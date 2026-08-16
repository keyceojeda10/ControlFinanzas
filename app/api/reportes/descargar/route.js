/* ══ UN SOLO SITIO QUE BAJA LOS DOCE INFORMES ════════════════════════════════
 *
 * Pedido por el dueño el 16 ago 2026: «lo puede descargar tanto en PDF como
 * Excel… que la gente sepa qué es lo que va a descargar».
 *
 * ── POR QUÉ UNO Y NO VEINTICUATRO ───────────────────────────────────────────
 *
 * Doce informes por dos formatos son veinticuatro sitios donde escribir la
 * misma tabla. Esta app ya sabe cómo acaba eso: la ganancia del mes decía una
 * cosa en la pantalla y otra en su PDF porque eran dos consultas distintas, y
 * llevo la semana entera arreglando parejas así.
 *
 * Aquí hay UN camino:
 *
 *     el API del informe  →  vistaDe()  →  PDF   (lib/papel/documento.js)
 *                                       →  Excel (xlsx)
 *
 * Y la PANTALLA usa el mismo `vistaDe()` sobre el mismo API. Así que lo que se
 * baja no se parece a lo que se ve: es lo mismo, pintado en otro papel.
 *
 * ⚠ NO SE CONSULTA LA BASE AQUÍ. Los datos se piden llamando al `GET` del API
 *   del propio informe —el mismo que alimenta la pantalla—, no repitiendo su
 *   consulta. Repetirla es exactamente cómo nacen las dos cifras distintas.
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buscarInforme } from '@/lib/reportes/catalogo'
import { exigeNivelReportes } from '@/lib/plan-servidor'
import { vistaDe } from '@/lib/reportes/vistas'
import { abrirDocumento, respuestaPdf } from '@/lib/papel/documento'
import { formatMoney, formatFechaCorta } from '@/lib/i18n'
import * as XLSX from 'xlsx'

/* Los handlers de cada informe. Se importan y se llaman: son funciones
   `(Request) => Response` normales, y leen la sesión del contexto de la
   petición, que es la misma. */
import { GET as verIngresos } from '@/app/api/reportes/ingresos/route'
import { GET as verCartera } from '@/app/api/reportes/cartera/route'
import { GET as verCobrosMes } from '@/app/api/reportes/cobros-mes/route'
import { GET as verDia } from '@/app/api/reportes/dia/route'
import { GET as verContador } from '@/app/api/reportes/contador/route'
import { GET as verCuentas } from '@/app/api/reportes/cuentas/route'
import { GET as verResumen } from '@/app/api/reportes/resumen/route'
import { GET as verCobradores } from '@/app/api/reportes/cobradores/route'
import { GET as verSeguros } from '@/app/api/reportes/seguros/route'

const HANDLERS = {
  entro: verIngresos,
  calle: verCartera,
  'cobros-mes': verCobrosMes,
  dia: verDia,
  contador: verContador,
  cuentas: verCuentas,
  resumen: verResumen,
  cobradores: verCobradores,
  seguros: verSeguros,
}

/** Los parámetros de filtro que se pasan tal cual al API del informe. */
const FILTROS = ['periodo', 'desde', 'hasta', 'fecha', 'rutas', 'mes', 'anio', 'orden', 'soloMora']

function urlDelInforme(informe, entrada) {
  /* ⚠ `entrada` YA es un `URL`, y `URL` no tiene `.url` — tiene `.origin` y
     `.href`. Con `entrada.url` la base salía `undefined` y `new URL()` reventaba
     con «Invalid URL» en los DIEZ informes. Compilaba y las pruebas pasaban: solo
     se vio pidiendo las descargas contra el espejo. */
  const base = new URL(informe.ver, entrada.origin)
  for (const k of FILTROS) {
    const v = entrada.searchParams.get(k)
    if (v != null && v !== '') base.searchParams.set(k, v)
  }
  return base
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const entrada = new URL(request.url)
  const informe = buscarInforme(entrada.searchParams.get('informe'))
  if (!informe) return Response.json({ error: 'Ese informe no existe' }, { status: 404 })

  const formato = entrada.searchParams.get('formato') === 'excel' ? 'excel' : 'pdf'

  /* El plan se comprueba AQUÍ además de en la pantalla: un enlace se puede
     escribir a mano, y el índice enseña a propósito los que no alcanza.
     `exigeNivelReportes` y no `informeBloqueado(nivel)`: el plan del JWT no se
     refresca sin volver a entrar, y quien acaba de pagar seguiría sin poder. */
  const veto = await exigeNivelReportes(session, informe.nivel)
  if (veto) return veto

  const handler = HANDLERS[informe.id]
  if (!handler) {
    /* `listado-cobros` y `crudo` bajan por su propia ruta y no pasan por aquí:
       son papeles ya hechos, no tablas. La pantalla enlaza directo a `bajar`. */
    return Response.json({ error: 'Este informe se baja por su propia ruta' }, { status: 400 })
  }

  const respuesta = await handler(new Request(urlDelInforme(informe, entrada)))
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => ({}))
    return Response.json({ error: detalle.error ?? 'No se pudo armar el informe' }, { status: respuesta.status })
  }
  const crudo = await respuesta.json()
  const vista = vistaDe(informe.id, crudo)

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { nombre: true },
  })
  const negocio = org?.nombre || 'Mi negocio'
  const pais = session.user.country ?? 'co'
  const rotuloPeriodo = entrada.searchParams.get('periodo') || informe.periodos?.[0] || ''

  return formato === 'excel'
    ? aExcel({ informe, vista, negocio, rotuloPeriodo })
    : aPdf({ informe, vista, negocio, pais, rotuloPeriodo })
}

/* ── EL PDF ──────────────────────────────────────────────────────────────── */
function aPdf({ informe, vista, negocio, pais, rotuloPeriodo }) {
  const dinero = (n) => formatMoney(Math.round(Number(n) || 0), pais)
  const doc = abrirDocumento({ pie: `Control Finanzas · ${negocio}` })

  let y = doc.cabecera({
    negocio,
    titulo: informe.titulo,
    // Lo que el informe PROMETE, impreso en la hoja. Así el papel que llega al
    // contador dice por sí solo qué es, sin que nadie tenga que explicarlo.
    subtitulo: informe.contesta,
    meta: rotuloPeriodo,
  })

  if (vista.cifras.length) {
    y = doc.tarjetasResumen(
      vista.cifras.slice(0, 4).map((c) => ({
        rotulo: c.etiqueta,
        valor: c.tipo === 'dinero' ? dinero(c.valor) : String(c.valor ?? ''),
        tono: c.tono ?? 'neutro',
      })),
      y,
    )
  }

  if (vista.tabla.filas.length) {
    y = doc.seccion('El detalle', y)
    y = doc.tabla({
      columnas: vista.tabla.columnas.map((c) => ({
        clave: c.clave, rotulo: c.rotulo, ancho: c.ancho,
        alinear: c.alinear === 'der' ? 'right' : 'left',
      })),
      filas: vista.tabla.filas.map((f) => {
        const salida = {}
        for (const c of vista.tabla.columnas) salida[c.clave] = celda(f[c.clave], c.tipo, { dinero, pais })
        return salida
      }),
    }, y)
  } else {
    y = doc.nota('No hubo movimiento en el periodo elegido.', y)
  }

  if (vista.nota) y = doc.nota(vista.nota, y)

  return doc.cerrar().then((buffer) =>
    respuestaPdf(buffer, `${informe.id}-${rotuloPeriodo || 'informe'}.pdf`),
  )
}

/* ── EL EXCEL ────────────────────────────────────────────────────────────── */
function aExcel({ informe, vista, negocio, rotuloPeriodo }) {
  const libro = XLSX.utils.book_new()

  /* ⚠ EL DINERO VA COMO NÚMERO, NO COMO TEXTO. Con «$1.500.000» dentro de la
     celda, Excel no suma la columna — y sumar es justo para lo que se baja un
     Excel. Se manda el número y se le pone formato de moneda, que enseña lo
     mismo que el PDF y además se deja sumar. */
  const FORMATO_DINERO = '"$"#,##0'

  const cabecera = vista.tabla.columnas.map((c) => c.rotulo)
  const cuerpo = vista.tabla.filas.map((f) =>
    vista.tabla.columnas.map((c) => {
      const v = f[c.clave]
      if (c.tipo === 'dinero' || c.tipo === 'numero') return Number(v) || 0
      if (c.tipo === 'pct') return Number(v) || 0
      return v == null ? '' : String(v)
    }),
  )

  // Las cifras de arriba van también, encima de la tabla: es lo que se lee
  // primero en la pantalla y sería raro que el archivo no las trajera.
  const encabezado = [
    [negocio],
    [informe.titulo],
    [informe.contesta],
    rotuloPeriodo ? [`Periodo: ${rotuloPeriodo}`] : [],
    [],
    ...vista.cifras.map((c) => [c.etiqueta, Number(c.valor) || 0]),
    [],
  ]

  const hoja = XLSX.utils.aoa_to_sheet([...encabezado, cabecera, ...cuerpo])

  // Formato de moneda a las columnas que lo son, y a las cifras de arriba.
  const filaCabecera = encabezado.length
  for (let i = 0; i < vista.cifras.length; i++) {
    if (vista.cifras[i].tipo !== 'dinero') continue
    const ref = XLSX.utils.encode_cell({ r: 5 + i, c: 1 })
    if (hoja[ref]) hoja[ref].z = FORMATO_DINERO
  }
  vista.tabla.columnas.forEach((c, ci) => {
    if (c.tipo !== 'dinero') return
    for (let r = 0; r < cuerpo.length; r++) {
      const ref = XLSX.utils.encode_cell({ r: filaCabecera + 1 + r, c: ci })
      if (hoja[ref]) hoja[ref].z = FORMATO_DINERO
    }
  })

  // Ancho de columna, para que no salga «####» en las de dinero.
  hoja['!cols'] = vista.tabla.columnas.map((c) => ({ wch: c.tipo === 'texto' ? 26 : 14 }))

  XLSX.utils.book_append_sheet(libro, hoja, informe.titulo.slice(0, 28))
  const buffer = XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' })

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${informe.id}-${rotuloPeriodo || 'informe'}.xlsx"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'no-store',
    },
  })
}

function celda(valor, tipo, { dinero, pais }) {
  if (valor == null || valor === '') return '—'
  if (tipo === 'dinero') return dinero(valor)
  if (tipo === 'pct') return `${valor}%`
  if (tipo === 'numero') return String(valor)
  if (tipo === 'fecha') {
    const d = new Date(String(valor).length === 10 ? `${valor}T12:00:00-05:00` : valor)
    return isNaN(d) ? String(valor) : formatFechaCorta(d, pais)
  }
  return String(valor)
}

export const dynamic = 'force-dynamic'
