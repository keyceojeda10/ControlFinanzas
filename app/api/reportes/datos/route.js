/* ══ LOS VOLCADOS, COMO INFORMES ═════════════════════════════════════════════
 *
 * Pedido por el dueño el 16 ago 2026:
 *
 *   «Los reportes de bajar hay que unificarlos en los nuevos reportes que
 *    hicimos, lo mismo: cada reporte con su pantalla individual, con sus
 *    filtros y con sus dos formatos para bajar, PDF y Excel. Porque si no,
 *    tendríamos reportes por todos lados, y la idea era unificar todos.»
 *
 * `/reportes/bajar` era lo último que se salía del sistema: cinco Excel que se
 * bajaban a ciegas, sin poder mirarlos antes ni pedirlos en PDF.
 *
 * ── POR QUÉ NO CONSULTA NADA ────────────────────────────────────────────────
 *
 * Devuelve las MISMAS filas que escribe el libro de «la cuenta completa»,
 * llamando al mismo constructor. No repite ni una consulta ni un cálculo: la
 * hoja de Excel y esta pantalla salen del mismo sitio, así que no pueden
 * discrepar. Repetir la consulta es exactamente cómo nacieron las dos cifras
 * distintas de la ganancia, del desembolsado y del próximo cobro.
 *
 * ⚠ Su coste es el de armar la cuenta entera aunque se pida una sola tabla. Se
 *   asume a propósito: la alternativa es una segunda consulta por tipo, y eso
 *   es la puerta a que «Clientes» diga una cosa aquí y otra en el Excel. Ya se
 *   midió que lo caro no era el SQL sino la hidratación anidada, y eso ya está
 *   resuelto en `cuenta-completa.js` con tres consultas planas.
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { exigeNivelReportes } from '@/lib/plan-servidor'
import { construirCuentaCompleta } from '@/lib/reportes/cuenta-completa'
import { COLUMNAS_CRUDAS } from '@/lib/reportes/columnas-crudas'

const TIPOS = ['cartera', 'clientes', 'pagos', 'cobradores']

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return Response.json({ error: 'Solo el administrador' }, { status: 403 })

  /* Mismo nivel que tenían en `/reportes/bajar`: quien podía bajarlos sigue
     pudiendo. Subirlo aquí sería quitarle algo a quien ya lo tenía. */
  const veto = await exigeNivelReportes(session, 1)
  if (veto) return veto

  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get('tipo') ?? 'cartera'
  if (!TIPOS.includes(tipo)) {
    return Response.json({ error: `No conozco el volcado «${tipo}»` }, { status: 400 })
  }

  const hoy = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10)
  const desde = searchParams.get('desde') ?? `${hoy.slice(0, 8)}01`
  const hasta = searchParams.get('hasta') ?? hoy
  // Rango en hora de Colombia. Sin esto, `new Date(desde)` lo lee como UTC y
  // arrastra los pagos del día anterior.
  const fechaDesde = new Date(`${desde}T00:00:00-05:00`)
  const fechaHasta = new Date(`${hasta}T23:59:59.999-05:00`)

  try {
    const { datos } = await construirCuentaCompleta(session.user.organizationId, {
      desde, hasta, fechaDesde, fechaHasta,
    })
    const filas = datos[tipo] ?? []
    return Response.json({
      tipo,
      columnas: COLUMNAS_CRUDAS[tipo],
      filas,
      total: filas.length,
      // Solo «pagos» se filtra por fechas; los demás son la foto de hoy. La
      // pantalla lo dice, para que nadie crea que filtró algo que no filtró.
      periodo: tipo === 'pagos' ? { desde, hasta } : null,
    })
  } catch (e) {
    console.error('[GET /api/reportes/datos]', e)
    return Response.json({ error: 'No se pudo armar el volcado' }, { status: 500 })
  }
}
