'use client'
/* «¿$80 o $80.000?» debajo del campo «ya había pagado». Un cliente escribió 80 y el
 * préstamo nació debiendo $79.920 de más (7 nov 2026). Ver lib/dinero/monto-raro.js.
 * Responder es obligatorio para seguir: `abonoSinResolver` lo dice. */
import { abonoPrevioRaro } from '@/lib/dinero/monto-raro'
import { formatMoney } from '@/lib/i18n'
import { BotonSecundario } from '@/components/cf/primitivos'

export default function PreguntaAbonoRaro({ abono, montoPrestado, totalAPagar, confirmado, onCorregir, onConfirmar }) {
  const raro = abonoPrevioRaro({ abono, montoPrestado, totalAPagar })
  if (!raro || Number(confirmado) === Number(abono)) return null
  const escrito = formatMoney(Number(abono))
  const era = formatMoney(raro.sugerido)
  return (
    <div role="alert" style={{
      marginTop: 8, padding: 12, borderRadius: 'var(--cf-r-control)', display: 'flex', flexDirection: 'column', gap: 8,
      background: 'var(--cf-card)', border: '1px solid var(--cf-gold-border)',
    }}>
      <span className="cf-num" style={{ fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)' }}>¿{escrito} o {era}?</span>
      <span style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--cf-ink-2)' }}>En un préstamo de {formatMoney(Number(montoPrestado))}, {escrito} es muy poco.</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <BotonSecundario type="button" style={{ flex: 1, minWidth: 0 }} onClick={() => onCorregir(String(raro.sugerido))}>Son {era}</BotonSecundario>
        <BotonSecundario type="button" style={{ flex: 1, minWidth: 0 }} onClick={() => onConfirmar(Number(abono))}>Sí, son {escrito}</BotonSecundario>
      </div>
    </div>
  )
}
