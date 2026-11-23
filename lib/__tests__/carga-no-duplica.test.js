import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { marcadorDeFila, PREFIJO_FILA } from '@/lib/carga-asesor/al-lote'

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
    expect(codigo).toMatch(/import \{ unirFilasDelLote, marcadorDeFila \} from '@\/lib\/carga-asesor\/al-lote'/)
    expect(codigo).toMatch(/cedula: f\.cedula\?\.trim\(\) \|\| \(solicitud && marcadorDeFila\(solicitudId, f\._id\)\) \|\| `SIN-\$\{Date\.now\(\)\}/)
  })

  it('un 409 con existingId (y sin bloqueada) es el cliente: solo en modo solicitud', () => {
    expect(codigo).toMatch(/if \(solicitud && resC\.status === 409 && dataC\.existingId && !dataC\.bloqueada\) \{\s*clienteId = dataC\.existingId/)
    // Fuera del modo solicitud sigue siendo un error.
    expect(codigo).toMatch(/\} else if \(!resC\.ok\) \{\s*throw new Error\(dataC\.error \|\| 'no se pudo crear el cliente'\)/)
  })

  it('el préstamo va con idempotente: true, solo en modo solicitud', () => {
    expect(codigo).toMatch(/\.\.\.\(solicitud && \{ idempotente: true \}\),/)
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
