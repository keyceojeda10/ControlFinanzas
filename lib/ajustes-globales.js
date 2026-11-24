// lib/ajustes-globales.js — interruptores de TODO el sistema que el superadmin
// mueve desde su panel sin desplegar (tabla `AjusteGlobal`, 23 nov 2026).
//
// Hoy hay uno: el «modo rápido». Lo lee la app (GET /api/ajustes/modo-rapido) y
// lo mueve el panel (PATCH /api/admin/ajustes).

import { prisma } from '@/lib/prisma'

export const CLAVE_MODO_RAPIDO = 'modo_rapido'

/* Cuánto se queda en memoria la respuesta de `modoRapidoGlobal`. Cada abrir de la
   app pregunta; sin esto serían miles de lecturas a la base por una sola fila.
   ⚠ Es por PROCESO: producción corre dos instancias de PM2, así que tras mover el
   interruptor una de ellas puede tardar hasta este tiempo en enterarse. */
const CADA_CUANTO_MS = 60_000

let guardado = null // { activo, hasta }

/** Olvida lo guardado: la próxima pregunta va a la base. Lo llama el PATCH del panel. */
export function invalidarAjustesGlobales() {
  guardado = null
}

/**
 * Lo que hay en la base, sin caché y SIN tragarse el error.
 *
 * El panel lee por aquí: un interruptor que dice «apagado» porque la base falló
 * es un interruptor que miente. Sin fila = ENCENDIDO (decisión del dueño: nace
 * encendido); solo un '0' lo apaga.
 */
export async function leerModoRapido() {
  const fila = await prisma.ajusteGlobal.findUnique({
    where: { clave: CLAVE_MODO_RAPIDO },
    select: { valor: true },
  })
  return fila ? fila.valor !== '0' : true
}

/**
 * Lo mismo que `leerModoRapido`, con la caché de 60 s, y TAMPOCO se traga el
 * error: lanza. Lo usa la ruta que contesta a la app, que necesita distinguir
 * «falló» de «está apagado» (un bache de la base no puede apagar el modo rápido a
 * nadie: contesta 503 y la app no decide nada). Un fallo no se guarda: en cuanto
 * la base vuelve, la siguiente pregunta contesta bien.
 */
export async function modoRapidoConCache() {
  const ahora = Date.now()
  if (guardado && ahora < guardado.hasta) return guardado.activo
  const activo = await leerModoRapido()
  guardado = { activo, hasta: ahora + CADA_CUANTO_MS }
  return activo
}

/**
 * ¿El modo rápido está encendido para todos? Para quien solo necesita un sí o un
 * no y no puede reventar.
 *
 * Si la base falla, APAGADO: lo seguro es el modo de siempre. Quien necesite saber
 * que falló —la ruta de la app— usa `modoRapidoConCache`.
 */
export async function modoRapidoGlobal() {
  try {
    return await modoRapidoConCache()
  } catch (err) {
    console.warn('[ajustes-globales] no se pudo leer modo_rapido:', err?.message || err)
    return false
  }
}
