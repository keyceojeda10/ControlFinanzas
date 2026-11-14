'use client'

// components/onboarding/wizard/WizardElegirPlan.jsx — «Elige tu plan», como era.
//
// ══ POR QUÉ VUELVE (14 nov 2026) ═══════════════════════════════════════════
//
// Hasta el 1 ago 2026 la primera decisión del asistente, después de «¿quién
// cobra?», era ELEGIR EL PLAN: «Elige tu plan · Selecciona el plan que mejor se
// adapte a tu cartera», con el precio de cada uno. El rediseño la invirtió
// («ya no se elige, se informa»: «Empieza sin pagar nada · gratis · sin
// tarjeta», 10ace715) y la conversión de registro a pago cayó de 13 % a 3 %
// en las dos semanas siguientes. Los registrados la semana anterior —que
// usaron la app nueva pero entraron por el registro viejo— pagaron el 13 %.
//
// El dueño decidió volver al flujo de antes, adaptado al diseño de hoy, y
// medirlo 6 semanas (memoria `quiebre_conversion_1ago`). Por eso:
//   · la elección es OBLIGATORIA y es el propio toque en la tarjeta: tocar es
//     elegir y seguir, como antes. No hay un botón «continuar» al fondo — esa
//     pantalla larga con la salida fuera de vista ya atascó el arranque una
//     vez (WizardPlan, ago 2026);
//   · la prueba corre en el plan elegido: quien tiene cobradores los puede
//     probar desde el primer día (`/api/onboarding/cambiar-plan`);
//   · el precio se ve: es la señal de que esto es algo que se paga.
//
// Ni un número escrito aquí: planes, techos y precios salen de PLANES_CONFIG y
// de `tramosDePlan` (lo que de verdad se cobra y se limita).

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { tramosDePlan } from '@/lib/adaptadores/planes'
import { DIAS_PRUEBA, DIAS_PRUEBA_BASE, DIAS_COBRO_PARA_REGALO } from '@/lib/planes'
import { useCountry } from '@/hooks/useCountry'

/** Cuántos planes se ofrecen a cada perfil: como antes, dos a quien cobra solo
 *  (Inicial y Básico) y tres a quien tiene cobradores. */
export const PLANES_POR_PERFIL = { solo: 2, equipo: 3 }

export default function WizardElegirPlan({ perfil = 'solo', onElegido, onVolver, onPagar }) {
  const { country, formatMoney } = useCountry()
  const { update: refrescarSesion } = useSession()
  const esEquipo = perfil === 'equipo'
  const tramos = tramosDePlan(country, (n) => formatMoney(n), PLANES_POR_PERFIL[esEquipo ? 'equipo' : 'solo'], perfil)
  const recomendado = tramos[0]?.id
  const [guardando, setGuardando] = useState(null)
  const [error, setError] = useState('')

  /* Tocar es elegir. Se guarda y, solo si el servidor lo aceptó, se sigue: no
     se avanza con un plan que la cuenta no tiene. */
  const elegir = async (id) => {
    if (guardando) return
    setError('')
    setGuardando(id)
    try {
      const r = await fetch('/api/onboarding/cambiar-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: id }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(d.error || 'No se pudo guardar el plan. Inténtalo otra vez.')
        return
      }
      // El plan va en la sesión: sin refrescarla, los límites de la pantalla
      // seguirían siendo los del plan de antes hasta volver a entrar.
      await refrescarSesion?.().catch(() => {})
      onElegido?.(id)
    } catch {
      setError('No hay conexión. Revisa tu internet e inténtalo otra vez.')
    } finally {
      setGuardando(null)
    }
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col" style={{ gap: 18 }}>
      <div>
        <h2 style={{
          fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 20, fontWeight: 600, letterSpacing: '-.02em',
          color: 'var(--cf-ink)', margin: 0, lineHeight: 1.25,
        }}>
          {esEquipo ? 'Elige tu plan de equipo' : 'Elige tu plan'}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--cf-ink-2)', marginTop: 6, lineHeight: 1.45 }}>
          {esEquipo
            ? 'Para trabajar con cobradores necesitas un plan de equipo.'
            : 'Selecciona el plan que mejor se adapte a tu cartera.'}
        </p>
      </div>

      {/* Lo que quita el miedo a elegir: la prueba no cobra. Condicional, como
          en todo el sistema: la prueba es de 7 días y llega a 14 cobrando. */}
      <div role="note" style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        padding: '11px 14px', borderRadius: 'var(--cf-r-control)',
        background: 'var(--cf-green-pill-bg)', border: '1px solid var(--cf-green-pill-border)',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cf-green-dark)" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', marginTop: 1 }} aria-hidden>
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p style={{ fontSize: 12, color: 'var(--cf-ink-2)', margin: 0, lineHeight: 1.5 }}>
          Gratis {DIAS_PRUEBA_BASE} días, y hasta {DIAS_PRUEBA} si registras cobros {DIAS_COBRO_PARA_REGALO} días
          distintos. No se cobra nada hasta que termine tu prueba.
        </p>
      </div>

      <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tramos.map((t) => {
          const esRecomendado = t.id === recomendado
          const esEste = guardando === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="listitem"
              onClick={() => elegir(t.id)}
              disabled={Boolean(guardando)}
              aria-label={`Elegir ${t.texto}, ${t.precio} al mes`}
              style={{
                width: '100%', textAlign: 'left', font: 'inherit',
                cursor: guardando ? 'progress' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px', borderRadius: 'var(--cf-r-card)',
                background: esRecomendado ? 'var(--cf-gold-tint)' : 'var(--cf-card)',
                border: `1px solid ${esRecomendado ? 'var(--cf-gold-border)' : 'var(--cf-border)'}`,
                opacity: guardando && !esEste ? 0.55 : 1,
                transition: 'opacity 160ms ease',
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)' }}>{t.texto}</span>
                  {esRecomendado && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '.04em',
                      padding: '2px 8px', borderRadius: 999,
                      background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
                    }}>
                      Recomendado
                    </span>
                  )}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--cf-ink-2)', marginTop: 2 }}>
                  {t.desbloquea}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--cf-ink-3)', marginTop: 1 }}>
                  {t.techo}
                </span>
                <span className="cf-fig" style={{ display: 'block', fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 15, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', marginTop: 6 }}>
                  {t.precio}
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--cf-ink-3)' }}> /mes</span>
                </span>
              </span>
              <span aria-hidden style={{ flex: 'none', color: esRecomendado ? 'var(--cf-gold-text)' : 'var(--cf-ink-3)' }}>
                {esEste ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                    strokeLinecap="round" className="animate-spin">
                    <path d="M12 3a9 9 0 019 9" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </span>
            </button>
          )
        })}
      </div>

      {error && (
        <p role="alert" style={{ fontSize: 12, color: 'var(--cf-red-dark)', margin: 0, lineHeight: 1.5 }}>
          {error}
        </p>
      )}

      <p style={{ fontSize: 12, color: 'var(--cf-ink-3)', margin: 0, lineHeight: 1.5 }}>
        Puedes cambiar de plan cuando quieras desde Configuración.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={onVolver} disabled={Boolean(guardando)} style={{
          background: 'none', border: 0, padding: '8px 0', cursor: 'pointer', font: 'inherit',
          display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--cf-ink-3)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        {onPagar && (
          <button type="button" onClick={onPagar} disabled={Boolean(guardando)} style={{
            background: 'none', border: 0, padding: '8px 0', cursor: 'pointer', font: 'inherit',
            fontSize: 13, color: 'var(--cf-ink-3)', textDecoration: 'underline', textUnderlineOffset: 3,
          }}>
            Pagar un plan desde ya
          </button>
        )}
      </div>
    </div>
  )
}
