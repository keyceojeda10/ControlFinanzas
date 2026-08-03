// lib/adaptadores/caja-por-ruta.js — T08-02 «Caja · por ruta».
//
// ── LA PANTALLA QUE FALTABA ────────────────────────────────────────────────
//
// El pie de la lámina: «La pestaña que faltaba. Cada ruta con lo recaudado
// partido en efectivo y digital —la barra lleva los dos tramos— más lo esperado
// y lo prestado en la calle. Sin el medio de pago de la pantalla 01 esta vista
// no puede existir: hoy todo sería efectivo.»
//
// Lo que había era un `<select>` de cobrador y media pantalla en blanco hasta
// que elegías uno. El dueño: «sigue saliendo como la versión anterior, y eso
// está bastante feo».
//
// ── POR QUÉ SEPARAR EFECTIVO DE DIGITAL ────────────────────────────────────
//
// Es la pregunta que se hace al cerrar el día: de lo que cobró esta ruta,
// ¿cuánto tiene el cobrador EN LA MANO y cuánto entró por Nequi? El cobrador
// solo entrega el efectivo; lo digital ya está. Sin la partición, el dueño le
// pide una cifra que incluye plata que nunca tocó.
//
// El dato existe desde que el pago guarda `metodoPago` (T08-01). Antes de eso
// todo habría salido como efectivo, que es lo que dice el pie de la lámina.

import { formatMoney } from '@/lib/i18n'

/** Un pago cuenta como digital si no entró en efectivo. */
function esDigital(pago) {
  return pago?.metodoPago === 'transferencia'
}

/**
 * Agrupa los pagos del día por RUTA.
 *
 * @param pagos    los de `cajaData.pagosDia` (traen `rutaId`, `rutaNombre`,
 *                 `metodoPago` y `cobradorNombre`)
 * @param rutas    las de `/api/rutas`, para el esperado y los cobros del día
 * @param pais     para `formatMoney`
 *
 * Devuelve una fila por ruta CON MOVIMIENTO, más —si la hay— la fila de los
 * pagos sin ruta. Una ruta sin cobros hoy no sale: la pregunta de esta pestaña
 * es «cómo va la plata de hoy», y diez ruedas en cero no la contestan.
 */
export function agruparCajaPorRuta(pagos = [], rutas = [], pais) {
  const porRuta = new Map()

  for (const p of pagos) {
    // Los ajustes NO son plata que entró: mueven la deuda en los papeles y nadie
    // entrega ni recibe un billete. Es el mismo criterio que usa toda la caja.
    if (p?.tipo === 'recargo' || p?.tipo === 'descuento') continue

    const id = p?.rutaId ?? '__sin_ruta__'
    if (!porRuta.has(id)) {
      porRuta.set(id, {
        id,
        nombre: p?.rutaNombre ?? 'Sin ruta',
        sinRuta: !p?.rutaId,
        efectivo: 0,
        digital: 0,
        cobros: 0,
        cobradores: new Set(),
      })
    }
    const fila = porRuta.get(id)
    const monto = Math.round(Number(p?.montoPagado) || 0)
    if (esDigital(p)) fila.digital += monto
    else fila.efectivo += monto
    fila.cobros += 1
    if (p?.cobradorNombre) fila.cobradores.add(p.cobradorNombre)
  }

  // Lo esperado y los cobros programados los sabe `/api/rutas`, no los pagos:
  // una ruta puede tener 5 cobros programados y 0 hechos, y eso no aparece en la
  // lista de pagos justamente porque no se pagaron.
  const porId = new Map((rutas || []).map((r) => [r.id, r]))

  const filas = [...porRuta.values()].map((f) => {
    const r = porId.get(f.id)
    const total = f.efectivo + f.digital
    const esperado = Math.round(Number(r?.esperadoHoy) || 0)
    return {
      id: f.id,
      nombre: f.nombre,
      sinRuta: f.sinRuta,
      // «Pepito · 4 de 5 cobros». Con varios cobradores en la misma ruta se
      // dicen todos: es el dato que explica una diferencia al cuadrar.
      subtitulo: [
        f.cobradores.size ? [...f.cobradores].join(', ') : null,
        r?.cobrosHoy > 0 ? `${f.cobros} de ${r.cobrosHoy} cobros` : `${f.cobros} ${f.cobros === 1 ? 'cobro' : 'cobros'}`,
      ].filter(Boolean).join(' · '),
      total: formatMoney(total, pais),
      efectivo: formatMoney(f.efectivo, pais),
      digital: formatMoney(f.digital, pais),
      esperado: esperado > 0 ? formatMoney(esperado, pais) : null,
      // ⚠ «PRESTADO» NO VA, Y ES A PROPÓSITO. La lámina lo pide como cuarta
      // cifra, pero `/api/rutas` NO manda lo desembolsado por ruta hoy —lo
      // comprobé— y la caja solo tiene el total del negocio. Ponerlo aquí sería
      // repartir a ojo un desembolso entre rutas, y esto es la pantalla del
      // dinero. Cuando el endpoint lo mande, entra sin tocar nada más.
      // Los dos tramos de la barra, en % del total cobrado. La barra dice de un
      // vistazo cuánto de lo cobrado sigue en la mano del cobrador.
      pctEfectivo: total > 0 ? Math.round((f.efectivo / total) * 100) : 0,
      pctDigital: total > 0 ? Math.round((f.digital / total) * 100) : 0,
      // Para ordenar y para el total de arriba.
      bruto: total,
      brutoEfectivo: f.efectivo,
      brutoDigital: f.digital,
    }
  })

  // La que más plata movió primero; la de «sin ruta» siempre al final, que es un
  // agujero por resolver y no una ruta más.
  filas.sort((a, b) => (a.sinRuta ? 1 : 0) - (b.sinRuta ? 1 : 0) || b.bruto - a.bruto)
  return filas
}

/** El total de arriba: «$1.2M · efectivo $800.000 · digital $400.000». */
export function totalesCajaPorRuta(filas = [], pais) {
  const efectivo = filas.reduce((a, f) => a + (f.brutoEfectivo || 0), 0)
  const digital = filas.reduce((a, f) => a + (f.brutoDigital || 0), 0)
  const total = efectivo + digital
  return {
    total: formatMoney(total, pais),
    efectivo: formatMoney(efectivo, pais),
    digital: formatMoney(digital, pais),
    pctEfectivo: total > 0 ? Math.round((efectivo / total) * 100) : 0,
    pctDigital: total > 0 ? Math.round((digital / total) * 100) : 0,
    hayAlgo: total > 0,
  }
}
