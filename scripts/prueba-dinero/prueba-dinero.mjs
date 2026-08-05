// Un negocio de mentira, de cero, con la respuesta sabida de antemano.
//
// El dueño de PRESTA MIL: «Como todos los movimientos y valores los definiste
// tú mismo, ya sabes exactamente cuál debería ser el resultado final. Si la
// caja no cuadra, podrás identificar con precisión en qué operación aparece la
// diferencia, sin estar adivinando ni dependiendo de datos de usuarios reales.»
//
//   node --import ./scripts/alias-loader.mjs scripts/prueba-dinero/prueba-dinero.mjs
//   ... --modo=fijo        un solo modo
//   ... --limpiar          barre restos y sale
//   ... --conservar        no borra al final
//   ... --seguir           no para en el primer descuadre
//   ... --presta-mil       con las banderas que tiene PRESTA MIL
//
// ⚠ VIVE EN `scripts/` Y NO EN `.auditoria/` A PROPÓSITO: esa carpeta está en
// el .gitignore (es de capturas desechables) y esta prueba tiene que sobrevivir
// a la sesión que la escribió.
//
// Requiere DOS túneles SSH abiertos:
//   ssh -N -L 3005:localhost:3005 root@69.62.87.141   (la aplicación)
//   ssh -N -L 3307:127.0.0.1:3306 root@69.62.87.141   (la base)

import { conectar, montar, limpiar, diaColombiano, minutosParaElCambioDeDia, IDS } from './montar.mjs'
import { abrirActores, llamar, cobrar, leerLasTresVistas } from './api.mjs'
import { libroNuevo, anotar, comparar, preverPrestamo, preverRenovacion } from './libro.mjs'
import { construirPasos, MODOS, MONTOS } from './pasos.mjs'
import { pintarDescuadre, pintarLasTresVistas, pintarPasoOk } from './informe.mjs'

const args = process.argv.slice(2)
const opcion = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1]
const bandera = (n) => args.includes(`--${n}`)

const SOLO_MODO = opcion('modo')
const CONSERVAR = bandera('conservar')
const SEGUIR = bandera('seguir')
const PRESTA_MIL = bandera('presta-mil')

const pesos = (n) => Math.round(n ?? 0).toLocaleString('es-CO')

async function main() {
  const cx = await conectar()

  if (bandera('limpiar')) {
    console.log('Barriendo restos de pruebas anteriores…')
    await limpiar(cx)
    await cx.end()
    return
  }

  // ⚠ La prueba entera tiene que caber en un día colombiano: los pagos no se
  // pueden fechar (`pagos/route.js:359` escribe `new Date()`). Si el día cambia
  // a mitad, las operaciones caen en uno y la lectura en otro.
  const fecha = diaColombiano()
  const margen = minutosParaElCambioDeDia()
  console.log(`\nDía colombiano: ${fecha}   (faltan ${margen} min para que cambie)`)
  if (margen < 25) {
    console.log('ABORTA: quedan menos de 25 minutos de día. La prueba cruzaría la medianoche')
    console.log('        colombiana y leería la caja de otro día. Vuelve a intentarlo luego.')
    await cx.end()
    process.exit(1)
  }

  const banderas = PRESTA_MIL
    ? { capitalEsEfectivo: true, renovacionesEnCobrado: true }
    : {}
  console.log(`Configuración: ${PRESTA_MIL ? 'la de PRESTA MIL (capitalEsEfectivo + renovacionesEnCobrado)' : 'la de por defecto'}`)

  const modos = SOLO_MODO ? [SOLO_MODO] : Object.keys(MODOS)
  console.log(`Modos a probar: ${modos.join(', ')}\n`)

  const resultados = []
  let huboDescuadre = false

  for (const modo of modos) {
    if (!MODOS[modo]) { console.log(`  (modo desconocido: ${modo})`); continue }
    console.log('─'.repeat(72))
    console.log(`MODO ${modo.toUpperCase()} — ${MODOS[modo].etiqueta}`)
    console.log('─'.repeat(72))

    await montar(cx, banderas)
    const { nav, owner, cobrador } = await abrirActores()
    const pags = { owner, cobrador }

    try {
      const r = await correrFlujo({ cx, pags, modo, fecha, banderas })
      resultados.push({ modo, ...r })
      if (r.descuadre) {
        huboDescuadre = true
        if (!SEGUIR) { await nav.close(); break }
      }
    } finally {
      await nav.close()
    }
  }

  console.log('\n' + '═'.repeat(72))
  console.log('RESUMEN')
  console.log('═'.repeat(72))
  for (const r of resultados) {
    console.log(`  ${r.modo.padEnd(14)} ${r.descuadre ? '✗ descuadre en ' + r.descuadre.paso.id : '✓ cuadra al peso'}`)
  }

  if (huboDescuadre || CONSERVAR) {
    console.log(`\n  La organización de prueba SE CONSERVA: ${IDS.org}`)
    console.log('  Bórrala con  --limpiar')
  } else {
    await limpiar(cx, { silencioso: true })
    console.log('\n  Espejo limpio: no quedan filas de la prueba.')
  }

  await cx.end()
  process.exit(huboDescuadre ? 1 : 0)
}

// ── EL FLUJO DE UN MODO ─────────────────────────────────────────────────────
async function correrFlujo({ cx, pags, modo, fecha, banderas }) {
  const m = MODOS[modo]
  const pasos = construirPasos(modo)
  const libro = libroNuevo()
  const ctx = { prestamos: {}, gastoId: null }

  for (const paso of pasos) {
    const pag = pags[paso.actor]
    // La marca de tiempo hace que los movimientos del informe sean EXACTAMENTE
    // los de este paso, sin depender de descripciones.
    const desde = new Date()
    await new Promise((r) => setTimeout(r, 60))

    let peticion = null
    let respuesta = null

    if (!paso.soloLeer) {
      const hecho = await ejecutarPaso({ paso, pag, ctx, libro, m, fecha, banderas })
      peticion = hecho.peticion
      respuesta = hecho.respuesta
      if (hecho.abortar) {
        console.log(`\n  ✗ ${paso.id} no se pudo ejecutar: ${hecho.abortar}`)
        return { descuadre: { paso, motivo: hecho.abortar } }
      }
    }

    const vistas = await leerLasTresVistas(pags.owner, IDS.cobrador, fecha)
    const comparacion = comparar(libro, vistas.global)

    if (paso.esperaTodoEnCero) {
      const noCero = comparacion.filas.filter((f) => f.obtenido !== 0)
      if (noCero.length) {
        console.log(`\n  ✗ ${paso.id}: la caja NO arranca en cero -> ${noCero.map((f) => `${f.nombre}=${pesos(f.obtenido)}`).join(', ')}`)
        console.log('    La organización no está limpia; cualquier descuadre posterior sería basura arrastrada.')
        return { descuadre: { paso, motivo: 'la caja no arrancaba en cero' } }
      }
    }

    if (comparacion.descuadres.length) {
      const [movs, pagosDelPaso] = await Promise.all([
        cx.execute(
          `SELECT tipo, monto, saldoAnterior, saldoNuevo, descripcion FROM MovimientoCapital
            WHERE organizationId=? AND createdAt >= ? ORDER BY createdAt`, [IDS.org, desde]),
        cx.execute(
          `SELECT p.tipo, p.montoPagado, p.metodoPago FROM Pago p
            JOIN Prestamo pr ON pr.id = p.prestamoId
            WHERE pr.organizationId=? AND p.fechaPago >= ? ORDER BY p.fechaPago`, [IDS.org, desde]),
      ])
      console.log(pintarDescuadre({
        paso, modo, comparacion, peticion, respuesta,
        movimientos: movs[0], pagos: pagosDelPaso[0], vistas, organizationId: IDS.org,
      }))
      return { descuadre: { paso, comparacion } }
    }

    console.log(pintarPasoOk(paso, comparacion))
    if (paso.id === 'P10') console.log(pintarLasTresVistas(vistas).join('\n'))
  }

  return { descuadre: null }
}

// ── CADA TIPO DE OPERACIÓN ──────────────────────────────────────────────────
async function ejecutarPaso({ paso, pag, ctx, libro, m, fecha, banderas }) {
  if (paso.tipo === 'prestamo') {
    const previsto = preverPrestamo({
      monto: paso.monto, tasa: paso.tasa, dias: paso.dias,
      frecuencia: paso.frecuencia, modoInteres: paso.modoInteres, fechaInicio: fecha,
    })
    const cuerpo = {
      clienteId: IDS.cliente(paso.cliente + 1),
      montoPrestado: paso.monto, tasaInteres: paso.tasa, diasPlazo: paso.dias,
      fechaInicio: fecha, frecuencia: paso.frecuencia, modoInteres: paso.modoInteres,
      metodoPago: paso.metodoPago,
    }
    const r = await llamar(pag, 'POST', '/api/prestamos', cuerpo)
    if (!r.ok) return { abortar: `${r.estado} ${JSON.stringify(r.datos)}`, peticion: { metodo: 'POST', ruta: '/api/prestamos', cuerpo }, respuesta: r }

    const id = r.datos?.prestamo?.id ?? r.datos?.id
    ctx.prestamos[paso.cliente === 0 ? 'A' : 'B'] = { id, ...previsto, monto: paso.monto }

    anotar(libro, {
      paso: paso.id,
      delta: { desembolsado: paso.monto, valorPrestado: paso.monto, capital: -paso.monto },
      porQue: 'prestar saca efectivo de la caja por el monto entregado',
    })
    return { peticion: { metodo: 'POST', ruta: '/api/prestamos', cuerpo }, respuesta: r }
  }

  if (paso.tipo === 'cobro') {
    const pres = ctx.prestamos[paso.enPrestamo]
    const cuerpo = { montoPagado: paso.monto, tipo: paso.tipoPago }
    if (paso.metodoPago) cuerpo.metodoPago = paso.metodoPago
    if (paso.nota) cuerpo.nota = paso.nota

    const r = await cobrar(pag, pres.id, cuerpo)
    const ruta = `/api/prestamos/${pres.id}/pagos?confirmarDuplicado=1`
    if (!r.ok) return { abortar: `${r.estado} ${JSON.stringify(r.datos)}`, peticion: { metodo: 'POST', ruta, cuerpo }, respuesta: r }

    // ⚠ SE ANOTA LO QUE EL SERVIDOR DIJO, NO LO QUE SE PIDIÓ.
    // `pagos/route.js:243` hace `Math.min(monto, saldoActual)` en silencio: si
    // el cobro rozara el saldo, anotar lo pedido daría un descuadre INVENTADO.
    const real = r.datos?.pago?.montoPagado ?? r.datos?.montoPagado ?? paso.monto
    if (Math.round(real) !== Math.round(paso.monto)) {
      console.log(`      (el servidor recortó el cobro: pedí ${pesos(paso.monto)}, registró ${pesos(real)})`)
    }

    if (paso.tipoPago === 'recargo' || paso.tipoPago === 'descuento') {
      // No tocan la caja: suben o bajan la deuda del cliente y punto.
      anotar(libro, { paso: paso.id, delta: {}, porQue: 'el recargo sube la deuda, no entra plata' })
    } else {
      // `caja/route.js:635`: solo 'transferencia' cuenta como digital. Todo lo
      // demás —incluido null y un método inválido— cuenta como efectivo.
      const esDigital = paso.metodoPago === 'transferencia'
      anotar(libro, {
        paso: paso.id,
        delta: esDigital
          ? { recogidaDigital: real, capital: real }
          : { recogidaEfectivo: real, capital: real },
        porQue: esDigital ? 'entra por transferencia' : 'entra como efectivo',
      })
    }
    return { peticion: { metodo: 'POST', ruta, cuerpo }, respuesta: r }
  }

  if (paso.tipo === 'gasto') {
    const cuerpo = { description: 'gasto de la prueba de flujo', monto: paso.monto, fecha, cobradorId: IDS.cobrador }
    const r = await llamar(pag, 'POST', '/api/gastos', cuerpo)
    if (!r.ok) return { abortar: `${r.estado} ${JSON.stringify(r.datos)}`, peticion: { metodo: 'POST', ruta: '/api/gastos', cuerpo }, respuesta: r }
    ctx.gastoId = r.datos?.gasto?.id ?? r.datos?.id

    // ⚠ NACE PENDIENTE: no toca capital todavía. Pero la caja global SÍ lo
    // cuenta (`caja/route.js:646` incluye 'pendiente'), así que sí entra en
    // `gastos`. Lo que no cambia es el capital.
    anotar(libro, {
      paso: paso.id, delta: { gastos: paso.monto },
      porQue: 'la caja del día cuenta los gastos pendientes; el capital no se mueve hasta aprobar',
    })
    return { peticion: { metodo: 'POST', ruta: '/api/gastos', cuerpo }, respuesta: r }
  }

  if (paso.tipo === 'aprobarGasto') {
    const ruta = `/api/gastos/${ctx.gastoId}`
    const cuerpo = { estado: 'aprobado' }
    const r = await llamar(pag, 'PATCH', ruta, cuerpo)
    if (!r.ok) return { abortar: `${r.estado} ${JSON.stringify(r.datos)}`, peticion: { metodo: 'PATCH', ruta, cuerpo }, respuesta: r }
    // Ahora sí sale del capital. `gastos` no cambia: ya estaba contado.
    anotar(libro, { paso: paso.id, delta: { capital: -MONTOS.gasto }, porQue: 'aprobar el gasto lo saca del capital' })
    return { peticion: { metodo: 'PATCH', ruta, cuerpo }, respuesta: r }
  }

  if (paso.tipo === 'renovacion') {
    const pres = ctx.prestamos[paso.enPrestamo]
    // Se lee el préstamo COMO ESTÁ AHORA (con el recargo y los cobros dentro)
    // para poder prever qué se absorbe.
    const antes = await llamar(pag, 'GET', `/api/prestamos/${pres.id}`)
    const p = antes.datos?.prestamo ?? antes.datos
    const previsto = preverRenovacion({ montoNuevo: paso.monto, prestamoViejo: p })

    const cuerpo = {
      montoPrestado: paso.monto, tasaInteres: paso.tasa, diasPlazo: paso.dias,
      fechaInicio: fecha, frecuencia: paso.frecuencia, modoInteres: paso.modoInteres,
    }
    const ruta = `/api/prestamos/${pres.id}/renovar`
    const r = await llamar(pag, 'POST', ruta, cuerpo)
    if (!r.ok) return { abortar: `${r.estado} ${JSON.stringify(r.datos)}`, peticion: { metodo: 'POST', ruta, cuerpo }, respuesta: r }

    paso.esperadoDetalle = {
      absorbido: previsto.absorbido,
      'dif. exacta': previsto.exacta,
      'dif. entregada': previsto.entregada,
      'saldoPendiente': previsto.saldoPendiente,
      'capitalRestante': previsto.capitalRestante,
      'con tabla': previsto.conTabla,
    }

    // Aquí las dos cifras SE SEPARAN, y es el corazón de la prueba:
    // de la caja sale la diferencia, pero la cartulina vale el monto entero.
    anotar(libro, {
      paso: paso.id,
      delta: {
        desembolsado: previsto.entregada,
        valorPrestado: paso.monto,
        capital: -previsto.entregada,
      },
      porQue: 'al renovar sale de caja SOLO la diferencia; lo que debía se absorbe',
    })
    return { peticion: { metodo: 'POST', ruta, cuerpo }, respuesta: r }
  }

  return { abortar: `tipo de paso desconocido: ${paso.tipo}` }
}

main().catch((e) => {
  console.error('\nLA PRUEBA MURIÓ:', e.message)
  console.error(`  La organización de prueba se conserva: ${IDS.org}`)
  console.error('  Bórrala con  --limpiar')
  process.exit(2)
})
