// Habla con el espejo por los endpoints REALES, con las dos sesiones.
//
// ⚠ ABORTA si la base no es localhost:3005. El espejo se puede escribir;
// producción NO. Misma guarda que `.auditoria/sembrar-socios-espejo.mjs`.

import { chromium } from 'playwright'
import { firmarSesiones, cookieDe } from './sesion.mjs'

export const BASE = 'http://localhost:3005'
if (!BASE.startsWith('http://localhost:3005')) {
  console.error('ABORTA: esto solo corre contra el espejo.')
  process.exit(1)
}

/* Dos pestañas, una por actor. Se usa Playwright y no `fetch` a pelo porque la
   cookie `httpOnly` de NextAuth necesita un contexto de navegador, y porque es
   el molde que ya funciona en este proyecto. */
export async function abrirActores() {
  const { owner, cobrador } = await firmarSesiones()
  const nav = await chromium.launch()

  const hacer = async (token) => {
    const ctx = await nav.newContext({
      storageState: { cookies: [cookieDe(token)], origins: [] },
      serviceWorkers: 'block',
    })
    const pag = await ctx.newPage()
    await pag.goto(BASE + '/api/caja', { waitUntil: 'domcontentloaded', timeout: 60000 })
    return pag
  }

  return { nav, owner: await hacer(owner), cobrador: await hacer(cobrador) }
}

/**
 * Una llamada al API. Devuelve SIEMPRE `{ok, estado, datos}` — nunca lanza,
 * porque un 400 o un 409 son información de la prueba, no un accidente.
 */
export async function llamar(pag, metodo, ruta, cuerpo = null) {
  return pag.evaluate(async ({ metodo, ruta, cuerpo }) => {
    const r = await fetch(ruta, {
      method: metodo,
      headers: cuerpo ? { 'Content-Type': 'application/json' } : {},
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    })
    let datos = null
    try { datos = await r.json() } catch { datos = null }
    return { ok: r.ok, estado: r.status, datos }
  }, { metodo, ruta, cuerpo })
}

/* Los cobros llevan `?confirmarDuplicado=1` SIEMPRE.
   `pagos/route.js:278-297` devuelve 409 si se repite préstamo+monto+tipo en 60
   segundos. Los montos de la prueba son todos distintos, así que no debería
   dispararse — pero un 409 a mitad de recorrido parece un descuadre y no lo es.
   Cinturón y tirantes. */
export async function cobrar(pag, prestamoId, cuerpo) {
  return llamar(pag, 'POST', `/api/prestamos/${prestamoId}/pagos?confirmarDuplicado=1`, cuerpo)
}

/**
 * Lee las TRES vistas del mismo cobrador. No es redundante: cuentan cosas
 * distintas y esa divergencia es uno de los hallazgos que se buscan.
 *
 *   A · caja global filtrada por cobrador → gastos pendiente+aprobado
 *   B · el array `cobradores[]` del dueño → gastos SOLO aprobado
 *   C · la ficha del cobrador            → cobros de su ruta, no solo suyos
 */
export async function leerLasTresVistas(pagOwner, cobradorId, fecha) {
  const global = await llamar(pagOwner, 'GET', `/api/caja?fecha=${fecha}`)
  const filtrada = await llamar(pagOwner, 'GET', `/api/caja?fecha=${fecha}&cobradorId=${cobradorId}`)
  const ficha = await llamar(pagOwner, 'GET', `/api/caja/cobrador/${cobradorId}?fecha=${fecha}`)

  const enLista = (global.datos?.cobradores ?? []).find((c) => c.id === cobradorId) ?? null

  return {
    global: global.datos?.stats?.dia ?? null,
    A: filtrada.datos?.stats?.dia ?? null,
    B: enLista,
    C: ficha.datos ?? null,
    crudo: { global, filtrada, ficha },
  }
}
