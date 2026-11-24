import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { marcadorDeFila, PREFIJO_FILA } from '@/lib/carga-asesor/al-lote'
import { hoyDeLaFila, inicioDeLaFila, selloDelIntento } from '@/components/migrador/LoteFotos'
import { VENTANA_REINTENTO_MS } from '@/lib/prestamos/ya-creado'

// La carga del dueño no duplica si la red se corta (Task 9, piloto del 22 nov
// 2026, check C). Cerrar la app a mitad de una tanda dejó clientes creados sin
// préstamo que el reintento volvía a crear —la fila sin cédula recibía un
// `SIN-<aleatorio>`—, y un `POST /api/prestamos` cortado a los 8 s en el
// navegador mientras el servidor sí lo creaba dejaba crearlo dos veces.

/* Sin comentarios: las notas citan a los clientes y nombran lo prohibido. */
const sinNotas = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
const leer = (r) => sinNotas(readFileSync(r, 'utf8'))

/* `Cliente.cedula` es `String` sin `@db.VarChar`: en MySQL, VARCHAR(191). */
const LARGO_CEDULA = 191

describe('marcadorDeFila', () => {
  const sol = 'cmi9x8q2a0001ab12cd34ef56'

  it('es determinista: la misma fila de la misma solicitud da el mismo marcador', () => {
    expect(marcadorDeFila(sol, '1-3')).toBe(marcadorDeFila(sol, '1-3'))
  })

  it('empieza por SIN-C (lo trata como «sin cédula» todo el sistema)', () => {
    const m = marcadorDeFila(sol, '1-3')
    expect(m.startsWith('SIN-')).toBe(true)
    expect(m.startsWith('SIN-C')).toBe(true)
    expect(m.startsWith(PREFIJO_FILA)).toBe(true)
  })

  it('⚠ el prefijo no lo produce el `SIN-<NOMBRE>` de la carga masiva', () => {
    // `sinCedulaDe` deja solo A-Z, 0-9 y «-»: «SIN-CARLOS-PEREZ» empieza por
    // SIN-C, así que el prefijo exclusivo lleva un carácter que eso no da.
    expect('SIN-CARLOS-PEREZ'.startsWith(PREFIJO_FILA)).toBe(false)
    expect(PREFIJO_FILA).toMatch(/^SIN-C[^A-Z0-9-]/)
  })

  it('cabe en la columna, aunque los ids sean largos', () => {
    expect(marcadorDeFila(sol, '1-3').length).toBeLessThanOrEqual(LARGO_CEDULA)
    const largo = marcadorDeFila('x'.repeat(300), 'y'.repeat(300))
    expect(largo.length).toBeLessThanOrEqual(LARGO_CEDULA)
    expect(largo.startsWith(PREFIJO_FILA)).toBe(true)
    expect(largo).toBe(marcadorDeFila('x'.repeat(300), 'y'.repeat(300)))
    expect(largo).not.toBe(marcadorDeFila('x'.repeat(300), 'y'.repeat(299) + 'z'))
  })

  it('distinto para filas distintas y para solicitudes distintas', () => {
    const a = marcadorDeFila(sol, '1-3')
    expect(marcadorDeFila(sol, '1-4')).not.toBe(a)
    expect(marcadorDeFila('cmi9x8q2a0001ab12cd34ef57', '1-3')).not.toBe(a)
    // Sin ambigüedad entre dónde acaba uno y empieza el otro.
    expect(marcadorDeFila('ab', 'c-1')).not.toBe(marcadorDeFila('abc', '-1'))
  })

  it('sin solicitud o sin fila no hay marcador (se usa el de siempre)', () => {
    expect(marcadorDeFila('', '1-3')).toBeNull()
    expect(marcadorDeFila(sol, '')).toBeNull()
    expect(marcadorDeFila(null, undefined)).toBeNull()
  })
})

describe('LoteFotos en modo solicitud no duplica al reintentar', () => {
  const codigo = leer('components/migrador/LoteFotos.jsx')

  it('recibe el solicitudId como prop opcional', () => {
    expect(codigo).toMatch(/bloqueada = false, onCreando, solicitudId,/)
  })

  it('la fila sin cédula manda el marcador de la fila, solo en modo solicitud', () => {
    expect(codigo).toMatch(/import \{ unirFilasDelLote, marcadorDeFila, PREFIJO_FILA \} from '@\/lib\/carga-asesor\/al-lote'/)
    expect(codigo).toMatch(/const cedula = f\.cedula\?\.trim\(\) \|\| \(solicitud && marcadorDeFila\(solicitudId, f\._id\)\) \|\| `SIN-\$\{Date\.now\(\)\}/)
    expect(codigo).toMatch(/nombre: f\.nombre\.trim\(\),\s*cedula,/)
  })

  /* Final review (23 nov 2026, I3): el 409 con el marcador SIN-C_ de la fila sigue
     siendo el reintento; con cédula real la fila pregunta. La regla vive en
     `clienteDeLaRespuesta` (probada en carga-dueno-final-review.test.js). */
  it('un 409 con existingId (y sin bloqueada) del marcador SIN-C_ es el cliente: solo en modo solicitud', () => {
    expect(codigo).toMatch(/if \(solicitud && status === 409 && d\.existingId && !d\.bloqueada\) \{\s*if \(String\(cedula \?\? ''\)\.startsWith\(PREFIJO_FILA\) \|\| esOtro\) return \{ clienteId: d\.existingId \}/)
    // Fuera del modo solicitud sigue siendo un error.
    expect(codigo).toMatch(/if \(!ok\) return \{ error: d\.error \|\| 'no se pudo crear el cliente' \}/)
  })

  it('el préstamo va con idempotente: true, solo en modo solicitud', () => {
    expect(codigo).toMatch(/\.\.\.\(solicitud && f\.noEsLaMisma !== true && \{ idempotente: true \}\),/)
  })

  it('⚠ la fila «No es la misma» no va con idempotente: son dos préstamos', () => {
    // Ningún otro sitio manda `idempotente` sin mirar `noEsLaMisma`.
    const usos = codigo.match(/idempotente: true/g) ?? []
    expect(usos).toHaveLength(1)
    expect(codigo).not.toMatch(/\.\.\.\(solicitud && \{ idempotente: true \}\)/)
  })
})

describe('la revisión le pasa el solicitudId al lote', () => {
  const codigo = leer('components/carga/RevisionDeLaCarga.jsx')
  it('solicitudId={solicitud.id}', () => {
    const i = codigo.indexOf('<LoteFotos')
    expect(i).toBeGreaterThan(-1)
    expect(codigo.slice(i, codigo.indexOf('/>', i))).toMatch(/solicitudId=\{solicitud\.id\}/)
  })

  it('/migrador y el asistente no lo pasan (se quedan como hoy)', () => {
    for (const r of ['app/(dashboard)/migrador/page.jsx', 'components/onboarding/OnboardingWizard.jsx']) {
      const c = leer(r)
      const i = c.indexOf('<LoteFotos')
      expect(i).toBeGreaterThan(-1)
      expect(c.slice(i, c.indexOf('/>', i))).not.toMatch(/solicitudId/)
    }
  })
})

describe('⚠ el reintento que cruza la medianoche de Bogotá no cambia la fecha', () => {
  const base = { tasa: '20', frecuencia: 'diario', modoInteres: 'fijo', rutaId: '' }
  const fila = { _id: '1-3', nombre: 'Ana', monto: 500000, plazoUnidades: '24', fechaInicio: '', yaAbonado: '' }
  const antes = Date.parse('2026-11-23T04:58:00.000Z')   // 11:58 p. m. del 22 en Bogotá
  const despues = Date.parse('2026-11-23T05:01:00.000Z') // 12:01 a. m. del 23

  it('sin `_hoy`, la fecha sale de hoy (como siempre)', () => {
    expect(hoyDeLaFila(fila, antes)).toBe('2026-11-22')
    expect(hoyDeLaFila(fila, despues)).toBe('2026-11-23')
  })

  it('con el `_hoy` del primer intento, el reintento de pasada la medianoche usa ese', () => {
    const marcada = { ...fila, _hoy: '2026-11-22', _hoyAt: antes }
    expect(hoyDeLaFila(marcada, despues)).toBe('2026-11-22')
    expect(inicioDeLaFila(marcada, base, hoyDeLaFila(marcada, despues))).toBe('2026-11-22')
  })

  it('pasada la ventana del reintento del servidor, vuelve a contar desde hoy', () => {
    const marcada = { ...fila, _hoy: '2026-11-22', _hoyAt: antes }
    expect(hoyDeLaFila(marcada, antes + VENTANA_REINTENTO_MS + 1)).toBe('2026-11-23')
  })

  /* Final review (23 nov 2026, I2): el sello se renovaba por TEXTO. Un intento
     fallido a las 11:40 p. m. deja `_hoy` = 22; a las 11:58 el texto coincide
     («22») y no se renovaba, así que el sello seguía siendo el de las 11:40, ya
     vencido. El reintento de las 12:01 a. m. contaba desde el 23: otra huella y
     un segundo préstamo. Se renueva por VIGENCIA. */
  it('⚠ un sello del mismo día pero vencido se renueva al intentar (23:58 → 00:01 no cambia la fecha)', () => {
    const viejo = Date.parse('2026-11-23T04:40:00.000Z')   // 11:40 p. m. del 22
    const marcada = { ...fila, _hoy: '2026-11-22', _hoyAt: viejo }
    const sello = selloDelIntento(marcada, antes)
    expect(sello).toEqual({ _hoy: '2026-11-22', _hoyAt: antes })
    const enviada = { ...marcada, ...sello }
    expect(hoyDeLaFila(enviada, despues)).toBe('2026-11-22')
    expect(inicioDeLaFila(enviada, base, hoyDeLaFila(enviada, despues))).toBe('2026-11-22')
  })

  it('un sello vigente no se toca', () => {
    const marcada = { ...fila, _hoy: '2026-11-22', _hoyAt: antes }
    expect(selloDelIntento(marcada, despues)).toBeNull()
  })

  it('sin sello, el primer intento sella hoy', () => {
    expect(selloDelIntento(fila, despues)).toEqual({ _hoy: '2026-11-23', _hoyAt: despues })
  })

  it('una fecha escrita en la fila manda sobre `_hoy`', () => {
    const marcada = { ...fila, fechaInicio: '2026-10-01', _hoy: '2026-11-22', _hoyAt: antes }
    expect(inicioDeLaFila(marcada, base, hoyDeLaFila(marcada, despues))).toBe('2026-10-01')
  })

  const codigo = leer('components/migrador/LoteFotos.jsx')
  it('el primer intento guarda su día en la fila antes de mandar nada, solo en modo solicitud', () => {
    const marca = codigo.indexOf('const marca = solicitud ? selloDelIntento(f) : null')
    expect(marca).toBeGreaterThan(-1)
    expect(codigo).toMatch(/if \(marca\) \{\s*fila = \{ \.\.\.f, \.\.\.marca \}/)
    expect(marca).toBeLessThan(codigo.indexOf("fetch('/api/clientes'"))
    expect(marca).toBeLessThan(codigo.indexOf("fetch('/api/prestamos'"))
  })

  it('el préstamo y su ficha usan esa misma fecha', () => {
    expect(codigo).toMatch(/const fechaDelPrestamo = inicioDeLaFila\(fila, base\)/)
    expect(codigo.match(/fechaInicio: fechaDelPrestamo,/g)).toHaveLength(2)
    expect(codigo).not.toMatch(/fechaInicio: inicioDeLaFila\(f, base\)/)
  })
})
