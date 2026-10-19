'use client'

/* ══ «¿CUÁNTA PLATA TIENES HOY PARA PRESTAR?» ══════════════════════════════════
 *
 * Decisión de Carlos, 18 oct 2026 (DETALLES-CARTERA #2, opción A). Después de
 * pasar el cuaderno la caja queda en negativo —lo prestado salió, lo abonado
 * entró—, y el Inicio le decía en rojo «No te queda caja para prestar» a quien
 * acababa de registrarse. Se le pregunta una sola cosa y el servidor asienta lo
 * que falta para que la caja diga exactamente eso (lib/dinero/plata-de-hoy.js).
 *
 * Sin `falta`, pregunta al servidor si hace falta: así sirve al terminar de
 * pasar la cartera (fotos y Excel) sin que cada pantalla lo calcule.
 */
import { useEffect, useState } from 'react'
import { Tarjeta } from '@/components/cf/primitivos'
import { Button } from '@/components/ui/Button'
import MoneyInput from '@/components/ui/MoneyInput'
import { formatMoney } from '@/lib/i18n'

export default function PreguntaPlataDeHoy({ falta: faltaDada = null, onListo, pais }) {
  const [falta, setFalta] = useState(faltaDada)
  const [monto, setMonto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState(null)

  useEffect(() => {
    if (faltaDada !== null) { setFalta(faltaDada); return }
    let vivo = true
    fetch('/api/capital/plata-de-hoy')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo) setFalta(!!d?.falta) })
      .catch(() => {})
    return () => { vivo = false }
  }, [faltaDada])

  if (hecho != null) {
    return (
      <Tarjeta>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--cf-ink)' }}>
          Listo: tu caja queda en <strong className="cf-num">{formatMoney(hecho, pais)}</strong>, la plata que tienes para prestar.
        </p>
      </Tarjeta>
    )
  }
  if (!falta) return null

  const guardar = async () => {
    const n = Number(monto)
    if (!Number.isFinite(n) || n < 0 || String(monto).trim() === '') { setError('Escribe cuánta plata tienes hoy para prestar. Si no tienes nada, escribe 0.'); return }
    setGuardando(true); setError('')
    try {
      const res = await fetch('/api/capital/plata-de-hoy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ monto: n }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'No se pudo guardar. Inténtalo otra vez.'); return }
      setHecho(d.saldo)
      onListo?.(d)
    } catch {
      setError('Sin conexión. Inténtalo otra vez.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Tarjeta>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--cf-ink)' }}>¿Cuánta plata tienes hoy para prestar?</h3>
      <p style={{ margin: '6px 0 12px', fontSize: 13, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>
        En efectivo y en el banco, lo que tienes disponible ahora. Lo que ya está en la calle lo suma el sistema.
      </p>
      <MoneyInput value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" />
      {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--cf-red-dark)' }}>{error}</p>}
      <Button className="w-full mt-3" onClick={guardar} loading={guardando}>Anotar</Button>
    </Tarjeta>
  )
}
