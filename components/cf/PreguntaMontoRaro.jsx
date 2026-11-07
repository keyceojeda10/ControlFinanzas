'use client'
/* «¿$30 o $30.000?» — la pregunta cuando un cobro parece un dedazo. La decide el
 * servidor (lib/dinero/monto-raro.js); aquí solo se contesta, a un toque.
 *
 * ⚠ VA EN UN PORTAL Y NO EN `HojaInferior`: se abre encima de otras hojas, y una
 *   hoja que nace de otra choca con su `history.back()` (ver la nota
 *   hoja_abre_hoja). Y la cifra sugerida es el botón grande, pero «Sí, son $30»
 *   está al lado: también pasa de verdad y no se le hace pedir perdón a nadie.
 */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { BotonPrimario, BotonSecundario, BotonTexto } from '@/components/cf/primitivos'

/** @param {{ pregunta: null|{tipo,monto,cuota,sugerido,nombre?}, formatMoney: Function,
 *   onResponder: (monto:number, respuesta:'era_otra'|'confirmo') => void, onCambiar: () => void }} p */
export default function PreguntaMontoRaro({ pregunta, formatMoney, onResponder, onCambiar }) {
  useEffect(() => {
    if (!pregunta) return
    const alPulsar = (e) => { if (e.key === 'Escape') onCambiar?.() }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [pregunta, onCambiar])

  if (!pregunta || typeof document === 'undefined') return null
  const { monto, cuota, sugerido, nombre } = pregunta
  const escrito = formatMoney(monto)
  const titulo = sugerido ? `¿${escrito} o ${formatMoney(sugerido)}?` : `¿Seguro son ${escrito}?`
  const de = nombre ? `La cuota de ${nombre}` : 'La cuota'
  const detalle = `${de} es ${formatMoney(cuota)}.`

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={titulo} style={{
      position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,.6)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: 480, background: 'var(--cf-surface)', borderRadius: '20px 20px 0 0',
        padding: '22px 20px max(16px, env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <span className="cf-num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--cf-ink)', textWrap: 'balance' }}>{titulo}</span>
        <p style={{ margin: '0 0 6px', fontSize: 15, lineHeight: 1.45, color: 'var(--cf-ink-2)', overflowWrap: 'anywhere' }}>{detalle}</p>
        {sugerido ? (
          <>
            <BotonPrimario onClick={() => onResponder(sugerido, 'era_otra')}>Son {formatMoney(sugerido)}</BotonPrimario>
            <BotonSecundario onClick={() => onResponder(monto, 'confirmo')}>Sí, son {escrito}</BotonSecundario>
          </>
        ) : (
          <BotonPrimario onClick={() => onResponder(monto, 'confirmo')}>Sí, son {escrito}</BotonPrimario>
        )}
        <BotonTexto onClick={onCambiar}>Cambiar el monto</BotonTexto>
      </div>
    </div>,
    document.body,
  )
}
