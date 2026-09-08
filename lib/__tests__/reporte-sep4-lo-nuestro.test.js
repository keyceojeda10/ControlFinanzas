/* Lo que era nuestro del informe de BotAdsManager del 4-6 sep 2026. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { CODIGOS_SIN_VUELTA, accionTrasThrottle, necesitaRescateUtility } from '@/lib/bot-v2/cadencia'

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
    expect(lee('lib/bot/bridge.js')).toMatch(/TEMPLATE_HOOK = process\.env\.WA_TEMPLATE_PRIMER_CONTACTO \|\| 'contacto_v2'/)
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

describe('7 sep: el 130472 se rescata una vez con la plantilla de utilidad', () => {
  it('solo con el 130472, solo con plantilla, solo la primera vez', () => {
    expect(necesitaRescateUtility({ codigo: 130472, rescatesPrevios: 0, plantilla: 'solicitud_recibida' })).toBe(true)
    expect(necesitaRescateUtility({ codigo: '130472', rescatesPrevios: 0, plantilla: 'solicitud_recibida' })).toBe(true)
    expect(necesitaRescateUtility({ codigo: 130472, rescatesPrevios: 1, plantilla: 'solicitud_recibida' })).toBe(false)
    expect(necesitaRescateUtility({ codigo: 130472, rescatesPrevios: 0, plantilla: null })).toBe(false)
    expect(necesitaRescateUtility({ codigo: 131049, rescatesPrevios: 0, plantilla: 'solicitud_recibida' })).toBe(false)
  })
  it('el webhook lo intenta ANTES de dejar de insistir, y lo deja escrito con su marca', () => {
    const W = lee('app/api/webhook/whatsapp-cloud/route.js')
    const i = W.indexOf('const plantillaRescate = process.env.WA_TEMPLATE_RESCATE')
    expect(i).toBeGreaterThan(0)
    expect(i).toBeLessThan(W.indexOf("=== 'dejar-de-insistir'"))
    expect(W).toMatch(/texto: \{ startsWith: MARCA_RESCATE \}/)
    expect(W).toMatch(/select: \{ id: true, nombre: true, telefono: true, intentosSeguimiento: true, estado: true \}/)
  })
})

describe('7 sep: el cron de formularios mira los que tienen leads, no uno fijo de marzo', () => {
  it('sin FB_FORM_ID recorre los formularios de la página con leads', () => {
    const S = lee('app/api/cron/leads-sync/route.js')
    expect(S).toMatch(/const FORM_ID = process\.env\.FB_FORM_ID \|\| null/)
    expect(S, 'volvió el id fijo del v1').not.toMatch(/933400739047391/)
    expect(S).toMatch(/me\/leadgen_forms\?fields=id,leads_count/)
    expect(S).toMatch(/filter\(\(f\) => Number\(f\.leads_count\) > 0\)/)
  })
})
