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
import { SkeletonCard }        from '@/components/ui/Skeleton'
import { formatCOP }           from '@/lib/calculos'

export default function RutasPage() {
  const router = useRouter()
  const { esOwner, loading: authLoading } = useAuth()
  const { lastSyncedAt } = useOffline()
  const [rutas,    setRutas]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [showForm, setShowForm] = useState(false)
  const [nombre,   setNombre]   = useState('')
  const [saving,   setSaving]   = useState(false)
  const [formError, setFormError] = useState('')
  const [isOffline, setIsOffline] = useState(false)
  const [backupLoading, setBackupLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const hasLoadedOnceRef = useRef(false)

  const fetchRutas = useCallback(async ({ soft = false } = {}) => {
    const shouldUseSoftRefresh = soft && hasLoadedOnceRef.current
    if (!shouldUseSoftRefresh) setLoading(true)
    setError('')
    setIsOffline(false)

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
        body:    JSON.stringify({ nombre }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error ?? 'Error al crear la ruta'); return }
      setRutas((prev) => [...prev, { ...data, cantidadClientes: 0, esperadoHoy: 0, recaudadoHoy: 0 }])
      setNombre('')
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
        <form onSubmit={crearRuta} className="bg-[var(--color-bg-surface)] border border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)] rounded-[16px] p-4 mb-4 flex gap-3">
          <Input
            placeholder="Nombre de la ruta (ej: Zona Norte)"
            value={nombre}
            onChange={(e) => { setNombre(e.target.value); setFormError('') }}
            error={formError}
            containerClassName="flex-1"
            autoFocus
          />
          <Button type="submit" loading={saving}>Crear</Button>
          <Button type="button" variant="ghost" onClick={() => setShowForm(false)} disabled={saving}>✕</Button>
        </form>
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

      {!loading && rutas.length > 0 && (
        <div className="space-y-3">
          {rutas.map((r) => {
            const progreso = r.esperadoHoy > 0
              ? Math.min(100, Math.round((r.recaudadoHoy / r.esperadoHoy) * 100))
              : 0
            const isComplete = progreso >= 100
            const accentColor = isComplete ? 'var(--color-success)' : 'var(--color-accent)'
            return (
              <Link
                key={r.id}
                href={`/rutas/${r.id}`}
                className="block border rounded-[16px] p-4 transition-all group active:scale-[0.98]"
                style={{
                  borderColor: isComplete ? 'rgba(34,197,94,0.2)' : '#2a2a2a',
                  background: `linear-gradient(135deg, ${accentColor}08 0%, #141414 50%, #141414 80%, ${accentColor}05 100%)`,
                  boxShadow: `0 0 40px ${accentColor}06, 0 2px 8px rgba(0,0,0,0.3)`,
                }}
              >
                {/* Top row: nombre + badge */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                      style={{ background: `${accentColor}15` }}
                    >
                      <svg className="w-4.5 h-4.5" style={{ color: accentColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[white] truncate">{r.nombre}</p>
                      <p className="text-[11px] text-[#666] mt-0.5">
                        {r.cobrador
                          ? <span className="text-[var(--color-purple)]">{r.cobrador.nombre}</span>
                          : 'Sin cobrador'
                        }
                        <span className="mx-1.5 text-[#666]">·</span>
                        {r.cantidadClientes} cliente{r.cantidadClientes !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div
                    className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold"
                    style={{
                      color: accentColor,
                      background: `${accentColor}12`,
                    }}
                  >
                    {progreso}%
                  </div>
                </div>

                {/* Metrics row */}
                <div className="flex gap-2 mb-3">
                  <div className="flex-1 bg-[rgba(255,255,255,0.03)] rounded-[10px] px-2.5 py-2">
                    <p className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">Recaudado</p>
                    <p className="text-xs font-bold text-[var(--color-success)] font-mono-display">{formatCOP(r.recaudadoHoy)}</p>
                  </div>
                  <div className="flex-1 bg-[rgba(255,255,255,0.03)] rounded-[10px] px-2.5 py-2">
                    <p className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">Esperado</p>
                    <p className="text-xs font-bold text-[var(--color-text-secondary)] font-mono-display">{formatCOP(r.esperadoHoy)}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-[#1f1f1f] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${progreso}%`,
                      background: isComplete
                        ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                        : `linear-gradient(90deg, ${accentColor}, ${accentColor}cc)`,
                      boxShadow: `0 0 8px ${accentColor}40`,
                    }}
                  />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
