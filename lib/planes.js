// lib/planes.js — Fuente unica de verdad para planes y limites
// TODOS los archivos deben importar de aqui en vez de hardcodear limites

export const PLANES_CONFIG = {
  test:         { nombre: 'Test',         precio: 1500,   maxClientes: 50,    maxRutas: 1,  maxUsuarios: 1,  cobradorExtra: 0,     rutaExtra: 0,     aiMensajesDia: 0,   reportesNivel: 0 },
  starter:      { nombre: 'Inicial',      precio: 39000,  maxClientes: 100,   maxRutas: 1,  maxUsuarios: 1,  cobradorExtra: 0,     rutaExtra: 0,     aiMensajesDia: 0,   reportesNivel: 0 },
  // ── BÁSICO LLEGA A LOS REPORTES (nivel 1) ──────────────────────────────
  // Decisión de negocio del dueño: es la razón para que quien está en Inicial
  // ($39.000) suba a Básico ($59.000). Sin esto los dos planes solo se
  // diferencian en el número de clientes (100 -> 450), que a mucha gente no le
  // aprieta todavía.
  //
  // Nivel 1 y no más: da el resumen, los ingresos y el reporte del día. Los de
  // nivel 2 (cartera, cobradores, PDF) y el nivel 3 (exportar a Excel) siguen
  // siendo de Crecimiento en adelante — si Básico se llevara todo, no quedaría
  // motivo para subir de ahí.
  basic:        { nombre: 'Básico',       precio: 59000,  maxClientes: 450,   maxRutas: 1,  maxUsuarios: 1,  cobradorExtra: 0,     rutaExtra: 0,     aiMensajesDia: 0,   reportesNivel: 1 },
  growth:       { nombre: 'Crecimiento',  precio: 79000,  maxClientes: 1000,  maxRutas: 3,  maxUsuarios: 2,  cobradorExtra: 19000, rutaExtra: 29000, aiMensajesDia: 20,  reportesNivel: 1 },
  standard:     { nombre: 'Profesional',  precio: 119000, maxClientes: 2000,  maxRutas: 6,  maxUsuarios: 5,  cobradorExtra: 19000, rutaExtra: 29000, aiMensajesDia: 60,  reportesNivel: 2 },
  professional: { nombre: 'Empresarial',  precio: 259000, maxClientes: 10000, maxRutas: 10, maxUsuarios: 10, cobradorExtra: 19000, rutaExtra: 29000, aiMensajesDia: 200, reportesNivel: 3 },
}

/**
 * DÍAS DE PRUEBA. Son 14, no 30.
 *
 * El handoff del rediseño dice «GRATIS 30 DÍAS» y yo lo copié tal cual a la
 * pantalla de onboarding sin comprobarlo — el mismo error que con los topes
 * 20/40/100. La verdad está en app/api/auth/registro/route.js, que pone
 * `vencimiento + 14` al crear la cuenta.
 *
 * YA SE LEE DE AQUÍ. Estaba escrito a mano dos veces en la ruta de registro —una
 * para la suscripción y otra para la fecha del correo de bienvenida— y una tercera
 * en el prompt del bot de ventas, que es la copia que HABLA CON EL CLIENTE. Las
 * tres importan esta constante.
 *
 * Y ojo con la lámina T37-02 del rediseño: dice «gratis 30 días». Son 14. Prometer
 * 30 y dar 14 no es un número mal puesto — es que al cliente se le vence la prueba
 * dos semanas antes de lo que le dijimos.
 */
export const DIAS_PRUEBA = 14

export const PLANES_VALIDOS = Object.keys(PLANES_CONFIG)

export const PLAN_NAMES = Object.fromEntries(
  Object.entries(PLANES_CONFIG).map(([k, v]) => [k, v.nombre])
)

export const LIMITES_PLAN = Object.fromEntries(
  Object.entries(PLANES_CONFIG).map(([k, v]) => [k, v.maxClientes])
)

export const LIMITES_USUARIOS = Object.fromEntries(
  Object.entries(PLANES_CONFIG).map(([k, v]) => [k, v.maxUsuarios])
)

export const LIMITES_RUTAS = Object.fromEntries(
  Object.entries(PLANES_CONFIG).map(([k, v]) => [k, v.maxRutas])
)

export function planTieneIA(plan) {
  return ['growth', 'standard', 'professional'].includes(plan)
}

export function planTieneFotos(plan) {
  return ['growth', 'standard', 'professional'].includes(plan)
}

export function nivelReportes(plan) {
  return PLANES_CONFIG[plan]?.reportesNivel ?? 0
}

// Precios por pais (moneda local). Paises con USD comparten tabla.
// Derivados de COP -> USD -> moneda local, redondeados a numeros limpios.
export const PRECIOS_PAIS = {
  co: { test: 1500, starter: 39000, basic: 59000, growth: 79000, standard: 119000, professional: 259000, cobradorExtra: 19000, rutaExtra: 29000 },
  mx: { starter: 179, basic: 279, growth: 379, standard: 559, professional: 1199, cobradorExtra: 99, rutaExtra: 139 },
  pe: { starter: 35, basic: 55, growth: 75, standard: 110, professional: 240, cobradorExtra: 19, rutaExtra: 27 },
  ec: { starter: 9, basic: 14, growth: 19, standard: 28, professional: 62, cobradorExtra: 5, rutaExtra: 7 },
  do: { starter: 550, basic: 850, growth: 1150, standard: 1700, professional: 3750, cobradorExtra: 300, rutaExtra: 425 },
  ve: { starter: 9, basic: 14, growth: 19, standard: 28, professional: 62, cobradorExtra: 5, rutaExtra: 7 },
  hn: { starter: 225, basic: 350, growth: 475, standard: 700, professional: 1550, cobradorExtra: 125, rutaExtra: 175 },
  gt: { starter: 70, basic: 110, growth: 150, standard: 220, professional: 480, cobradorExtra: 39, rutaExtra: 55 },
  sv: { starter: 9, basic: 14, growth: 19, standard: 28, professional: 62, cobradorExtra: 5, rutaExtra: 7 },
  ni: { starter: 340, basic: 520, growth: 700, standard: 1050, professional: 2300, cobradorExtra: 185, rutaExtra: 260 },
  cr: { starter: 4500, basic: 7000, growth: 9500, standard: 14000, professional: 31500, cobradorExtra: 2500, rutaExtra: 3500 },
  pa: { starter: 9, basic: 14, growth: 19, standard: 28, professional: 62, cobradorExtra: 5, rutaExtra: 7 },
  us: { starter: 9, basic: 14, growth: 19, standard: 28, professional: 62, cobradorExtra: 5, rutaExtra: 7 },
  /* ── EL CONO SUR ──
     Misma base que el resto: ~9 USD el starter, ~62 el professional, y de ahí
     a moneda local redondeando a cifras limpias.

     ⚠ Argentina lleva inflación alta, así que estos números envejecen: el
     equivalente en dólares hay que revisarlo cada pocos meses. Si el peso se
     devalúa y nadie toca esta tabla, el plan se regala. */
  ar: { starter: 12000, basic: 19000, growth: 25000, standard: 37000, professional: 82000, cobradorExtra: 6500, rutaExtra: 9000 },
  cl: { starter: 8500, basic: 13500, growth: 18000, standard: 26500, professional: 59000, cobradorExtra: 4700, rutaExtra: 6600 },
  bo: { starter: 62, basic: 97, growth: 131, standard: 193, professional: 428, cobradorExtra: 35, rutaExtra: 48 },
  py: { starter: 68000, basic: 106000, growth: 144000, standard: 212000, professional: 470000, cobradorExtra: 38000, rutaExtra: 53000 },
  uy: { starter: 370, basic: 580, growth: 780, standard: 1150, professional: 2550, cobradorExtra: 205, rutaExtra: 290 },
}

export function getPrecioPlan(plan, country = 'co') {
  const precios = PRECIOS_PAIS[country] || PRECIOS_PAIS.co
  return precios[plan] ?? PRECIOS_PAIS.co[plan] ?? 0
}

export function getPrecioCobradorExtra(country = 'co') {
  return (PRECIOS_PAIS[country] || PRECIOS_PAIS.co).cobradorExtra
}

export function getPrecioRutaExtra(country = 'co') {
  return (PRECIOS_PAIS[country] || PRECIOS_PAIS.co).rutaExtra
}
