import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { formatMoney }      from '@/lib/i18n'
import { calcularSaldoPendiente, calcularDiasMora } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { abrirDocumento, respuestaPdf } from '@/lib/papel/documento'
import { COLOR } from '@/lib/papel/tokens'
import { rotulo } from '@/lib/dinero/definiciones'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return Response.json({ error: 'Solo el administrador' }, { status: 403 })

  /* ⚠ AQUI NO HAY BARRERA DE PLAN, Y ES A PROPOSITO.
   *
   * Todos los demas reportes se cerraron a Basico el 8 ago 2026. Este NO: es la
   * hoja con la que el cobrador sale a la calle, no un reporte de gestion.
   * Quitarsela a los 322 negocios en plan Inicial seria quitarles la
   * herramienta de trabajo del dia, no una funcion de mas.
   *
   * Decision del dueño, no un olvido: si alguien viene a «arreglar» esto,
   * hay una prueba que lo tiene fijado (lib/__tests__/barreras-de-plan). */

  const orgId = session.user.organizationId
  const country = session.user.country ?? 'co'
  const { searchParams } = new URL(req.url)
  const rutaId = searchParams.get('rutaId')
  const soloMora = searchParams.get('soloMora') === '1'
  const orden = searchParams.get('orden') || 'nombre'

  const fmt = (v) => formatMoney(v, country)

  const { org, festivos, rutas } = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { nombre: true, diasSinCobro: true },
    }),
    prisma.festivo.findMany({
      where: { organizationId: orgId },
      select: { fecha: true },
    }),
    prisma.ruta.findMany({
      where: {
        organizationId: orgId,
        activo: true,
        ...(rutaId ? { id: rutaId } : {}),
      },
      select: {
        id: true,
        nombre: true,
        diasSinCobro: true,
        clientes: {
          where: {
            estado: { notIn: ['eliminado', 'inactivo'] },
            prestamos: { some: { estado: 'activo', esClavo: false } },
          },
          select: {
            id: true,
            nombre: true,
            cedula: true,
            telefono: true,
            direccion: true,
            diasSinCobro: true,
            prestamos: {
              where: { estado: 'activo', esClavo: false },
              select: {
                estado: true,
                montoPrestado: true,
                totalAPagar: true,
                cuotaDiaria: true,
                frecuencia: true,
                fechaInicio: true,
                diasPlazo: true,
                modoInteres: true,
                proximoCobroManual: true,
                /* ⚠ SIN ESTO UN PRÉSTAMO ABIERTO SALE «AL DÍA» SIEMPRE: su mora es el
                   interés devengado sin pagar, y un campo que no se pide vale `undefined`
                   —no da error, decide en silencio—. Ver lib/dinero/devengar.js. */
                devengos: { select: { periodo: true, interes: true } },
                cuotasAmortizacion: { select: { numeroPeriodo: true, cuotaTotal: true, capital: true, pagado: true, fechaEsperada: true } },
                pagos: { select: { montoPagado: true, tipo: true } },
              },
            },
          },
          orderBy: { nombre: 'asc' },
        },
      },
      orderBy: { nombre: 'asc' },
    }),
  ]).then(async ([org, festivos, rutas]) => {
    /* ══ ⚠ LOS CLIENTES SIN RUTA TAMBIEN COBRAN ═══════════════════════════
     *
     * Este reporte recorria RUTAS y, dentro, los clientes de cada ruta. Quien
     * no habia creado ninguna ruta se bajaba un PDF VACIO: el bucle no entraba
     * nunca. Y no fallaba — generaba el documento con «0 clientes», que es
     * peor, porque parece una respuesta.
     *
     * Medido en produccion el 8 ago 2026, al reportarlo un cliente (Crediya:
     * 0 rutas, 31 clientes, 35 prestamos activos, PDF vacio):
     *
     *   · 160 de 223 negocios con prestamos activos NO tienen ninguna ruta
     *   · 2.904 de 5.395 prestamos activos no salian en el papel
     *
     * O sea el 72 % de los negocios y el 54 % de la cartera. No era el caso
     * raro de uno: era la mayoria.
     *
     * Los sueltos se agrupan bajo «Sin ruta». Solo se piden cuando NO se ha
     * filtrado por una ruta concreta: si el usuario eligio una, quiere esa. */
    const sinRuta = rutaId ? [] : await prisma.cliente.findMany({
      where: {
        organizationId: orgId,
        OR: [{ rutaId: null }, { ruta: { activo: false } }],
        estado: { notIn: ['eliminado', 'inactivo'] },
        prestamos: { some: { estado: 'activo', esClavo: false } },
      },
      select: {
        id: true,
        nombre: true,
        cedula: true,
        telefono: true,
        direccion: true,
        diasSinCobro: true,
        prestamos: {
          where: { estado: 'activo', esClavo: false },
          select: {
            estado: true,
            montoPrestado: true,
            totalAPagar: true,
            cuotaDiaria: true,
            frecuencia: true,
            fechaInicio: true,
            diasPlazo: true,
            modoInteres: true,
            proximoCobroManual: true,
            cuotasAmortizacion: { select: { numeroPeriodo: true, cuotaTotal: true, capital: true, pagado: true, fechaEsperada: true } },
            pagos: { select: { montoPagado: true, tipo: true } },
          },
        },
      },
      orderBy: { nombre: 'asc' },
    })

    /* Va al final y se comporta como una ruta mas, para que el resto del
       codigo —el bucle, los totales, el PDF— no tenga que saber que existe.
       `diasSinCobro: null` hace que herede los de la organizacion, que es lo
       correcto: un cliente sin ruta no tiene dias propios de ruta. */
    /* El nombre viejo hablaba de grupos y no tenia NADA que ver con los
       cobro que se retiraron: son las rutas mas el cajon de «Sin ruta». */
    const rutasYSinRuta = sinRuta.length
      ? [...rutas, { id: null, nombre: 'Sin ruta', diasSinCobro: null, clientes: sinRuta }]
      : rutas

    return { org, festivos, rutas: rutasYSinRuta }
  })

  const festArr = festivos.map(f => new Date(f.fecha).toISOString().slice(0, 10))

  let filas = []
  let totalCuotas = 0
  let totalSaldos = 0
  let clientesConMora = 0

  for (const ruta of rutas) {
    for (const cliente of ruta.clientes) {
      // La firma es obtenerDiasSinCobro(cliente, ruta, org, prestamo). Antes se
      // llamaba con el STRING JSON de la organizacion como primer argumento, o
      // sea en el lugar de `cliente`: adentro hacia '[0]'.diasSinCobro ->
      // undefined, y ruta/org llegaban undefined, asi que SIEMPRE devolvia [].
      // Resultado: si el negocio no cobra domingos, el papel contaba los
      // domingos como mora y los dias de atraso no coincidian con la app.
      const diasExcluidos = obtenerDiasSinCobro(cliente, ruta, org)

      for (const p of cliente.prestamos) {
        const saldo = calcularSaldoPendiente(p)
        const mora = calcularDiasMora(p, diasExcluidos, festArr)
        const pagado = p.totalAPagar - saldo
        const avance = p.totalAPagar > 0 ? Math.round((pagado / p.totalAPagar) * 100) : 0

        if (soloMora && mora <= 0) continue

        totalCuotas += p.cuotaDiaria
        totalSaldos += saldo
        if (mora > 0) clientesConMora++

        filas.push({
          ruta: ruta.nombre,
          nombre: cliente.nombre,
          direccion: cliente.direccion || '',
          telefono: cliente.telefono || '',
          cuota: p.cuotaDiaria,
          frecuencia: p.frecuencia,
          saldo,
          mora,
          avance,
        })
      }
    }
  }

  if (orden === 'mora') filas.sort((a, b) => b.mora - a.mora)
  else if (orden === 'saldo') filas.sort((a, b) => b.saldo - a.saldo)

  // ── SOLO LA CUENTA ───────────────────────────────────────
  // T33-02 enseña «van a salir 18 clientes · $16,2M» ANTES de pulsar bajar,
  // porque hasta ahora se bajaba el PDF para ver que traia y, si no era eso,
  // otra vez. La cuenta sale de AQUI —el mismo filtrado, el mismo bucle— y no
  // de una consulta aparte: dos caminos distintos acaban dando dos numeros
  // distintos, y entonces el aviso miente sobre lo que se va a bajar.
  if (searchParams.get('solo') === 'cuenta') {
    return Response.json({
      clientes: filas.length,
      saldo: totalSaldos,
    })
  }

  /* ══ EL PAPEL ═════════════════════════════════════════════════════════
   *
   * Todo el dibujo lo pone `lib/papel/documento`. Aqui abajo solo se decide
   * QUE va en la hoja; el COMO —fuentes de la marca, tabla que no se corta,
   * pie que no abre hojas de mas— es del kit y sale igual en los cuatro
   * documentos del sistema.
   *
   * Antes este archivo declaraba su propia paleta (`#16a34a`, `#dc2626`:
   * colores por defecto de Tailwind) y dibujaba con Helvetica. Por eso no se
   * parecia ni a la app ni a los otros reportes. */
  const doc = abrirDocumento({ pie: `Control Finanzas · ${org?.nombre ?? 'Mi negocio'}` })

  const hoy = new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })

  let y = doc.cabecera({
    negocio: org?.nombre,
    titulo: 'Quién me debe',
    subtitulo: hoy,
    meta: `${filas.length} clientes · ${soloMora ? 'Solo en mora' : 'Todos'}`,
  })

  y = doc.tarjetasResumen([
    { rotulo: 'Cuota del periodo', valor: fmt(totalCuotas) },
    { rotulo: 'Saldo pendiente', valor: fmt(totalSaldos) },
    { rotulo: rotulo('clientesEnMora'), valor: `${clientesConMora} de ${filas.length}`,
      tono: clientesConMora > 0 ? 'malo' : 'bueno' },
  ], y)

  const sufijo = (f) => f === 'semanal' ? '/sem' : f === 'quincenal' ? '/qna' : f === 'mensual' ? '/mes' : '/día'

  /* ⚠ `identidad: true` = NO SE RECORTA. Nombre, direccion y telefono bajan de
     renglon antes que perder una letra: el cobrador va a esa casa con este
     papel, y «Cra 50 # 50-100 barrio La» no es una direccion. */
  const columnas = [
    // 0,5 dejaba «100» partido en «10 / 0» a partir del cliente numero cien.
    { clave: 'num', titulo: '#', ancho: 0.8 },
    // La direccion va DEBAJO del nombre, no en columna aparte: en columna
    // propia se partia en dos o tres renglones y el listado de 984 prestamos
    // salia en 86 hojas. Debajo tiene el doble de ancho y entra en una.
    { clave: 'nombre', titulo: 'Cliente y dirección', ancho: 4.6, identidad: true, sub: 'direccion' },
    { clave: 'telefono', titulo: 'Teléfono', ancho: 1.5, identidad: true },
    // 1,5 dejaba «$150.000/sem» en dos renglones dentro de la celda.
    { clave: 'cuota', titulo: 'Cuota', ancho: 1.9, fuente: 'cifra' },
    { clave: 'saldo', titulo: 'Debe', ancho: 1.6, fuente: 'cifra' },
    { clave: 'mora', titulo: 'Mora', ancho: 1.3, alinear: 'center' },
  ]

  const aFila = (f, i) => ({
    num: String(i + 1),
    nombre: f.nombre,
    direccion: f.direccion || '',
    telefono: f.telefono || '—',
    cuota: fmt(f.cuota) + sufijo(f.frecuencia),
    saldo: fmt(f.saldo),
    mora: f.mora > 0 ? `${f.mora} d` : 'Al día',
    moraPastilla: f.mora > 0
      ? { fondo: COLOR.redTint, color: COLOR.red }
      : { fondo: COLOR.greenTint, color: COLOR.green },
  })

  /* ⚠ QUIEN NO TIENE RUTAS NO VE RUTAS. Un negocio que nunca creo ninguna se
     bajaba —cuando se bajaba algo— una hoja encabezada por «Sin ruta», que le
     dice que le falta algo que el no usa. Si no hay ni una ruta, es una lista
     limpia de clientes: el mismo dato con la cara que le corresponde. */
  const hayRutas = rutas.some((r) => r.id !== null)

  if (!hayRutas) {
    y = doc.tabla({ columnas, filas: filas.map(aFila) }, y)
  } else {
    const porRuta = new Map()
    for (const f of filas) {
      if (!porRuta.has(f.ruta)) porRuta.set(f.ruta, [])
      porRuta.get(f.ruta).push(f)
    }
    const grupos = [...porRuta].map(([nombre, lista]) => ({
      titulo: nombre,
      // El subtotal va en el TITULO, no en una fila al pie: se lee antes de
      // recorrer la tabla, que es cuando sirve.
      nota: `${lista.length} clientes · ${fmt(lista.reduce((a, c) => a + c.saldo, 0))}`,
      filas: lista.map(aFila),
    }))
    y = doc.tabla({ columnas, grupos }, y)

    if (porRuta.has('Sin ruta')) {
      y = doc.nota(
        'Los clientes «Sin ruta» tienen préstamo activo pero todavía no están asignados a un recorrido. Aparecen al final para que no se queden sin cobrar.',
        y, { tono: 'acento' },
      )
    }
  }

  if (!filas.length) {
    doc.nota(
      soloMora
        ? 'No hay ningún cliente en mora ahora mismo.'
        : 'No hay préstamos activos. En cuanto prestes, este listado sale con los clientes que tienes que visitar.',
      y,
    )
  }

  const buffer = await doc.cerrar()
  const fechaFile = new Date().toISOString().slice(0, 10)
  return respuestaPdf(buffer, `quien-me-debe-${fechaFile}.pdf`)
}
