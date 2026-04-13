// lib/planes.js — Fuente unica de verdad para planes y limites
// TODOS los archivos deben importar de aqui en vez de hardcodear limites

export const PLANES_CONFIG = {
  test:         { nombre: 'Test',         precio: 1500,   maxClientes: 50,    maxRutas: 1,  maxUsuarios: 1,  cobradorExtra: 0,     rutaExtra: 0     },
  starter:      { nombre: 'Inicial',      precio: 39000,  maxClientes: 150,   maxRutas: 1,  maxUsuarios: 1,  cobradorExtra: 0,     rutaExtra: 0     },
  basic:        { nombre: 'Básico',       precio: 59000,  maxClientes: 450,   maxRutas: 1,  maxUsuarios: 1,  cobradorExtra: 0,     rutaExtra: 0     },
  growth:       { nombre: 'Crecimiento',  precio: 79000,  maxClientes: 1000,  maxRutas: 3,  maxUsuarios: 2,  cobradorExtra: 19000, rutaExtra: 29000 },
  standard:     { nombre: 'Profesional',  precio: 119000, maxClientes: 2000,  maxRutas: 6,  maxUsuarios: 5,  cobradorExtra: 19000, rutaExtra: 29000 },
  professional: { nombre: 'Empresarial',  precio: 259000, maxClientes: 10000, maxRutas: 10, maxUsuarios: 10, cobradorExtra: 19000, rutaExtra: 29000 },
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
