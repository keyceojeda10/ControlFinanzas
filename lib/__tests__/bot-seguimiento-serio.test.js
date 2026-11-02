import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/bot/whatsapp-cloud', () => ({}))

import { prometeCita, esQuierePagar } from '@/lib/seguimiento/aviso-al-dueno'
import { momentoDe, mensajePara } from '@/lib/seguimiento/serios'
import { elegirVideo } from '@/lib/bot-v2/videos'
import { clasificar } from '@/lib/bot-v2/clasificador'

/* Lo que se vio el 2 nov 2026 en las conversaciones de los negocios serios. */

describe('la llamada que el bot promete llega al dueño', () => {
  it('con alguien del equipo y un cuándo, es cita', () => {
    expect(prometeCita('Perfecto, Arneides. Voy a agendar una llamada con el equipo para que le muestren en vivo cómo funciona. ¿Mañana a qué hora le viene bien?')).toBe(true)
    expect(prometeCita('Perfecto, Arneides. Mañana a las 11 de la mañana el equipo le muestra cómo funciona en vivo.')).toBe(true)
  })
  it('el horario de soporte no es una cita, ni los cobradores que el cliente llama', () => {
    expect(prometeCita('Escriba al 301 199 3001 y le resuelven en vivo, de 7am a 10pm.')).toBe(false)
    expect(prometeCita('Escriba al 301 199 3001, de lunes a domingo, de 7 de la mañana a 10 de la noche, y le ayudan paso a paso.')).toBe(false)
    expect(prometeCita('Con 5 cobradores en la calle: mientras usted no llama a cada uno, no sabe cuánto entró hoy.')).toBe(false)
    expect(prometeCita('Usted llamando a cada cobrador durante el día es dinero que se le va en llamadas, y mañana igual.')).toBe(false)
  })
  it('quien quiere pagar también avisa, con las dos razones que usa el bot', () => {
    expect(esQuierePagar('intencion_pago')).toBe(true)
    expect(esQuierePagar('intencion_pago_registrado')).toBe(true)
    expect(esQuierePagar('soporte_registrado')).toBe(false)
  })
  it('la cita va primero en la lista y tiene su mensaje', () => {
    expect(momentoDe({ citaPrometida: true, quierePagar: true })).toBe('cita')
    expect(mensajePara({ momento: 'cita', nombre: 'Arneides' })).toMatch(/demostración/)
  })
  it('el webhook avisa en los dos casos, después de la alerta de siempre', () => {
    const src = readFileSync('app/api/webhook/whatsapp-cloud/route.js', 'utf8')
    const alerta = src.indexOf('await alertarLeadCaliente(lead, decision.motivo, historial)')
    const pago = src.indexOf('if (esQuierePagar(decision.motivo)) {\n    await avisarAlDueno(')
    const cita = src.indexOf('} else if (decision.mensaje && prometeCita(decision.mensaje)) {\n    await avisarAlDueno(')
    expect(alerta).toBeGreaterThan(-1)
    expect(pago).toBeGreaterThan(alerta)
    expect(cita).toBeGreaterThan(pago)
    expect(src).toMatch(/if \(motivoAviso === 'quiere pagar'\) await avisarAlDueno\(/)
  })
})

describe('la ráfaga entera, no el último mensaje', () => {
  it('«Por nequi» solo no dice nada; con lo de antes, quiere pagar', () => {
    expect(clasificar('Por nequi', { yaRegistrado: true }).razon).toBe(null)
    expect(clasificar('Buenos días una pregunta para pagar la mensualidad como es\nPor nequi', { yaRegistrado: true }).razon).toBe('intencion_pago')
  })
  it('el webhook le pasa al agente lo que escribió desde la última respuesta', () => {
    const src = readFileSync('app/api/webhook/whatsapp-cloud/route.js', 'utf8')
    expect(src).toMatch(/createdAt: \{ gt: ultimoBot\?\.createdAt \?\? new Date\(0\), gte: new Date\(Date\.now\(\) - 3 \* 60000\) \}/)
    expect(src).toMatch(/decision = await responder\(lead, historial, \{ texto: textoRafaga, tipoMensaje, imagenBase64, imagenMime \}\)/)
  })
})

describe('instalar la app', () => {
  it('«dónde la descargo» es el vídeo de instalar, no «no se descarga»', () => {
    expect(elegirVideo('Donde la descargo', { registrado: true })?.n).toBe(2)
    expect(elegirVideo('cómo descargo la aplicación', { registrado: true })?.n).toBe(2)
  })
  it('el prompt ya no prohíbe decir cómo instalarla', () => {
    const src = readFileSync('lib/bot-v2/prompts.js', 'utf8')
    expect(src).not.toMatch(/Nunca "descargar la app"\./)
    expect(src).toMatch(/SÍ se instala como icono en el celular desde \$\{EMPRESA\.linkInstalar\}/)
  })
})

describe('una sola bienvenida', () => {
  it('quien se vuelve a registrar antes de verificar no la recibe dos veces', () => {
    const src = readFileSync('app/api/auth/registro/route.js', 'utf8')
    const busca = src.indexOf("promptId: 'bienvenida-cartera', createdAt: { gte: new Date(Date.now() - 48 * 3600 * 1000) }")
    const manda = src.indexOf('if (!yaBienvenido && await ventanaAbierta(telefonoLimpio)) {')
    expect(busca).toBeGreaterThan(-1)
    expect(manda).toBeGreaterThan(busca)
  })
})
