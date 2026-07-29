// lib/adaptadores/planes.js — los tramos de la pantalla «Empieza sin pagar
// nada», derivados de la fuente única.
//
// POR QUÉ EXISTE: la pantalla tenía los tres tramos escritos a mano, copiados
// del handoff: «Hasta 20 clientes $39.000 · Hasta 40 $59.000 · Hasta 100
// $79.000». Los precios coincidían; LOS LÍMITES NO, ni de lejos. Lo que el
// sistema cobra y permite es 150 / 450 / 1.000 clientes por esos mismos
// precios.
//
// O sea: la pantalla vendía el producto SIETE VECES PEOR de lo que es, y
// justo en la que decide si la persona sube su cartera. A quien tiene 68
// clientes en un cuaderno, un «hasta 20» le dice que no le van a caber — y los
// clientes cargados son lo que predice que pague.
//
// Aquí no se escribe ningún número. Salen de PLANES_CONFIG y de getPrecioPlan,
// que es lo que de verdad se cobra y lo que de verdad se limita. El día que
// cambie un precio o un tope, esta pantalla cambia sola.
//
// Y el precio es EL DEL PAÍS: PRECIOS_PAIS tiene 12, y la pantalla escribía
// pesos colombianos a pelo. En México o Perú enseñaba cifras que no existen.

import { PLANES_CONFIG, getPrecioPlan } from '@/lib/planes'

/** Los planes que se le enseñan a alguien que arranca, del más barato al más caro. */
const ESCALERA = ['starter', 'basic', 'growth']

/**
 * @param pais      código de país ('co', 'mx', …)
 * @param formatear (n) => string — el formateador del país, ya resuelto
 * @param cuantos   cuántos tramos enseñar. Tres: con más, la tabla deja de
 *                  ser una referencia y se vuelve un catálogo que hay que leer.
 */
export function tramosDePlan(pais = 'co', formatear = String, cuantos = 3) {
  return ESCALERA
    .map((id) => {
      const cfg = PLANES_CONFIG[id]
      const precio = getPrecioPlan(id, pais)
      if (!cfg || !precio) return null
      return { id, limite: cfg.maxClientes, precio: formatear(precio) }
    })
    .filter(Boolean)
    .slice(0, cuantos)
    .map((t, i) => ({
      ...t,
      // «Hasta 150 clientes» en el primero y «Hasta 450» en los demás: repetir
      // «clientes» tres veces no aclara nada y estrecha la columna del precio.
      texto: i === 0
        ? `Hasta ${t.limite.toLocaleString('es-CO')} clientes`
        : `Hasta ${t.limite.toLocaleString('es-CO')}`,
    }))
}

/**
 * El límite del plan más barato — el número que va en «cuando pases de N
 * clientes te decimos qué plan te sirve». También estaba escrito a mano, y
 * también decía 20.
 */
export function limiteInicial() {
  return PLANES_CONFIG[ESCALERA[0]]?.maxClientes ?? null
}
