'use client'
/* ── «TU PRIMER MES 35 % MÁS BARATO» — LA VENTANA ────────────────────────────
 *
 * Opción B del dueño (12 oct 2026). La oferta del 35 % por dejar el Nequi
 * guardado salía solo por WhatsApp; un cliente preguntó si aplicaba y cómo
 * hacía. Ahora se abre aquí, en el centro, UNA vez al día, cuando se acerca el
 * vencimiento (lo decide `debeAbrirseVentanaNequi`, lib/oferta-nequi-aviso.js):
 *   · en prueba, a quien usa el sistema (6 clientes o más) en sus 3 últimos días;
 *   · pagando a mano, en los 5 días antes de que venza el plan.
 * El botón abre la hoja de pago ya con el Nequi primero (`?suscribir=1`). Un
 * solo mes con descuento, y así lo dice.
 *
 * ⚠ NUNCA ENCIMA DE OTRA VENTANA. Si al abrirse ya hay una (la de «Hoy te toca
 * cobrar»), no sale y lo intenta en la siguiente pantalla: dos ventanas seguidas
 * es lo que hace que la gente cierre todo sin leer.
 * ⚠ Espera a que la página termine de cargar (el #418 de AvisoCobrarHoy).
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { formatMoney } from '@/lib/i18n'
import { pedirCompartido } from '@/lib/pedir-compartido'
import { PLANES_CONFIG } from '@/lib/planes'
import { debeAbrirseVentanaNequi, precioConOferta } from '@/lib/oferta-nequi-aviso'

const diaBogota = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10)
const clave = (dia) => `cf-ventana-nequi-${dia}`
const leer = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const guardar = (k) => { try { localStorage.setItem(k, '1') } catch {} }
const fechaLarga = (d) => new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' })

export default function AvisoOfertaNequi() {
  const { rol } = useAuth()
  const pathname = usePathname()
  const [d, setD] = useState(null)

  useEffect(() => {
    if (rol !== 'owner' || d) return
    if (pathname?.startsWith('/configuracion/plan')) return // ahí ya está la oferta, junto al botón
    let vivo = true
    const listo = () => new Promise((ok) => {
      const despues = () => setTimeout(ok, 1200)
      if (document.readyState === 'complete') despues()
      else window.addEventListener('load', despues, { once: true })
    })
    Promise.all([pedirCompartido('/api/pagos/estado', { ventanaMs: 60_000 }), listo()])
      .then(([estado]) => {
        if (!vivo || !debeAbrirseVentanaNequi(estado, { rol, vistoHoy: Boolean(leer(clave(diaBogota()))) })) return
        if (document.querySelector('[role="dialog"]')) return // otra ventana abierta: en la siguiente pantalla
        setD(estado)
      })
      .catch(() => {})
    return () => { vivo = false }
  }, [rol, pathname, d])

  if (!d) return null

  const pct = d.ofertaNequi
  const enPrueba = d.planPagado === false
  const precio = Number(d.proximoCobro?.monto) || 0
  const nombrePlan = PLANES_CONFIG[d.proximoCobro?.plan]?.nombre ?? null
  const cerrar = () => { guardar(clave(diaBogota())); setD(null) }
  const guardarNequi = () => { guardar(clave(diaBogota())); window.location.assign('/configuracion/plan?suscribir=1') }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`${enPrueba ? 'Tu primer mes' : 'Tu próximo mes'} ${pct} % más barato`} onClick={cerrar} style={{
      position: 'fixed', inset: 0, zIndex: 10003, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, background: 'rgba(10,11,14,.55)',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 'min(100%, 400px)', background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderRadius: 20,
        padding: '22px 20px 14px', display: 'flex', flexDirection: 'column', gap: 14, color: 'var(--cf-ink)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 44, height: 44, borderRadius: 12, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'color-mix(in srgb, var(--cf-green-dark) 14%, transparent)', color: 'var(--cf-green-dark)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M9 14l6-6M9.5 8.5h.01M14.5 13.5h.01M20 12a8 8 0 11-16 0 8 8 0 0116 0z" />
            </svg>
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cf-green-dark)' }}>
            {enPrueba ? 'Tu prueba termina' : 'Tu plan vence'} el {fechaLarga(d.fechaVencimiento)}
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 24, fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1.15 }}>
          {enPrueba ? 'Tu primer mes' : 'Tu próximo mes'} {pct} % más barato
        </span>
        <span style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--cf-ink-2)' }}>
          Deja tu Nequi guardado para el pago automático y {enPrueba ? 'el primer mes' : 'ese mes'} pagas menos. Solo ese mes; después, el precio normal. Lo quitas cuando quieras.
        </span>
        {precio > 0 && (
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 10, padding: '12px 14px', borderRadius: 12,
            background: 'var(--cf-surface)', border: '1px solid var(--cf-border)',
          }}>
            <span style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>{nombrePlan ? `Plan ${nombrePlan}` : 'Tu plan'}</span>
            <span style={{ flex: 1 }} />
            <span className="cf-fig" style={{ fontSize: 15, color: 'var(--cf-ink-3)', textDecoration: 'line-through' }}>{formatMoney(precio)}</span>
            <span className="cf-fig" style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 22, fontWeight: 600, color: 'var(--cf-green-dark)' }}>
              {formatMoney(precioConOferta(precio, pct))}
            </span>
          </div>
        )}
        <button type="button" onClick={guardarNequi} style={{
          height: 52, borderRadius: 14, border: 0, cursor: 'pointer', font: 'inherit',
          background: 'var(--cf-green-dark)', color: '#fff', fontSize: 16, fontWeight: 700,
        }}>Guardar mi Nequi</button>
        <button type="button" onClick={cerrar} style={{
          height: 40, border: 0, background: 'none', cursor: 'pointer', font: 'inherit',
          fontSize: 14, fontWeight: 600, color: 'var(--cf-ink-3)',
        }}>Ahora no</button>
      </div>
    </div>,
    document.body,
  )
}
