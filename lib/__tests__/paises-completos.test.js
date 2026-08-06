import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { COUNTRIES, COUNTRY_CODES, getCountryConfig, getCountryList } from '@/lib/countries'
import { PRECIOS_PAIS, getPrecioPlan } from '@/lib/planes'

// ── FALTABA EL CONO SUR ENTERO ──────────────────────────────────────────────
//
// Lo reportó un colombiano viviendo en Argentina: intentó registrarse, «le
// salían varios países pero no salía Argentina», y acabó abriendo la cuenta con
// datos de Colombia y un teléfono colombiano provisional.
//
// Eran 13 países y no estaban Argentina, Chile, Bolivia, Paraguay ni Uruguay.
//
// Añadir un país es barato —`country` es un `String` en la base, no un enum, así
// que no hay migración— pero hay TRES sitios que van a la par y dos de ellos no
// dan ningún error si se olvidan:
//
//   · `lib/countries.js`  — moneda, teléfono, documento, huso
//   · `lib/planes.js`     — el precio en moneda local; sin él se cae al de
//                           Colombia y un argentino vería «39.000» en pesos
//                           argentinos, que son 4 dólares en vez de 9
//   · `FLAGS` del registro — sin entrada, el país sale SIN bandera
//
// Esta prueba mantiene los tres alineados.

const CONO_SUR = ['ar', 'cl', 'bo', 'py', 'uy']

describe('los cinco del cono sur están', () => {
  it.each(CONO_SUR)('%s existe con su configuración', (code) => {
    expect(COUNTRY_CODES, `falta ${code}`).toContain(code)
    expect(COUNTRIES[code].name).toBeTruthy()
  })

  it('y salen en la lista del registro', () => {
    const codes = getCountryList().map((c) => c.code)
    for (const c of CONO_SUR) expect(codes).toContain(c)
  })

  it('Argentina, que es la que lo destapó', () => {
    const ar = getCountryConfig('ar')
    expect(ar.name).toBe('Argentina')
    expect(ar.currency).toBe('ARS')
    expect(ar.phonePrefix).toBe('+54')
    expect(ar.documentLabel).toBe('DNI')
    expect(ar.timezone).toBe('America/Argentina/Buenos_Aires')
  })
})

describe('los tres sitios que van a la par', () => {
  it('TODO país tiene precio propio', () => {
    /* Sin entrada en `PRECIOS_PAIS` no falla nada: `getPrecioPlan` se cae al de
       Colombia (`PRECIOS_PAIS[country] || PRECIOS_PAIS.co`). Un argentino
       vería el plan a «39.000», que en pesos argentinos son unos 4 dólares en
       vez de 9 — se le regalaría la mitad sin que nadie se entere. */
    const sinPrecio = COUNTRY_CODES.filter((c) => !PRECIOS_PAIS[c])
    expect(sinPrecio, `países sin precio propio: ${sinPrecio.join(', ')}`).toEqual([])
  })

  it('y TODO país tiene bandera en el registro', () => {
    // Sin entrada en `FLAGS`, el país aparece en el desplegable sin icono.
    const src = readFileSync(resolve(process.cwd(), 'app/registro/RegistroForm.jsx'), 'utf8')
    const bloque = src.slice(src.indexOf('const FLAGS = {'), src.indexOf('const TOTAL_STEPS'))
    const sinBandera = COUNTRY_CODES.filter((c) => !new RegExp(`\\b${c}:`).test(bloque))
    expect(sinBandera, `países sin bandera: ${sinBandera.join(', ')}`).toEqual([])
  })
})

describe('la configuración de cada país es usable', () => {
  it.each(COUNTRY_CODES)('%s tiene todos los campos que la app consume', (code) => {
    const c = COUNTRIES[code]
    for (const campo of ['name', 'currency', 'currencySymbol', 'locale', 'timezone',
                         'phonePrefix', 'phoneRegex', 'phonePlaceholder', 'phoneLabel',
                         'documentRegex', 'documentLabel', 'documentAbbr',
                         'roundingUnit', 'paymentGateway', 'speechLang', 'dateFormat']) {
      expect(c[campo], `${code} no tiene ${campo}`).toBeDefined()
    }
    expect(typeof c.currencyDecimals, `${code} sin currencyDecimals`).toBe('number')
  })

  it('el teléfono de ejemplo PASA su propia validación', () => {
    /* Un `phonePlaceholder` que no cumple su `phoneRegex` es una trampa: el
       usuario copia lo que ve y el formulario se lo rechaza. */
    for (const code of COUNTRY_CODES) {
      const c = COUNTRIES[code]
      expect(c.phoneRegex.test(c.phonePlaceholder),
        `${code}: el ejemplo «${c.phonePlaceholder}» no pasa su propia validación`).toBe(true)
      expect(c.phonePlaceholder.length,
        `${code}: el ejemplo no tiene los ${c.phoneDigits} dígitos que declara`).toBe(c.phoneDigits)
    }
  })

  it('y el documento de ejemplo también, cuando es un ejemplo', () => {
    /* Estados Unidos y México ponen una FRASE de ayuda en vez de un número
       («SSN, ITIN o ID estatal», «CURP o número de INE») porque ahí no hay un
       documento único. Es una decisión suya y es razonable: se saltan las dos,
       y el resto sí tiene que cumplir su propio patrón. */
    for (const code of COUNTRY_CODES) {
      const c = COUNTRIES[code]
      if (!c.documentPlaceholder) continue
      if (/\s(o|or)\s/i.test(c.documentPlaceholder)) continue
      expect(c.documentRegex.test(c.documentPlaceholder),
        `${code}: el documento de ejemplo «${c.documentPlaceholder}» no pasa su validación`).toBe(true)
    }
  })

  it('el RUT chileno acepta la K del verificador', () => {
    // Le toca a uno de cada once chilenos: sin esto, su documento rebota.
    const cl = COUNTRIES.cl
    expect(cl.documentRegex.test('12345678-K')).toBe(true)
    expect(cl.documentRegex.test('12345678-k')).toBe(true)
    expect(cl.documentRegex.test('12345678-9')).toBe(true)
  })

  it('el redondeo va con el valor de la moneda, no copiado', () => {
    /* Copiar el 100 de Colombia a todas partes sería un error caro: un
       boliviano son ~30 pesos colombianos, así que redondear a 100 Bs es
       redondear a 3.000 pesos y se come la cuota. Y el guaraní va al revés. */
    expect(COUNTRIES.ar.roundingUnit).toBe(100)
    expect(COUNTRIES.cl.roundingUnit).toBe(100)
    expect(COUNTRIES.bo.roundingUnit).toBe(1)
    expect(COUNTRIES.py.roundingUnit).toBe(1000)
  })
})

describe('los precios nuevos son coherentes', () => {
  it.each(CONO_SUR)('%s: el professional cuesta más que el starter', (code) => {
    const p = PRECIOS_PAIS[code]
    expect(p.starter).toBeLessThan(p.basic)
    expect(p.basic).toBeLessThan(p.growth)
    expect(p.growth).toBeLessThan(p.standard)
    expect(p.standard).toBeLessThan(p.professional)
    expect(p.cobradorExtra).toBeLessThan(p.starter)
  })

  it('y `getPrecioPlan` los devuelve, sin caerse a Colombia', () => {
    for (const code of CONO_SUR) {
      expect(getPrecioPlan('starter', code)).toBe(PRECIOS_PAIS[code].starter)
      expect(getPrecioPlan('starter', code)).not.toBe(PRECIOS_PAIS.co.starter)
    }
  })
})
