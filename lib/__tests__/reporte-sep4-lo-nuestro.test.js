/* Lo que era nuestro del informe de BotAdsManager del 4-6 sep 2026. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { CODIGOS_SIN_VUELTA, accionTrasThrottle } from '@/lib/bot-v2/cadencia'

const lee = (p) => readFileSync(p, 'utf8')

describe('los checkouts abiertos se cierran con el pago', () => {
  it('al activar por Wompi se cancelan las filas pendientes del negocio', () => {
    const S = lee('lib/activar-suscripcion.js')
    const i = S.indexOf("estado: 'pendiente', mpStatus: 'pending', gatewayPago: 'wompi'")
    expect(i).toBeGreaterThan(0)
    expect(S.slice(i, i + 200)).toMatch(/estado: 'cancelada', canceladaAt: ahora/)
    // y ANTES de buscar la fila activa, para que el pago siga sin tocar pendientes
    expect(i).toBeLessThan(S.indexOf("OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }],", S.indexOf('tx.suscripcion.findFirst')))
  })
})

describe('el bot', () => {
  it('la recuperación manda el mismo hook que el primer contacto', () => {
    expect(lee('app/api/cron/leads-recovery/route.js')).toMatch(/AB_TEMPLATES = \{ A: 'contacto_v2', B: 'contacto_v2' \}/)
    expect(lee('lib/bot/bridge.js')).toMatch(/TEMPLATE_HOOK = 'contacto_v2'/)
  })
  it('131050 (bloqueó marketing) no se reintenta; 131049 (tope) sí, hasta dos rebotes', () => {
    expect(CODIGOS_SIN_VUELTA.has(131050)).toBe(true)
    expect(accionTrasThrottle(0, 131050)).toBe('dejar-de-insistir')
    expect(accionTrasThrottle(0, 131049)).toBe('devolver-intento')
  })
  it('el cron de leads solo escribe cuando hay algo', () => {
    expect(lee('app/api/cron/leads-sync/route.js')).toMatch(/if \(leads\.length > 0 \|\| nuevos > 0\) console\.log\(`\[Leads Sync\]/)
  })
})

describe('el evento CAPI se manda una vez por negocio y umbral', () => {
  it('mira y marca en PushLog con tipo capi antes de enviar', () => {
    const C = lee('lib/capi-activacion.js')
    const i = C.indexOf('for (const umbral of cruzados) {')
    const bloque = C.slice(i, C.indexOf('await sendConversionEvent({', i))
    expect(bloque).toMatch(/pushLog\.findFirst\(\{\s*\n\s*where: \{ organizationId, tipo: 'capi', clave: evento \}/)
    expect(bloque).toMatch(/if \(yaEnviado\) continue/)
    expect(bloque).toMatch(/pushLog\.create\(/)
  })
  it('celebraciones no cuenta esas filas (filtra por su tipo)', () => {
    expect(lee('app/api/cron/celebraciones/route.js')).toMatch(/tipo: 'celebracion', createdAt/)
  })
})
