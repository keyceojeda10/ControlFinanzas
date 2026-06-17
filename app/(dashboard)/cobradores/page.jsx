'use client'
// app/(dashboard)/cobradores/page.jsx - Lista de cobradores

import { useState, useEffect, useCallback, useRef } from 'react'
import Link                    from 'next/link'
import { useAuth }             from '@/hooks/useAuth'
import { Badge }               from '@/components/ui/Badge'
import { Button }              from '@/components/ui/Button'
import { Card }                from '@/components/ui/Card'
import CobradorCard            from '@/components/cobradores/CobradorCard'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import { useOnline }           from '@/hooks/useOnline'
import OfflineFallback         from '@/components/offline/OfflineFallback'
import { useCountry } from '@/hooks/useCountry'

export default function CobradoresPage() {
  const online = useOnline()
  if (!online) return <OfflineFallback titulo="La gestion de cobradores requiere conexion" />
  return <CobradoresPageInner />
}

function CobradoresPageInner() {
  const { session, esOwner, loading: authLoading } = useAuth()

  const { formatMoney } = useCountry()
  const [cobradores, setCobradores] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [toggling,   setToggling]   = useState(null)

  // Modo trabajo / ordenar (drag-and-drop de cobradores) — solo owner
  const [modoOrdenar, setModoOrdenar] = useState(false)
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [ordenEstado, setOrdenEstado] = useState('') // '' | 'guardando' | 'guardado' | 'error'
  const saveOrdenTimer = useRef(null)

  const plan = session?.user?.plan ?? 'starter'

  const guardarOrdenCobradores = useCallback((lista) => {
    const cobradorIds = lista.map(c => c.id)
    if (saveOrdenTimer.current) clearTimeout(saveOrdenTimer.current)
    setOrdenEstado('guardando')
    saveOrdenTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/cobradores/reordenar', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cobradorIds }),
        })
        if (!res.ok) throw new Error('fallo')
        setOrdenEstado('guardado')
        setTimeout(() => setOrdenEstado(''), 1500)
      } catch {
        setOrdenEstado('error')
      }
    }, 700)
  }, [])

  // Drag desktop (mouse)
  const onDragStart = (i) => setDragIndex(i)
  const onDragOver  = (e, i) => { e.preventDefault(); setDragOverIdx(i) }
  const onDrop = (i) => {
    if (dragIndex === null || dragIndex === i) { setDragIndex(null); setDragOverIdx(null); return }
    const lista = [...cobradores]
    const [moved] = lista.splice(dragIndex, 1)
    lista.splice(i, 0, moved)
    setCobradores(lista)
    guardarOrdenCobradores(lista)
    setDragIndex(null); setDragOverIdx(null)
  }
  const onDragEnd = () => { setDragIndex(null); setDragOverIdx(null) }

  // Drag tactil (movil) — el drag nativo HTML5 no funciona con el dedo
  const listaRef = useRef(null)
  const tStart = useRef(null)
  const tNode = useRef(null)
  const tClone = useRef(null)
  const tIndex = useRef(null)
  const tOver = useRef(null)

  const onTouchStart = (e, i) => {
    const touch = e.touches[0]
    tStart.current = { y: touch.clientY, started: false, offsetY: null }
    tIndex.current = i
    tNode.current = e.currentTarget
  }
  const onTouchMove = (e) => {
    if (tIndex.current === null || !tStart.current) return
    const touch = e.touches[0]
    const dy = Math.abs(touch.clientY - tStart.current.y)
    if (!tStart.current.started && dy < 8) return
    e.preventDefault()
    if (!tStart.current.started) {
      tStart.current.started = true
      setDragIndex(tIndex.current)
      const node = tNode.current
      if (node) {
        const rect = node.getBoundingClientRect()
        const clone = node.cloneNode(true)
        clone.style.position = 'fixed'
        clone.style.left = `${rect.left}px`
        clone.style.width = `${rect.width}px`
        clone.style.top = `${rect.top}px`
        clone.style.zIndex = '9999'
        clone.style.opacity = '0.95'
        clone.style.transform = 'scale(1.02)'
        clone.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)'
        clone.style.border = '1px solid var(--color-accent)'
        clone.style.pointerEvents = 'none'
        clone.style.transition = 'none'
        document.body.appendChild(clone)
        tClone.current = clone
        tStart.current.offsetY = touch.clientY - rect.top
      }
    }
    if (tClone.current && tStart.current.offsetY != null) {
      tClone.current.style.top = `${touch.clientY - tStart.current.offsetY}px`
    }
    if (listaRef.current) {
      const items = listaRef.current.querySelectorAll('[data-idx]')
      for (const item of items) {
        const rect = item.getBoundingClientRect()
        if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
          const overIdx = parseInt(item.dataset.idx)
          if (overIdx !== tOver.current) { tOver.current = overIdx; setDragOverIdx(overIdx) }
          break
        }
      }
    }
  }
  const onTouchEnd = () => {
    if (tClone.current) { document.body.removeChild(tClone.current); tClone.current = null }
    if (tIndex.current !== null && tOver.current !== null && tIndex.current !== tOver.current) {
      const lista = [...cobradores]
      const [moved] = lista.splice(tIndex.current, 1)
      lista.splice(tOver.current, 0, moved)
      setCobradores(lista)
      guardarOrdenCobradores(lista)
    }
    tStart.current = null; tIndex.current = null; tNode.current = null; tOver.current = null
    setDragIndex(null); setDragOverIdx(null)
  }

  // Mover con botones (subir/bajar) — a prueba de fallos en movil
  const moverCobrador = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= cobradores.length) return
    const lista = [...cobradores]
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
    setCobradores(lista)
    guardarOrdenCobradores(lista)
  }

  const toggleCobrador = async (cobrador) => {
    setToggling(cobrador.id)
    try {
      const res = await fetch(`/api/cobradores/${cobrador.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !cobrador.activo }),
      })
      if (!res.ok) throw new Error()
      setCobradores((prev) =>
        prev.map((c) => c.id === cobrador.id ? { ...c, activo: !c.activo } : c)
      )
    } catch {
      setError('No se pudo cambiar el estado del cobrador.')
    } finally {
      setToggling(null)
    }
  }

  useEffect(() => {
    if (authLoading || !esOwner) { setLoading(false); return }
    fetch('/api/cobradores')
      .then((r) => r.json())
      .then((d) => setCobradores(Array.isArray(d) ? d : []))
      .catch(() => setError('No se pudieron cargar los cobradores.'))
      .finally(() => setLoading(false))
  }, [authLoading, esOwner])

  // Planes de entrada — bloquear
  if (!authLoading && ['starter', 'basic'].includes(plan)) {
    return (
      <div className="max-w-xl mx-auto">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-6">Cobradores</h1>
        <div
          className="border border-[var(--color-border)] rounded-[16px] p-8 text-center"
          style={{
            background: 'linear-gradient(135deg, #f59e0b0A 0%, var(--color-bg-card) 40%, var(--color-bg-card) 70%, #f59e0b05 100%)',
            boxShadow: '0 0 30px #f59e0b08, 0 1px 2px rgba(0,0,0,0.3)',
          }}
        >
          <div className="w-14 h-14 rounded-full bg-[rgba(245,158,11,0.12)] flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[var(--color-warning)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-base font-bold text-[var(--color-text-primary)] mb-2">Función de plan premium</p>
          <p className="text-sm text-[var(--color-text-muted)] mb-5">
            Actualiza tu plan para agregar cobradores y gestionar rutas de cobro.
          </p>
          <div className="inline-flex flex-col gap-2 text-xs text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-[var(--color-success)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> Crecimiento: hasta 2 usuarios</span>
            <span className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-[var(--color-success)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> Profesional: hasta 5 usuarios</span>
            <span className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-[var(--color-success)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> Empresarial: hasta 10 usuarios</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Cobradores</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {loading ? '…' : `${cobradores.length} cobrador${cobradores.length !== 1 ? 'es' : ''}`}
          </p>
        </div>
        {!authLoading && esOwner && (
          <Link href="/cobradores/nuevo">
            <Button
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              Nuevo cobrador
            </Button>
          </Link>
        )}
      </div>

      {error && (
        <div className="bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] text-sm rounded-[12px] px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {!loading && cobradores.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-[rgba(245,197,24,0.1)] flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">Sin cobradores aún</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Crea el primer cobrador para asignarle una ruta</p>
          <Link href="/cobradores/nuevo" className="mt-4">
            <Button size="sm">Crear cobrador</Button>
          </Link>
        </div>
      )}

      {/* Toggle modo trabajo / ordenar (solo owner, con 2+ cobradores) */}
      {!loading && cobradores.length > 1 && esOwner && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1 p-1 rounded-[12px]" style={{ background: 'var(--color-bg-hover)' }}>
            {[
              { key: false, label: 'Trabajo' },
              { key: true, label: 'Ordenar' },
            ].map(t => (
              <button
                key={String(t.key)}
                type="button"
                onClick={() => setModoOrdenar(t.key)}
                className="px-3 py-1.5 rounded-[9px] text-xs font-medium transition-all"
                style={modoOrdenar === t.key
                  ? { background: 'var(--color-accent)', color: '#000' }
                  : { color: 'var(--color-text-muted)' }}
              >
                {t.label}
              </button>
            ))}
          </div>
          {modoOrdenar && (
            <span className="text-[11px]" style={{ color: ordenEstado === 'error' ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
              {ordenEstado === 'guardando' ? 'Guardando...' : ordenEstado === 'guardado' ? 'Guardado' : ordenEstado === 'error' ? 'Error al guardar' : 'Arrastra o usa las flechas'}
            </span>
          )}
        </div>
      )}

      {!loading && cobradores.length > 0 && !modoOrdenar && (
        <div className="space-y-3">
          {cobradores.map((c) => (
            <CobradorCard
              key={c.id}
              cobrador={c}
              onToggleActivo={toggleCobrador}
              toggling={toggling === c.id}
            />
          ))}
        </div>
      )}

      {/* Modo ordenar: cards no clicables, con grip (drag) y flechas subir/bajar */}
      {!loading && cobradores.length > 0 && modoOrdenar && (
        <div className="space-y-2" ref={listaRef}>
          {cobradores.map((c, i) => (
            <div
              key={c.id}
              data-idx={i}
              draggable
              onDragStart={() => onDragStart(i)}
              onDragOver={(e) => onDragOver(e, i)}
              onDrop={() => onDrop(i)}
              onDragEnd={onDragEnd}
              onTouchStart={(e) => onTouchStart(e, i)}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              className="flex items-center gap-3 px-3 py-3 rounded-[12px] border bg-[var(--color-bg-card)] select-none"
              style={{
                borderColor: dragOverIdx === i ? 'var(--color-accent)' : 'var(--color-border)',
                opacity: dragIndex === i ? 0.4 : 1,
                touchAction: 'none',
              }}
            >
              <span className="text-[var(--color-text-muted)] cursor-grab shrink-0" aria-hidden>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{c.nombre}</p>
                <p className="text-[11px] text-[var(--color-text-muted)] truncate">{c.ruta?.nombre || 'Sin ruta'}</p>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button type="button" onClick={() => moverCobrador(i, -1)} disabled={i === 0}
                  className="w-7 h-6 rounded-[6px] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] disabled:opacity-30 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                </button>
                <button type="button" onClick={() => moverCobrador(i, 1)} disabled={i === cobradores.length - 1}
                  className="w-7 h-6 rounded-[6px] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] disabled:opacity-30 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
