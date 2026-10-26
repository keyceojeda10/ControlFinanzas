/* Del 23 al 26 oct 2026 Meta rechazó todo con 131042. El bot se recuperó solo;
   los avisos de la app quedaron como enviados y no se repitieron: 17 negocios
   vencieron su prueba o su plan sin enterarse. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { esErrorDeCorte, reintentableTrasCorte, marcarEnvioFallido } from '@/lib/seguimiento/corte'

describe('corte de la cuenta', () => {
  it('reconoce los códigos de la CUENTA, no los del número', () => {
    expect(esErrorDeCorte('131042: Business eligibility payment issue')).toBe(true)
    expect(esErrorDeCorte('131031: Account restricted')).toBe(true)
    expect(esErrorDeCorte('368: Temporarily blocked')).toBe(true)
    expect(esErrorDeCorte('131026: Message undeliverable')).toBe(false) // el número
    expect(esErrorDeCorte('131049: healthy ecosystem')).toBe(false)
    expect(esErrorDeCorte(null)).toBe(false)
  })
  it('solo se reintenta lo de WhatsApp que no llegó por corte y nadie respondió', () => {
    const base = { canal: 'whatsapp', ok: false, error: '131042: Business eligibility payment issue', respondidoAt: null }
    expect(reintentableTrasCorte(base)).toBe(true)
    expect(reintentableTrasCorte({ ...base, ok: true })).toBe(false)
    expect(reintentableTrasCorte({ ...base, error: '131026: Message undeliverable' })).toBe(false)
    expect(reintentableTrasCorte({ ...base, respondidoAt: new Date() })).toBe(false)
    expect(reintentableTrasCorte({ ...base, canal: 'push' })).toBe(false)
    expect(reintentableTrasCorte(null)).toBe(false)
  })
  it('el rechazo se apunta en el registro de envíos y en el aviso', async () => {
    const llamadas = []
    const db = {
      envioWhatsapp: { updateMany: async (a) => llamadas.push(['wa', a]) },
      envioSeguimiento: { updateMany: async (a) => llamadas.push(['seg', a]) },
    }
    await marcarEnvioFallido(db, 'wamid.X', '131042: Business eligibility payment issue')
    expect(llamadas).toEqual([
      ['wa', { where: { wamid: 'wamid.X' }, data: { ok: false, error: '131042: Business eligibility payment issue' } }],
      ['seg', { where: { wamid: 'wamid.X', canal: 'whatsapp' }, data: { ok: false, error: '131042: Business eligibility payment issue' } }],
    ])
    llamadas.length = 0
    await marcarEnvioFallido(db, null, 'x')
    expect(llamadas).toEqual([])
  })
})

describe('el hilo: webhook → aviso → reintento', () => {
  it('el webhook apunta el rechazo en los avisos', () => {
    const w = readFileSync('app/api/webhook/whatsapp-cloud/route.js', 'utf8')
    expect(w).toMatch(/if \(estado === 'fallido'\) \{\n\s+await marcarEnvioFallido\(prisma, wamid, errorEntrega\)/)
  })
  it('enviarPaso reclama la fila del corte una sola vez y la vuelve a mandar', () => {
    const e = readFileSync('lib/seguimiento/enviar.js', 'utf8')
    expect(e).toContain('if (!reintentableTrasCorte(previa)) return { enviado: false, motivo: \'ya_enviado\' }')
    expect(e).toContain('where: { id: previa.id, ok: false, error: previa.error },')
    expect(e).toContain('envio = previa')
  })
})

describe('el motor vuelve a pedir el paso que no llegó por corte', () => {
  it('ni en la prueba ni en el vencido lo cuenta como enviado', () => {
    const m = readFileSync('lib/seguimiento/motor.js', 'utf8')
    expect(m).toContain('const enviados = new Set(filas.filter((f) => !reintentableTrasCorte(f)).map((f) => f.paso))')
    expect(m).toContain('select: { paso: true, ok: true, error: true, canal: true, respondidoAt: true },')
    expect(m).toContain('const enviados = Object.fromEntries(filas.filter((f) => !reintentableTrasCorte(f)).map((f) => [f.paso, f]))')
  })
})
