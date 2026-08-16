/* ══ QUÉ INFORMES EXISTEN, EN UN SOLO SITIO ══════════════════════════════════
 *
 * Reportado por el dueño el 16 ago 2026, leyendo la sugerencia de Préstamos
 * Rincón:
 *
 *   «Hay reportes por todos lados. Hay reportes en caja, hay reportes en
 *    reportes, hay reportes en cómo va el negocio. Unos están abajo, otros
 *    arriba en cabecera, otros al lado de los títulos. Si la gente va a buscar
 *    un reporte específico, de pronto ni siquiera está en el apartado de
 *    reportes.»
 *
 * Contado: OCHO cosas que se descargan repartidas en SIETE pantallas, y ocho
 * informes más que solo se ven y no se pueden bajar. Y ya eran DOS pantallas
 * hermanas —`/reportes` enseña, `/reportes/bajar` baja—, que es parte del
 * enredo: quien busca «el del mes» no sabe en cuál de las dos está.
 *
 * ── LO QUE ESTE ARCHIVO DECIDE ──────────────────────────────────────────────
 *
 * Cada informe se declara UNA vez: qué contesta, qué período admite, qué plan
 * hace falta, si se ve, si se baja y por dónde. La pantalla se pinta leyendo
 * esto, así que un informe nuevo es un renglón aquí y no una pantalla más.
 *
 * ⚠ NO ENTRAN LOS DOCUMENTOS DE UN CASO. El pagaré de Juan, el recibo de ese
 *   pago y la hoja de la ruta de hoy se piden ESTANDO ahí, con el cliente
 *   delante. Sacarlos a un centro de informes sería moverlos más lejos de donde
 *   se necesitan. Se quedan en su pantalla y no se listan aquí: la diferencia es
 *   que un informe se busca a ciegas —se sabe qué se necesita, no dónde está— y
 *   un documento se pide en contexto.
 */

/** Períodos que ofrece un informe. El primero es el que sale puesto. */
export const PERIODOS = {
  HOY:      { id: 'hoy',        rotulo: 'Hoy' },
  SEMANA:   { id: 'semana',     rotulo: 'Semana' },
  MES:      { id: 'mes',        rotulo: 'Mes' },
  TRIMESTRE:{ id: 'trimestre',  rotulo: 'Trimestre' },
  SEMESTRE: { id: 'semestre',   rotulo: 'Semestre' },
  ANIO:     { id: 'anio',       rotulo: 'Año' },
  TODO:     { id: 'todo',       rotulo: 'Todo' },
}

/* Los informes, en el orden en que se pintan.
 *
 * ⚠ EL ORDEN ES EL DE USO, no el alfabético ni el de cuándo se programaron.
 *   Arriba lo de todos los días; abajo lo de cerrar el año. Es la misma regla
 *   que los chips de préstamos, donde poner lo más usado en séptimo lugar lo
 *   dejaba fuera de pantalla.
 *
 * `nivel` es `reportesNivel` de lib/planes.js: 0 lo ve cualquiera, 1 desde
 * Básico, 2 desde Profesional, 3 Empresarial.
 */
export const INFORMES = [
  {
    id: 'entro',
    titulo: 'Lo que entró',
    contesta: 'Cuánto cobraste y, de eso, cuánto ganaste.',
    pantalla: '/reportes',
    ancla: '#informe-entro',
    nivel: 1,
    periodos: ['hoy', 'semana', 'mes', 'trimestre', 'semestre', 'anio'],
    /* `pantalla` es dónde se ENSEÑA y `ver` el API que lo calcula. Son dos cosas
       distintas: un API no lleva a ninguna parte por sí solo, y la queja era
       justamente no saber a dónde ir. */
    ver: '/api/reportes/ingresos',
    bajar: null,          // pendiente: su PDF entra en la tanda 2
    // De dónde venía antes, para no perder a quien ya sabía llegar.
    atajoDesde: '/reportes',
  },
  {
    id: 'calle',
    titulo: 'Lo que está en la calle',
    contesta: 'Quién te debe, cuánto y cuántos días lleva atrasado.',
    pantalla: '/reportes/bajar',
    ancla: '#informe-calle',
    nivel: 1,
    periodos: ['todo'],
    ver: '/api/reportes/cartera',
    bajar: '/api/reportes/exportar?tipo=prestamos',
    atajoDesde: '/reportes/bajar',
  },
  {
    id: 'cobros-mes',
    titulo: 'Los cobros del mes',
    contesta: 'Cliente por cliente, qué se cobró y qué falta.',
    pantalla: '/reportes',
    ancla: '#informe-cobros-mes',
    nivel: 1,
    periodos: ['mes'],
    ver: '/api/reportes/cobros-mes',
    bajar: null,
    atajoDesde: '/reportes',
  },
  {
    id: 'dia',
    titulo: 'El día',
    contesta: 'Lo cobrado, lo prestado y los gastos de una jornada.',
    pantalla: '/caja',
    ancla: null,
    nivel: 1,
    periodos: ['hoy'],
    ver: '/api/reportes/dia',
    bajar: '/api/pagos/export',
    // El botón de caja se queda donde está y abre esto con el día puesto.
    atajoDesde: '/caja',
  },
  {
    id: 'rendimiento',
    titulo: 'Cómo rindió el negocio',
    contesta: 'Ganancia, rentabilidad por ruta y quién cobra mejor.',
    pantalla: '/dashboard/analiticas',
    ancla: null,
    nivel: 2,
    periodos: ['mes', 'trimestre', 'semestre', 'anio'],
    ver: '/api/dashboard/analiticas',
    bajar: '/api/dashboard/analiticas/reporte-pdf',
    atajoDesde: '/dashboard/analiticas',
  },
  {
    id: 'contador',
    titulo: 'Para el contador',
    contesta: 'Gastos contra utilidad, y utilidad contra capital recuperado.',
    // Pedido por Préstamos Rincón: «para quienes estamos cerca a topes de
    // declarar y así poder saber cuál es el capital recuperado y las utilidades
    // obtenidas». Se construye en la tanda 2.
    pantalla: null,
    ancla: null,
    nivel: 1,
    periodos: ['mes', 'trimestre', 'semestre', 'anio'],
    ver: null,
    bajar: null,
    pendiente: true,
  },
  {
    id: 'cuentas',
    titulo: 'Movimientos por cuenta',
    contesta: 'Qué entró y qué salió por cada cuenta y por efectivo.',
    // También de Rincón. Los datos ya están: cada pago guarda `metodoPago` y
    // `plataforma`, y él tiene cuatro cuentas configuradas.
    pantalla: null,
    ancla: null,
    nivel: 1,
    periodos: ['mes', 'trimestre', 'semestre', 'anio'],
    ver: null,
    bajar: null,
    pendiente: true,
  },
  {
    id: 'resumen',
    titulo: 'Resumen del negocio',
    contesta: 'Una hoja con todo, para imprimir o mandar.',
    pantalla: '/reportes/bajar',
    ancla: '#informe-resumen',
    nivel: 1,
    periodos: ['mes'],
    ver: '/api/reportes/resumen',
    bajar: '/api/reportes/resumen-pdf',
    atajoDesde: '/reportes',
  },
  {
    id: 'listado-cobros',
    titulo: 'Listado de cobros',
    contesta: 'La lista del día para imprimir y darle al cobrador.',
    pantalla: '/reportes/bajar',
    ancla: '#informe-listado-cobros',
    nivel: 1,
    periodos: ['hoy'],
    ver: null,
    bajar: '/api/reportes/listado-cobros',
    atajoDesde: '/reportes',
  },
  {
    id: 'cobradores',
    titulo: 'Tus cobradores',
    contesta: 'Cuánto recogió cada uno y cómo va su cartera.',
    pantalla: '/reportes',
    ancla: '#informe-cobradores',
    nivel: 2,
    periodos: ['mes'],
    ver: '/api/reportes/cobradores',
    bajar: '/api/reportes/exportar?tipo=cobradores',
    atajoDesde: '/reportes',
  },
  {
    id: 'seguros',
    titulo: 'Seguros cobrados',
    contesta: 'Cuánto se cobró de seguro y en qué ruta.',
    pantalla: '/reportes',
    ancla: '#informe-seguros',
    nivel: 1,
    periodos: ['hoy', 'semana', 'mes', 'todo'],
    ver: '/api/reportes/seguros',
    bajar: null,
    atajoDesde: '/reportes',
  },
  {
    id: 'crudo',
    titulo: 'Todo en bruto',
    contesta: 'Clientes, préstamos, pagos y cobradores en Excel.',
    pantalla: '/reportes/bajar',
    ancla: '#informe-crudo',
    nivel: 1,
    periodos: ['todo'],
    ver: null,
    bajar: '/api/reportes/exportar?tipo=todo',
    atajoDesde: '/reportes/bajar',
  },
]

/* ⚠ `pantalla` SOLO PUEDE APUNTAR A UNA RUTA QUE EXISTA.
 *
 * La primera versión de este archivo la escribí con `/reportes/entro`,
 * `/reportes/calle` y cuatro más que me inventé pensando en cómo quedaría la
 * pantalla nueva. Ninguna existe: habrían sido seis renglones que llevan a un
 * 404 — el mismo botón muerto que esta app ya tuvo cuatro veces, y que una
 * prueba de este archivo vigila para `ver` y `bajar` pero no vigilaba aquí.
 *
 * Mientras la pantalla única no exista, apuntan a donde el informe se enseña
 * HOY. `catalogo-de-informes.test.js` comprueba contra el disco que cada una
 * tiene su `page.jsx`.
 */

/** Los que el plan del negocio alcanza a abrir. */
export function informesDelPlan(nivel = 0) {
  return INFORMES.filter((i) => i.nivel <= nivel)
}

/**
 * ⚠ Los que NO alcanza el plan SIGUEN EN LA LISTA, apagados.
 *
 * Esconderlos deja al prestamista sin saber qué se está perdiendo, y esta
 * pantalla es justo donde se decide subir de plan. `PlanGate` y `UpgradeNudge`
 * ya existen para eso.
 */
export function informeBloqueado(informe, nivel = 0) {
  return informe.nivel > nivel
}

export function buscarInforme(id) {
  return INFORMES.find((i) => i.id === id) ?? null
}

/**
 * A dónde lleva su renglón del índice.
 *
 * ⚠ CON EL ANCLA, NO SOLO LA RUTA. Sin ella, «Los cobros del mes» deja al
 * prestamista arriba de una pantalla de 3.700 píxeles a buscar el informe que
 * acaba de pedir por su nombre — que es exactamente la queja.
 */
export function destinoDe(informe) {
  if (!informe?.pantalla) return null
  return `${informe.pantalla}${informe.ancla ?? ''}`
}
