'use client'

/* El ícono al lado de cada función (lámina E2, elegida por Carlos el 17 oct
 * 2026): un botón redondo de play al final de la fila que abre el video de esa
 * función. La fila sigue abriendo la función, como antes.
 *
 *   <BotonProfe id="prestamos-cerrar" junto="Anular" />
 *
 * `flotante`: lleva la sombra de lo que flota (junto a una barra flotante).
 * `junto` es el texto del control tal como está en el catálogo (`junto_a`): si
 * esa entrada trae `desde`, el video abre en el capítulo de esa función.
 *
 * No pinta nada si el video no está terminado, si esta persona no lo puede ver
 * (cobrador sin `cobrador` en `para`) o si apagó «Ver el botón del profe».
 * Una vez visto queda en gris (decisión 3 del catálogo). */

import { desdeDe } from '@/lib/tutoriales/profe'
import { useProfe } from './ProfeProvider'

export default function BotonProfe({ id, junto, flotante = false, style }) {
  const profe = useProfe()
  if (!profe?.activo || !profe.botonVisible) return null
  const video = profe.visibles.find((v) => v.id === id)
  if (!video) return null
  const visto = profe.vistos.has(id)
  return (
    <button
      type="button"
      aria-label={`Ver el video: ${video.titulo}`}
      title={`Ver el video: ${video.titulo}`}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); profe.abrir(id, { desde: desdeDe(video, junto), via: 'E2' }) }}
      style={{
        width: 44, height: 44, flex: 'none', border: 0, background: 'none', padding: 0, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style,
      }}
    >
      <span aria-hidden style={{
        width: 30, height: 30, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: visto ? 'var(--cf-fill)' : 'var(--cf-gold-tint)',
        border: `1px solid ${visto ? 'var(--cf-border)' : 'var(--cf-gold-border)'}`,
        color: visto ? 'var(--cf-ink-3)' : 'var(--cf-gold-text)',
        // Sobre una barra que flota (el recorrido): la sombra de lo que flota.
        ...(flotante ? { boxShadow: 'var(--cf-sh-float)' } : {}),
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
      </span>
    </button>
  )
}
