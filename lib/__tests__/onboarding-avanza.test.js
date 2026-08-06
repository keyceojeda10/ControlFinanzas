import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── EL ASISTENTE SE QUEDABA PIDIENDO LO QUE YA SE HIZO ──────────────────────
//
// Reportado: «creé el cliente manual, me voy al dashboard, y me sigue
// apareciendo como si todavía debiera crear un usuario cuando ya lo creé».
//
// LA CAUSA. El paso 2 del asistente es «traer tu cartera», y ofrece tres vías:
//
//   · foto  → termina DENTRO del asistente, que llama a `persistStep(3)`  ✅
//   · Excel → igual                                                       ✅
//   · a mano → `persistStep(2)` y `window.location.href = '/clientes/nuevo'`
//
// La tercera se va de la pantalla y no vuelve. El cliente se creaba bien, pero
// el paso guardado seguía siendo el 2, así que al volver al panel el asistente
// pedía otra vez la cartera — justo la vía que usa el 97% de la gente.
//
// ⚠ SE ARREGLA EN EL ENDPOINT, NO EN EL FORMULARIO. Hay cinco caminos para
// crear un cliente (formulario, migrador, Excel, asistente, carga masiva) y
// pedirle a cada uno que se acuerde de avisar es garantizar que el sexto se
// olvide. El paso deja de anunciarse y pasa a comprobarse.

const api = readFileSync(
  resolve(process.cwd(), 'app/api/onboarding/progreso/route.js'), 'utf8')
const wizard = readFileSync(
  resolve(process.cwd(), 'components/onboarding/OnboardingWizard.jsx'), 'utf8')

describe('el paso de la cartera se da por hecho si ya hay clientes', () => {
  it('el endpoint lo deduce en vez de esperar a que se lo digan', () => {
    expect(api).toMatch(/const PASO_TRAER_CARTERA = 2/)
    expect(api).toMatch(/if \(currentStep <= PASO_TRAER_CARTERA && clientes > 0\)/)
  })

  it('y lo guarda, para que el asistente no parpadee al recargar', () => {
    /* Sin guardarlo, cada petición volvería a deducirlo y el paso real seguiría
       en 2: bastaría con que una respuesta llegara antes de la deducción para
       ver el asistente saltar entre pantallas. */
    expect(api).toMatch(/data: \{ onboardingStep: currentStep \}/)
  })

  it('`currentStep` es reasignable, o la deducción no serviría de nada', () => {
    // Era `const`. Con `const` el bloque no compila, así que esto también
    // protege de que alguien lo revierta sin darse cuenta.
    expect(api).toMatch(/let currentStep = org\?\.onboardingStep \?\? 0/)
  })

  it('la cuenta de clientes ya existe antes de usarse', () => {
    // Si alguien mueve el bloque de deducción por encima del `count`, `clientes`
    // sería `undefined` y la comparación daría siempre falso — en silencio.
    const iCuenta = api.indexOf('const [clientes, prestamos, pagos')
    const iUso = api.indexOf('clientes > 0')
    expect(iCuenta).toBeGreaterThan(-1)
    expect(iUso).toBeGreaterThan(iCuenta)
  })
})

describe('la vía de a mano sigue saliendo del asistente', () => {
  it('manda a crear el cliente, que es lo que se espera', () => {
    // No se cambia su comportamiento: el arreglo es que al VOLVER el asistente
    // ya sepa que la cartera está traída.
    expect(wizard).toMatch(/window\.location\.href = '\/clientes\/nuevo'/)
  })
})
