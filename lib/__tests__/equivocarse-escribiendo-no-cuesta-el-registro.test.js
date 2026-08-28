/* Equivocarse escribiendo no puede costar la cuenta.
 *
 * El registro tenía UN límite —3 por IP y hora— y se consumía en CADA intento,
 * antes de validar nada. Escribir mal el celular dos veces y la contraseña una
 * dejaba a alguien fuera UNA HORA sin haber creado ninguna cuenta. Lo vi
 * recorriendo el asistente: segundo intento, 429.
 *
 * Y en este mercado mucha gente sale por la IP del operador, así que tres
 * vecinos registrándose la misma tarde bastan para bloquear al cuarto.
 *
 * Lo que hay que frenar es crear cuentas en masa, no equivocarse. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { rateLimit } from '@/lib/rate-limit'

const ruta = readFileSync('app/api/auth/registro/route.js', 'utf8')

describe('equivocarse escribiendo no cuesta el registro', () => {
  it('⚠ el límite de CUENTAS se cobra al crearla, no al llegar', () => {
    /* Anclado en el orden del fichero: el de golpes va arriba y el de cuentas
       tiene que quedar DESPUÉS de la validación, pegado a la transacción. */
    const arriba = ruta.indexOf('registroIntentos(ip)')
    const cuentas = ruta.indexOf('registroLimiter(ip)')
    /* La que CREA la cuenta, no la primera del fichero: hay otra antes que
       limpia un usuario sin verificar, y anclar ahí hacía fallar la prueba
       con el código correcto puesto. */
    const crea = ruta.indexOf('const resultado = await prisma.$transaction')
    expect(arriba).toBeGreaterThan(-1)
    expect(cuentas).toBeGreaterThan(arriba)
    expect(cuentas).toBeLessThan(crea)
  })

  it('el mensaje del bloqueo dice qué pasó, no «intenta más tarde» a secas', () => {
    expect(ruta).toMatch(/Ya se crearon varias cuentas desde esta conexión/)
  })

  it('el de golpes deja equivocarse varias veces', () => {
    // 30 por hora: quien se equivoca cinco veces sigue pudiendo registrarse.
    const limitador = readFileSync('lib/rate-limit.js', 'utf8')
    const m = limitador.match(/registroIntentos = rateLimit\('registro-intentos', (\d+),/)
    expect(m, 'ya no existe `registroIntentos`').toBeTruthy()
    expect(Number(m[1])).toBeGreaterThanOrEqual(20)
  })

  it('y el de cuentas sigue siendo 3 por hora: crear en masa no se puede', () => {
    const limitador = readFileSync('lib/rate-limit.js', 'utf8')
    expect(limitador).toMatch(/registroLimiter = rateLimit\('registro', 3, 60 \* 60 \* 1000\)/)
  })

  it('el limitador cuenta como dice que cuenta', () => {
    // La pieza en sí, con su propia ventana, para que el número no dependa de
    // leer el fichero: tres pasan, el cuarto no.
    const check = rateLimit(`prueba-${Math.random()}`, 3, 60_000)
    expect([1, 2, 3].map(() => check('1.2.3.4').ok)).toEqual([true, true, true])
    expect(check('1.2.3.4').ok).toBe(false)
    // Y es POR IP: al vecino no le afecta.
    expect(check('5.6.7.8').ok).toBe(true)
  })
})

describe('quien empieza de cero no queda marcado como atascado', () => {
  const wizard = readFileSync('components/onboarding/OnboardingWizard.jsx', 'utf8')
  it('⚠ «empezar de cero» guarda el paso 50, no el 2', () => {
    /* Guardaba 2 y se iba del asistente, así que quedaba contado como detenido
       para siempre. De las 88 «detenidas en el paso 2» de agosto, 19 tenían
       entre 1 y 5 clientes: eran éstas. */
    const bloque = wizard.slice(wizard.indexOf('onCero={'), wizard.indexOf('pasos={'))
    expect(bloque).toMatch(/persistStep\(50, flujo\)/)
    expect(bloque).not.toMatch(/persistStep\(2, flujo\)/)
  })
})
