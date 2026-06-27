'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { calcularPrestamo } from '@/lib/calculos'
import { formatMoney } from '@/lib/i18n'
import ModoInteresSelector from '@/components/prestamos/ModoInteresSelector'

const getColombiaDate = () => new Date(Date.now() - 5 * 60 * 60 * 1000)
const hoyISO = () => getColombiaDate().toISOString().slice(0, 10)

const DIAS_POR_PERIODO = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }
const PLAZO_DEFAULT = { diario: '30', semanal: '8', quincenal: '4', mensual: '2' }
const FRECUENCIAS = [
  { key: 'diario', label: 'Diario' },
  { key: 'semanal', label: 'Semanal' },
  { key: 'quincenal', label: 'Quincenal' },
  { key: 'mensual', label: 'Mensual' },
]
const CHIPS_MONTO = [50000, 100000, 200000, 500000, 1000000]

function fichaVacia(defaults) {
  return {
    nombre: '',
    cedula: '',
    telefono: '',
    direccion: '',
    monto: '',
    tasa: defaults.tasa,
    frecuencia: defaults.frecuencia,
    plazoUnidades: PLAZO_DEFAULT[defaults.frecuencia],
    modoInteres: defaults.modoInteres,
    fechaInicio: hoyISO(),
    esEnCurso: false,
    yaAbonado: '',
    rutaId: defaults.rutaId,
  }
}

export default function MigradorPage() {
  const router = useRouter()
  const { esOwner, loading: authLoading } = useAuth()
  const nombreRef = useRef(null)
  const fotoRef = useRef(null)

  const [rutas, setRutas] = useState([])
  const [configOpen, setConfigOpen] = useState(true)

  // Config global (se hereda a cada ficha nueva)
  const [defaults, setDefaults] = useState({
    tasa: '20',
    frecuencia: 'diario',
    modoInteres: 'fijo',
    rutaId: '',
  })

  // Ficha actual
  const [ficha, setFicha] = useState(() => fichaVacia(defaults))

  // Lista de creados
  const [creados, setCreados] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrMsg, setOcrMsg] = useState('')
  const [fotoPerfilRef] = useState(() => ({ current: null }))
  const [fotoPerfil, setFotoPerfil] = useState(null)
  const [fotoPerfilPreview, setFotoPerfilPreview] = useState(null)

  useEffect(() => {
    if (!authLoading && !esOwner) router.replace('/dashboard')
  }, [authLoading, esOwner, router])

  useEffect(() => {
    fetch('/api/rutas')
      .then(r => r.json())
      .then(list => setRutas(Array.isArray(list) ? list : []))
      .catch(() => {})
  }, [])

  const diasPlazo = useMemo(() => {
    return String((Number(ficha.plazoUnidades) || 0) * (DIAS_POR_PERIODO[ficha.frecuencia] || 1))
  }, [ficha.plazoUnidades, ficha.frecuencia])

  const calculo = useMemo(() => {
    const m = Number(ficha.monto)
    const t = Number(ficha.tasa)
    const d = Number(diasPlazo)
    if (m <= 0 || t < 0 || d <= 0) return null
    try {
      return calcularPrestamo({
        montoPrestado: m,
        tasaInteres: t,
        diasPlazo: d,
        fechaInicio: ficha.fechaInicio || hoyISO(),
        frecuencia: ficha.frecuencia,
        modoInteres: ficha.modoInteres,
      })
    } catch {
      return null
    }
  }, [ficha.monto, ficha.tasa, diasPlazo, ficha.fechaInicio, ficha.frecuencia, ficha.modoInteres])

  const saldoPendiente = useMemo(() => {
    if (!calculo) return null
    const abonado = Number(ficha.yaAbonado) || 0
    return calculo.totalAPagar - abonado
  }, [calculo, ficha.yaAbonado])

  const set = useCallback((campo, valor) => {
    setFicha(prev => ({ ...prev, [campo]: valor }))
    if (error) setError('')
  }, [error])

  const handleFrecuenciaChange = useCallback((freq) => {
    setFicha(prev => ({
      ...prev,
      frecuencia: freq,
      plazoUnidades: PLAZO_DEFAULT[freq],
    }))
  }, [])

  const updateDefault = useCallback((campo, valor) => {
    setDefaults(prev => ({ ...prev, [campo]: valor }))
  }, [])

  const handleFoto = async (e) => {
    const archivos = Array.from(e.target.files ?? [])
    if (!archivos.length) return
    if (fotoRef.current) fotoRef.current.value = ''

    setOcrLoading(true)
    setOcrMsg('')
    setError('')

    const fd = new FormData()
    archivos.forEach(f => fd.append('fotos', f))

    try {
      const res = await fetch('/api/herramientas/leer-cartulina', { method: 'POST', body: fd })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'No pudimos leer la foto')
        setOcrLoading(false)
        return
      }

      const d = json.datos || {}
      const camposLlenados = []

      setFicha(prev => {
        const updated = { ...prev }
        if (d.nombre)         { updated.nombre = d.nombre; camposLlenados.push('nombre') }
        if (d['cédula'] || d.cedula) { updated.cedula = d['cédula'] || d.cedula; camposLlenados.push('cédula') }
        if (d['teléfono'] || d.telefono) { updated.telefono = d['teléfono'] || d.telefono; camposLlenados.push('teléfono') }
        if (d['dirección'] || d.direccion) { updated.direccion = d['dirección'] || d.direccion; camposLlenados.push('dirección') }
        if (d.montoPrestado)  { updated.monto = String(d.montoPrestado); camposLlenados.push('monto') }
        if (d.tasaInteres)    { updated.tasa = String(d.tasaInteres); camposLlenados.push('tasa') }
        if (d.frecuencia && DIAS_POR_PERIODO[d.frecuencia]) {
          updated.frecuencia = d.frecuencia
          updated.plazoUnidades = PLAZO_DEFAULT[d.frecuencia]
          camposLlenados.push('frecuencia')
        }
        if (d.diasPlazo) {
          const freq = updated.frecuencia
          const dias = Number(d.diasPlazo)
          const porPeriodo = DIAS_POR_PERIODO[freq] || 1
          updated.plazoUnidades = String(Math.round(dias / porPeriodo))
          camposLlenados.push('plazo')
        }
        if (d.fechaInicio) { updated.fechaInicio = d.fechaInicio; camposLlenados.push('fecha') }
        if (d.montoPagadoHasta || d.cuotasPagadas) {
          updated.esEnCurso = true
          if (d.montoPagadoHasta) { updated.yaAbonado = String(d.montoPagadoHasta); camposLlenados.push('abonado') }
        }
        return updated
      })

      const faltantes = []
      if (!d.nombre) faltantes.push('nombre')
      if (!d['cédula'] && !d.cedula) faltantes.push('cédula')
      if (!d['teléfono'] && !d.telefono) faltantes.push('teléfono')
      if (!d.montoPrestado) faltantes.push('monto')

      let msg = `${camposLlenados.length} campo${camposLlenados.length !== 1 ? 's' : ''} extraído${camposLlenados.length !== 1 ? 's' : ''}`
      if (faltantes.length) msg += ` · Falta: ${faltantes.join(', ')}`
      if (json.advertencias?.length) msg += ` · ${json.advertencias[0]}`
      setOcrMsg(msg)
      setTimeout(() => setOcrMsg(''), 6000)
    } catch {
      setError('Error de conexión al leer la foto')
    } finally {
      setOcrLoading(false)
    }
  }

  const handleFotoPerfil = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoPerfil(file)
    setFotoPerfilPreview(URL.createObjectURL(file))
  }

  const subirFotoPerfil = async (clienteId) => {
    if (!fotoPerfil) return
    try {
      const fd = new FormData()
      fd.append('foto', fotoPerfil)
      await fetch(`/api/clientes/${clienteId}/foto`, { method: 'POST', body: fd })
    } catch {}
  }

  const guardar = async (continuar) => {
    if (!ficha.nombre.trim()) {
      setError('El nombre del cliente es obligatorio')
      return
    }
    if (!ficha.cedula.trim()) {
      setError('La cédula es obligatoria')
      return
    }
    if (!ficha.telefono.trim()) {
      setError('El teléfono es obligatorio')
      return
    }
    if (!ficha.monto || Number(ficha.monto) <= 0) {
      setError('El monto del préstamo es obligatorio')
      return
    }
    if (!calculo) {
      setError('Revisa los datos del préstamo')
      return
    }

    setSaving(true)
    setError('')
    setSuccessMsg('')

    try {
      // 1. Crear cliente
      const clientePayload = {
        nombre: ficha.nombre.trim(),
        cedula: ficha.cedula.trim(),
        telefono: ficha.telefono.trim(),
        ...(ficha.direccion.trim() && { direccion: ficha.direccion.trim() }),
        ...(ficha.rutaId && { rutaId: ficha.rutaId }),
      }

      const resCliente = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientePayload),
      })
      const dataCliente = await resCliente.json()

      if (!resCliente.ok) {
        setError(dataCliente.error || 'Error al crear el cliente')
        setSaving(false)
        return
      }

      // 1b. Subir foto de perfil si hay
      await subirFotoPerfil(dataCliente.id)

      // 2. Crear préstamo
      const prestamoPayload = {
        clienteId: dataCliente.id,
        montoPrestado: Number(ficha.monto),
        tasaInteres: Number(ficha.tasa),
        diasPlazo: Number(diasPlazo),
        fechaInicio: ficha.fechaInicio,
        frecuencia: ficha.frecuencia,
        modoInteres: ficha.modoInteres,
        ...(ficha.esEnCurso && Number(ficha.yaAbonado) > 0 && {
          yaAbonado: Number(ficha.yaAbonado),
        }),
      }

      const resPrestamo = await fetch('/api/prestamos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prestamoPayload),
      })
      const dataPrestamo = await resPrestamo.json()

      if (!resPrestamo.ok) {
        setError(dataPrestamo.error || 'Cliente creado pero error en el préstamo')
        setSaving(false)
        return
      }

      // Agregar a la lista de creados
      setCreados(prev => [{
        nombre: ficha.nombre.trim(),
        monto: Number(ficha.monto),
        frecuencia: ficha.frecuencia,
        totalAPagar: calculo.totalAPagar,
        cuota: calculo.cuotaDiaria,
        clienteId: dataCliente.id,
        prestamoId: dataPrestamo.id,
      }, ...prev])

      if (continuar) {
        setFicha(fichaVacia(defaults))
        setFotoPerfil(null)
        if (fotoPerfilPreview) URL.revokeObjectURL(fotoPerfilPreview)
        setFotoPerfilPreview(null)
        setSuccessMsg(`${ficha.nombre.trim()} guardado`)
        setTimeout(() => setSuccessMsg(''), 3000)
        setTimeout(() => nombreRef.current?.focus(), 100)
      } else {
        router.push('/prestamos')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || !esOwner) return null

  const freqLabel = FRECUENCIAS.find(f => f.key === ficha.frecuencia)?.label?.toLowerCase() || ficha.frecuencia
  const unidadPlazo = { diario: 'días', semanal: 'semanas', quincenal: 'quincenas', mensual: 'meses' }[ficha.frecuencia] || 'días'

  return (
    <div className="max-w-lg mx-auto pb-32">
      {/* Header */}
      <div className="mb-5">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm mb-3 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Migrador de cartera
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Agrega clientes con préstamo, uno tras otro
            </p>
          </div>
          {creados.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: 'var(--color-success-dim)', color: 'var(--color-success)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              {creados.length}
            </div>
          )}
        </div>
      </div>

      {/* Configuración global */}
      <div className="rounded-[14px] border mb-4 overflow-hidden"
        style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
        <button
          type="button"
          onClick={() => setConfigOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
              style={{ color: 'var(--color-accent)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Configuración base
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              {defaults.tasa}% · {FRECUENCIAS.find(f => f.key === defaults.frecuencia)?.label}
            </span>
            <svg className="w-4 h-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"
              style={{ color: 'var(--color-text-muted)', transform: configOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {configOpen && (
          <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            <p className="text-[11px] pt-3" style={{ color: 'var(--color-text-muted)' }}>
              Estos valores se aplican a cada cliente nuevo. Puedes cambiarlos individualmente abajo.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block"
                  style={{ color: 'var(--color-text-muted)' }}>Tasa %</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={defaults.tasa}
                  onChange={e => updateDefault('tasa', e.target.value)}
                  className="w-full h-10 rounded-[10px] border px-3 text-sm"
                  style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block"
                  style={{ color: 'var(--color-text-muted)' }}>Frecuencia</label>
                <select
                  value={defaults.frecuencia}
                  onChange={e => updateDefault('frecuencia', e.target.value)}
                  className="w-full h-10 rounded-[10px] border px-3 text-sm"
                  style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                >
                  {FRECUENCIAS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
              </div>
            </div>
            {rutas.length > 0 && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block"
                  style={{ color: 'var(--color-text-muted)' }}>Ruta</label>
                <select
                  value={defaults.rutaId}
                  onChange={e => updateDefault('rutaId', e.target.value)}
                  className="w-full h-10 rounded-[10px] border px-3 text-sm"
                  style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                >
                  <option value="">Sin ruta</option>
                  {rutas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] mb-4 text-sm font-medium animate-in fade-in"
          style={{ background: 'var(--color-success-dim)', color: 'var(--color-success)', border: '1px solid var(--color-success-border)' }}>
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          {successMsg}
        </div>
      )}

      {/* Ficha actual */}
      <div className="rounded-[14px] border overflow-hidden mb-4"
        style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>

        {/* Hidden file inputs */}
        <input
          ref={fotoRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handleFoto}
          capture="environment"
        />
        <input
          ref={el => { fotoPerfilRef.current = el }}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFotoPerfil}
          capture="environment"
        />

        {/* Header de ficha */}
        <div className="px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--color-border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Cliente {creados.length + 1}
          </span>
          {creados.length > 0 && (
            <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              {creados.length} creado{creados.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Banner OCR — importar desde foto */}
        <div className="mx-4 mt-3">
          <button
            type="button"
            onClick={() => fotoRef.current?.click()}
            disabled={ocrLoading}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-[12px] border-2 border-dashed transition-all active:scale-[0.98] disabled:opacity-60"
            style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 50%, transparent)', background: 'color-mix(in srgb, var(--color-accent) 6%, transparent)' }}
          >
            <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
              style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>
              {ocrLoading ? (
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
              )}
            </div>
            <div className="text-left min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {ocrLoading ? 'Leyendo foto...' : 'Importar desde foto'}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                Cartulina, cuaderno, libreta... detecta los datos
              </p>
            </div>
            {!ocrLoading && (
              <svg className="w-4 h-4 shrink-0 ml-auto" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                style={{ color: 'var(--color-text-muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>

        {/* OCR result message */}
        {ocrMsg && (
          <div className="mx-4 mt-2 flex items-center gap-2 px-3 py-2 rounded-[10px] text-[12px]"
            style={{ background: 'var(--color-info-dim, var(--color-accent-soft))', color: 'var(--color-info, var(--color-accent))', border: '1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)' }}>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {ocrMsg}
          </div>
        )}

        <div className="p-4 space-y-4">
          {/* ── DATOS DEL CLIENTE ── */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide mb-2"
              style={{ color: 'var(--color-accent)' }}>Datos del cliente</h3>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                {/* Foto de perfil */}
                <button
                  type="button"
                  onClick={() => fotoPerfilRef.current?.click()}
                  className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center border-2 border-dashed overflow-hidden transition-all active:scale-95"
                  style={{ borderColor: fotoPerfilPreview ? 'var(--color-accent)' : 'var(--color-border)', background: fotoPerfilPreview ? 'transparent' : 'var(--color-bg-base)' }}
                  title="Foto de perfil"
                >
                  {fotoPerfilPreview ? (
                    <img src={fotoPerfilPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
                      style={{ color: 'var(--color-text-muted)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  )}
                </button>
                <input
                  ref={nombreRef}
                  type="text"
                  placeholder="Nombre *"
                  autoFocus
                  value={ficha.nombre}
                  onChange={e => set('nombre', e.target.value)}
                  className="flex-1 h-11 rounded-[10px] border px-3 text-sm"
                  style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="text"
                  placeholder="Cédula *"
                  inputMode="numeric"
                  value={ficha.cedula}
                  onChange={e => set('cedula', e.target.value)}
                  className="w-full h-11 rounded-[10px] border px-3 text-sm"
                  style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                />
                <input
                  type="tel"
                  placeholder="Teléfono *"
                  value={ficha.telefono}
                  onChange={e => set('telefono', e.target.value)}
                  className="w-full h-11 rounded-[10px] border px-3 text-sm"
                  style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                />
              </div>
              <input
                type="text"
                placeholder="Dirección"
                value={ficha.direccion}
                onChange={e => set('direccion', e.target.value)}
                className="w-full h-11 rounded-[10px] border px-3 text-sm"
                style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </div>
          </div>

          {/* ── PRÉSTAMO ── */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide mb-2"
              style={{ color: 'var(--color-accent)' }}>Préstamo</h3>
            <div className="space-y-3">
              {/* Monto */}
              <div>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Monto prestado *"
                  value={ficha.monto}
                  onChange={e => set('monto', e.target.value)}
                  className="w-full h-11 rounded-[10px] border px-3 text-sm"
                  style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                />
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {CHIPS_MONTO.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => set('monto', String(v))}
                      className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
                      style={{
                        background: Number(ficha.monto) === v ? 'var(--color-accent-soft)' : 'var(--color-bg-base)',
                        borderColor: Number(ficha.monto) === v ? 'var(--color-accent)' : 'var(--color-border)',
                        color: Number(ficha.monto) === v ? 'var(--color-accent)' : 'var(--color-text-muted)',
                      }}
                    >
                      {formatMoney(v)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tasa + Frecuencia + Plazo */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block"
                    style={{ color: 'var(--color-text-muted)' }}>Tasa %</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={ficha.tasa}
                    onChange={e => set('tasa', e.target.value)}
                    className="w-full h-10 rounded-[10px] border px-3 text-sm"
                    style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block"
                    style={{ color: 'var(--color-text-muted)' }}>Frecuencia</label>
                  <select
                    value={ficha.frecuencia}
                    onChange={e => handleFrecuenciaChange(e.target.value)}
                    className="w-full h-10 rounded-[10px] border px-2 text-sm"
                    style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                  >
                    {FRECUENCIAS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block"
                    style={{ color: 'var(--color-text-muted)' }}>Plazo ({unidadPlazo})</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={ficha.plazoUnidades}
                    onChange={e => set('plazoUnidades', e.target.value)}
                    className="w-full h-10 rounded-[10px] border px-3 text-sm"
                    style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                  />
                </div>
              </div>

              {/* Modo interés */}
              <ModoInteresSelector
                modoInteres={ficha.modoInteres}
                onChange={v => set('modoInteres', v)}
                monto={ficha.monto}
                tasa={ficha.tasa}
                frecuencia={ficha.frecuencia}
                diasPlazo={diasPlazo}
              />

              {/* Fecha inicio */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block"
                  style={{ color: 'var(--color-text-muted)' }}>Fecha de inicio</label>
                <input
                  type="date"
                  value={ficha.fechaInicio}
                  onChange={e => set('fechaInicio', e.target.value)}
                  max={hoyISO()}
                  className="w-full h-10 rounded-[10px] border px-3 text-sm"
                  style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                />
              </div>

              {/* Préstamo en curso */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ficha.esEnCurso}
                  onChange={e => set('esEnCurso', e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--color-accent)]"
                />
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Ya tiene abonos (préstamo en curso)
                </span>
              </label>

              {ficha.esEnCurso && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block"
                    style={{ color: 'var(--color-text-muted)' }}>Ya ha pagado</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Monto ya abonado"
                    value={ficha.yaAbonado}
                    onChange={e => set('yaAbonado', e.target.value)}
                    className="w-full h-10 rounded-[10px] border px-3 text-sm"
                    style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                  />
                </div>
              )}

              {/* Ruta (si no está en config global) */}
              {rutas.length > 0 && !defaults.rutaId && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block"
                    style={{ color: 'var(--color-text-muted)' }}>Ruta</label>
                  <select
                    value={ficha.rutaId}
                    onChange={e => set('rutaId', e.target.value)}
                    className="w-full h-10 rounded-[10px] border px-3 text-sm"
                    style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                  >
                    <option value="">Sin ruta</option>
                    {rutas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* ── RESUMEN EN VIVO ── */}
          {calculo && (
            <div className="rounded-[12px] p-3.5 space-y-1.5"
              style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border)' }}>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total a pagar</span>
                <span className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {formatMoney(calculo.totalAPagar)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Cuota {freqLabel}
                </span>
                <span className="text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>
                  {formatMoney(calculo.cuotaDiaria)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Interés</span>
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {formatMoney(calculo.totalInteres)}
                </span>
              </div>
              {ficha.esEnCurso && Number(ficha.yaAbonado) > 0 && saldoPendiente !== null && (
                <div className="flex justify-between items-center pt-1.5"
                  style={{ borderTop: '1px dashed var(--color-border)' }}>
                  <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                    Saldo pendiente
                  </span>
                  <span className="text-sm font-bold" style={{ color: 'var(--color-success)' }}>
                    {formatMoney(saldoPendiente)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-4 flex items-center gap-2 px-3 py-2.5 rounded-[10px] text-sm"
            style={{ background: 'var(--color-danger-dim)', color: 'var(--color-danger)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)' }}>
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}

        {/* Botones */}
        <div className="p-4 flex gap-2.5" style={{ borderTop: '1px solid var(--color-border)' }}>
          <button
            type="button"
            onClick={() => guardar(true)}
            disabled={saving}
            className="flex-1 h-12 rounded-[12px] text-sm font-bold transition-all disabled:opacity-50"
            style={{ background: 'var(--color-accent)', color: '#000' }}
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Guardando...
              </span>
            ) : (
              'Guardar y crear otro'
            )}
          </button>
          <button
            type="button"
            onClick={() => guardar(false)}
            disabled={saving}
            className="h-12 px-4 rounded-[12px] text-sm font-semibold border transition-all disabled:opacity-50"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', background: 'var(--color-bg-surface)' }}
          >
            Terminar
          </button>
        </div>
      </div>

      {/* ── LISTA DE CREADOS ── */}
      {creados.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide mb-2 px-1"
            style={{ color: 'var(--color-text-muted)' }}>
            Creados ({creados.length})
          </h3>
          <div className="space-y-1.5">
            {creados.map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] border"
                style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'var(--color-success-dim)' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    style={{ color: 'var(--color-success)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {c.nombre}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    {formatMoney(c.monto)} · {c.frecuencia} · cuota {formatMoney(c.cuota)}
                  </p>
                </div>
                <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                  {formatMoney(c.totalAPagar)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
