'use client'

// components/dashboard/BannerTarjetaCliente.jsx — LA TARJETA, OFRECIDA UNA SOLA VEZ.
//
// Lo decide el dueño: hay quien no quiere que el cliente vea sus cuentas. Por eso los
// negocios que ya usan la app no la tienen encendida y esto no vuelve a salir,
// respondan lo que respondan. Va en papel y no en ámbar: no se pierde un peso por
// ignorarlo.

import { useEffect, useState } from 'react'

export default function BannerTarjetaCliente() {
  const [estado, setEstado] = useState('oculto') // 'oculto' | 'visible' | 'activada'
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let vivo = true
    fetch('/api/tarjeta/aviso', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo && d?.mostrar) setEstado('visible') })
      .catch(() => {})
    return () => { vivo = false }
  }, [])

  if (estado === 'oculto') return null

  const responder = async (activar) => {
    setEnviando(true)
    setError(false)
    try {
      const res = await fetch('/api/tarjeta/aviso', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activar }),
      })
      if (!res.ok) { setError(true); return }
      setEstado(activar ? 'activada' : 'oculto')
    } catch { setError(true) } finally { setEnviando(false) }
  }

  const caja = {
    borderRadius: 'var(--cf-r-card)', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
    padding: 16, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16,
  }

  if (estado === 'activada') {
    return (
      <div data-banner="tarjeta" role="status" style={caja}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)' }}>Tarjeta activada</span>
        <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>
          Desde ahora el recibo lleva el enlace. Lo puedes cambiar en Configuración, en Avisos por WhatsApp.
        </span>
      </div>
    )
  }

  return (
    <div data-banner="tarjeta" style={caja}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)' }}>
          ¿Quieres que tus clientes vean su tarjeta en el celular?
        </span>
        <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>
          El recibo llevaría un enlace con sus pagos y lo que les falta. Si un pago no aparece, te avisan a ti.
        </span>
      </div>
      {error && <span role="alert" style={{ fontSize: 13, color: 'var(--cf-red-dark)' }}>No se pudo guardar. Inténtalo de nuevo.</span>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" disabled={enviando} onClick={() => responder(true)} style={{
          height: 44, padding: '0 18px', border: 0, borderRadius: 14, cursor: 'pointer', font: 'inherit',
          fontSize: 15, fontWeight: 700, background: 'var(--cf-ink)', color: 'var(--cf-surface)', opacity: enviando ? .6 : 1,
        }}>Activar</button>
        <a href="/t/ejemplo" target="_blank" rel="noopener noreferrer" style={{
          height: 44, padding: '0 14px', display: 'inline-flex', alignItems: 'center', borderRadius: 14,
          border: '1px solid var(--cf-border-strong)', fontSize: 15, fontWeight: 600, color: 'var(--cf-ink)', textDecoration: 'none',
        }}>Ver ejemplo</a>
        <button type="button" disabled={enviando} onClick={() => responder(false)} style={{
          height: 44, padding: '0 10px', border: 0, background: 'none', cursor: 'pointer', font: 'inherit',
          fontSize: 15, fontWeight: 600, color: 'var(--cf-ink-2)',
        }}>Ahora no</button>
      </div>
    </div>
  )
}
