'use client'

/* Configuración → Ayuda y tutoriales (Adenda 6, §4).
 *
 * Arriba, cuántos videos ha visto y la salida a la biblioteca. Debajo, DOS
 * interruptores y no uno, porque son molestias distintas:
 *   · «Botones de video» — lo que está siempre a la vista: la pastilla, los
 *     enlaces y los minutos. Lleva la miniatura de la pastilla para que se sepa
 *     exactamente qué se apaga.
 *   · «Avisos la primera vez» — lo que interrumpe. Un experto apaga este y deja
 *     el otro.
 * «Volver a mostrar los avisos» deshace los «Ya sé cómo».
 *
 * Apagar no borra nada: la biblioteca sigue en Más herramientas. */

import { useRouter } from 'next/navigation'
import { Toggle } from '@/components/ui/Toggle'
import { BLOQUE } from '@/components/cf/bloqueOscuro'
import { IconoPlay } from './PiezasProfe'
import { useProfe } from './ProfeProvider'

export default function AyudaProfe({ esOwner }) {
  const profe = useProfe()
  const router = useRouter()
  if (!profe?.activo) return null
  const total = profe.visibles.length
  const vistos = profe.visibles.filter((v) => profe.vistos.has(v.id)).length
  const cerrados = profe.descartados.length
  const fila = { padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }
  const rotulo = { fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        background: BLOQUE.fondo, borderRadius: 'var(--cf-r-card)', padding: '16px 18px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ ...rotulo, color: BLOQUE.rotulo }}>Viste</span>
          <span className="cf-fig" style={{ fontSize: 24, fontWeight: 700, color: BLOQUE.tinta, fontVariantNumeric: 'tabular-nums' }}>
            {vistos} de {total}
          </span>
          <span style={{ fontSize: 12, color: BLOQUE.apagado }}>videos de la app</span>
        </div>
        <button type="button" onClick={() => router.push('/tutoriales')} style={{
          height: 44, padding: '0 16px', borderRadius: 'var(--cf-r-control)', cursor: 'pointer', font: 'inherit',
          fontSize: 14, fontWeight: 600, color: BLOQUE.tinta, background: 'rgba(255,255,255,.08)', border: `1px solid ${BLOQUE.linea}`,
        }}>Biblioteca</button>
      </div>

      <span style={rotulo}>Qué ver en las pantallas</span>
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

      <p style={{ margin: 0, display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.5, color: 'var(--cf-ink-2)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden style={{ flex: 'none', marginTop: 2 }}>
          <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
        </svg>
        Apagar no borra nada. Los videos siguen en la biblioteca, en Más herramientas.
      </p>
    </div>
  )
}
