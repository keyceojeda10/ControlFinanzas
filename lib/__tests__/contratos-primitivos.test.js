import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

// ══ EL CAMPO QUE NO COINCIDE ═══════════════════════════════════════════════
//
// Cinco veces en este rediseño he pasado un objeto con la clave equivocada a un
// componente: el componente lee `nombre`, quien lo llama manda `etiqueta`, y no
// pasa NADA. No hay error, no hay aviso, no falla ninguna prueba. Sale una fila
// de botones en blanco, y solo se ve mirando la captura.
//
// Estas pruebas leen los sitios de llamada y comprueban la clave. No prueban la
// lógica: prueban el contrato, que es donde de verdad se rompe.

const archivos = execSync(
  'git ls-files "app/**/*.jsx" "components/**/*.jsx"',
  { cwd: process.cwd(), encoding: 'utf8' },
).split('\n').filter(Boolean)

const fuentes = archivos.map((f) => ({ f, s: readFileSync(f, 'utf8') }))

/** Los bloques `<Componente ... />` de un archivo, con su cuerpo. */
function usos(fuente, componente) {
  const re = new RegExp(`<${componente}\\b[\\s\\S]*?/>`, 'g')
  return fuente.match(re) ?? []
}

describe('GrupoSegmentado: las opciones llevan `nombre`', () => {
  it('nadie manda `etiqueta`, que se pinta como un botón vacío', () => {
    const fallos = []
    for (const { f, s } of fuentes) {
      if (f.endsWith('primitivos2.jsx')) continue
      for (const uso of usos(s, 'GrupoSegmentado')) {
        // Solo se revisa cuando las opciones van escritas ahí mismo; si vienen de
        // una variable, esta prueba no puede verlas y no inventa un veredicto.
        if (!uso.includes('opciones={[')) continue
        if (/\betiqueta:/.test(uso) && !/\bnombre:/.test(uso)) fallos.push(f)
      }
    }
    expect(fallos).toEqual([])
  })
})

describe('Chip: el texto va dentro, no en una prop', () => {
  it('nadie pasa `etiqueta` a un Chip', () => {
    const fallos = []
    for (const { f, s } of fuentes) {
      if (f.endsWith('primitivos.jsx')) continue
      for (const uso of s.match(/<Chip\b[^>]*>/g) ?? []) {
        if (/\betiqueta=/.test(uso)) fallos.push(`${f}: ${uso.slice(0, 60)}`)
      }
    }
    expect(fallos).toEqual([])
  })
})

describe('BloqueOscuro: los literales oscuros no salen de tokens', () => {
  it('el bloque oscuro no usa `--cf-ink`, que en tema claro es negro sobre negro', () => {
    // Es oscuro SIEMPRE, independientemente del tema de la app: dentro no manda
    // el tema, manda que el fondo es negro.
    const s = readFileSync('components/cf/primitivos.jsx', 'utf8')
    const bloque = s.slice(s.indexOf('export function BloqueOscuro'), s.indexOf('export function TiraCifras'))
    expect(bloque).toMatch(/#15161A/)
    expect(bloque).not.toMatch(/var\(--cf-ink\)/)
  })
})
