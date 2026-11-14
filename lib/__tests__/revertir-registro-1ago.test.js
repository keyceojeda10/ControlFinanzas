/**
 * EL REGISTRO COMO ERA ANTES DEL 1 AGO 2026 (14 nov 2026).
 *
 * Medido: la conversión de registro a pago pasó de 13 % a 3 % la semana del
 * 3 ago, cuando entraron el asistente «Empieza sin pagar nada» (sin elegir
 * plan) y, el 8 ago, el candado de Analíticas, su PDF y el ranking. El dueño
 * decidió volver al punto exacto de antes y medir 6 semanas. Ver memoria `quiebre_conversion_1ago`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { nivelReportes, PLANES_CONFIG } from '@/lib/planes'
import { tramosDePlan } from '@/lib/adaptadores/planes'

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('Analíticas, su PDF y el ranking: abiertos para todos, como antes del 8 ago', () => {
  /* El dueño: «¿no sería contraproducente […] cuando ya pagan, les quitamos
     las opciones?». Por eso NO es «abierto en la prueba y cerrado al pagar»:
     es volver al punto exacto de antes, abierto para todos. */
  for (const f of ['app/api/dashboard/analiticas/route.js', 'app/api/dashboard/analiticas/reporte-pdf/route.js', 'app/api/reportes/scorecard/route.js']) {
    it(`${f} sin barrera de plan, y dicho`, () => {
      const src = leer(f)
      expect(src).not.toMatch(/exigeNivelReportes\(/)
      expect(src).toMatch(/ABIERTO A PROPÓSITO, SIN BARRERA DE PLAN \(14 nov 2026\)/)
    })
  }
  it('los informes de Reportes siguen por plan, como antes', () => {
    expect(leer('app/api/reportes/resumen/route.js')).toMatch(/exigeNivelReportes\(session, 1\)/)
    expect(nivelReportes('starter')).toBe(0)
  })
  it('a Analíticas se llega desde «Más»', () => {
    expect(leer('components/pantallas/PantallaMas.jsx')).toMatch(/destino: '\/dashboard\/analiticas'/)
  })
})

describe('«Elige tu plan», como antes', () => {
  it('a quien cobra solo, Inicial y Básico; a quien tiene cobradores, tres planes con cobradores', () => {
    // El componente lleva JSX y vitest no lo importa: la constante se lee del código.
    expect(leer('components/onboarding/wizard/WizardElegirPlan.jsx')).toMatch(/export const PLANES_POR_PERFIL = \{ solo: 2, equipo: 3 \}/)
    const PLANES_POR_PERFIL = { solo: 2, equipo: 3 }
    expect(tramosDePlan('co', String, PLANES_POR_PERFIL.solo, 'solo').map((t) => t.id)).toEqual(['starter', 'basic'])
    const equipo = tramosDePlan('co', String, PLANES_POR_PERFIL.equipo, 'equipo')
    expect(equipo).toHaveLength(3)
    for (const t of equipo) expect(PLANES_CONFIG[t.id].maxUsuarios).toBeGreaterThan(1)
  })

  it('tocar la tarjeta guarda el plan y SOLO si el servidor lo aceptó sigue', () => {
    const c = leer('components/onboarding/wizard/WizardElegirPlan.jsx')
    expect(c).toMatch(/fetch\('\/api\/onboarding\/cambiar-plan'/)
    const guarda = c.indexOf("fetch('/api/onboarding/cambiar-plan'")
    const falla = c.indexOf('if (!r.ok) {')
    const sigue = c.indexOf('onElegido?.(id)')
    expect(guarda).toBeLessThan(falla)
    expect(falla).toBeLessThan(sigue)
    expect(c).toMatch(/onClick=\{\(\) => elegir\(t\.id\)\}/)
    // El precio se ve, y la prueba se dice condicional (7 + 7), nunca «14 días gratis» a secas.
    expect(c).toMatch(/\{t\.precio\}/)
    expect(c).toMatch(/Gratis \{DIAS_PRUEBA_BASE\} días, y hasta \{DIAS_PRUEBA\} si registras cobros/)
  })

  it('sale la pantalla «Empieza sin pagar nada»', () => {
    expect(existsSync(resolve(process.cwd(), 'components/onboarding/wizard/WizardPlan.jsx'))).toBe(false)
    const w = leer('components/onboarding/OnboardingWizard.jsx')
    // Anclado en código, no en prosa: el comentario del asistente cita la pantalla vieja.
    expect(w).not.toMatch(/<WizardPlan\b|vioPlan &&|!vioPlan/)
    expect(w).toMatch(/\{step === 2 && flujo && !metodo && \(\n\s+<TraerCartera/)
  })

  it('se sigue midiendo: vista, elegida (con el plan) y pagar desde ya', () => {
    const w = leer('components/onboarding/OnboardingWizard.jsx')
    expect(w).toMatch(/if \(step === 0 && perfilPendiente\) marcar\('onb_plan_visto', \{ flujo: perfilPendiente \}\)/)
    expect(w).toMatch(/marcar\('onb_plan_seguir', \{ flujo: perfilPendiente, plan \}\)/)
    expect(w).toMatch(/marcar\('onb_plan_pagar', \{ flujo: perfilPendiente \}\)/)
  })
})
