'use client'

// components/armazon/PastillaNav.jsx
//
// La barra inferior del rediseño 2026. docs/design_handoff/02-ARMAZON.md sección B.
//
// NO es una barra anclada al borde: es una pastilla que FLOTA sobre el contenido,
// y el contenido pasa por debajo. El modelo anterior (barra anclada de 76px con
// botón dorado sobresaliente) se descartó en el diseño.
//
// El botón + va FUERA de la pastilla, a su derecha, y es CARBÓN con el signo
// dorado — no al revés. El dorado no aparece en el armazón salvo la pastilla del
// destino activo.
//
// Consecuencias para el contenido, que hay que respetar en cada pantalla:
//   1. La columna NO lleva padding-bottom para la barra: el contenido pasa por
//      debajo a propósito, y así se ve que hay más.
//   2. Ningún texto puede quedar detrás de la pastilla. Si una lista termina
//      justo ahí, se corta la última fila; no se deja a medio tapar.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DESTINOS, destinoActivo } from '@/lib/armazon'

const ICONOS = {
  '/dashboard': (
    <>
      <path d="M4 11.5L12 4l8 7.5" />
      <path d="M6 10.5V20h12v-9.5" />
    </>
  ),
  '/clientes': (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" />
      <path d="M16 5.5a3 3 0 010 5.6M17.5 19.5c0-2.2-.8-3.6-2-4.5" />
    </>
  ),
  '/prestamos': (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6.5 12h.01M17.5 12h.01" />
    </>
  ),
  '/rutas': (
    <>
      <path d="M9 4.5L3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8 9 4.5z" />
      <path d="M9 4.5v12.7M15 6.8v12.7" />
    </>
  ),
  '/mas': (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.8" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" />
    </>
  ),
}

export default function PastillaNav({ onCrear }) {
  const pathname = usePathname()
  const activo = destinoActivo(pathname)

  return (
    <nav
      aria-label="Navegación principal"
      style={{
        position: 'fixed',
        left: 'var(--cf-nav-side)', right: 'var(--cf-nav-side)',
        bottom: 'calc(var(--cf-nav-inset) + env(safe-area-inset-bottom, 0px))',
        display: 'flex', alignItems: 'center', gap: 12,
        zIndex: 45,
        // Glitch de rasterizado en GPU Mali (Android): el border-radius de la
        // pastilla parpadea al hacer scroll sin una capa propia.
        transform: 'translateZ(0)',
      }}
    >
      <div style={{
        flex: 1, minWidth: 0,
        height: 'var(--cf-h-nav)',
        borderRadius: 999,
        background: 'var(--cf-card)',
        border: '1px solid var(--cf-border)',
        boxShadow: 'var(--cf-sh-nav)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '0 6px',
      }}>
        {DESTINOS.map((d) => {
          const esActivo = activo === d.href
          return (
            <Link
              key={d.href}
              href={d.href}
              aria-label={d.nombre}
              aria-current={esActivo ? 'page' : undefined}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 42, height: 42, flex: 'none',
                borderRadius: 999,
                // La ÚNICA aparición del dorado en el armazón.
                background: esActivo ? 'var(--cf-gold-tint)' : 'transparent',
              }}
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none"
                stroke={esActivo ? 'var(--cf-gold-dark)' : 'var(--cf-ink-3)'}
                strokeWidth={esActivo ? 2.1 : 1.9}
                strokeLinecap="round" strokeLinejoin="round">
                {ICONOS[d.href]}
              </svg>
            </Link>
          )
        })}
      </div>

      {/* El + : carbón con el signo dorado, nunca al revés. */}
      <button
        type="button"
        onClick={onCrear}
        aria-label="Crear"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flex: 'none',
          width: 62, minWidth: 62, height: 62, minHeight: 62, aspectRatio: '1',
          borderRadius: 999, border: 0, padding: 0, cursor: 'pointer',
          background: 'var(--cf-ink)',
          boxShadow: 'var(--cf-sh-plus)',
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
          stroke="var(--cf-gold-light)" strokeWidth="2.6" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </nav>
  )
}
