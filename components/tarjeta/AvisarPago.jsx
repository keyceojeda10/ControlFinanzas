'use client'

// components/tarjeta/AvisarPago.jsx — «¿PAGASTE Y NO APARECE AQUÍ?»
//
// Lo que hace indispensable la tarjeta: cada cliente vigila que su cuota se anote.
// El aviso va al dueño y nunca al cobrador, que puede ser justo quien se la guardó.
// Sin sesión ni hooks de la app: esto corre en el teléfono del deudor.

import { useMemo, useState } from 'react'

const hoyLocal = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

const CAMPO = {
  height: 48, width: '100%', boxSizing: 'border-box', padding: '0 14px',
  borderRadius: 14, border: '1px solid var(--cf-border-strong)',
  background: 'var(--cf-card)', color: 'var(--cf-ink)', font: 'inherit',
  fontSize: 16, // ⚠ Menos de 16 y el iPhone acerca la pantalla al tocar el campo.
}
const ETIQUETA = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--cf-ink-2)' }

export default function AvisarPago({ token, negocio }) {
  const hoy = useMemo(hoyLocal, [])
  const [abierto, setAbierto] = useState(false)
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [nota, setNota] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  if (enviado) {
    return (
      <p role="status" style={{
        margin: 0, padding: 16, borderRadius: 'var(--cf-r-card)', fontSize: 14, lineHeight: 1.5,
        background: 'var(--cf-green-pill-bg)', border: '1px solid var(--cf-green-pill-border)', color: 'var(--cf-ink)',
      }}>Listo. Ya le avisamos a {negocio} para que lo revise.</p>
    )
  }

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} style={{
        height: 48, borderRadius: 14, border: '1px solid var(--cf-border-strong)', cursor: 'pointer',
        background: 'var(--cf-card)', color: 'var(--cf-ink)', font: 'inherit', fontSize: 15, fontWeight: 600,
      }}>¿Pagaste y no aparece aquí?</button>
    )
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (!token) { setEnviado(true); return } // El ejemplo no le avisa a nadie.
    setEnviando(true)
    setError('')
    try {
      const res = await fetch(`/api/tarjeta/reclamo/${encodeURIComponent(token)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto: monto ? Number(monto) : null, fecha, nota: nota.trim() || null }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'No se pudo enviar. Inténtalo de nuevo.')
        return
      }
      setEnviado(true)
    } catch {
      setError('Sin conexión. Inténtalo de nuevo.')
    } finally { setEnviando(false) }
  }

  return (
    <form onSubmit={enviar} style={{
      padding: 20, borderRadius: 'var(--cf-r-card)', background: 'var(--cf-card)',
      border: '1px solid var(--cf-border)', display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Avísale a {negocio}</span>
        <span style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--cf-ink-2)' }}>
          Le llega directamente al dueño del negocio.
        </span>
      </div>
      <label style={ETIQUETA}>
        ¿Cuánto pagaste?
        <input inputMode="numeric" value={monto} placeholder="Opcional" style={CAMPO}
          onChange={(e) => setMonto(e.target.value.replace(/\D/g, '').slice(0, 12))} />
      </label>
      <label style={ETIQUETA}>
        ¿Qué día?
        <input type="date" required value={fecha} max={hoy} style={CAMPO} onChange={(e) => setFecha(e.target.value)} />
      </label>
      <label style={ETIQUETA}>
        Algo más que quieras decir
        <input value={nota} maxLength={200} placeholder="Opcional" style={CAMPO} onChange={(e) => setNota(e.target.value)} />
      </label>
      {error && <span role="alert" style={{ fontSize: 13, color: 'var(--cf-red-dark)' }}>{error}</span>}
      <button type="submit" disabled={enviando} style={{
        height: 48, border: 0, borderRadius: 14, cursor: 'pointer', font: 'inherit', fontSize: 16, fontWeight: 700,
        background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', opacity: enviando ? .6 : 1,
      }}>{enviando ? 'Enviando…' : 'Enviar aviso'}</button>
      <button type="button" onClick={() => setAbierto(false)} style={{
        height: 44, border: 0, background: 'none', cursor: 'pointer', font: 'inherit',
        fontSize: 15, fontWeight: 600, color: 'var(--cf-ink-2)',
      }}>Cancelar</button>
    </form>
  )
}
