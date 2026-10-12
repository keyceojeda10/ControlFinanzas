'use client'
/* ── «HOY TE TOCA COBRAR» ────────────────────────────────────────────────────
 *
 * Bloque 3 del plan de seguimiento (12 oct 2026). Se abre al entrar a la app,
 * SOLO a quien está en prueba, SOLO si hoy le tocan cobros y todavía no
 * registró ninguno (lo decide `/api/seguimiento/aviso-del-dia`). Lleva los
 * cobros y el monto de hoy, un botón grande que abre el primer cobro de la
 * ruta, y el avance hacia los 7 días de regalo.
 *
 * El dato que lo justifica: quien cobra en 5 días distintos en sus primeros 12
 * paga el 85 % de las veces; quien cobra uno solo, el 21 %.
 *
 * Se cierra con un toque y no vuelve ese día (localStorage). Desde las 6 p. m.
 * no sale: a esa hora toca «Tu resumen del día», y dos ventanas encima es ruido.
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/hooks/useAuth'
import { formatMoney } from '@/lib/i18n'

const leer = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const guardar = (k, v) => { try { localStorage.setItem(k, v) } catch {} }
const clave = (dia) => `cf-aviso-cobrar-${dia}`
const HORA_TOPE = 18

export default function AvisoCobrarHoy() {
  const { rol } = useAuth()
  const [d, setD] = useState(null)

  useEffect(() => {
    if (rol !== 'owner') return
    if (new Date().getHours() >= HORA_TOPE) return
    let vivo = true
    /* ⚠ SE ABRE CUANDO LA PÁGINA TERMINÓ DE CARGAR. En el teléfono la respuesta
       llegaba antes de que React acabara de hidratar las partes que llegan en
       streaming, y meter el aviso en el `body` en ese momento daba el error
       #418 (el HTML no coincide). Se vio en el espejo a 412 px; en PC no. */
    const listo = () => new Promise((ok) => {
      const despues = () => setTimeout(ok, 400)
      if (document.readyState === 'complete') despues()
      else window.addEventListener('load', despues, { once: true })
    })
    Promise.all([
      fetch('/api/seguimiento/aviso-del-dia').then((r) => (r.ok ? r.json() : null)),
      listo(),
    ])
      .then(([j]) => { if (vivo && j?.mostrar && !leer(clave(j.dia))) setD(j) })
      .catch(() => {})
    return () => { vivo = false }
  }, [rol])

  if (!d) return null

  const cerrar = () => { guardar(clave(d.dia), '1'); setD(null) }
  const cobrar = () => { guardar(clave(d.dia), '1'); window.location.assign('/cobros-hoy?empezar=1') }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Hoy te toca cobrar" onClick={cerrar} style={{
      position: 'fixed', inset: 0, zIndex: 10003, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, background: 'rgba(10,11,14,.55)',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 'min(100%, 400px)', background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderRadius: 20,
        padding: '22px 20px 16px', display: 'flex', flexDirection: 'column', gap: 16, color: 'var(--cf-ink)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cf-gold-dark)' }}>Hoy te toca cobrar</span>
            <span className="cf-fig" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-.02em' }}>
              {d.cobros} {d.cobros === 1 ? 'cobro' : 'cobros'}
            </span>
            <span style={{ fontSize: 15, color: 'var(--cf-ink-2)' }}>por {formatMoney(d.monto)}</span>
          </div>
          <button type="button" onClick={cerrar} aria-label="Cerrar" style={{
            width: 36, height: 36, borderRadius: 999, border: '1px solid var(--cf-border)', background: 'var(--cf-surface)',
            color: 'var(--cf-ink-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {d.regalo && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', borderRadius: 12, background: 'var(--cf-surface)', border: '1px solid var(--cf-border)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cf-ink)' }}>
              Cobrando hoy vas en el día {Math.min(d.regalo.dias + 1, d.regalo.meta)} de {d.regalo.meta} para ganar {d.regalo.diasRegalo} días de regalo
            </span>
            <div style={{ display: 'flex', gap: 6 }} aria-hidden>
              {Array.from({ length: d.regalo.meta }, (_, i) => (
                <span key={i} style={{
                  flex: 1, height: 6, borderRadius: 999,
                  background: i < d.regalo.dias ? 'var(--cf-green-dark)'
                    : i === d.regalo.dias ? 'color-mix(in srgb, var(--cf-green-dark) 35%, transparent)'
                      : 'var(--cf-border)',
                }} />
              ))}
            </div>
          </div>
        )}

        <button type="button" onClick={cobrar} style={{
          height: 54, borderRadius: 999, border: 0, cursor: 'pointer', font: 'inherit',
          background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', fontSize: 16, fontWeight: 700,
        }}>Cobrar ahora</button>
      </div>
    </div>,
    document.body,
  )
}
