'use client'

// components/armazon/Pendientes.jsx — LO QUE ESPERA TU DECISIÓN.
//
// Va ARRIBA de la campana. Un préstamo que un cobrador no puede entregar hasta
// que se lo aprueben, una caja que pide reabrirse, un gasto por aprobar: eso no
// es «algo que pasó», es alguien parado en la calle esperando. Hasta el 19 sep
// 2026 llegaba solo por push (lo tiene encendido el 14 % de los dueños) y para
// resolverlo había que ir a tres pantallas distintas.
//
// Se decide AQUÍ, sin abrir nada: aprobar y rechazar llaman a los mismos
// endpoints de siempre, con sus mismas validaciones.
//
// ⚠ DOS TOQUES. Aprobar un préstamo saca plata de la caja y aprobar un gasto la
// descuenta: en una lista, con el pulgar, un toque suelto no puede mover dinero.
// El primer toque arma el botón —que pasa a decir QUÉ va a hacer y por cuánto— y
// el segundo lo ejecuta. Si no se confirma en cuatro segundos, se desarma.

import { useEffect, useRef, useState } from 'react'
import { useCountry } from '@/hooks/useCountry'

function haceCuanto(fecha, soloDia = false) {
  if (soloDia) {
    const dia = (d) => new Date(d).toLocaleDateString('en-CA')
    const dias = Math.round((new Date(dia(Date.now())) - new Date(dia(fecha))) / 86400000)
    return dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`
  }
  const min = Math.max(0, Math.round((Date.now() - new Date(fecha).getTime()) / 60000))
  if (min < 1) return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'ayer' : `hace ${d} días`
}

const ICONO = {
  prestamo: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6.5 9.5v.01M17.5 14.5v.01" /></>,
  reapertura: <><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 017.5-2" /></>,
  gasto: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" /><path d="M9 8h6M9 12h6" /></>,
}

async function resolver(p, accion) {
  const json = { method: 'POST', headers: { 'Content-Type': 'application/json' } }
  if (p.clase === 'prestamo') {
    return fetch(`/api/prestamos/${p.id}/${accion === 'aprobar' ? 'aprobar' : 'rechazar'}`, { ...json, body: '{}' })
  }
  if (p.clase === 'reapertura') {
    return fetch(`/api/caja/reabrir/${accion === 'aprobar' ? 'aprobar' : 'rechazar'}`, { ...json, body: JSON.stringify({ cierreId: p.id }) })
  }
  return fetch(`/api/gastos/${p.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado: accion === 'aprobar' ? 'aprobado' : 'rechazado' }),
  })
}

function Fila({ p, onResuelto, onAbrir }) {
  const { formatMoney, formatFecha } = useCountry()
  const [armado, setArmado] = useState(null)      // 'aprobar' | 'rechazar' | null
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const reloj = useRef(null)
  useEffect(() => () => clearTimeout(reloj.current), [])

  const titulo = p.clase === 'prestamo' ? `${p.quien} quiere prestar ${formatMoney(p.monto)}`
    : p.clase === 'reapertura' ? `${p.quien} pide reabrir su caja`
    : `${p.quien} anotó un gasto de ${formatMoney(p.monto)}`
  const detalle = p.clase === 'prestamo' ? (p.para ? `a ${p.para}` : null)
    : p.clase === 'reapertura' ? (p.fechaCaja ? `la del ${formatFecha(p.fechaCaja)}` : null)
    : p.concepto

  const tocar = async (accion) => {
    setError('')
    if (armado !== accion) {
      setArmado(accion)
      clearTimeout(reloj.current)
      reloj.current = setTimeout(() => setArmado(null), 4000)
      return
    }
    clearTimeout(reloj.current)
    setEnviando(true)
    try {
      const res = await resolver(p, accion)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'No se pudo. Inténtalo de nuevo.')
        setArmado(null)
        return
      }
      onResuelto?.(p, accion)
    } catch {
      setError('Sin conexión. Inténtalo de nuevo.')
      setArmado(null)
    } finally { setEnviando(false) }
  }

  const textoAprobar = armado === 'aprobar'
    ? (p.monto ? `Confirmar ${formatMoney(p.monto)}` : 'Confirmar')
    : 'Aprobar'

  return (
    <div data-pendiente={p.clase} style={{
      borderRadius: 'var(--cf-r-card)', background: 'var(--cf-card)',
      border: '1px solid var(--cf-border)', padding: '13px 14px',
      display: 'flex', flexDirection: 'column', gap: 11,
    }}>
      <button type="button" onClick={() => onAbrir?.(p)} style={{
        display: 'flex', alignItems: 'flex-start', gap: 11, textAlign: 'left',
        background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit',
      }}>
        <span aria-hidden style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 30, height: 30, minWidth: 30, borderRadius: 10, background: 'var(--cf-gold-tint)',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-gold-dark)"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONO[p.clase]}</svg>
        </span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="cf-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)', lineHeight: 1.3 }}>{titulo}</span>
          <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-2)', lineHeight: 1.4 }}>
            {[detalle, haceCuanto(p.desde, p.soloDia)].filter(Boolean).join(' · ')}
          </span>
        </span>
      </button>

      {error && <span style={{ fontSize: 13, color: 'var(--cf-red-dark)' }}>{error}</span>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" disabled={enviando} onClick={() => tocar('aprobar')} style={{
          flex: 1, height: 40, borderRadius: 'var(--cf-r-control)', cursor: 'pointer', border: 0,
          fontSize: 14, fontWeight: 700, opacity: enviando ? .6 : 1,
          // Armado pasa a dorado: es LA acción primaria, y solo entonces.
          background: armado === 'aprobar' ? 'var(--cf-gold)' : 'var(--cf-ink)',
          color: armado === 'aprobar' ? 'var(--cf-gold-ink)' : 'var(--cf-surface)',
        }}>
          <span className="cf-num">{enviando && armado === 'aprobar' ? 'Aprobando…' : textoAprobar}</span>
        </button>
        <button type="button" disabled={enviando} onClick={() => tocar('rechazar')} style={{
          flex: 1, height: 40, borderRadius: 'var(--cf-r-control)', cursor: 'pointer',
          fontSize: 14, fontWeight: 700, opacity: enviando ? .6 : 1,
          background: armado === 'rechazar' ? 'var(--cf-red-pill-bg)' : 'var(--cf-card)',
          color: armado === 'rechazar' ? 'var(--cf-red-dark)' : 'var(--cf-ink-2)',
          border: `1px solid ${armado === 'rechazar' ? 'var(--cf-red-pill-border)' : 'var(--cf-border-strong)'}`,
        }}>
          {enviando && armado === 'rechazar' ? 'Rechazando…' : armado === 'rechazar' ? 'Sí, rechazar' : 'Rechazar'}
        </button>
      </div>
    </div>
  )
}

export default function Pendientes({ pendientes = [], onResuelto, onAbrir }) {
  if (!pendientes.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cf-ink)' }}>
        {pendientes.length === 1 ? 'Esperan tu decisión · 1' : `Esperan tu decisión · ${pendientes.length}`}
      </span>
      {pendientes.map((p) => (
        <Fila key={p.clave} p={p} onResuelto={onResuelto} onAbrir={onAbrir} />
      ))}
    </div>
  )
}
