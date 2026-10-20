'use client'

/* La biblioteca: todos los videos que esta persona puede ver, por serie, con
 * su portada, lo que duran y «Visto» (TUTORIALES-CATALOGO.md, paso 6).
 *
 * `soloSinVer`: el filtro «Sin ver». Cada serie lleva su `id` de ancla
 * (`serie-<id>`) para el índice de arriba (`AyudaProfe`).
 *
 * Reemplaza en /tutoriales a las guías escritas de `lib/tutorialesData.js`, que
 * contradecían la pantalla en varios puntos (DETALLES-RUTAS #47). Las guías
 * siguen vivas para el buscador («¿cómo hago…?») y el panel de admin. */

import { SERIES, duracionCorta } from '@/lib/tutoriales/profe'
import { useProfe } from './ProfeProvider'

/** Las series con sus videos, en el orden de la ayuda. */
export function seriesConVideos(visibles) {
  return SERIES
    .map((s) => ({ ...s, videos: visibles.filter((v) => v.serie === s.id) }))
    .filter((g) => g.videos.length)
}

export default function ListaVideosProfe({ soloSinVer = false }) {
  const profe = useProfe()
  if (!profe?.activo) return null
  if (!profe.visibles.length) {
    return (
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--cf-ink-2)' }}>
        Tu administrador apagó los videos para los cobradores.
      </p>
    )
  }
  const grupos = seriesConVideos(profe.visibles)
    .map((g) => ({ ...g, videos: soloSinVer ? g.videos.filter((v) => !profe.vistos.has(v.id)) : g.videos }))
    .filter((g) => g.videos.length)

  if (!grupos.length) {
    return (
      <p style={{ margin: 0, padding: '18px 16px', borderRadius: 'var(--cf-r-card)', background: 'var(--cf-card)', border: '1px solid var(--cf-border)', fontSize: 14, color: 'var(--cf-ink-2)' }}>
        Ya los viste todos. Quita «Sin ver» para volver a cualquiera.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {grupos.map((g) => (
        <section key={g.id} id={`serie-${g.id}`} aria-label={g.titulo} style={{ display: 'flex', flexDirection: 'column', gap: 8, scrollMarginTop: 120 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--cf-ink-2)' }}>{g.titulo}</h3>
          <div style={{
            borderRadius: 'var(--cf-r-card)', border: '1px solid var(--cf-border)', background: 'var(--cf-card)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            {g.videos.map((v, i) => {
              const visto = profe.vistos.has(v.id)
              return (
                <button key={v.id} type="button" onClick={() => profe.abrir(v.id, { via: 'ayuda' })} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', minHeight: 72,
                  border: 0, borderTop: i ? '1px solid var(--cf-border)' : 0, background: 'none',
                  textAlign: 'left', cursor: 'pointer', font: 'inherit',
                }}>
                  <span aria-hidden style={{
                    position: 'relative', width: 40, height: 52, flex: 'none', borderRadius: 8, overflow: 'hidden', background: 'var(--cf-fill)',
                  }}>
                    {v.poster && <img src={v.poster} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.3, color: visto ? 'var(--cf-ink-3)' : 'var(--cf-ink)' }}>{v.pregunta || v.titulo}</span>
                  {visto
                    ? <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cf-green-dark)' }}>Visto</span>
                    : <span className="cf-fig" style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>{duracionCorta(v.duracion)}</span>}
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
