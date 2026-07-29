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

/** Todos los planes, del más barato al más caro. */
const TODOS = ['starter', 'basic', 'growth', 'standard', 'professional']

/**
 * @param pais      código de país ('co', 'mx', …)
 * @param formatear (n) => string — el formateador del país, ya resuelto
 * @param cuantos   cuántos tramos enseñar. Tres: con más, la tabla deja de
 *                  ser una referencia y se vuelve un catálogo que hay que leer.
 */
/**
 * QUIEN YA DIJO QUE TIENE COBRADORES NO PUEDE VER PLANES SIN COBRADORES.
 *
 * Ofrecerle Inicial a alguien que acaba de contestar «tengo cobradores» es
 * ofrecerle un plan donde lo que dijo que hace NO SE PUEDE HACER. La escalera
 * empieza en el primero que le sirve.
 */
export function escaleraPara(perfil) {
  if (perfil !== 'equipo') return ESCALERA
  return TODOS.filter((id) => (PLANES_CONFIG[id]?.maxUsuarios ?? 1) > 1)
}

export function tramosDePlan(pais = 'co', formatear = String, cuantos = 3, perfil) {
  return escaleraPara(perfil)
    .map((id) => {
      const cfg = PLANES_CONFIG[id]
      const precio = getPrecioPlan(id, pais)
      if (!cfg || !precio) return null
      return { id, nombre: cfg.nombre, limite: cfg.maxClientes, precio: formatear(precio) }
    })
    .filter(Boolean)
    .slice(0, cuantos)
    .map((t, i) => ({
      ...t,
      // «Hasta 150 clientes» en el primero y «Hasta 450» en los demás: repetir
      // «clientes» tres veces no aclara nada y estrecha la columna del precio.
      // El NOMBRE manda, porque es lo que se compra. El techo de clientes baja
      // a letra pequeña: es un límite, no una razón para elegir.
      texto: t.nombre,
      desbloquea: loQueDesbloquea(t.id),
      techo: `hasta ${t.limite.toLocaleString('es-CO')} clientes`,
    }))
}

/**
 * QUÉ DESBLOQUEA CADA PLAN, que es lo que de verdad decide la compra.
 *
 * El número de clientes es el peor criterio posible para elegir: alguien con 60
 * clientes puede pagar Crecimiento solo por tener un cobrador. Lo que diferencia
 * de verdad es si puedes meter gente a cobrar, cuántas rutas manejas, y si
 * tienes reportes e IA.
 *
 * Y hay un dato que lo confirma: Inicial y Básico son IDÉNTICOS salvo el techo
 * de clientes —misma ruta, mismo usuario, sin IA, sin reportes—. Enseñar solo el
 * techo hacía que los cinco planes parecieran la misma cosa a distintos precios.
 *
 * Se deriva de PLANES_CONFIG para que no pueda desfasarse del producto.
 */
export function loQueDesbloquea(id) {
  const c = PLANES_CONFIG[id]
  if (!c) return null
  const partes = []

  // OJO CON ESTE NÚMERO. `maxUsuarios` cuenta TODAS las cuentas de la
  // organización —lo verifica app/api/plan/uso: prisma.user.count por
  // organizationId—, y ahí está incluido el dueño. Así que Crecimiento con
  // maxUsuarios 2 NO son «2 personas cobrando»: es el dueño más UN cobrador.
  // Escribirlo mal vende el doble de lo que se entrega.
  const cobradores = Math.max(0, (c.maxUsuarios ?? 1) - 1)
  if (cobradores === 0) partes.push('tú solo')
  else partes.push(`tú + ${cobradores} cobrador${cobradores === 1 ? '' : 'es'}`)

  partes.push(c.maxRutas === 1 ? '1 ruta' : `${c.maxRutas} rutas`)

  if (c.reportesNivel > 0) partes.push('reportes')
  if (c.aiMensajesDia > 0) partes.push('IA')

  return partes.join(' · ')
}

/**
 * El límite del plan más barato — el número que va en «cuando pases de N
 * clientes te decimos qué plan te sirve». También estaba escrito a mano, y
 * también decía 20.
 */
export function limiteInicial() {
  return PLANES_CONFIG[ESCALERA[0]]?.maxClientes ?? null
}

/* ══════════════════════════════════════════════════════════════════════════
   «03 · Plan excedido» — la pantalla más delicada del sistema, porque es donde
   la app le cobra al usuario.
   ══════════════════════════════════════════════════════════════════════════ */


/**
 * EL PLAN SE RECOMIENDA POR LA CARTERA, NO POR EL MÍNIMO QUE CABE.
 *
 * Regla del diseñador, con su ejemplo: «con 31 clientes se sugiere el de 100,
 * porque el de 40 lo vuelve a bloquear en tres meses». Ofrecer el mínimo que
 * entra es vender dos veces y bloquear dos veces — y la segunda vez ya no
 * perdona, porque la primera enseñó que el límite vuelve.
 *
 * Se busca el más barato que deje sitio para CRECER: al menos el doble de los
 * clientes que ya tiene. Si ninguno llega, el más grande que haya.
 */
export const HOLGURA = 2

/**
 * Los planes por ENCIMA del que ya tiene. Sin esto, la pantalla llegó a
 * ofrecerle a alguien del plan Básico… subir al plan Básico. Un «sube a lo que
 * ya tienes» no es un error de cálculo, es la app pidiendo plata por nada.
 */
function superiores(planActual) {
  const i = TODOS.indexOf(planActual)
  return i < 0 ? TODOS : TODOS.slice(i + 1)
}

export function recomendarPlan(clientes, { holgura = HOLGURA, planActual } = {}) {
  const n = Number(clientes)
  if (!Number.isFinite(n) || n <= 0) return null
  const candidatos = superiores(planActual)
  if (!candidatos.length) return null
  const conSitio = candidatos.find((id) => (PLANES_CONFIG[id]?.maxClientes ?? 0) >= n * holgura)
  return conSitio ?? candidatos[candidatos.length - 1]
}

/** El más barato en el que caben, aunque le quede justo. Es la alternativa. */
export function planMinimo(clientes, { planActual } = {}) {
  const n = Number(clientes)
  if (!Number.isFinite(n) || n <= 0) return null
  return superiores(planActual).find((id) => (PLANES_CONFIG[id]?.maxClientes ?? 0) >= n) ?? null
}

/**
 * La razón que va bajo el plan recomendado. El diseño escribe «te alcanza para
 * triplicar tu cartera», y con su ejemplo (31 → 100) es verdad. Con otros
 * números puede no serlo, y una promesa que no se cumple en la pantalla donde
 * la app cobra es de las que se recuerdan. Así que se dice lo que de verdad da.
 */
export function razonDelPlan(clientes, limite) {
  const veces = Number(limite) / Number(clientes)
  if (!Number.isFinite(veces) || veces <= 1) return null
  if (veces >= 3) return 'te alcanza para triplicar tu cartera'
  if (veces >= 2) return 'te alcanza para doblar tu cartera'
  return 'te deja sitio para crecer'
}

/**
 * «El plan te cuesta el 0,3% de lo que tienes en la calle.»
 *
 * Poner el precio contra la cartera, y no a secas, es lo que convierte
 * «$79.000» en una cifra que se puede juzgar. Si no hay cartera todavía, NO se
 * calcula: un porcentaje sobre cero es infinito, y un «0%» es mentira.
 */
export function pesoDelPlan(precio, carteraPorCobrar) {
  const p = Number(precio), c = Number(carteraPorCobrar)
  if (!Number.isFinite(p) || !Number.isFinite(c) || c <= 0 || p <= 0) return null
  const pct = (p / c) * 100
  // Un decimal: «0,3%» se lee; «0,31428%» hay que descifrarlo.
  return Math.round(pct * 10) / 10
}

/** Todo lo que la pantalla necesita, derivado. Ni un número escrito a mano. */
export function adaptarPlanExcedido({ plan, clientes, carteraPorCobrar, pais = 'co' }, formatear = String) {
  const actual = PLANES_CONFIG[plan]
  // Solo por encima del suyo: ofrecerle el plan que ya paga es pedirle plata
  // por nada.
  const idRec = recomendarPlan(clientes, { planActual: plan })
  const idMin = planMinimo(clientes, { planActual: plan })
  const rec = idRec && PLANES_CONFIG[idRec]
  if (!rec) return null

  const precioRec = getPrecioPlan(idRec, pais)
  const peso = pesoDelPlan(precioRec, carteraPorCobrar)

  const armar = (id) => {
    const c = PLANES_CONFIG[id]
    if (!c) return null
    return {
      id,
      nombre: `Plan ${c.nombre}`,
      limite: c.maxClientes,
      texto: `Plan ${c.nombre} · ${c.maxClientes.toLocaleString('es-CO')} clientes`,
      precio: formatear(getPrecioPlan(id, pais)),
    }
  }

  return {
    // «PLAN BÁSICO · 150 CLIENTES» — de dónde viene el tope, dicho arriba.
    rotulo: actual ? `Plan ${actual.nombre} · ${actual.maxClientes.toLocaleString('es-CO')} clientes` : null,
    titulo: actual ? `Tienes ${clientes} clientes y tu plan cubre ${actual.maxClientes.toLocaleString('es-CO')}` : null,
    detalle: `Para crear el número ${Number(clientes) + 1} necesitas subir de plan. Todo lo demás sigue igual.`,
    peso,
    recomendado: { ...armar(idRec), razon: razonDelPlan(clientes, PLANES_CONFIG[idRec]?.maxClientes) },
    // Solo si es OTRO: enseñar dos veces el mismo plan es ruido.
    alternativa: idMin && idMin !== idRec ? armar(idMin) : null,
    accion: `Subir a ${rec.nombre} · ${formatear(precioRec)}`,
  }
}
