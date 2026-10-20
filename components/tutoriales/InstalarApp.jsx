'use client'

/* La página pública /instalar: el video del profe para instalar la app y, al
 * pie, los pasos exactos de este teléfono (`InstallGuideModal`, que detecta el
 * equipo y el navegador). Sin sesión: se manda por WhatsApp.
 *
 * El video solo sale si está terminado en el catálogo (`listo`); mientras, la
 * página da los pasos, que es lo que ya funcionaba. */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { videoPorId, partesDe, capituloEn, reloj } from '@/lib/tutoriales/profe'
import { isStandalone } from '@/components/layout/InstallButton'
import PuertaInstalacion, { pedirInstalar } from '@/components/layout/PuertaInstalacion'
import { detectar, caminoInstalar, enlaceAChrome } from '@/lib/instalar'

const VIDEO = videoPorId('inicio-instalar')
const LISTO = Boolean(VIDEO && (VIDEO.estado === 'listo' || VIDEO.estado === 'montado'))

export default function InstalarApp() {
  const ref = useRef(null)
  const [t, setT] = useState(0)
  const [instalada, setInstalada] = useState(false)
  // El camino de ESTE teléfono; cambia a «un toque» si el navegador avisa tarde.
  const [camino, setCamino] = useState(null)
  useEffect(() => {
    setInstalada(isStandalone())
    const decidir = () => setCamino(caminoInstalar(detectar(navigator.userAgent), { hayToque: Boolean(window.__cfInstalar) }))
    decidir()
    const yaEsta = () => setInstalada(true)
    window.addEventListener('cf:instalable', decidir)
    window.addEventListener('cf:instalada', yaEsta)
    return () => { window.removeEventListener('cf:instalable', decidir); window.removeEventListener('cf:instalada', yaEsta) }
  }, [])
  const textoBoton = {
    'un-toque': 'Instalar ahora',
    'ios-safari': 'Cómo instalarla en tu iPhone',
    'ios-chrome': 'Cómo instalarla en tu iPhone',
    'ios-dentro': 'Cómo instalarla en tu iPhone',
  }[camino] ?? 'Ver los pasos en este teléfono'
  const partes = LISTO ? partesDe(VIDEO) : []
  const actual = LISTO ? capituloEn(VIDEO, t) : -1

  const irA = (s) => { const v = ref.current; if (!v) return; v.currentTime = s; v.play().catch(() => {}) }

  return (
    <main style={{
      minHeight: '100dvh', background: 'var(--cf-surface)', color: 'var(--cf-ink)',
      display: 'flex', justifyContent: 'center', padding: '24px 16px 40px',
    }}>
      <div style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/apple-icon.png" alt="" width={36} height={36} style={{ borderRadius: 10 }} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>Control Finanzas</span>
        </div>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1.2, textWrap: 'balance' }}>
          Instala la app en tu teléfono
        </h1>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--cf-ink-2)' }}>
          Queda en tu pantalla de inicio como cualquier app, y abre más rápido.
          {LISTO ? ' Mira el video: el profe te lo enseña en un minuto.' : ''}
        </p>

        {instalada && (
          <p style={{ margin: 0, padding: '12px 14px', borderRadius: 'var(--cf-r-card)', background: 'var(--cf-green-pill-bg)', color: 'var(--cf-green-dark)', fontSize: 14, fontWeight: 600 }}>
            Ya la tienes instalada en este teléfono.
          </p>
        )}

        {LISTO && (
          <>
            <div style={{ borderRadius: 16, overflow: 'hidden', background: '#000', display: 'flex', justifyContent: 'center' }}>
              <video
                ref={ref}
                src={VIDEO.src}
                poster={VIDEO.poster}
                controls
                playsInline
                preload="metadata"
                onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
                style={{ width: '100%', maxHeight: '70dvh', aspectRatio: '9 / 16', objectFit: 'contain', display: 'block' }}
              />
            </div>
            <div role="list" aria-label="Partes del video" style={{ borderRadius: 'var(--cf-r-card)', border: '1px solid var(--cf-border)', background: 'var(--cf-card)', overflow: 'hidden' }}>
              {partes.map((p, i) => (
                <button key={p.n} type="button" role="listitem" onClick={() => irA(p.t)} aria-current={i === actual ? 'true' : undefined} style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 48, padding: '8px 14px', textAlign: 'left',
                  border: 0, borderTop: i ? '1px solid var(--cf-border)' : 0, cursor: 'pointer', font: 'inherit',
                  background: i === actual ? 'var(--cf-gold-tint-2)' : 'transparent', color: 'var(--cf-ink)',
                }}>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: i === actual ? 700 : 500 }}>{p.titulo}</span>
                  <span className="cf-fig" style={{ fontSize: 12, color: 'var(--cf-ink-3)', fontVariantNumeric: 'tabular-nums' }}>{reloj(p.t)}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Dentro de Facebook o Instagram (Android) no se puede instalar: lo
            primero es salir a Chrome, y ahí ya es de un toque. */}
        {!instalada && camino === 'abrir-en-chrome' && (
          <a href={enlaceAChrome(window.location.href)} style={{
            height: 52, borderRadius: 'var(--cf-r-control)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
            fontSize: 16, fontWeight: 700, background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
          }}>Abrir en Chrome para instalarla</a>
        )}
        {!instalada && camino && camino !== 'abrir-en-chrome' && (
          <button type="button" onClick={() => pedirInstalar('pagina-instalar')} style={{
            height: 52, borderRadius: 'var(--cf-r-control)', border: 0, cursor: 'pointer', font: 'inherit',
            fontSize: 16, fontWeight: 700, background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
          }}>{textoBoton}</button>
        )}
        <Link href="/login" style={{ textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--cf-gold-dark)' }}>
          Entrar a la app
        </Link>
      </div>
      <PuertaInstalacion />
    </main>
  )
}
