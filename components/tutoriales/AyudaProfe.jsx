'use client'

/* Configuración → Ayuda: los interruptores de los videos del profe y la lista
 * para verlos cuando se quiera (lámina «Ajustes» del 17 oct 2026).
 *
 * «Que me avise cuando me haga falta» de la lámina NO va: el profe no se vuelve
 * a asomar por algo que arreglar (decisión 2 del catálogo; segunda versión). */

import { Toggle } from '@/components/ui/Toggle'
import ListaVideosProfe from './ListaVideosProfe'
import { useProfe } from './ProfeProvider'

export default function AyudaProfe({ esOwner }) {
  const profe = useProfe()
  if (!profe?.activo) return null
  const fila = { padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{
        borderRadius: 'var(--cf-r-card)', border: '1px solid var(--cf-border)', background: 'var(--cf-card)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={fila}>
          <Toggle
            checked={profe.botonVisible}
            onChange={(v) => profe.cambiarPreferencia('prefBoton', v)}
            label="Ver el botón del profe"
            description="El botón de play junto a cada función, que abre su video."
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
      <ListaVideosProfe />
    </div>
  )
}
