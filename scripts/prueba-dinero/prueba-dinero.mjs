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
import { libroNuevo, anotar, comparar, preverPrestamo, preverRenovacion, fajoEsperado } from './libro.mjs'
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
  const ctx = { prestamos: {}, gastoId: null, cuentaId: IDS.cuenta }

  for (const paso of pasos) {
    const pag = pags[paso.actor]
    // La marca de tiempo hace que los movimientos del informe sean EXACTAMENTE
    // los de este paso, sin depender de descripciones.
    const desde = new Date()
    await new Promise((r) => setTimeout(r, 60))

    let peticion = null
    let respuesta = null

    if (!paso.soloLeer) {
      const hecho = await ejecutarPaso({ paso, pag, ctx, libro, m, fecha, banderas, cx })
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
    // ── LA COMPROBACIÓN QUE DE VERDAD IMPORTA ────────────────────────────
    // No que la caja cuadre consigo misma —eso lo hacía ya— sino que cuadre
    // con la cuenta que hace el cobrador con los billetes en la mano.
    const fallosDelFajo = comprobarElFajo(libro, vistas)
    if (fallosDelFajo.length) {
      console.log(pintarElFajo(libro, vistas, fallosDelFajo))
      return { descuadre: { paso, motivo: 'el fajo no cuadra a mano' } }
    }

    if (paso.id === 'P10') console.log(pintarLasTresVistas(vistas).join('\n'))
  }

  return { descuadre: null }
}

// ── ¿CUADRA EL FAJO? ────────────────────────────────────────────────────────
//
// La cuenta del cobrador con los billetes en la mano. Se comprueban las CINCO
// líneas de su pantalla una por una, no solo la suma: el 27 de julio dos
// errores que se anulaban dejaron el total bien y cada línea falsa.
function comprobarElFajo(libro, vistas) {
  const c = vistas.C
  if (!c?.cuenta) return []

  const linea = (id) => c.cuenta.find((l) => l.id === id)?.monto ?? null
  const fallos = []
  const revisar = (id, rotulo, esperado, porQue) => {
    const obtenido = linea(id)
    if (obtenido == null) return
    if (Math.round(obtenido) !== Math.round(esperado)) {
      fallos.push({ id, rotulo, esperado: Math.round(esperado), obtenido: Math.round(obtenido), porQue })
    }
  }

  revisar('recaudoEfectivo', 'Cobró en efectivo', libro.recogidaEfectivo,
    'solo los cobros que le entraron en billetes')
  revisar('recaudoDigital', 'Cobró por transferencia', libro.recogidaDigital,
    'los que entraron a la cuenta de la oficina')
  revisar('desembolsos', 'Prestó en efectivo', libro.desembolsadoEfectivo,
    'solo lo que salió de SU fajo; lo de transferencia no lo entregó él')
  revisar('gastos', 'Gastó', libro.gastos, 'lo que pagó de su bolsillo')
  revisar('aLaCuenta', 'Entró a la cuenta de la oficina', libro.recogidaDigital,
    'el contrapeso de lo digital: nunca estuvo en su bolsillo')

  // Y la suma, que es lo que él compara contra los billetes que tiene.
  const esperadaSuma = fajoEsperado(libro)
  if (c.cuentaSuma != null && Math.round(c.cuentaSuma) !== Math.round(esperadaSuma)) {
    fallos.push({
      id: 'SUMA', rotulo: 'Le queda en el fajo',
      esperado: Math.round(esperadaSuma), obtenido: Math.round(c.cuentaSuma),
      porQue: 'cobró en efectivo − prestó en efectivo − gastos',
    })
  }

  // La tarjeta «lo que prestó hoy» dice cuánto salió de su mano: tiene que
  // decir lo MISMO que la línea «Prestó en efectivo».
  const efectivoTarjeta = c.prestadoDetalle?.efectivoTotal
  if (efectivoTarjeta != null && Math.round(efectivoTarjeta) !== Math.round(libro.desembolsadoEfectivo)) {
    fallos.push({
      id: 'TARJETA', rotulo: '«Lo que prestó hoy» · efectivo',
      esperado: Math.round(libro.desembolsadoEfectivo), obtenido: Math.round(efectivoTarjeta),
      porQue: 'la tarjeta dice «lo que de verdad salió de su mano», y debe coincidir con la línea de arriba',
    })
  }

  return fallos
}

function pintarElFajo(libro, vistas, fallos) {
  const L = ['', '═'.repeat(72),
    'EL FAJO DEL COBRADOR NO CUADRA A MANO',
    '═'.repeat(72), '',
    'La caja puede cuadrar consigo misma y aun así pedirle al cobrador un fajo',
    'que no tiene. Esto compara con la cuenta de los billetes en la mano:', '',
    '  lo que cobró EN EFECTIVO − lo que prestó EN EFECTIVO − gastos', '',
    '                                    DEBERÍA      DICE       DIFERENCIA']
  for (const f of fallos) {
    L.push(`  ${f.rotulo.padEnd(32)}${String(pesos(f.esperado)).padStart(10)}${String(pesos(f.obtenido)).padStart(11)}${String(pesos(f.obtenido - f.esperado)).padStart(14)}`)
    L.push(`    └ ${f.porQue}`)
  }
  L.push('')
  L.push('LA CUENTA QUE SALE EN SU PANTALLA:')
  for (const l of vistas.C?.cuenta ?? []) {
    L.push(`  ${String(l.signo === 1 ? '+' : l.signo === -1 ? '−' : ' ').padStart(2)} ${String(l.rotulo).padEnd(34)}${String(pesos(l.monto)).padStart(11)}`)
  }
  L.push(`     ${'suma'.padEnd(34)}${String(pesos(vistas.C?.cuentaSuma)).padStart(11)}`)
  L.push('')
  return L.join('\n')
}

// ── CADA TIPO DE OPERACIÓN ──────────────────────────────────────────────────
async function ejecutarPaso({ paso, pag, ctx, libro, m, fecha, banderas, cx }) {
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
      // A QUÉ cuenta. Sin esto el desembolso cae en un cajón genérico
      // «Transferencia», separado del renglón de la cuenta real: el dueño
      // vería dos filas de lo mismo. Es el fallo que ya documentaba
      // `caja-cobrado-total.test.js` para los cobros.
      ...(paso.metodoPago === 'transferencia' && { metodoPagoId: ctx.cuentaId }),
    }
    const r = await llamar(pag, 'POST', '/api/prestamos', cuerpo)
    if (!r.ok) return { abortar: `${r.estado} ${JSON.stringify(r.datos)}`, peticion: { metodo: 'POST', ruta: '/api/prestamos', cuerpo }, respuesta: r }

    const id = r.datos?.prestamo?.id ?? r.datos?.id
    // El que se va a anular no se guarda: nadie lo va a renovar ni cobrar, y
    // guardarlo como 'B' machacaría el préstamo bueno del paso 2.
    if (!paso.seAnula) {
      ctx.prestamos[paso.cliente === 0 ? 'A' : 'B'] = { id, ...previsto, monto: paso.monto }
    }

    // ⚠ Un préstamo por TRANSFERENCIA no sale del fajo del cobrador. Sale del
    // negocio (y por eso baja el capital), pero él no entregó billetes.
    const salioDelFajo = paso.metodoPago !== 'transferencia'
    /* Si el paso pide anularlo, se anula acto seguido y NO se anota nada: un
       préstamo cancelado no sacó plata de la caja. Es el caso de JULIAN #7, que
       creó y anuló tres y su pantalla los seguía contando. */
    if (paso.seAnula) {
      /* ⚠ SE PONE EL ESTADO, NO SE BORRA LA FILA.
         El `DELETE` del API borra el registro entero, y entonces no queda nada
         que contar. Lo que le pasó a JULIAN #7 es distinto: sus préstamos
         quedaron EN ESTADO `cancelado`, con su fila y su movimiento de capital
         intactos — y ahí es donde se colaban. Hay 418 así en el sistema, 36 de
         PRESTA MIL, así que es un estado real y frecuente.
         Se escribe por SQL porque hoy ningún endpoint lo pone. */
      await cx.execute("UPDATE Prestamo SET estado='cancelado' WHERE id=?", [id])
      /* ⚠ EL CAPITAL SÍ BAJÓ, Y ESTÁ BIEN.
         Al crear el préstamo salió el desembolso del ledger. Anularlo por SQL
         —como se hizo aquí— NO lo devuelve: el reverso lo genera el `DELETE`
         del API (`prestamos/[id]/route.js:1013`), que además borra la fila.
         Aquí se reproduce el estado `cancelado` con la fila viva, que es el
         caso de JULIAN #7 y el que se colaba.

         Lo que se comprueba es que «lo que prestó» del DÍA no lo cuente. Que
         el capital quede bajo es consecuencia de anularlo a mano, no un fallo. */
      anotar(libro, {
        paso: paso.id, delta: { capital: -paso.monto },
        porQue: 'anulado por fuera del API: la caja del día no lo cuenta, el capital no se revierte',
      })
      return { peticion: { metodo: 'POST', ruta: '/api/prestamos', cuerpo }, respuesta: r }
    }

    anotar(libro, {
      paso: paso.id,
      delta: {
        desembolsado: paso.monto,
        desembolsadoEfectivo: salioDelFajo ? paso.monto : 0,
        valorPrestado: paso.monto,
        capital: -paso.monto,
      },
      porQue: salioDelFajo
        ? 'prestar en efectivo saca billetes del fajo'
        : 'prestar por transferencia sale del negocio, NO del fajo del cobrador',
    })
    return { peticion: { metodo: 'POST', ruta: '/api/prestamos', cuerpo }, respuesta: r }
  }

  if (paso.tipo === 'cobro') {
    const pres = ctx.prestamos[paso.enPrestamo]
    const cuerpo = { montoPagado: paso.monto, tipo: paso.tipoPago }
    if (paso.metodoPago) cuerpo.metodoPago = paso.metodoPago
    // A QUÉ cuenta entró, no solo por qué vía: es lo que permite decir «Nequi»
    // en vez de «Transferencia» y saber dónde está la plata.
    if (paso.metodoPago === 'transferencia') cuerpo.metodoPagoId = ctx.cuentaId
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
      // Entregar la diferencia por transferencia: hasta hoy no se podía y todo
      // se contaba como salido del fajo del cobrador.
      ...(paso.porTransferencia && { metodoPago: 'transferencia', metodoPagoId: ctx.cuentaId }),
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
        // Si se entregó por transferencia, NO salió del fajo del cobrador.
        desembolsadoEfectivo: paso.porTransferencia ? 0 : previsto.entregada,
        valorPrestado: paso.monto,
        capital: -previsto.entregada,
      },
      porQue: paso.porTransferencia
        ? 'la diferencia salió por transferencia: del negocio sí, del fajo no'
        : 'al renovar sale de caja SOLO la diferencia; lo que debía se absorbe',
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
