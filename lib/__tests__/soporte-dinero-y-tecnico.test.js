/**
 * Lo que el bot NO contesta nunca, y a quién manda en su lugar.
 *
 * Hubo un tercer nivel, «navegación», que mandaba una de las 35 guías de
 * capturas. Se retiró el 8 sep 2026 con las capturas: eran del 15 de agosto y
 * la interfaz había cambiado. Ahora eso lo contesta el vídeo del tema
 * (`videos-por-tema.test.js`). Quedan los dos niveles que van a una persona.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import { nivelDeSoporte } from '@/lib/bot-v2/soporte'
import { ESCALAMIENTO, respuestaEscalamiento } from '@/lib/bot-v2/respuestas-fijas'

describe('nivelDeSoporte', () => {
  const reg = { yaRegistrado: true }
  it('las preguntas de plata van a una persona, siempre', () => {
    for (const t of ['Hermano como quito el saldo en negativo', 'no me cuadra la caja de hoy',
      'por que me sale ese total si yo cobre menos', 'el sistema me calculó mal la mora',
      'me falta plata en el cuadre']) {
      expect(nivelDeSoporte(t, reg), t).toBe('dinero')
    }
  })
  it('los fallos técnicos también', () => {
    for (const t of ['Hoy no me deja entrar', 'me sale un error al guardar',
      'la app no carga', 'se me cierra sola']) {
      expect(nivelDeSoporte(t, reg), t).toBe('tecnico')
    }
  })
  it('la plata gana al parecido de palabras: que exista el vídeo de cuadrar la caja no autoriza a contestar por qué HOY no le cuadra', () => {
    expect(nivelDeSoporte('como hago para cuadrar la caja si no me cuadra', reg)).toBe('dinero')
  })
  it('«cómo hago tal cosa» no lo atiende este módulo: es el vídeo', () => {
    expect(nivelDeSoporte('como creo una ruta', reg)).toBe(null)
    expect(nivelDeSoporte('como agrego un cliente', reg)).toBe(null)
  })
  it('a quien no está registrado no se le manda nada de esto: está en mitad de una venta', () => {
    expect(nivelDeSoporte('no me deja entrar', { yaRegistrado: false })).toBe(null)
    expect(nivelDeSoporte('no me cuadra la caja', { yaRegistrado: false })).toBe(null)
  })
})

describe('los textos de escalamiento', () => {
  it('hay uno para plata y otro para fallos técnicos', () => {
    expect(respuestaEscalamiento('dinero')).toContain('no adivinar')
    expect(respuestaEscalamiento('tecnico')).toContain('qué le sale en pantalla')
  })
  it('ninguno promete que ya se avisó al equipo: la alerta tiene enfriamiento', () => {
    for (const [k, v] of Object.entries(ESCALAMIENTO)) {
      expect(v, k).not.toMatch(/ya le pas|ya avis|le paso su caso|ya le report/i)
    }
  })
  it('todos dicen a dónde escribir, en qué horario, y tratan de usted', () => {
    for (const [k, v] of Object.entries(ESCALAMIENTO)) {
      expect(v, k).toContain('301 199 3001')
      expect(v, k).toMatch(/7am a 10pm/)
      expect(v, k).not.toMatch(/\b(?:tú|tienes|puedes|escríbeme)\b/)
    }
  })
  it('el cliente que quiere pagar recibe dónde se paga, no un teléfono', () => {
    const t = respuestaEscalamiento('intencion_pago_registrado')
    expect(t).toContain('configuracion/plan')
    expect(t).not.toContain('/registro')
  })
})

describe('las guías de capturas se fueron enteras', () => {
  it('no queda ni catálogo, ni enviador, ni carpeta de imágenes', () => {
    expect(fs.existsSync('lib/bot/guias-catalogo.js')).toBe(false)
    expect(fs.existsSync('lib/bot/guias-sender.js')).toBe(false)
    expect(fs.existsSync('public/guias')).toBe(false)
  })
  it('ni nadie que las llame', () => {
    for (const f of ['lib/bot-v2/agente.js', 'app/api/webhook/whatsapp-cloud/route.js', 'lib/bot-v2/soporte.js']) {
      const src = fs.readFileSync(f, 'utf8')
      expect(src, f).not.toMatch(/enviarGuia|guias-catalogo|guias-sender|elegirGuia/)
    }
  })
  it('pero el motor que casa preguntas con un catálogo se quedó, que es lo que usa el vídeo', () => {
    expect(fs.existsSync('lib/bot-v2/emparejar.js')).toBe(true)
    expect(fs.readFileSync('lib/bot-v2/videos.js', 'utf8')).toContain("from './emparejar.js'")
  })
})

describe('la plata llega al camino fijo venga por donde venga', () => {
  it('el agente lo comprueba en los DOS sitios: dentro del escalamiento y fuera', () => {
    const src = fs.readFileSync('lib/bot-v2/agente.js', 'utf8')
    // Dentro del `if (tipo === 'escalar')`, y otra vez suelto para el registrado.
    expect((src.match(/nivel === 'dinero' \|\| nivel === 'tecnico'/g) || []).length).toBe(2)
  })
  it('«no me cuadra la caja de hoy» no lo clasifica el clasificador como soporte, y aun así es dinero', async () => {
    /* Ese hueco lo contestaba el modelo. Se vio probando el simulador. */
    const { clasificar } = await import('@/lib/bot-v2/clasificador')
    expect(clasificar('no me cuadra la caja de hoy', { yaRegistrado: true })?.tipo).not.toBe('escalar')
    expect(nivelDeSoporte('no me cuadra la caja de hoy', { yaRegistrado: true })).toBe('dinero')
  })
})
