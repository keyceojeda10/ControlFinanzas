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
})
