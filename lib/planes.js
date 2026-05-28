// lib/planes.js — Fuente unica de verdad para planes y limites
// TODOS los archivos deben importar de aqui en vez de hardcodear limites

export const PLANES_CONFIG = {
  test:         { nombre: 'Test',         precio: 1500,   maxClientes: 50,    maxRutas: 1,  maxUsuarios: 1,  cobradorExtra: 0,     rutaExtra: 0,     aiMensajesDia: 0,   reportesNivel: 0 },
  starter:      { nombre: 'Inicial',      precio: 39000,  maxClientes: 150,   maxRutas: 1,  maxUsuarios: 1,  cobradorExtra: 0,     rutaExtra: 0,     aiMensajesDia: 0,   reportesNivel: 0 },
  basic:        { nombre: 'Básico',       precio: 59000,  maxClientes: 450,   maxRutas: 1,  maxUsuarios: 1,  cobradorExtra: 0,     rutaExtra: 0,     aiMensajesDia: 0,   reportesNivel: 0 },
  growth:       { nombre: 'Crecimiento',  precio: 79000,  maxClientes: 1000,  maxRutas: 3,  maxUsuarios: 2,  cobradorExtra: 19000, rutaExtra: 29000, aiMensajesDia: 20,  reportesNivel: 1 },
  standard:     { nombre: 'Profesional',  precio: 119000, maxClientes: 2000,  maxRutas: 6,  maxUsuarios: 5,  cobradorExtra: 19000, rutaExtra: 29000, aiMensajesDia: 60,  reportesNivel: 2 },
  professional: { nombre: 'Empresarial',  precio: 259000, maxClientes: 10000, maxRutas: 10, maxUsuarios: 10, cobradorExtra: 19000, rutaExtra: 29000, aiMensajesDia: 200, reportesNivel: 3 },
}

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
  co: { starter: 39000, basic: 59000, growth: 79000, standard: 119000, professional: 259000, cobradorExtra: 19000, rutaExtra: 29000 },
  mx: { starter: 179, basic: 279, growth: 379, standard: 559, professional: 1199, cobradorExtra: 99, rutaExtra: 139 },
  pe: { starter: 35, basic: 55, growth: 75, standard: 110, professional: 240, cobradorExtra: 19, rutaExtra: 27 },
  ec: { starter: 9, basic: 14, growth: 19, standard: 28, professional: 62, cobradorExtra: 5, rutaExtra: 7 },
  do: { starter: 550, basic: 850, growth: 1150, standard: 1700, professional: 3750, cobradorExtra: 300, rutaExtra: 425 },
  ve: { starter: 9, basic: 14, growth: 19, standard: 28, professional: 62, cobradorExtra: 5, rutaExtra: 7 },
  hn: { starter: 225, basic: 350, growth: 475, standard: 700, professional: 1550, cobradorExtra: 125, rutaExtra: 175 },
  gt: { starter: 70, basic: 110, growth: 150, standard: 220, professional: 480, cobradorExtra: 39, rutaExtra: 55 },
  sv: { starter: 9, basic: 14, growth: 19, standard: 28, professional: 62, cobradorExtra: 5, rutaExtra: 7 },
  ni: { starter: 340, basic: 520, growth: 700, standard: 1050, professional: 2300, cobradorExtra: 185, rutaExtra: 260 },
  pa: { starter: 9, basic: 14, growth: 19, standard: 28, professional: 62, cobradorExtra: 5, rutaExtra: 7 },
  us: { starter: 9, basic: 14, growth: 19, standard: 28, professional: 62, cobradorExtra: 5, rutaExtra: 7 },
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
