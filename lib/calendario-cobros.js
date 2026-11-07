// lib/calendario-cobros.js — qué día le toca a quién, para el calendario de cobros.
//
// «Un calendario visual donde la gente pudiera ver qué día le toca a qué persona…
//  si le pica un día, le sale en orden los cobros que tiene ese día» — el dueño,
//  6 nov 2026. Y: «solo lo que viene, y para planes a partir de Básico puedan ver
//  lo anterior».
//
// ⚠ NO HAY CALENDARIO PROPIO AQUÍ. Cada fecha sale de `tocaCobrarEn`, la misma que
//   arma «Cobrar hoy», y HOY sale de `loDeHoyDelPrestamo`: si el calendario dijera
//   otra cifra para hoy que «Cobrar hoy», el cobrador ya no le cree a ninguno. Este
//   proyecto ya pagó tres veces por tener dos calendarios (ver [[fechas_un_solo_calendario]]).
//
// Lo que dice cada día:
//   · PASADO (Básico en adelante): quién pagó (los pagos reales, con su monto) y a
//     quién le tocaba y no pagó nada ese día.
//     ⚠ «No pagó» SOLO SI IBA ATRASADO ESE DÍA. Quien pagó tres cuotas juntas el 17
//     no le debía nada al calendario el 31: decirle «no pagó» es acusarlo en falso.
//     Se compara lo pagado hasta ese día (todo, también lo de antes del mes y el
//     abono previo) contra las cuotas que ya habían llegado.
//   · HOY: lo mismo que «Cobrar hoy»: lo que toca y si ya se cobró.
//   · LO QUE VIENE: la cuota de cada fecha de su calendario, hasta que con esas
//     cuotas quedaría saldado (el plazo no es tope: se cobra hasta saldar).
//     ⚠ NUNCA ANTES DE SU PRÓXIMO COBRO. `tocaCobrarEn` es el calendario pelado y no
//     mira lo pagado: quien va adelantado salía con cobro el 14 teniendo el próximo
//     el 28. Y la fecha aplazada a mano sale en su día aunque no sea de calendario.

import { tocaCobrarEn, loDeHoyDelPrestamo, cuotaDelPeriodo, pagadoEnElDia } from '@/lib/dinero/esperado'
import { calcularSaldoPendiente, calcularProximoCobro } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'

const DIA_MS = 86400000
const OFFSET_BOGOTA = 5 * 3600000
/** El día en Bogotá de una fecha guardada, a cualquier hora. */
const diaBogota = (f) => diaIso(new Date(f).getTime() - OFFSET_BOGOTA)
export const MAX_NOMBRES = 3

export const diaIso = (f) => new Date(f).toISOString().slice(0, 10)
/** Medianoche de Bogotá de 'YYYY-MM-DD' (T05:00Z), el convenio del sistema. */
export const fechaDe = (iso) => new Date(`${iso}T05:00:00.000Z`)

/**
 * @param {object} a
 * @param {Array}  a.clientes   con `ruta`, `diasSinCobro` y `prestamos` vivos (pagos del cálculo
 *                              en `pagos`, los de hoy en `pagosHoy`), ya en orden de ruta
 * @param {Array}  a.pagosPasados  `{ clienteId, prestamoId, dia, monto, previo? }` de los días pasados del
 *                              rango; `previo` (abono previo) cubre cuotas pero no es cobro de ese día
 * @param {Map}    a.pagadoAntes  prestamoId → lo pagado antes de `desde`
 * @param {string} a.hoy        'YYYY-MM-DD' de hoy en Bogotá
 * @param {string} a.desde      primer día del rango
 * @param {string} a.hasta      último día del rango (incluido)
 * @param {boolean} a.conPasado si el plan deja ver los días pasados
 * @param {string|null} a.detalle  un día: de ese se devuelve la lista completa
 * @returns {Record<string, { n:number, total:number, cobrado:number, sinPagar:number, nombres:string[], items?:Array }>}
 */
export function armarCalendario({ clientes, pagosPasados = [], pagadoAntes = new Map(), org = null, festivos = [], hoy, desde, hasta, conPasado, detalle = null }) {
  const dias = {}
  const dia = (iso) => (dias[iso] ??= { n: 0, total: 0, cobrado: 0, sinPagar: 0, nCobrado: 0, nSinPagar: 0, nombres: [] })
  const poner = (iso, item) => {
    if (iso < desde || iso > hasta) return
    const d = dia(iso)
    d.n += 1
    d.total += item.monto
    if (item.estado === 'cobrado') { d.cobrado += item.monto; d.nCobrado += 1 }
    if (item.estado === 'sin_pagar') { d.sinPagar += item.monto; d.nSinPagar += 1 }
    if (d.nombres.length < MAX_NOMBRES && !d.nombres.includes(item.nombre)) d.nombres.push(item.nombre)
    if (detalle === iso) (d.items ??= []).push(item)
  }

  const fin = fechaDe(hasta).getTime()
  const manana = fechaDe(hoy).getTime() + DIA_MS

  // ── LO PASADO: los pagos de verdad, y a quién le tocaba y no pagó ──────────
  const pagadoPorDia = new Map() // `${prestamoId}|${dia}` → lo cobrado ese día
  const cubreElDia = new Map()   // lo mismo más el abono previo: lo que cubre cuotas
  if (conPasado) {
    for (const p of pagosPasados) {
      const k = `${p.prestamoId}|${p.dia}`
      cubreElDia.set(k, (cubreElDia.get(k) ?? 0) + p.monto)
      if (!p.previo) pagadoPorDia.set(k, (pagadoPorDia.get(k) ?? 0) + p.monto)
    }
  }

  for (const c of clientes) {
    const base = { clienteId: c.id, nombre: c.nombre, ruta: c.ruta?.nombre ?? null, rutaId: c.ruta?.id ?? null }
    for (const p of c.prestamos ?? []) {
      if (p.estado !== 'activo' || p.esClavo) continue
      const excl = obtenerDiasSinCobro(c, c.ruta, org, p)
      const it = (estado, monto) => ({ ...base, prestamoId: p.id, estado, monto: Math.round(monto) })

      if (conPasado && desde < hoy) {
        const cuota = cuotaDelPeriodo(p)
        const ultimo = Math.min(fechaDe(hoy).getTime() - DIA_MS, fin)
        let acumulado = pagadoAntes.get(p.id) ?? 0
        let llegaron = 0
        // Desde la entrega: las cuotas que ya llegaron se cuentan desde el principio.
        for (let t = fechaDe(diaBogota(p.fechaInicio)).getTime(); t <= ultimo; t += DIA_MS) {
          const iso = diaIso(t)
          if (iso >= desde) acumulado += cubreElDia.get(`${p.id}|${iso}`) ?? 0
          if (!tocaCobrarEn(p, new Date(t), excl, festivos)) continue
          llegaron += 1
          if (iso < desde) continue
          if ((pagadoPorDia.get(`${p.id}|${iso}`) ?? 0) > 0) continue // va con los pagos, abajo
          const falta = llegaron * cuota - acumulado
          if (falta > 0) poner(iso, it('sin_pagar', Math.min(cuota, falta)))
        }
      }

      // HOY: la cuenta de «Cobrar hoy», al peso.
      const pagadoHoy = pagadoEnElDia({ ...p, pagos: p.pagosHoy ?? [] }, fechaDe(hoy))
      const loDeHoy = loDeHoyDelPrestamo(p, { diasExcluidos: excl, festivos, pagadoHoy })
      if (loDeHoy.cuenta) poner(hoy, it(loDeHoy.falta > 0 ? 'pendiente' : 'cobrado', loDeHoy.toca))

      // LO QUE VIENE: cuota por fecha hasta que quedaría saldado.
      if (fin < manana) continue
      let restante = calcularSaldoPendiente(p) - (loDeHoy.falta || 0)
      const cuota = cuotaDelPeriodo(p)
      if (!(cuota > 0)) continue
      const proximo = calcularProximoCobro(p, excl, festivos)
      const diaProximo = proximo ? fechaDe(diaBogota(proximo)).getTime() : manana
      for (let t = Math.max(manana, diaProximo); t <= fin && restante > 0; t += DIA_MS) {
        if (t !== diaProximo && !tocaCobrarEn(p, new Date(t), excl, festivos)) continue
        const monto = Math.min(cuota, restante)
        restante -= monto
        poner(diaIso(t), it('programado', monto))
      }
    }
  }

  // Los pagos de días pasados, con el nombre de quien pagó (también de préstamos
  // que ya se terminaron: lo cobrado ese día es lo cobrado).
  if (conPasado) {
    const quien = new Map(clientes.map((c) => [c.id, c]))
    const porPrestamoDia = new Map()
    for (const p of pagosPasados) {
      if (p.dia >= hoy || p.previo) continue
      const k = `${p.prestamoId}|${p.dia}`
      const prev = porPrestamoDia.get(k)
      if (prev) prev.monto += p.monto
      else porPrestamoDia.set(k, { ...p })
    }
    for (const p of porPrestamoDia.values()) {
      const c = quien.get(p.clienteId)
      if (!c) continue
      poner(p.dia, { clienteId: c.id, nombre: c.nombre, ruta: c.ruta?.nombre ?? null, rutaId: c.ruta?.id ?? null, prestamoId: p.prestamoId, estado: 'cobrado', monto: Math.round(p.monto) })
    }
  }

  // El orden de la lista es el de la ruta: ruta por nombre y, dentro, como vienen
  // los clientes (ya ordenados por `ordenRuta`).
  if (detalle && dias[detalle]?.items) {
    const orden = new Map(clientes.map((c, i) => [c.id, i]))
    dias[detalle].items.sort((a, b) =>
      String(a.ruta ?? '￿').localeCompare(String(b.ruta ?? '￿'), 'es')
      || (orden.get(a.clienteId) ?? 0) - (orden.get(b.clienteId) ?? 0))
  }
  return dias
}
