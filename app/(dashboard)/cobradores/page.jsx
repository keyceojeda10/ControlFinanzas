'use client'
// app/(dashboard)/cobradores/page.jsx - Lista de cobradores

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Cobradores } from '@/components/pantallas/Cobradores'
import { agrupaCobradores } from '@/lib/adaptadores/cobradores'
import Link                    from 'next/link'
import { useAuth }             from '@/hooks/useAuth'
import { Badge }               from '@/components/ui/Badge'
import { Button }              from '@/components/ui/Button'
import { Card }                from '@/components/ui/Card'
import CobradorCard            from '@/components/cobradores/CobradorCard'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import { useCountry } from '@/hooks/useCountry'
import { obtenerCobradoresOffline } from '@/lib/offline'

export default function CobradoresPage() {
  return <CobradoresPageInner />
}

function CobradoresPageInner() {
  const { session, esOwner, loading: authLoading } = useAuth()

  const { formatMoney } = useCountry()
  const router = useRouter()
  const [cobradores, setCobradores] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [toggling,   setToggling]   = useState(null)
  const [usuariosPermitidos, setUsuariosPermitidos] = useState(null)

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
        clone.style.border = '1px solid var(--cf-gold)'
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
      .then((d) => {
        if (Array.isArray(d) && d.length > 0) setCobradores(d)
        else return obtenerCobradoresOffline().then(cached => { if (cached.length) setCobradores(cached) })
      })
      .catch(() => obtenerCobradoresOffline().then(cached => {
        if (cached.length) setCobradores(cached)
        else setError('No se pudieron cargar los cobradores.')
      }))
      .finally(() => setLoading(false))
    fetch('/api/plan/uso')
      .then(r => r.json())
      .then(d => { if (d.usuariosPermitidos) setUsuariosPermitidos(new Set(d.usuariosPermitidos)) })
      .catch(() => {})
  }, [authLoading, esOwner])

  // Planes de entrada — bloquear
  if (!authLoading && ['starter', 'basic'].includes(plan)) {
    return (
      <div className="max-w-xl mx-auto">
        {/* Sin <h1>: la cabecera del armazon ya dice «Cobradores». Aqui salia
            otra vez justo encima del aviso de plan. */}
        <div
          className="border border-[var(--cf-border)] rounded-[20px] p-8 text-center cf-card-shadow"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--cf-gold-dark) 4%, transparent) 0%, var(--cf-card) 40%, var(--cf-card) 70%, color-mix(in srgb, var(--cf-gold-dark) 2%, transparent) 100%)',
            boxShadow: '0 0 30px color-mix(in srgb, var(--cf-gold-dark) 3%, transparent), 0 1px 2px rgba(0,0,0,0.3)',
          }}
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'color-mix(in srgb, var(--cf-gold-dark) 12%, transparent)' }}>
            <svg className="w-7 h-7 text-[var(--cf-gold-dark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-base font-bold text-[var(--cf-ink)] mb-2">Función de plan premium</p>
          <p className="text-sm text-[var(--cf-ink-3)] mb-5">
            Actualiza tu plan para agregar cobradores y gestionar rutas de cobro.
          </p>
          <div className="inline-flex flex-col gap-2 text-xs text-[var(--cf-ink-3)]">
            <span className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-[var(--cf-green-dark)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> Crecimiento: hasta 2 usuarios</span>
            <span className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-[var(--cf-green-dark)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> Profesional: hasta 5 usuarios</span>
            <span className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-[var(--cf-green-dark)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> Empresarial: hasta 10 usuarios</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl lg:max-w-6xl mx-auto">
      {/* ── LOS DOS BOTONES DE ARRIBA SE VAN (T09-02) ──
          Aqui habia un titulo «Cobradores» y, a su derecha, «Ranking» y «Nuevo
          cobrador»: dos botones del mismo tamaño, pegados, que en 390px no
          caben en la misma fila que el titulo. La lamina no los tiene. Pone
          «Crear cobrador» ABAJO, entero y solo, porque crear un cobrador es la
          accion de esta pantalla; y el ranking no es su par — se mira de
          pasada, no se crea cada dia.

          La cabecera vuelve al componente, que ya la trae con las dos cifras
          que hacen evidente el hueco: «9 cuentas · 4 con ruta asignada». */}

      {error && (
        <div className="bg-[var(--cf-red-pill-bg)] border border-[color-mix(in_srgb,var(--cf-red-dark)_30%,transparent)] text-[var(--cf-red-dark)] text-sm rounded-[12px] px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Toggle modo trabajo / ordenar (solo owner, con 2+ cobradores) */}
      {!loading && cobradores.length > 1 && esOwner && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1 p-1 rounded-[12px]" style={{ background: 'var(--cf-fill)' }}>
            {[
              { key: false, label: 'Trabajo' },
              { key: true, label: 'Ordenar' },
            ].map(t => (
              <button
                key={String(t.key)}
                type="button"
                onClick={() => setModoOrdenar(t.key)}
                className="px-3 py-1.5 rounded-[8px] text-xs font-medium transition-all"
                style={modoOrdenar === t.key
                  ? { background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }
                  : { color: 'var(--cf-ink-3)' }}
              >
                {t.label}
              </button>
            ))}
          </div>
          {modoOrdenar && (
            <span className="text-[11px]" style={{ color: ordenEstado === 'error' ? 'var(--cf-red-dark)' : 'var(--cf-ink-3)' }}>
              {ordenEstado === 'guardando' ? 'Guardando...' : ordenEstado === 'guardado' ? 'Guardado' : ordenEstado === 'error' ? 'Error al guardar' : 'Arrastra o usa las flechas'}
            </span>
          )}
        </div>
      )}

      {!loading && usuariosPermitidos && cobradores.some(c => !usuariosPermitidos.has(c.id)) && (
        <div
          className="rounded-[12px] px-4 py-3 mb-4 text-sm"
          style={{
            background: 'color-mix(in srgb, var(--cf-gold-dark) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--cf-gold-dark) 20%, transparent)',
            color: 'var(--cf-ink)',
          }}
        >
          <p className="font-semibold mb-1" style={{ color: 'var(--cf-gold-dark)' }}>
            Tu plan permite {usuariosPermitidos.size - 1} cobrador{usuariosPermitidos.size - 1 !== 1 ? 'es' : ''}
          </p>
          <p className="text-xs" style={{ color: 'var(--cf-ink-3)' }}>
            Los cobradores marcados como &quot;Suspendido&quot; no pueden iniciar sesion.
            Puedes reordenar tus cobradores para elegir cuales mantener activos.
          </p>
        </div>
      )}

      {/* ── T09-02 · Dos grupos, no una lista ──
          Estaba construido y probado desde el bloque de cobradores y esta ruta
          seguia pintando una rejilla de tarjetas iguales. La separacion ES el
          diagnostico: una cuenta SIN RUTA no puede cobrar nada, y mezclada con
          las que trabajan no avisa de nada.

          La cabecera la pinta el componente: trae las dos cifras juntas
          —«9 cuentas · 4 con ruta asignada»— que son las que hacen evidente el
          hueco. Cualquiera de las dos sola no dice nada. */}
      {!loading && !modoOrdenar && (() => {
        const grupos = agrupaCobradores(cobradores, formatMoney)
        return (
          <Cobradores
            alto="auto"
            resumen={grupos.resumen}
            aviso={grupos.aviso}
            cobrando={grupos.cobrando}
            sinRuta={grupos.sinRuta}
            onAbrir={(c) => router.push(`/cobradores/${c.id}`)}
            onAsignar={(c) => router.push(`/cobradores/${c.id}`)}
            onCrear={esOwner ? () => router.push('/cobradores/nuevo') : null}
            onRanking={esOwner ? () => router.push('/cobradores/ranking') : null}
          />
        )
      })()}

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
              className="flex items-center gap-3 px-3 py-3 rounded-[12px] border bg-[var(--cf-card)] select-none"
              style={{
                borderColor: dragOverIdx === i ? 'var(--cf-gold)' : 'var(--cf-border)',
                opacity: dragIndex === i ? 0.4 : 1,
                touchAction: 'none',
              }}
            >
              <span className="text-[var(--cf-ink-3)] cursor-grab shrink-0" aria-hidden>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--cf-ink)] truncate">{c.nombre}</p>
                <p className="text-[11px] text-[var(--cf-ink-3)] truncate">{c.ruta?.nombre || 'Sin ruta'}</p>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button type="button" onClick={() => moverCobrador(i, -1)} disabled={i === 0}
                  className="w-7 h-6 rounded-[6px] flex items-center justify-center text-[var(--cf-ink-3)] hover:text-[var(--cf-ink)] hover:bg-[var(--cf-fill)] disabled:opacity-30 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                </button>
                <button type="button" onClick={() => moverCobrador(i, 1)} disabled={i === cobradores.length - 1}
                  className="w-7 h-6 rounded-[6px] flex items-center justify-center text-[var(--cf-ink-3)] hover:text-[var(--cf-ink)] hover:bg-[var(--cf-fill)] disabled:opacity-30 transition-colors">
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
