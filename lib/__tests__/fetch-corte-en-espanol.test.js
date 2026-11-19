// El corte por tiempo de las consultas (lib/fetch-timeout.js) lleva un motivo en
// español: sin él, «signal is aborted without reason» salía tal cual en pantalla
// (un informe que tardó, 19 nov 2026). El nombre sigue siendo AbortError.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

describe('el corte por tiempo se lee en español', () => {
  const src = readFileSync('lib/fetch-timeout.js', 'utf8')
  it('aborta con motivo, no a secas', () => {
    expect(src).toMatch(/setTimeout\(\(\) => ctrl\.abort\(motivoDelCorte\(\)\), ms\)/)
    expect(src).not.toMatch(/ctrl\.abort\(\), ms/)
  })
  it('el motivo se sigue llamando AbortError y dice qué hacer', () => {
    expect(src).toMatch(/new DOMException\(TEXTO_CORTE, 'AbortError'\)/)
    expect(src).toMatch(/TEXTO_CORTE = 'La conexión tardó demasiado\. Revisa la señal y vuelve a intentar\.'/)
  })
  it('un AbortController abortado con ese motivo rechaza con el texto y el nombre', async () => {
    const ctrl = new AbortController()
    ctrl.abort(new DOMException('La conexión tardó demasiado. Revisa la señal y vuelve a intentar.', 'AbortError'))
    expect(ctrl.signal.reason.name).toBe('AbortError')
    expect(ctrl.signal.reason.message).toMatch(/^La conexión tardó demasiado/)
  })
})
