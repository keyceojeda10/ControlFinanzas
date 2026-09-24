'use client'
/* Los teléfonos donde está guardada una cuenta: el aparato, cuándo se guardó,
   cuándo se usó por última vez, y «Quitar». Con `cobradorId`, los de ese
   cobrador (solo el dueño); sin él, los propios. El cero es un dato: sin
   teléfonos se dice, no se esconde la sección. Este panel existe para que el
   dueño pueda cortar un teléfono perdido, así que un fallo de carga o de
   «Quitar» se avisa — no se confunde con una lista vacía ni queda mudo. */
import { useCallback, useEffect, useState } from 'react'

const fecha = (f) => {
  const d = new Date(f)
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${d.getDate()} ${MESES[d.getMonth()]}`
}

export default function TelefonosGuardados({ cobradorId = null }) {
  const base = cobradorId ? `/api/cobradores/${cobradorId}/cuentas-guardadas` : '/api/cuentas-guardadas'
  const [aparatos, setAparatos] = useState(null)
  const [errorCarga, setErrorCarga] = useState(false)
  const [quitandoId, setQuitandoId] = useState(null)
  const [errorQuitarId, setErrorQuitarId] = useState(null)

  const cargar = useCallback(() => {
    setErrorCarga(false)
    fetch(base)
      .then((r) => { if (!r.ok) throw new Error('carga'); return r.json() })
      .then((d) => setAparatos(d.aparatos ?? []))
      .catch(() => { setAparatos([]); setErrorCarga(true) })
  }, [base])
  useEffect(() => { cargar() }, [cargar])

  const quitar = async (id) => {
    setQuitandoId(id)
    setErrorQuitarId(null)
    try {
      const r = await fetch(`${base}?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('quitar')
      cargar()
    } catch {
      setErrorQuitarId(id)
    } finally {
      setQuitandoId(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[14px] font-semibold" style={{ color: 'var(--cf-ink)' }}>
        {cobradorId ? 'Teléfonos con su cuenta guardada' : 'Teléfonos con tu cuenta guardada'}
      </p>
      {aparatos === null ? null : errorCarga ? (
        <p className="text-[13px]" style={{ color: 'var(--cf-red-darker)' }}>No se pudo cargar la lista. Intenta de nuevo.</p>
      ) : aparatos.length === 0 ? (
        <p className="text-[13px]" style={{ color: 'var(--cf-ink-3)' }}>Ningún teléfono la tiene guardada.</p>
      ) : aparatos.map((a) => (
        <div key={a.id} className="flex items-center justify-between gap-3 py-2" style={{ borderBottom: '1px solid var(--cf-hairline)' }}>
          <span className="min-w-0">
            <span className="block text-[14px]" style={{ color: 'var(--cf-ink)' }}>{a.dispositivo || 'Teléfono'}</span>
            <span className="block text-[12px]" style={{ color: 'var(--cf-ink-3)' }}>
              Guardada el {fecha(a.createdAt)} · último uso {fecha(a.lastUsedAt)}
            </span>
            {errorQuitarId === a.id && (
              <span className="block text-[12px]" style={{ color: 'var(--cf-red-darker)' }}>No se pudo quitar ese teléfono. Intenta de nuevo.</span>
            )}
          </span>
          <button type="button" onClick={() => quitar(a.id)} disabled={quitandoId === a.id} className="text-[13px] font-semibold shrink-0"
            style={{
              background: 'none', border: 0, color: 'var(--cf-red-dark)',
              cursor: quitandoId === a.id ? 'default' : 'pointer',
              opacity: quitandoId === a.id ? 0.6 : 1,
            }}>
            {quitandoId === a.id ? 'Quitando…' : 'Quitar'}
          </button>
        </div>
      ))}
    </div>
  )
}
