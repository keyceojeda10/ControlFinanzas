'use client'

/* Ayuda y tutoriales: LA MISMA pantalla en /tutoriales y en Configuración
 * («en tutoriales también debería estar la configuración de apagar y prender…
 * o un mejor índice», Carlos, 19 oct 2026). Dos puertas, un solo sitio.
 *
 *   · Arriba, cuánto ha visto, con su barra.
 *   · El índice: «Sin ver» y una pastilla por serie que lleva a ella.
 *   · La biblioteca (`ListaVideosProfe`).
 *   · Al final, los interruptores (Adenda 6, §4), DOS y no uno porque son
 *     molestias distintas: «Botones de video» (lo que está siempre a la vista,
 *     con la miniatura de la pastilla para que se sepa qué se apaga) y «Avisos
 *     la primera vez» (lo que interrumpe). «Volver a mostrar los avisos»
 *     deshace los «Ya sé cómo».
 *
 * Apagar no borra nada: la biblioteca sigue en Más herramientas. */

import { useState } from 'react'
import { Toggle } from '@/components/ui/Toggle'
import { BLOQUE } from '@/components/cf/bloqueOscuro'
import { IconoPlay } from './PiezasProfe'
import ListaVideosProfe, { seriesConVideos } from './ListaVideosProfe'
import { useProfe } from './ProfeProvider'

export default function AyudaProfe({ esOwner }) {
  const profe = useProfe()
  const [soloSinVer, setSoloSinVer] = useState(false)
  if (!profe?.activo) return null
  const total = profe.visibles.length
  const vistos = profe.visibles.filter((v) => profe.vistos.has(v.id)).length
  const cerrados = profe.descartados.length
  const series = seriesConVideos(profe.visibles)
  const fila = { padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }
  const rotulo = { fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }
  const chip = (activo) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px', flex: 'none',
    borderRadius: 999, cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
    // El chip de filtro activo es NEGRO, no dorado (DESIGN.md §1).
    background: activo ? 'var(--cf-ink)' : 'var(--cf-card)', color: activo ? 'var(--cf-surface)' : 'var(--cf-ink)',
    border: `1px solid ${activo ? 'var(--cf-ink)' : 'var(--cf-border)'}`,
  })
  const irASerie = (id) => document.getElementById(`serie-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: BLOQUE.fondo, borderRadius: 'var(--cf-r-card)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ ...rotulo, color: BLOQUE.rotulo }}>Viste</span>
          <span className="cf-fig" style={{ fontSize: 24, fontWeight: 700, color: BLOQUE.tinta, fontVariantNumeric: 'tabular-nums' }}>{vistos} de {total}</span>
          <span style={{ fontSize: 12, color: BLOQUE.apagado }}>videos de la app</span>
        </div>
        <div aria-hidden style={{ height: 6, borderRadius: 999, background: BLOQUE.pista, overflow: 'hidden' }}>
          <div style={{ width: `${total ? (vistos / total) * 100 : 0}%`, height: '100%', background: BLOQUE.oro }} />
        </div>
      </div>

      {/* El índice: el filtro y las series, en una fila que se desliza. */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 0 4px', margin: '0 -2px' }}>
        <button type="button" onClick={() => setSoloSinVer((v) => !v)} aria-pressed={soloSinVer} style={chip(soloSinVer)}>
          Sin ver · {total - vistos}
        </button>
        {series.map((s) => {
          const faltan = s.videos.filter((v) => !profe.vistos.has(v.id)).length
          return (
            <button key={s.id} type="button" onClick={() => irASerie(s.id)} style={chip(false)}>
              {s.titulo}
              {faltan > 0 && <span aria-label={`${faltan} sin ver`} style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: 'var(--cf-gold-tint)', color: 'var(--cf-gold-text)', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{faltan}</span>}
            </button>
          )
        })}
      </div>

      <ListaVideosProfe soloSinVer={soloSinVer} />

      <span style={{ ...rotulo, marginTop: 8 }}>Qué ver en las pantallas</span>
      <div style={{
        borderRadius: 'var(--cf-r-card)', border: '1px solid var(--cf-border)', background: 'var(--cf-card)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={fila}>
          <Toggle
            checked={profe.botonVisible}
            onChange={(v) => profe.cambiarPreferencia('prefBoton', v)}
            label="Botones de video"
            description="La pastilla de cada pantalla y los enlaces dentro de cada función."
          />
          {/* La miniatura de lo que se apaga. */}
          <span aria-hidden style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', height: 36, padding: '0 12px 0 6px',
            borderRadius: 10, background: 'var(--cf-surface)', border: '1px solid var(--cf-border)',
            opacity: profe.botonVisible ? 1 : 0.45,
          }}>
            <IconoPlay tam={24} radio={7} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cf-ink)', fontVariantNumeric: 'tabular-nums' }}>1:20</span>
          </span>
        </div>
        <div style={{ ...fila, borderTop: '1px solid var(--cf-border)' }}>
          <Toggle
            checked={profe.mostrarAvisos}
            onChange={(v) => profe.cambiarPreferencia('prefAvisos', v)}
            label="Avisos la primera vez"
            description="La tarjeta que aparece antes del primer cierre de caja y del primer préstamo."
          />
        </div>
        {esOwner && (
          <div style={{ ...fila, borderTop: '1px solid var(--cf-border)' }}>
            <Toggle
              checked={profe.paraCobradores}
              onChange={(v) => profe.cambiarPreferencia('prefCobradores', v)}
              label="También para mis cobradores"
              description="Ven solo los de su trabajo: la ruta, cobrar y su caja."
            />
          </div>
        )}
      </div>

      <button type="button" onClick={profe.volverAMostrarAvisos} disabled={!cerrados} style={{
        display: 'flex', alignItems: 'center', gap: 10, height: 56, padding: '0 16px', textAlign: 'left',
        borderRadius: 'var(--cf-r-card)', border: '1px solid var(--cf-border)', background: 'var(--cf-card)',
        cursor: cerrados ? 'pointer' : 'default', font: 'inherit', opacity: cerrados ? 1 : 0.6,
      }}>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--cf-ink)' }}>Volver a mostrar los avisos</span>
        <span style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>{cerrados ? `ya cerraste ${cerrados}` : 'ninguno cerrado'}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cf-chevron)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
      </button>

      <p style={{ margin: '0 0 24px', display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.5, color: 'var(--cf-ink-2)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden style={{ flex: 'none', marginTop: 2 }}>
          <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
        </svg>
        Apagar no borra nada. Los videos siguen aquí, en Tutoriales.
      </p>
    </div>
  )
}
