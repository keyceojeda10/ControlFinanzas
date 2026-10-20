'use client'

/* La novedad «El profe en toda la app» (Carlos, 19 oct 2026): un video que
 * cuenta que ahora hay tutoriales en cada pantalla. Se abre SOLA una vez por
 * persona —en el servidor: en otro teléfono no vuelve— y se cierra con «Ahora
 * no». Ver `NOVEDAD_PROFE` (lib/tutoriales/profe.js) para a quién le sale.
 *
 * ⚠ NUNCA ENCIMA DE PAGAR NI DE OTRA NOVEDAD. Igual que `NovedadesModal`: no
 * tapa las pantallas de pago, y si ese día ya va a salir la otra novedad, ésta
 * espera a la próxima visita. Dos ventanas que se abren solas seguidas se
 * cierran las dos sin leer. */

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createPortal } from 'react-dom'
import HojaInferior from '@/components/cf/HojaInferior'
import { NOVEDADES, NOVEDADES_VERSION, novedadVigente } from '@/lib/novedades'
import { NOVEDAD_PROFE, reloj } from '@/lib/tutoriales/profe'

const RUTAS_SIN_MODAL = ['/configuracion/plan', '/pago', '/checkout', '/suscripcion-vencida']

/** ¿Va a salir hoy la otra novedad? Misma cuenta que `NovedadesModal`. */
function saleLaOtra() {
  try {
    const visto = Number(localStorage.getItem('cf:novedades:visto') || 0)
    return NOVEDADES_VERSION > visto && novedadVigente(NOVEDADES[0])
  } catch { return false }
}

export default function NovedadProfe({ profe, primeraVez, videoAbierto }) {
  const ruta = usePathname() || '/'
  const [abierta, setAbierta] = useState(false)
  const video = profe.visibles.find((v) => v.id === NOVEDAD_PROFE.video)
  const toca = Boolean(
    profe.activo && profe.cargado && primeraVez?.novedad && video
    && !profe.vistos.has(video.id) && !profe.descartados.includes(video.id),
  )

  useEffect(() => {
    if (!toca || abierta || videoAbierto) return undefined
    if (RUTAS_SIN_MODAL.some((r) => ruta.startsWith(r)) || saleLaOtra()) return undefined
    // Un respiro: que la pantalla cargue antes de que se abra nada encima.
    const t = setTimeout(() => setAbierta(true), 1500)
    return () => clearTimeout(t)
  }, [toca, abierta, videoAbierto, ruta])

  if (!abierta || !toca) return null

  // Verla o cerrarla cuentan igual: no vuelve a abrirse sola.
  const cerrar = () => { profe.descartarAviso(video.id); setAbierta(false) }
  const ver = () => { profe.descartarAviso(video.id); setAbierta(false); profe.abrir(video.id, { via: 'novedad' }) }

  return createPortal(
    <div style={{ position: 'relative', zIndex: 95 }}>
      <HojaInferior abierta onCerrar={cerrar} titulo="Novedad" subtitulo={NOVEDAD_PROFE.titulo}
        accion={
          <div style={{ flex: 1, display: 'flex', gap: 8 }}>
            <button type="button" onClick={ver} style={{
              flex: 1.4, height: 48, borderRadius: 'var(--cf-r-control)', border: 0, cursor: 'pointer', font: 'inherit',
              fontSize: 15, fontWeight: 700, background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
            }}>Ver en {reloj(video.duracion)}</button>
            <button type="button" onClick={cerrar} style={{
              flex: 1, height: 48, borderRadius: 'var(--cf-r-control)', cursor: 'pointer', font: 'inherit',
              fontSize: 15, fontWeight: 600, background: 'var(--cf-card)', color: 'var(--cf-ink)', border: '1px solid var(--cf-border-strong)',
            }}>Ahora no</button>
          </div>
        }
      >
        <button type="button" onClick={ver} aria-label={`Ver el video: ${video.titulo}`} style={{
          position: 'relative', display: 'block', width: '100%', height: 220, border: 0, padding: 0, cursor: 'pointer',
          borderRadius: 'var(--cf-r-card)', overflow: 'hidden', background: '#22232A',
        }}>
          {video.poster && <img src={video.poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
          <span aria-hidden style={{
            position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
            width: 60, height: 60, borderRadius: 999, background: 'var(--cf-gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,.3)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--cf-gold-ink)"><path d="M7 4.5v15l13-7.5z" /></svg>
          </span>
        </button>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--cf-ink-2)' }}>{NOVEDAD_PROFE.porque}</p>
      </HojaInferior>
    </div>,
    document.body,
  )
}
