/* BOT v3 · sprint 1 · la traza por mensaje (8 sep 2026).
   Las tres auditorías externas pidieron lo mismo: sin la etapa, el prompt y la
   respuesta cruda no se puede saber si falló el código que decide o el modelo
   que redacta. Esta prueba exige que TODO el que escribe un mensaje del bot
   diga de dónde salió, para que no quede una vía sin trazar. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { promptIdDe } from '@/lib/bot-v2/traza'

describe('el id del prompt', () => {
  const plantilla = (nombre, hist, msg) => `Eres el asistente. Conversacion con ${nombre}.\n${hist}\nREGLAS…\nMensaje del lead ahora:\n${msg}`
  it('es estable aunque cambien el historial, el nombre y el mensaje', () => {
    const a = promptIdDe('VALOR', plantilla('Carlos', 'Bot: hola\nLead: x', 'cuánto'), 'Bot: hola\nLead: x', 'Carlos', 'cuánto')
    const b = promptIdDe('VALOR', plantilla('Ana', 'Lead: otra cosa', 'precio'), 'Lead: otra cosa', 'Ana', 'precio')
    expect(a).toBe(b)
    expect(a).toMatch(/^VALOR@[0-9a-f]{8}$/)
  })
  it('cambia cuando alguien edita la plantilla', () => {
    const a = promptIdDe('VALOR', plantilla('Carlos', 'h', 'm'), 'h', 'Carlos', 'm')
    const b = promptIdDe('VALOR', plantilla('Carlos', 'h', 'm') + '\n- NUEVA REGLA', 'h', 'Carlos', 'm')
    expect(a).not.toBe(b)
  })
})

describe('todo el que escribe un mensaje del bot dice de dónde salió', () => {
  const salida = execSync("grep -rn 'botConversacion.create' --include=*.js lib app | grep -v __tests__", { encoding: 'utf8' })
  const sitios = salida.trim().split('\n').map((l) => { const [f, n] = l.split(':'); return { f, n: Number(n) } })

  it('encuentra los sitios (si esto da pocos, la prueba dejó de mirar donde toca)', () => {
    expect(sitios.length).toBeGreaterThanOrEqual(15)
  })

  for (const { f, n } of sitios) {
    const lineas = readFileSync(f, 'utf8').split('\n')
    const bloque = lineas.slice(n - 1, n + 8).join('\n')
    const rol = (bloque.match(/rol:\s*'(\w+)'/) || [])[1]
    if (!rol || rol === 'lead') continue          // los del lead no llevan traza
    it(`${f}:${n} (rol ${rol}) lleva proveedor o la traza del agente`, () => {
      expect(bloque, bloque).toMatch(/proveedor:|\.\.\.\(decision\.traza|\.\.\.\(seg\.traza/)
    })
  }
})

describe('el agente devuelve la traza con las columnas exactas', () => {
  const A = readFileSync('lib/bot-v2/agente.js', 'utf8')
  it('las respuestas fijas llevan proveedor fijo y su clasificación', () => {
    expect(A).toMatch(/traza: FIJO\(`rechazo:\$\{razon\}`\)/)
    expect(A).toMatch(/traza: FIJO\(`tutoriales:\$\{razon\}`\)/)
    expect(A).toMatch(/traza: FIJO\(`escalar:\$\{razon\}`\)/)
    expect(A).toMatch(/traza: FIJO\('ventas', \{ etapa: stage, promptId: 'pitchTrasSolicitud' \}\)/)
  })
  it('la respuesta del modelo lleva etapa, prompt, crudo, violaciones, segunda pasada y latencia', () => {
    const i = A.indexOf('traza: {\n      etapa: stage,')
    expect(i).toBeGreaterThan(0)
    const t = A.slice(i, i + 600)
    for (const campo of ['etapa', 'clasificacion', 'proveedor', 'promptId', 'respuestaCruda', 'violaciones', 'segundaPasada', 'latenciaMs']) {
      expect(t, campo).toContain(campo)
    }
    expect(A).toMatch(/crudo = reintento\.mensaje/)          // si la segunda pasada gana, el crudo es el suyo
    expect(A).toMatch(/latenciaMs \+= reintento\?\._latenciaMs/) // y la latencia suma las dos
  })
  it('el seguimiento también', () => {
    expect(A).toMatch(/etapa: 'SEGUIMIENTO', proveedor: resultado\._proveedor/)
  })
})
