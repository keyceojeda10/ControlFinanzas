// lib/__tests__/respuesta-vuelve-al-banner.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «No se les puede contestar desde el banner, no por WhatsApp.»
//                                                    — el dueño, 18 ago 2026
//
// El campo `respuesta` lo hice el 17 como LIBRETA PRIVADA del panel, y lo dejé
// escrito así: «se guarda aquí, no se le envía». Con eso, contestarle a alguien
// dependía de tener su WhatsApp: de los cinco que escribieron hubo que buscarle
// el número a uno, y un cobrador que manda una queja desde la ruta no tiene por
// qué dar su teléfono para que le respondan.
//
// Escribieron desde el banner. La respuesta vuelve por el banner.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
const api = leer('app/api/sugerencias/route.js')
const banner = leer('components/dashboard/BannerSugerencias.jsx')
const panel = leer('app/admin/sugerencias/page.jsx')

describe('⚠ la respuesta le llega a quien escribió', () => {
  it('el API se la devuelve, y solo la SUYA', () => {
    /* Sin `userId`, una organización con diez cobradores les enseñaría a todos
       la respuesta de cualquiera. */
    const get = api.slice(api.indexOf('export async function GET'), api.indexOf('export async function POST'))
    expect(get).toMatch(/userId: session\.user\.id/)
    expect(get).toMatch(/respuesta: \{ not: null \}/)
  })

  it('solo mientras no la haya visto', () => {
    const get = api.slice(api.indexOf('export async function GET'), api.indexOf('export async function POST'))
    expect(get).toMatch(/respuestaVistaEn: null/)
  })

  it('y devuelve TAMBIÉN de qué sugerencia era', () => {
    /* A los diez días no se acuerda de a cuál de sus mensajes le contestan. */
    const get = api.slice(api.indexOf('export async function GET'), api.indexOf('export async function POST'))
    expect(get).toMatch(/texto: true/)
  })
})

describe('⚠ se puede cerrar, y solo por su dueño', () => {
  const patch = api.slice(api.indexOf('export async function PATCH'))

  it('hay por dónde marcarla vista', () => {
    expect(api).toMatch(/export async function PATCH/)
    expect(patch).toMatch(/respuestaVistaEn: new Date\(\)/)
  })

  it('⚠ el `where` lleva el usuario, no solo el id', () => {
    /* Con solo el id, cualquiera podría marcar como vista la respuesta de otro
       —y esa persona no volvería a verla nunca—. */
    expect(patch).toMatch(/id, userId: session\.user\.id/)
  })

  it('la tarjeta trae su botón', () => {
    expect(banner).toMatch(/Entendido/)
    expect(banner).toMatch(/method: 'PATCH'/)
  })
})

describe('⚠ la respuesta se lee aunque la campaña haya cerrado', () => {
  it('el banner no se apaga con una respuesta sin leer', () => {
    /* El banner se apaga solo el 28 de agosto. Quien escribió el 27 tiene que
       poder leer lo que se le contestó el 29 — si no, la respuesta se escribe
       para nadie. */
    expect(banner).toMatch(/if \(!estado\.viva && contestadas\.length === 0\) return null/)
  })
})

describe('⚠ el panel ya no dice que es privado', () => {
  it('el marcador de posición no promete lo contrario', () => {
    /* Decía «se guarda aquí, no se le envía». Si alguien escribe una nota para
       sí mismo creyendo eso, se la manda al cliente sin querer. */
    expect(panel, 'sigue diciendo que no se envía').not.toMatch(/no se le envía/)
  })

  it('y avisa dónde lo va a ver', () => {
    expect(panel).toMatch(/pantalla de inicio/)
  })
})
