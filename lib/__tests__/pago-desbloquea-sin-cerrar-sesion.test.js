// lib/__tests__/pago-desbloquea-sin-cerrar-sesion.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Cuando pagan, al recargar no entran a su sistema normalmente, sino que tienen
//  que cerrar sesión y volverla a abrir. Mucha gente paga y me escribe que el
//  sistema sigue igual.»                                 — el dueño, 1 sep 2026
//
// La fecha de vencimiento viaja DENTRO del JWT, y `middleware.js` corta todas
// las `/api/*` con ese dato. Así que al pagar:
//
//   · la base quedaba bien (el webhook de Wompi activa el plan)
//   · el token del navegador seguía diciendo «vencido»
//   · y la app le respondía 403 a todo
//
// Cerrar sesión funcionaba porque regenera el token. Los 15 minutos de refresco
// no salvaban nada: con `refetchInterval={0}` y `refetchOnWindowFocus={false}`
// la sesión no se vuelve a pedir sola, así que el callback ni corría.
//
// ⚠ Esto es plata: el cliente ya pagó y no puede trabajar.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const raiz = resolve(__dirname, '../..')
const sinComentarios = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|\s)\/\/[^\n]*/g, '$1 ')
const auth       = sinComentarios(readFileSync(resolve(raiz, 'lib/auth.js'), 'utf8'))
/* Sin limpiar: el middleware usa separadores `// ───` que confunden al
   limpiador y se llevarían por delante lo que hay que comprobar. */
const middleware = readFileSync(resolve(raiz, 'middleware.js'), 'utf8')
const provider   = sinComentarios(readFileSync(resolve(raiz, 'components/providers/SessionProvider.jsx'), 'utf8'))
const plan       = sinComentarios(readFileSync(resolve(raiz, 'app/(dashboard)/configuracion/plan/page.jsx'), 'utf8'))

describe('⚠ quien paga entra sin cerrar sesión', () => {
  it('el token vencido se refresca SIEMPRE, sin esperar los 15 minutos', () => {
    /* Es el arreglo de fondo: cualquier carga de la app tras pagar lo
       desbloquea, venga el pago de donde venga (Wompi, admin, WhatsApp). */
    expect(auth).toMatch(/tokenDiceVencido/)
    expect(auth).toMatch(/trigger === 'update' \|\| needsRefresh \|\| tokenDiceVencido/)
  })

  it('y la pantalla del plan lo fuerza cuando la base ya dice que pagó', () => {
    /* Para que se note SIN recargar: es la pantalla donde acaba de pagar. */
    expect(plan).toMatch(/sesionDiceVencido/)
    expect(plan).toMatch(/baseDiceAlDia/)
    expect(plan).toMatch(/updateSession\?\.\(\)/)
  })

  it('⚠ pero solo una vez, o se pediría en bucle', () => {
    /* Refrescar cambia `session`, que vuelve a disparar el efecto. */
    expect(plan).toMatch(/yaRefresque\.current = true/)
    expect(plan).toMatch(/&& !yaRefresque\.current/)
  })

  it('el bloqueo sigue en pie para quien de verdad está vencido', () => {
    /* El arreglo no puede abrirle la puerta a quien no ha pagado: lo que
       cambia es cuándo se relee el dato, no la regla. */
    expect(middleware).toMatch(/suscripcionVencida: true/)
    expect(middleware).toMatch(/new Date\(token\.suscripcionVencimiento\) < new Date\(\)/)
  })

  it('y queda escrito por qué los 15 minutos no bastaban', () => {
    /* Si alguien enciende `refetchInterval` algún día, que sepa que esto
       dependía de que estuviera apagado. */
    expect(provider).toMatch(/refetchInterval=\{0\}/)
  })
})
