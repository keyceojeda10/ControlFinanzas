/**
 * BOT v3 · sprint 8: el pipeline de aprendizaje.
 *
 * La autocrítica lleva desde julio dejando lecciones que nadie podía comprobar:
 * 53 quedaron marcadas como «aplicadas» sin haber llegado nunca al código. Con
 * la traza (sprint 1) y los motivos del validador (sprint 7) eso ya se puede
 * contar, así que cada lección sale con el número de mensajes reales que la
 * respaldan, o con el aviso de que no la respalda ninguno.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import { resumirTraza, contrastarLecciones, textoAprendizaje } from '@/lib/bot-v2/aprendizaje'

const fila = (o = {}) => ({ etapa: 'VALOR', clasificacion: 'ventas', proveedor: 'claude', promptId: 'VALOR@abc123', violaciones: null, segundaPasada: false, latenciaMs: 3000, ...o })

describe('resumirTraza', () => {
  it('cuenta solo lo que salió del modelo, no las plantillas ni los caminos fijos', () => {
    const r = resumirTraza([fila(), fila({ proveedor: 'plantilla' }), fila({ proveedor: 'fijo' }), fila({ proveedor: 'deepseek' })])
    expect(r.turnos).toBe(4)
    expect(r.delModelo).toBe(2)
  })
  it('desglosa los motivos y dice en qué etapa pasan', () => {
    const r = resumirTraza([
      fila({ violaciones: 'tuteo,calco_largo', segundaPasada: true }),
      fila({ violaciones: 'tuteo', etapa: 'PRECIOS', segundaPasada: true }),
      fila(),
    ])
    expect(r.motivos).toEqual([['tuteo', 2], ['calco_largo', 1]])
    expect(r.motivosPorEtapa[0]).toEqual(['VALOR·tuteo', 1])
    expect(r.regeneraciones).toBe(2)
    expect(r.tasaRegeneracion).toBe(66.7)
  })
  it('la latencia sale en percentiles y aguanta que falte', () => {
    const r = resumirTraza([fila({ latenciaMs: 1000 }), fila({ latenciaMs: 9000 }), fila({ latenciaMs: null })])
    expect(r.latencia.p50).toBe(9000)
    expect(resumirTraza([fila({ latenciaMs: 0 })]).latencia.p50).toBe(null)
  })
  it('señala la plantilla de prompt que más falla', () => {
    const r = resumirTraza([
      fila({ violaciones: 'tuteo', promptId: 'VALOR@aaa' }),
      fila({ violaciones: 'tuteo', promptId: 'VALOR@aaa' }),
      fila({ violaciones: 'tuteo', promptId: 'CIERRE@bbb' }),
    ])
    expect(r.promptsConMasFallos[0]).toEqual(['VALOR@aaa', 2])
  })
  it('sin datos no revienta', () => {
    expect(resumirTraza([]).delModelo).toBe(0)
    expect(resumirTraza().turnos).toBe(0)
  })
})

describe('contrastarLecciones', () => {
  const resumen = resumirTraza([fila({ violaciones: 'sin_siguiente_paso' }), fila({ violaciones: 'sin_siguiente_paso' }), fila({ violaciones: 'precio_falso' })])
  it('una lección que la traza respalda sale con sus casos', () => {
    const [l] = contrastarLecciones([{ tipo: 'mejora_cierre', leccion: 'El bot dejó la conversación muerta con un quedo atento', accion: 'invitar al siguiente paso' }], resumen)
    expect(l.respaldo.verificada).toBe(true)
    expect(l.respaldo.casos).toBe(2)
    expect(l.respaldo.motivos).toContain('sin_siguiente_paso')
  })
  it('una lección que no aparece en ningún mensaje se marca como no verificada', () => {
    const [l] = contrastarLecciones([{ tipo: 'patron', leccion: 'El bot deberia hablar mas del horario de atencion', accion: 'mencionarlo' }], resumen)
    expect(l.respaldo.verificada).toBe(false)
    expect(l.respaldo.casos).toBe(0)
  })
  it('no pierde ni inventa lecciones', () => {
    const dadas = [{ leccion: 'a' }, { leccion: 'b' }, { leccion: 'c' }]
    expect(contrastarLecciones(dadas, resumen)).toHaveLength(3)
    expect(contrastarLecciones([], resumen)).toEqual([])
  })
})

describe('textoAprendizaje', () => {
  it('dice cuántos se corrigieron, con qué motivo y cuántas lecciones van sin respaldo', () => {
    const resumen = resumirTraza([fila({ violaciones: 'tuteo', segundaPasada: true }), fila()])
    const lecciones = contrastarLecciones([{ leccion: 'tuteo indebido' }, { leccion: 'algo que nadie midio' }], resumen)
    const t = textoAprendizaje(resumen, lecciones)
    expect(t).toContain('2 mensajes del modelo')
    expect(t).toContain('Se corrigieron 1')
    expect(t).toContain('tuteo')
    expect(t).toContain('1 no')
  })
  it('sin mensajes del modelo lo dice y no finge cifras', () => {
    expect(textoAprendizaje(resumirTraza([]))).toBe('Sin mensajes del modelo en el periodo.')
  })
})

describe('la autocrítica usa la traza (anclado en código)', () => {
  const src = fs.readFileSync('lib/bot/autocritica.js', 'utf8')
  it('lee la traza de las últimas 24 h y contrasta las lecciones', () => {
    expect(src).toMatch(/const resumenTraza = resumirTraza\(trazaDelDia\)/)
    expect(src).toMatch(/const todas = contrastarLecciones\(/)
    expect(src).toMatch(/proveedor: \{ not: null \}/)
  })
  it('cada lección de Telegram dice si la traza la respalda', () => {
    expect(src).toMatch(/item\.respaldo\?\.verificada/)
    expect(src).toMatch(/Sin respaldo en la traza de hoy/)
  })
  it('y la lección guardada deja constancia, para poder ordenarlas después', () => {
    expect(src).toMatch(/TRAZA: \$\{item\.respaldo\.casos\} mensajes reales/)
    expect(src).toMatch(/TRAZA: sin respaldo/)
  })
})
