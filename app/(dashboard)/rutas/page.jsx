'use client'
// app/(dashboard)/rutas/page.jsx - Lista de rutas

import { useState, useEffect } from 'react'
import Link                    from 'next/link'
import { useRouter }           from 'next/navigation'
import { useAuth }             from '@/hooks/useAuth'
import { guardarEnCache, leerDeCache, obtenerRutasOffline } from '@/lib/offline'
import { Button }              from '@/components/ui/Button'
import { Input }               from '@/components/ui/Input'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import { formatCOP }           from '@/lib/calculos'

export default function RutasPage() {
  const router = useRouter()
  const { esOwner, loading: authLoading } = useAuth()
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

  useEffect(() => {
    setIsOffline(false)
    fetch('/api/rutas')
      .then((r) => r.json())
      .then((d) => {
        const rutas = Array.isArray(d) ? d : []
        setRutas(rutas)
        guardarEnCache('rutas', rutas).catch(() => {})
      })
      .catch(async () => {
        try {
          let cached = await leerDeCache('rutas')
          if (!cached || cached.length === 0) cached = await obtenerRutasOffline()
          if (cached && cached.length > 0) { setRutas(cached); setIsOffline(true); setLoading(false); return }
        } catch {}
        setError('No se pudieron cargar las rutas.')
      })
      .finally(() => setLoading(false))
  }, [])

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
      if (!confirm('Esto reemplazara la configuracion actual de TODAS las rutas con el archivo seleccionado. ¿Continuar?')) return
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[white]">Rutas</h1>
          <p className="text-sm text-[#888888] mt-0.5">
            {loading ? '…' : `${rutas.length} ruta${rutas.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!authLoading && esOwner && rutas.length > 0 && (
            <>
              <button
                onClick={descargarBackup}
                disabled={backupLoading}
                className="h-9 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#1a1a1a] text-xs text-[#888888] hover:text-white hover:border-[#3a3a3a] transition-all disabled:opacity-50 flex items-center gap-1.5"
                title="Guardar copia de seguridad"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
                {backupLoading ? 'Guardando...' : 'Guardar copia'}
              </button>
              <button
                onClick={restaurarBackup}
                disabled={restoreLoading}
                className="h-9 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#1a1a1a] text-xs text-[#888888] hover:text-white hover:border-[#3a3a3a] transition-all disabled:opacity-50 flex items-center gap-1.5"
                title="Restaurar copia de seguridad"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 6l-4-4-4 4M12 3v12" /></svg>
                {restoreLoading ? 'Restaurando...' : 'Restaurar copia'}
              </button>
            </>
          )}
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
      </div>

      {/* Mini formulario inline */}
      {showForm && (
        <form onSubmit={crearRuta} className="bg-[#1a1a1a] border border-[#f5c518]/30 rounded-[16px] p-4 mb-4 flex gap-3">
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
        <div className="bg-[rgba(245,197,24,0.1)] border border-[rgba(245,197,24,0.2)] text-[#f5c518] text-xs rounded-[12px] px-4 py-2.5 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#f5c518] animate-pulse shrink-0" />
          Datos guardados — sin conexión
        </div>
      )}
      {error && (
        <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[12px] px-4 py-3 mb-4">
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
            <svg className="w-7 h-7 text-[#f5c518]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[white]">Sin rutas aún</p>
          <p className="text-xs text-[#888888] mt-1">Crea una ruta y asígnale un cobrador</p>
          <button onClick={() => setShowForm(true)} className="mt-4 text-sm text-[#f5c518] hover:underline">
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
            return (
              <Link
                key={r.id}
                href={`/rutas/${r.id}`}
                className="block border border-[#2a2a2a] rounded-[16px] p-4 hover:border-[#f5c518]/40 transition-all group"
                style={{
                  background: `linear-gradient(135deg, #22c55e0A 0%, #1a1a1a 40%, #1a1a1a 70%, #f5c5180A 100%)`,
                  boxShadow: `0 0 30px #22c55e08, 0 1px 2px rgba(0,0,0,0.3)`,
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-[white]">{r.nombre}</p>
                    <p className="text-xs text-[#888888] mt-0.5">
                      {r.cobrador
                        ? <span className="text-[#a855f7]">{r.cobrador.nombre}</span>
                        : <span className="text-[#888888]">Sin cobrador asignado</span>
                      }
                    </p>
                  </div>
                  <span className="text-xs text-[#888888]">
                    {r.cantidadClientes} cliente{r.cantidadClientes !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="flex justify-between text-xs text-[#888888] mb-1.5">
                  <span>Recaudado: <span className="text-[#22c55e] font-medium font-mono-display">{formatCOP(r.recaudadoHoy)}</span></span>
                  <span>Esperado: <span className="font-mono-display">{formatCOP(r.esperadoHoy)}</span></span>
                </div>
                <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${progreso}%`,
                      background: progreso >= 100 ? '#22c55e' : '#f5c518',
                    }}
                  />
                </div>
                <p className="text-[10px] text-[#888888] mt-1 text-right">{progreso}% del día</p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
