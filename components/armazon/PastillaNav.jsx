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
import { ICONO_DE_RUTA } from '@/components/armazon/iconos'

// Los iconos NO viven aquí: son los del sistema (`armazon/iconos.jsx`). Esta
// pastilla tenía su propia copia de los cinco, y por eso «Préstamos» se dibujaba
// con dos puntos aquí y sin ellos en la barra lateral.
const ICONOS = ICONO_DE_RUTA

export default function PastillaNav({ onCrear }) {
  const pathname = usePathname()
  const activo = destinoActivo(pathname)

  return (
    <nav
      aria-label="Navegación principal"
      /* No se imprime: flota fija y salía encima del contenido en el PDF. */
      data-imprimir="no"
      // Solo movil: en escritorio navega la barra lateral, y las dos a la vez
      // son dos barras de navegacion compitiendo en la misma pantalla.
      // `display` va en la clase, no aqui: en linea le ganaria a lg:hidden y la
      // pastilla saldria tambien en escritorio, bajo la barra lateral.
      className="flex lg:hidden"
      style={{
        position: 'fixed',
        left: 'var(--cf-nav-side)', right: 'var(--cf-nav-side)',
        bottom: 'calc(var(--cf-nav-inset) + env(safe-area-inset-bottom, 0px))',
        alignItems: 'center', gap: 12,
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
