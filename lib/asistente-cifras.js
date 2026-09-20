/* LAS CIFRAS QUE LUCAS DICE, CON LAS REGLAS DE LAS PANTALLAS.
 *
 * Lucas llevaba su propia aritmética y por eso decía otra cosa que el Inicio.
 * Medido en el espejo el 20 sep 2026, en 8 negocios:
 *
 *   · «Meta diaria esperada» era la SUMA de todas las cuotas de la cartera, sin
 *     mirar a quién le toca hoy. Un domingo le dijo $65.588.500 a un negocio al
 *     que ese día le tocaba cobrar $0; en los demás iba de 4 a 120 veces lo que
 *     enseña el Inicio. Es el mismo fallo —sumar todas las cuotas— que ya se
 *     había arreglado en el resto del sistema.
 *   · La mora difería en 3 de 8: su `select` no pedía el día de cobro, ni la
 *     tabla, ni los devengos, ni `sinPlazo`. Un campo que no se pide no da
 *     error: llega `undefined` y `calcularDiasMora` decide mal en silencio.
 *   · «Intereses ya cobrados» era `pagado − prestado`: capital primero. Con
 *     $1.000.000 prestados al 20 % y $600.000 cobrados, Lucas decía que no se
 *     había ganado NADA; el resto del sistema dice $100.000.
 *   · Contaba los clavos; el Inicio no.
 *
 * Aquí no hay ninguna fórmula: cada cifra sale de la MISMA función que usa la
 * pantalla que el prestamista tiene al lado. Es puro (no toca la base) para que
 * se pueda probar. */
import {
  calcularDiasMora,
  calcularSaldoPendiente,
  calcularCapitalRestante,
  tienePeriodoEsperadoHoy,
} from '@/lib/calculos'
import { obtenerDiasSinCobro, esHoySinCobro, esHoyFestivo } from '@/lib/dias-sin-cobro'
import { interesCobradoDelPrestamo, interesCobradoDeLosPrestamos } from '@/lib/dinero/interes-cobrado'

/* Lo que leen `calcularDiasMora`, `tienePeriodoEsperadoHoy`, `calcularCapitalRestante`
 * e `interesPagoAPago`. Los pagos van ENTEROS y en orden: el interés de cada uno
 * depende de cuánto se llevaba pagado antes. Es lo que Lucas ya traía —dos
 * veces, en dos consultas—; ahora es una. */
export const SELECT_PRESTAMO_DE_LUCAS = {
  id: true,
  clienteId: true,
  estado: true,
  montoPrestado: true,
  totalAPagar: true,
  totalPagado: true,
  abonadoCapital: true,
  cuotaDiaria: true,
  fechaInicio: true,
  diasPlazo: true,
  frecuencia: true,
  ultimoPagoAt: true,
  modoInteres: true,
  sinPlazo: true,
  proximoCobroManual: true,
  diaCobroSemana: true,
  diaCobroMes: true,
  diaCobroMes2: true,
  primerCobro: true,
  diasSinCobro: true,
  devengos: { select: { periodo: true, interes: true } },
  cuotasAmortizacion: {
    orderBy: { numeroPeriodo: 'asc' },
    select: { numeroPeriodo: true, cuotaTotal: true, capital: true, interes: true, pagado: true, interesPagado: true, fechaEsperada: true },
  },
  pagos: {
    where: { tipo: { notIn: ['recargo', 'descuento'] } },
    orderBy: { fechaPago: 'asc' },
    select: { montoPagado: true, fechaPago: true, tipo: true },
  },
}

/* A cuántos se nombra. El contexto viaja en cada mensaje: una lista de 300
   clientes es plata tirada y el modelo se pierde en ella. */
const TOPE_FALTAN = 12
const TOPE_MORA = 5

/**
 * @param {object}   e
 * @param {Array}    e.prestamos   activos, con SELECT_PRESTAMO_DE_LUCAS + `cliente`
 * @param {object}   e.org         { diasSinCobro }
 * @param {Array}    e.festivos
 * @param {Array}    [e.pagosDeHoy] [{ montoPagado, cobradorId, cobrador: { nombre }, prestamo: { clienteId } }]
 * @param {number}   [e.topeMora]
 */
export function cifrasDeLaCartera({ prestamos = [], org = null, festivos = [], pagosDeHoy = [], topeMora = TOPE_MORA }) {
  const clientesActivos = new Set()
  const clientesMora = new Set()
  const tocaHoy = new Map() // clienteId → { nombre, cuota }
  const enMora = new Map() // clienteId → el más atrasado de los suyos
  let carteraActiva = 0
  let saldoPorCobrar = 0
  let capitalEnCalle = 0
  let esperadoHoy = 0
  let interesesPorCobrar = 0

  for (const p of prestamos) {
    clientesActivos.add(p.clienteId)
    carteraActiva += p.totalAPagar ?? 0
    const saldo = calcularSaldoPendiente(p)
    saldoPorCobrar += saldo
    capitalEnCalle += calcularCapitalRestante(p) ?? p.montoPrestado ?? 0

    // La herencia de los días sin cobro, entera: préstamo → cliente → ruta → negocio.
    const dias = obtenerDiasSinCobro(p.cliente, p.cliente?.ruta, org, p)

    const diasMora = calcularDiasMora(p, dias, festivos)
    if (diasMora > 0) {
      clientesMora.add(p.clienteId)
      /* POR CLIENTE, no por préstamo: con tres préstamos atrasados la misma
         persona ocupaba tres de los cinco renglones de «mora urgente» y el
         modelo hablaba de «tus cinco morosos» siendo tres. Manda el préstamo
         más atrasado; el saldo es la suma de los que están en mora. */
      const m = enMora.get(p.clienteId) ?? {
        nombre: p.cliente?.nombre ?? 'Cliente',
        diasMora: 0,
        saldo: 0,
        prestamosEnMora: 0,
        cobradorNombre: p.cliente?.ruta?.cobrador?.nombre || null,
        rutaNombre: p.cliente?.ruta?.nombre || null,
        notas: p.cliente?.notas || null,
      }
      m.diasMora = Math.max(m.diasMora, diasMora)
      m.saldo += saldo
      m.prestamosEnMora += 1
      enMora.set(p.clienteId, m)
    }

    // «Hoy toca»: la regla del Inicio, de Rutas y de Cobros de hoy. No otra.
    const cerradoHoy = esHoySinCobro(dias) || esHoyFestivo(festivos)
    if (tienePeriodoEsperadoHoy(p, cerradoHoy, dias, festivos)) {
      esperadoHoy += p.cuotaDiaria ?? 0
      const v = tocaHoy.get(p.clienteId) ?? { nombre: p.cliente?.nombre ?? 'Cliente', cuota: 0 }
      v.cuota += p.cuotaDiaria ?? 0
      tocaHoy.set(p.clienteId, v)
    }

    // Lo que falta por ganar de este préstamo. En un abierto no hay interés
    // pactado de antemano —se va devengando—, así que no promete nada.
    const interesPactado = Math.max(0, (p.totalAPagar ?? 0) - (p.montoPrestado ?? 0))
    const yaCobrado = interesCobradoDelPrestamo({ prestamo: p, cuotas: p.cuotasAmortizacion ?? null, pagos: p.pagos ?? [] })
    if (!p.sinPlazo) interesesPorCobrar += Math.max(0, interesPactado - yaCobrado)
  }

  // Lo de hoy: quién pagó y quién lo cobró.
  const pagaronHoy = new Set()
  const porCobrador = new Map()
  let cobroHoy = 0
  for (const g of pagosDeHoy) {
    const monto = g.montoPagado ?? 0
    cobroHoy += monto
    if (g.prestamo?.clienteId) pagaronHoy.add(g.prestamo.clienteId)
    const clave = g.cobradorId ?? '—'
    const c = porCobrador.get(clave) ?? { nombre: g.cobrador?.nombre ?? 'Sin cobrador', monto: 0, cobros: 0 }
    c.monto += monto
    c.cobros += 1
    porCobrador.set(clave, c)
  }

  const faltan = [...tocaHoy.entries()]
    .filter(([clienteId]) => !pagaronHoy.has(clienteId))
    .map(([, v]) => v)
    .sort((a, b) => b.cuota - a.cuota)

  return {
    clientesActivos: clientesActivos.size,
    clientesMora: clientesMora.size,
    pctMora: clientesActivos.size > 0 ? Math.round((clientesMora.size / clientesActivos.size) * 100) : 0,
    carteraActiva,
    saldoPorCobrar,
    capitalEnCalle: Math.round(capitalEnCalle),
    esperadoHoy: Math.round(esperadoHoy),
    clientesConCobroHoy: tocaHoy.size,
    clientesCobradosHoy: [...tocaHoy.keys()].filter((id) => pagaronHoy.has(id)).length,
    faltanHoy: { cuantos: faltan.length, monto: Math.round(faltan.reduce((n, f) => n + f.cuota, 0)), lista: faltan.slice(0, TOPE_FALTAN) },
    cobroHoy,
    cobrosHoyCount: pagosDeHoy.length,
    cobradoPorCobrador: [...porCobrador.values()].sort((a, b) => b.monto - a.monto),
    moraUrgente: [...enMora.values()].sort((a, b) => b.diasMora - a.diasMora).slice(0, topeMora),
    interesesYaCobrados: interesCobradoDeLosPrestamos(prestamos),
    interesesPorCobrar: Math.round(interesesPorCobrar),
  }
}

/* LOS SIETE DÍAS, CON SU NOMBRE DE VERDAD.
 *
 * El prompt los rotulaba con una lista fija —'Lun','Mar',…,'Sab','Hoy'— sobre
 * una ventana que RUEDA: solo acertaba los domingos. Un miércoles le decía al
 * modelo que lo cobrado el jueves pasado era «del lunes». */
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
export function rotulosDeLosSieteDias(hoyLocal) {
  const base = Date.UTC(hoyLocal.getUTCFullYear(), hoyLocal.getUTCMonth(), hoyLocal.getUTCDate())
  return Array.from({ length: 7 }, (_, i) => {
    if (i === 6) return 'hoy'
    if (i === 5) return 'ayer'
    return DIAS[new Date(base - (6 - i) * 86_400_000).getUTCDay()]
  })
}
