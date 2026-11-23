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
 * ¿El modo rápido está encendido para todos? Lo que contesta la app.
 *
 * Si la base falla, APAGADO: lo seguro es el modo de siempre. Y ese fallo no se
 * guarda: en cuanto la base vuelve, la siguiente pregunta contesta bien.
 */
export async function modoRapidoGlobal() {
  const ahora = Date.now()
  if (guardado && ahora < guardado.hasta) return guardado.activo
  try {
    const activo = await leerModoRapido()
    guardado = { activo, hasta: ahora + CADA_CUANTO_MS }
    return activo
  } catch (err) {
    console.warn('[ajustes-globales] no se pudo leer modo_rapido:', err?.message || err)
    return false
  }
}
