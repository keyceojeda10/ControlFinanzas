/* Préstamos, tanda 4 de lo que encontró el agente de los videos
 * (DETALLES-PRESTAMOS.md, 17 oct 2026): la ficha, Gestión y lo demás. Con las
 * decisiones del dueño: «Si paga todo hoy» y «Anular el préstamo» (#15), el
 * interés vencido de una tabla se suma al renovar (#18) y un solo umbral de
 * mora, 1-7 vencido y más de 7 en mora (#21). Las cuentas, con casos de plata;
 * lo demás, anclado en el código. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { interesVencidoSinPagarTabla, minimoParaRenovar, calcularCapitalRestante } from '@/lib/calculos'
import { saldoTrasCadaPago, efectoDelPago } from '@/lib/dinero/saldo-tras-cada-pago'
import { vuelveACajaAlAnular } from '@/lib/dinero/revertir-renovacion'
import { sePagaDeUnaVez } from '@/lib/dinero/modos'
import { interesQueAhorraUnAbono } from '@/lib/dinero/abono-capital'

const leer = (f) => readFileSync(f, 'utf8')
const ficha = leer('app/(dashboard)/prestamos/[id]/page.jsx')
const DIA = 864e5
const fecha = (dias) => new Date(Date.now() + dias * DIA).toISOString()

describe('#18 · el interés vencido de una tabla pasa al renovar', () => {
  // Quincenal con tabla: 4 cuotas de $100.000 (80 capital + 20 interés).
  const conTabla = (pagado, fechas) => ({
    montoPrestado: 320000, totalAPagar: 400000, totalPagado: pagado, cuotaDiaria: 100000,
    diasPlazo: 60, frecuencia: 'quincenal', modoInteres: 'lineal',
    pagos: pagado ? [{ montoPagado: pagado, tipo: 'completo' }] : [],
    cuotasAmortizacion: fechas.map((f, i) => ({
      numeroPeriodo: i + 1, capital: 80000, interes: 20000, cuotaTotal: 100000,
      pagado: 0, interesPagado: 0, fechaEsperada: f,
    })),
  })

  it('solo las cuotas vencidas sin cubrir; la que no vence no cuenta', () => {
    // Dos vencidas, una cubierta por el pago: falta el interés de la segunda.
    const p = conTabla(100000, [fecha(-20), fecha(-5), fecha(10), fecha(25)])
    expect(interesVencidoSinPagarTabla(p)).toBe(20000)
    expect(minimoParaRenovar(p)).toBe(calcularCapitalRestante(p) + 20000)
  })

  it('de una cuota a medio pagar se cubre primero el interés', () => {
    const p = conTabla(115000, [fecha(-20), fecha(-5), fecha(10), fecha(25)])
    expect(interesVencidoSinPagarTabla(p)).toBe(5000)
  })

  it('al día no cambia nada, y sin fecha no se cuenta como vencida', () => {
    expect(interesVencidoSinPagarTabla(conTabla(100000, [fecha(-20), fecha(5), fecha(20), fecha(35)]))).toBe(0)
    expect(interesVencidoSinPagarTabla(conTabla(0, [undefined, undefined, undefined, undefined]))).toBe(0)
  })

  it('⚠ la ruta de renovar pide la fecha de cada cuota (sin ella liquidaba menos y salía plata)', () => {
    expect(leer('app/api/prestamos/[id]/renovar/route.js')).toMatch(/cuotasAmortizacion: \{ select: \{[^}]*fechaEsperada: true[^}]*\}/)
  })

  it('la ficha dice cuánto es interés, y la ruta lo apunta como interés arrastrado', () => {
    expect(leer('app/api/prestamos/[id]/route.js')).toMatch(/interesVencidoRenovacion: interesVencidoSinPagarTabla\(p\)/)
    expect(leer('components/prestamos/RenovarPrestamo.jsx')).toMatch(/'Capital e interés vencido'/)
  })
})

describe('#24 · «Quedó en» deshace cada movimiento como el servidor', () => {
  const base = {
    modoInteres: 'fijo', montoPrestado: 300000, tasaInteres: 20, diasPlazo: 30,
    fechaInicio: '2026-10-01T05:00:00.000Z', cuotaDiaria: 12000,
  }
  const pago = (dia, tipo, montoPagado) => ({ tipo, montoPagado, fechaPago: `2026-10-${dia}T15:00:00.000Z` })

  it('recargo y descuento mueven el total, no lo pagado', () => {
    // Prestó 360.000: −12.000, recargo +20.000, −12.000, descuento −5.000, −12.000.
    const p = { ...base, pagos: [pago('02', 'completo', 12000), pago('03', 'recargo', 20000), pago('04', 'completo', 12000), pago('05', 'descuento', 5000), pago('06', 'completo', 12000)] }
    const filas = saldoTrasCadaPago(p, 339000)
    expect(filas.map((f) => f.saldoDespues)).toEqual([339000, 356000, 348000])
  })

  it('el interés que sube la deuda no baja el saldo', () => {
    const p = { ...base, pagos: [pago('02', 'completo', 12000), pago('03', 'intereses', 6000)] }
    expect(saldoTrasCadaPago(p, 348000).map((f) => f.saldoDespues)).toEqual([348000, 348000])
  })

  it('el abono a capital lleva su ahorro de interés', () => {
    const abono = pago('11', 'capital', 100000)
    const ahorro = interesQueAhorraUnAbono({ monto: 100000, tasaInteres: 20, diasPlazo: 30, fechaInicio: base.fechaInicio, ahora: abono.fechaPago })
    const p = { ...base, pagos: [pago('02', 'completo', 12000), abono] }
    const [despuesDelAbono, despuesDelPrimero] = saldoTrasCadaPago(p, 200000).map((f) => f.saldoDespues)
    expect(despuesDelAbono).toBe(200000)
    expect(despuesDelPrimero).toBe(200000 + 100000 + ahorro)
  })

  it('lo que no se puede rehacer corta la cuenta: mejor sin cifra', () => {
    const conTabla = { ...base, modoInteres: 'lineal', cuotasAmortizacion: [{ numeroPeriodo: 1, cuotaTotal: 10, capital: 5, interes: 5, fechaEsperada: fecha(1) }], pagos: [pago('02', 'completo', 12000), pago('03', 'capital', 50000)] }
    expect(saldoTrasCadaPago(conTabla, 100000).map((f) => f.saldoDespues)).toEqual([100000, null])
    expect(saldoTrasCadaPago({ ...base, sinPlazo: true, modoInteres: 'solo_interes', pagos: [pago('02', 'intereses', 1000)] }, 5000)[0].saldoDespues).toBeNull()
    expect(ficha).toMatch(/saldo != null \? `quedó en \$\{formatMoney\(saldo\)\}` : null/)
  })
})

describe('#39 · sin señal, el recibo usa las reglas del servidor', () => {
  const fijo = { modoInteres: 'fijo', totalAPagar: 360000, totalPagado: 12000, tasaInteres: 20, diasPlazo: 30, fechaInicio: '2026-10-01T05:00:00.000Z' }
  it('«Solo interés» en Clásico no baja el saldo; una cuota sí', () => {
    expect(efectoDelPago(fijo, { tipo: 'intereses', monto: 6000 }).saldo).toBe(348000)
    expect(efectoDelPago(fijo, { tipo: 'completo', monto: 12000 }).saldo).toBe(336000)
    expect(efectoDelPago(fijo, { tipo: 'recargo', monto: 10000 }).saldo).toBe(358000)
  })
  it('el aplazo viaja en la cola', () => {
    expect(leer('lib/offline.js')).toMatch(/\.\.\.\(pago\.aplazarUnPeriodo \? \{ aplazarUnPeriodo: true \} : \{\}\)/)
    expect(leer('components/prestamos/RegistrarPago.jsx')).toMatch(/\.\.\.\(puedeAplazar && aplazar \? \{ aplazarUnPeriodo: true \} : \{\}\),\n\s+\/\/ La cuenta y el cliente/)
  })
})

describe('#16 · anular dice lo que hace el servidor', () => {
  it('lo que salió menos lo cobrado, con tope en el saldo', () => {
    // Renovación: debía 360.000, se entregaron 140.000, cobró 50.000.
    expect(vuelveACajaAlAnular({ salio: 140000, cobrado: 50000, saldoPendiente: 450000 })).toBe(90000)
    // Cobró más de lo que se entregó: no vuelve nada.
    expect(vuelveACajaAlAnular({ salio: 140000, cobrado: 200000, saldoPendiente: 300000 })).toBe(0)
    // Con seguro salió el monto menos el seguro.
    expect(vuelveACajaAlAnular({ salio: 290000, cobrado: 0, saldoPendiente: 360000 })).toBe(290000)
  })
  it('el servidor y la ficha usan la misma cuenta, y se avisa la renovación revivida', () => {
    const api = leer('app/api/prestamos/[id]/route.js')
    expect(api).toMatch(/saldoNoRecuperado = vuelveACajaAlAnular\(\{ salio, cobrado: totalPagosReales, saldoPendiente: saldoPendienteRestante \}\)/)
    expect(api).toMatch(/await queHaceAnular\(prisma, p, saldoPendiente\)/)
    expect(ficha).toMatch(/`El préstamo anterior vuelve con su saldo de \$\{formatMoney\(prestamo\.alAnular\.anterior\.saldo\)\}`/)
  })
})

describe('#23 · «Cuota única» es un pago solo si la cuota es el total', () => {
  it('casi siempre va en cuotas', () => {
    expect(sePagaDeUnaVez({ modoInteres: 'unico', cuotaDiaria: 12000, totalAPagar: 360000 })).toBe(false)
    expect(sePagaDeUnaVez({ modoInteres: 'unico', cuotaDiaria: 360000, totalAPagar: 360000 })).toBe(true)
    expect(sePagaDeUnaVez({ modoInteres: 'fijo', cuotaDiaria: 360000, totalAPagar: 360000 })).toBe(false)
    expect(ficha).toMatch(/const esUnicoModo = sePagaDeUnaVez\(prestamo\)/)
  })
})

describe('#15 #22 #27 #28 · nombres, pendientes, pagaré y la flecha', () => {
  it('pagar todo no es anular', () => {
    expect(leer('components/pantallas/FichaPrestamo.jsx')).toMatch(/rotulo="Si paga todo hoy"/)
    expect(ficha).toMatch(/id: 'cancelar', nombre: 'Anular el préstamo'/)
    expect(leer('lib/acciones/prestamo.js')).toMatch(/cancelar: \['anular', 'anular el prestamo'/)
  })
  it('un préstamo sin aprobar dice «Por aprobar»', () => {
    expect(leer('components/prestamos/PrestamoDetalleViews.jsx')).toMatch(/prestamo\?\.estado === 'pendiente_aprobacion' \? 'Por aprobar' :/)
  })
  it('el pagaré se encuentra en el buscador', () => {
    expect(ficha).toMatch(/\{ id: 'prestamo-pagare', label: EXTRAS_PRESTAMO\[3\]\.label/)
    expect(ficha).toMatch(/<div id="cf-firma-pagare"/)
  })
  it('la flecha al menú solo tras una acción que la tiene', () => {
    expect((ficha.match(/sinVolver: true/g) || []).length).toBe(4)
  })
})

describe('#19 · cambiar el modo no entrega plata', () => {
  it('ni la pantalla deja escribir el total ni el servidor lo acepta', () => {
    expect(leer('components/prestamos/RenovarPrestamo.jsx')).toMatch(/onTotal=\{soloModo \? undefined : /)
    expect(leer('components/pantallas/Renovar.jsx')).toMatch(/readOnly=\{!onTotal\}/)
    expect(leer('app/api/prestamos/[id]/renovar/route.js')).toMatch(/if \(body\.soloCambioDeModo === true && diferenciaBruta > 0\) \{/)
  })
})

describe('#25 · «Siguiente» solo viniendo de la ruta', () => {
  it('el recorrido se lee solo con fromRuta', () => {
    expect(ficha).toMatch(/if \(new URLSearchParams\(window\.location\.search\)\.get\('fromRuta'\) !== '1'\) return/)
    expect(leer('public/sw.js')).toMatch(/caches\.match\(request, \{ ignoreSearch: true \}\)/)
  })
})

describe('#35 #36 #37 #40 #41 · lo demás', () => {
  it('el reintento del duplicado registra el mismo cobro', () => {
    expect(leer('app/(dashboard)/rutas/[id]/page.jsx')).toMatch(/ejecutarPagoRapido\(metodoPago, \{ confirmarDuplicado: true, metodoPagoId, destino: objetivo \}\)/)
    expect(leer('app/(dashboard)/cobros-hoy/page.jsx')).toMatch(/montoCustom: d\.montoCustom, destino: \{ id: d\.clienteId/)
  })
  it('deshacer dice si el servidor no lo dejó', () => {
    for (const f of ['app/(dashboard)/cobros-hoy/page.jsx', 'app/(dashboard)/rutas/[id]/page.jsx']) {
      expect(leer(f)).toMatch(/alert\(`No se deshizo: el cobro sigue registrado\./)
    }
  })
  it('la fecha de un pago: ni futura ni cruzando una caja cerrada', () => {
    const api = leer('app/api/pagos/[id]/route.js')
    expect(api).toMatch(/if \(diaNuevo > getLocalDateStr\(pais\)\) \{/)
    expect(api).toMatch(/if \(cierre && !cierre\.reabiertoEn\) \{/)
  })
  it('el escáner de la app va por /qr como la cámara', () => {
    expect(leer('components/armazon/Armazon.jsx')).toMatch(/router\.push\(`\/qr\/\$\{clienteId\}`\)/)
  })
  it('Lucas busca el nombre entero, dice lo guardado y guarda la cuenta', () => {
    const lucas = leer('app/api/asistente/accion/route.js')
    expect(lucas).not.toMatch(/split\(' '\)\[0\]/)
    expect(lucas).toMatch(/nombre: \{ contains: nombre \}/)
    expect(lucas).toMatch(/\.\.\.\(cuenta \? \{ metodoPagoId: cuenta\.id \} : \{\}\)/)
    expect(lucas).toMatch(/Pago de \$\$\{Math\.round\(montoGuardado\)/)
  })
})
