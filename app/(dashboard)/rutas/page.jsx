'use client'
// app/(dashboard)/rutas/page.jsx - Lista de rutas

import { useState, useEffect, useCallback, useRef } from 'react'
import Link                    from 'next/link'
import { useRouter }           from 'next/navigation'
import { useAuth }             from '@/hooks/useAuth'
import { useOffline }         from '@/components/providers/OfflineProvider'
import { guardarEnCache, leerDeCache, obtenerRutasOffline } from '@/lib/offline'
import { Button }              from '@/components/ui/Button'
import { Input }               from '@/components/ui/Input'
import MoneyInput              from '@/components/ui/MoneyInput'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import { Card }                from '@/components/ui/Card'
import RutaCard                from '@/components/rutas/RutaCard'
import ModalSugerenciasRutas   from '@/components/rutas/ModalSugerenciasRutas'
import { useCountry } from '@/hooks/useCountry'

export default function RutasPage() {
  const router = useRouter()
  const { esOwner, loading: authLoading } = useAuth()

  const { formatMoney } = useCountry()
  const { lastSyncedAt } = useOffline()
  const [rutas,    setRutas]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [showForm, setShowForm] = useState(false)
  const [nombre,   setNombre]   = useState('')
  const [capitalRuta, setCapitalRuta] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [formError, setFormError] = useState('')
  const [isOffline, setIsOffline] = useState(false)
  const [backupLoading, setBackupLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  // Recomendaciones de rutas (clientes sin ruta agrupados por similitud)
  const [recom, setRecom] = useState(null) // { totalSinRuta, ... }
  const [recomIgnoradoEn, setRecomIgnoradoEn] = useState(null) // valor de totalSinRuta cuando se cerro
  const [showSugerencias, setShowSugerencias] = useState(false)
  const hasLoadedOnceRef = useRef(false)

  // Modo trabajo / ordenar (drag-and-drop de rutas) — solo owner
  const [modoOrdenar, setModoOrdenar] = useState(false)
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [ordenEstado, setOrdenEstado] = useState('') // '' | 'guardando' | 'guardado' | 'error'
  const saveOrdenTimer = useRef(null)

  const guardarOrdenRutas = useCallback((lista) => {
    const rutaIds = lista.map(r => r.id)
    if (saveOrdenTimer.current) clearTimeout(saveOrdenTimer.current)
    setOrdenEstado('guardando')
    saveOrdenTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/rutas/reordenar', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rutaIds }),
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
    const lista = [...rutas]
    const [moved] = lista.splice(dragIndex, 1)
    lista.splice(i, 0, moved)
    setRutas(lista)
    guardarOrdenRutas(lista)
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
      const lista = [...rutas]
      const [moved] = lista.splice(tIndex.current, 1)
      lista.splice(tOver.current, 0, moved)
      setRutas(lista)
      guardarOrdenRutas(lista)
    }
    tStart.current = null; tIndex.current = null; tNode.current = null; tOver.current = null
    setDragIndex(null); setDragOverIdx(null)
  }

  // Mover con botones (subir/bajar) — mas simple y a prueba de fallos en movil
  const moverRuta = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= rutas.length) return
    const lista = [...rutas]
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
    setRutas(lista)
    guardarOrdenRutas(lista)
  }

  const fetchRutas = useCallback(async ({ soft = false } = {}) => {
    const shouldUseSoftRefresh = soft && hasLoadedOnceRef.current
    setError('')
    setIsOffline(false)

    // Cache-first: pintar al instante desde IndexedDB y luego revalidar.
    // Evita el flash vacio→skeleton→datos en cada navegacion repetida.
    if (!shouldUseSoftRefresh && !hasLoadedOnceRef.current) {
      try {
        const cached = await leerDeCache('rutas')
        if (cached && cached.length > 0) {
          setRutas(cached)
          setLoading(false)        // hay datos: no mostrar skeleton
          hasLoadedOnceRef.current = true
        } else {
          setLoading(true)         // primera vez sin cache: skeleton
        }
      } catch { setLoading(true) }
    }

    // Offline: go straight to IndexedDB, bypass SW cached response
    if (!navigator.onLine) {
      try {
        let cached = await leerDeCache('rutas')
        if (!cached || cached.length === 0) cached = await obtenerRutasOffline()
        if (cached && cached.length > 0) {
          setRutas(cached)
          setIsOffline(true)
          setLoading(false)
          hasLoadedOnceRef.current = true
          return
        }
      } catch {}
    }

    try {
      const res = await fetch('/api/rutas')
      if (!res.ok) throw new Error()
      const d = await res.json()
      if (d.offline) throw new Error('offline')
      const rutas = Array.isArray(d) ? d : []
      setRutas(rutas)
      guardarEnCache('rutas', rutas).catch(() => {})
    } catch {
      try {
        let cached = await leerDeCache('rutas')
        if (!cached || cached.length === 0) cached = await obtenerRutasOffline()
        if (cached && cached.length > 0) { setRutas(cached); setIsOffline(true); setLoading(false); hasLoadedOnceRef.current = true; return }
      } catch {}
      setError('No se pudieron cargar las rutas.')
    } finally {
      setLoading(false)
      hasLoadedOnceRef.current = true
    }
  }, [])

  useEffect(() => { fetchRutas() }, [fetchRutas])

  // Cargar recomendaciones (solo owner, en paralelo, sin bloquear)
  const fetchRecomendaciones = useCallback(async () => {
    if (!esOwner) return
    try {
      const r = await fetch('/api/rutas/recomendaciones')
      if (!r.ok) return
      const d = await r.json()
      setRecom(d)
    } catch {}
  }, [esOwner])

  useEffect(() => {
    if (!authLoading && esOwner) fetchRecomendaciones()
  }, [authLoading, esOwner, fetchRecomendaciones])

  // Leer valor "ignorado" desde localStorage al montar
  useEffect(() => {
    try {
      const v = localStorage.getItem('cf-rutas-recomendacion-ignored')
      if (v !== null) setRecomIgnoradoEn(Number(v))
    } catch {}
  }, [])

  const ignorarRecomendacion = () => {
    const total = recom?.totalSinRuta ?? 0
    setRecomIgnoradoEn(total)
    try { localStorage.setItem('cf-rutas-recomendacion-ignored', String(total)) } catch {}
  }

  const mostrarBannerRec =
    !!recom &&
    recom.totalSinRuta >= 3 &&
    (recomIgnoradoEn === null || recom.totalSinRuta !== recomIgnoradoEn)

  // Refresh silencioso cuando llega nueva sincronización global.
  useEffect(() => {
    if (!lastSyncedAt) return
    fetchRutas({ soft: true })
  }, [lastSyncedAt, fetchRutas])

  const crearRuta = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) { setFormError('El nombre es requerido'); return }
    setSaving(true)
    setFormError('')
    try {
      const res  = await fetch('/api/rutas', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nombre, ...(Number(capitalRuta) > 0 && { capitalInicial: Number(capitalRuta) }) }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error ?? 'Error al crear la ruta'); return }
      setRutas((prev) => [...prev, { ...data, cantidadClientes: 0, esperadoHoy: 0, recaudadoHoy: 0 }])
      setNombre('')
      setCapitalRuta('')
      setShowForm(false)
      router.push(`/rutas/${data.id}`)
    } catch {
      setFormError('Error de conexión.')
    } finally {
      setSaving(false)
    }
  }

  const descargarBackup = async () => {
    setBackupLoading(true)
    try {
      const res = await fetch('/api/rutas/backup')
      if (!res.ok) { alert('Error al descargar backup'); return }
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rutas-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Error de conexion') } finally { setBackupLoading(false) }
  }

  const restaurarBackup = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (!confirm('Esto reemplazará la configuración actual de TODAS las rutas con el archivo seleccionado. ¿Continuar?')) return
      setRestoreLoading(true)
      try {
        const text = await file.text()
        const backup = JSON.parse(text)
        const res = await fetch('/api/rutas/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backup),
        })
        const data = await res.json()
        if (!res.ok) { alert(data.error ?? 'Error al restaurar'); return }
        alert(`Restauracion completada: ${data.restaurados} clientes reasignados`)
        window.location.reload()
      } catch { alert('Error al leer el archivo') } finally { setRestoreLoading(false) }
    }
    input.click()
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-[white]">Rutas</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {loading ? '…' : `${rutas.length} ruta${rutas.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {!authLoading && esOwner && (
          <Button
            onClick={() => setShowForm(true)}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Nueva ruta
          </Button>
        )}
      </div>

      {!authLoading && esOwner && rutas.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={descargarBackup}
            disabled={backupLoading}
            className="h-8 px-3 rounded-[10px] border border-[var(--color-border)] bg-[#141414] text-[11px] text-[#666] hover:text-[var(--color-text-secondary)] hover:border-[var(--color-border)] transition-all disabled:opacity-50 flex items-center gap-1.5"
            title="Guardar copia de seguridad"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
            {backupLoading ? 'Guardando...' : 'Guardar copia'}
          </button>
          <button
            onClick={restaurarBackup}
            disabled={restoreLoading}
            className="h-8 px-3 rounded-[10px] border border-[var(--color-border)] bg-[#141414] text-[11px] text-[#666] hover:text-[var(--color-text-secondary)] hover:border-[var(--color-border)] transition-all disabled:opacity-50 flex items-center gap-1.5"
            title="Restaurar copia de seguridad"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 6l-4-4-4 4M12 3v12" /></svg>
            {restoreLoading ? 'Restaurando...' : 'Restaurar copia'}
          </button>
        </div>
      )}

      {/* Mini formulario inline */}
      {showForm && (
        <form onSubmit={crearRuta} className="bg-[var(--color-bg-surface)] border border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)] rounded-[16px] p-4 mb-4 space-y-3">
          <Input
            placeholder="Nombre de la ruta (ej: Zona Norte)"
            value={nombre}
            onChange={(e) => { setNombre(e.target.value); setFormError('') }}
            error={formError}
            autoFocus
          />
          <div>
            <MoneyInput
              label="Capital de la ruta (opcional)"
              placeholder="Ej: 5.000.000"
              value={capitalRuta}
              onChange={(e) => setCapitalRuta(e.target.value)}
            />
            <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Asigna un capital propio para esta ruta. Si lo dejas vacío, usa el capital general.
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => { setShowForm(false); setCapitalRuta('') }} disabled={saving}>Cancelar</Button>
            <Button type="submit" loading={saving}>Crear ruta</Button>
          </div>
        </form>
      )}

      {mostrarBannerRec && (
        <div
          className="rounded-[12px] px-4 py-3 mb-4 flex items-center gap-3"
          style={{
            background: 'color-mix(in srgb, var(--color-accent) 6%, transparent)',
            borderLeft: '2px solid var(--color-accent)',
          }}
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--color-accent)' }}>
            <path d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-xs leading-snug" style={{ color: 'var(--color-text-primary)' }}>
              Tienes <strong>{recom.totalSinRuta}</strong> cliente{recom.totalSinRuta === 1 ? '' : 's'} sin ruta asignada.
              {recom.gruposSugeridos?.length > 0 && (
                <> Detectamos {recom.gruposSugeridos.length} grupo{recom.gruposSugeridos.length === 1 ? '' : 's'} por direccion.</>
              )}
            </p>
          </div>
          <button
            onClick={() => setShowSugerencias(true)}
            className="shrink-0 px-3 py-1.5 rounded-[8px] text-[11px] font-semibold transition-colors"
            style={{ background: 'var(--color-accent)', color: 'var(--color-bg-base)' }}
          >
            Ver sugerencias
          </button>
          <button
            onClick={ignorarRecomendacion}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Ignorar"
            title="Ignorar (solo vuelve a aparecer si hay nuevos clientes sin ruta)"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {isOffline && (
        <div className="bg-[var(--color-warning-dim)] border border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)] text-[var(--color-warning)] text-xs rounded-[12px] px-4 py-2.5 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse shrink-0" />
          Datos guardados — sin conexión
        </div>
      )}
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

      {!loading && rutas.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-[rgba(245,197,24,0.1)] flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[white]">Sin rutas aún</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Crea una ruta y asígnale un cobrador</p>
          <button onClick={() => setShowForm(true)} className="mt-4 text-sm text-[var(--color-accent)] hover:underline">
            Crear primera ruta
          </button>
        </div>
      )}

      {/* Toggle modo trabajo / ordenar (solo owner, con 2+ rutas) */}
      {!loading && rutas.length > 1 && esOwner && (
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

      {!loading && rutas.length > 0 && !modoOrdenar && (
        <div className="space-y-3">
          {rutas.map((r) => <RutaCard key={r.id} ruta={r} />)}
        </div>
      )}

      {/* Modo ordenar: cards no clicables, con grip (drag) y flechas subir/bajar */}
      {!loading && rutas.length > 0 && modoOrdenar && (
        <div className="space-y-2" ref={listaRef}>
          {rutas.map((r, i) => (
            <div
              key={r.id}
              data-idx={i}
              draggable
              onDragStart={() => onDragStart(i)}
              onDragOver={(e) => onDragOver(e, i)}
              onDrop={() => onDrop(i)}
              onDragEnd={onDragEnd}
              onTouchStart={(e) => onTouchStart(e, i)}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              className="flex items-center gap-2 px-3 py-3 rounded-[12px] border transition-all"
              style={{
                background: 'var(--color-bg-card)',
                borderColor: dragOverIdx === i ? 'var(--color-accent)' : 'var(--color-border)',
                opacity: dragIndex === i ? 0.5 : 1,
                cursor: 'grab',
                touchAction: 'none',
              }}
            >
              {/* Grip */}
              <svg className="w-6 h-6 shrink-0" style={{ color: 'var(--color-text-muted)' }} fill="currentColor" viewBox="0 0 24 24">
                <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
              </svg>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>{r.nombre}</p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  {r.cobrador?.nombre || 'Sin cobrador'} · {r.cantidadClientes} cliente{r.cantidadClientes !== 1 ? 's' : ''}
                </p>
              </div>
              {/* Flechas subir/bajar */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button" onClick={() => moverRuta(i, -1)} disabled={i === 0}
                  className="w-7 h-7 flex items-center justify-center rounded-[8px] disabled:opacity-30"
                  style={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-primary)' }}
                  aria-label="Subir"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7"/></svg>
                </button>
                <button
                  type="button" onClick={() => moverRuta(i, 1)} disabled={i === rutas.length - 1}
                  className="w-7 h-7 flex items-center justify-center rounded-[8px] disabled:opacity-30"
                  style={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-primary)' }}
                  aria-label="Bajar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ModalSugerenciasRutas
        open={showSugerencias}
        onClose={() => setShowSugerencias(false)}
        onSuccess={() => { fetchRutas({ soft: true }); fetchRecomendaciones() }}
      />
    </div>
  )
}
