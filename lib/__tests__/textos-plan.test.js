import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// DETALLES-PLAN (27 oct 2026): textos del plan que salen en el video «Pagar tu
// plan». Anclados en el JSX, no en los comentarios.

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('con tildes', () => {
  it('la franja y la ventana del último día', () => {
    const b = leer('components/layout/SuscripcionBanner.jsx')
    expect(b).toMatch(/>Tu plan venció<\/p>/)
    expect(b).toMatch(/\n\s*Tu plan está por vencer\n/)
    expect(b).toMatch(/El acceso al sistema se suspenderá cuando/)
  })
  it('la pantalla de vencida y su WhatsApp', () => {
    const v = leer('app/suscripcion-vencida/page.jsx')
    expect(v).toMatch(/: 'Tu plan ya no está activo\.'/)
    expect(v).toMatch(/'Hola, mi suscripción de Control Finanzas venció\./)
  })
})

describe('Mi plan', () => {
  const p = leer('app/(dashboard)/configuracion/plan/page.jsx')
  it('un día es «día restante»', () => {
    expect(p).toMatch(/\{dias\} \{dias === 1 \? 'día restante' : 'días restantes'\}/)
  })
  it('ya vencida dice «venció» y no enseña los días', () => {
    expect(p).toMatch(/const vencido = !!fechaVenc && dias <= 0/)
    expect(p).toMatch(/`Tu \$\{esTrial \? 'prueba' : 'plan'\} venció el \$\{formatFecha\(fechaVenc\)\}`/)
    expect(p).toMatch(/\{!vencido && \(\s*<div className="flex items-center justify-between">/)
  })
  // DETALLES-PLAN #7 y #8 (27 oct, tarde).
  it('con más de un ciclo por delante no dice «de 30 días»', () => {
    expect(p).toMatch(/\{dias <= totalDias && \(\s*<span[^>]*>\s*de \{totalDias\} días/)
  })
  it('«¿Necesitas ayuda?» y la prueba gratuita, con sus signos y tildes', () => {
    expect(p).toContain('>¿Necesitas ayuda?</p>')
    expect(p).toContain("{estado.diasTrial === 1 ? 'día restante' : 'días restantes'}")
    expect(p).toContain('tu cuenta pasará al plan')
  })
})

// DETALLES-CONFIGURACION #4: salen en el video «Configuración».
describe('Configuración, con tildes', () => {
  const c = leer('app/(dashboard)/configuracion/page.jsx')
  it('portal, avisos por WhatsApp, seguridad y aprobar préstamos', () => {
    expect(c).toContain('tasa de interés y demás detalles financieros. Si desactivas esto, solo verá saldo')
    expect(c).toContain('Configura qué información se incluye en los mensajes que se envían')
    expect(c).toContain('Descarga toda la información de tu cuenta')
    expect(c).toContain('Elimina todos los clientes, préstamos, pagos, rutas, socios y cobradores. Tu cuenta y suscripción se mantienen.')
    expect(c).toContain('>Aprobar préstamos del cobrador<')
    expect(c).toContain('>Tasa moratoria mensual (%)<')
  })
  it('los medios de transferencia', () => {
    expect(leer('components/pagos/MetodoPagoAdmin.jsx')).toContain('Estos aparecen para toda tu organización.')
  })
})
