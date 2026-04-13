'use client'
// components/clientes/ClienteForm.jsx - Formulario reutilizable para crear/editar cliente

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import dynamic                 from 'next/dynamic'
import { Input, Select }       from '@/components/ui/Input'
import { Button }              from '@/components/ui/Button'
import DiasSinCobroSelector    from '@/components/ui/DiasSinCobroSelector'

const LocationPicker = dynamic(() => import('@/components/clientes/LocationPicker'), { ssr: false })

// Validación de teléfono colombiano: 10 dígitos, empieza en 3
const validarTelefono = (v) => /^3\d{9}$/.test(v.replace(/\s/g, ''))

export default function ClienteForm({ clienteInicial = null, plan = 'basic' }) {
  const router = useRouter()
  const esEdicion = !!clienteInicial

  const [form, setForm] = useState({
    nombre:     clienteInicial?.nombre     ?? '',
    cedula:     clienteInicial?.cedula     ?? '',
    telefono:   clienteInicial?.telefono   ?? '',
    direccion:  clienteInicial?.direccion  ?? '',
    referencia: clienteInicial?.referencia ?? '',
    notas:      clienteInicial?.notas      ?? '',
    rutaId:     clienteInicial?.rutaId     ?? '',
    grupoCobroId: clienteInicial?.grupoCobroId ?? '',
    latitud:    clienteInicial?.latitud    ?? null,
    longitud:   clienteInicial?.longitud   ?? null,
  })
  const [errores, setErrores]   = useState({})
  const [rutas,   setRutas]     = useState([])
  const [grupos,  setGrupos]    = useState([])
  const [loading, setLoading]   = useState(false)
  const [error,   setError]     = useState('')
  const [scoreData, setScoreData] = useState(null)
  const [avanzadoOpen, setAvanzadoOpen] = useState(false)
  const [diasSinCobro, setDiasSinCobro] = useState(() => {
    try { return JSON.parse(clienteInicial?.diasSinCobro || '[]') } catch { return [] }
  })

  // Consulta de score crediticio debounced al escribir cédula
  const habilitadoScore = !esEdicion && ['standard', 'professional'].includes(plan)
  useEffect(() => {
    if (!habilitadoScore) return
    const cedula = form.cedula.trim()
    if (cedula.length < 6 || !/^\d{6,12}$/.test(cedula)) {
      setScoreData(null)
      return
    }
    const timer = setTimeout(() => {
      fetch(`/api/clientes/score?cedula=${encodeURIComponent(cedula)}`)
        .then(r => r.json())
        .then(d => { if (!d.error) setScoreData(d); else setScoreData(null) })
        .catch(() => setScoreData(null))
    }, 500)
    return () => clearTimeout(timer)
  }, [form.cedula, habilitadoScore])

  // Cargar rutas solo para plan standard+
  useEffect(() => {
    if (plan === 'basic') return
    fetch('/api/rutas')
      .then((r) => r.json())
      .then((data) => setRutas(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [plan])

  // Cargar grupos para asignación rápida desde el formulario
  useEffect(() => {
    fetch('/api/grupos')
      .then((r) => r.json())
      .then((data) => setGrupos(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    setErrores((prev) => ({ ...prev, [field]: '' }))
  }

  const validar = () => {
    const errs = {}
    if (!form.nombre.trim())    errs.nombre   = 'El nombre es requerido'
    if (!form.cedula.trim())    errs.cedula   = 'La cédula es requerida'
    if (!form.telefono.trim())  errs.telefono = 'El teléfono es requerido'

    if (form.cedula && !/^\d{6,12}$/.test(form.cedula.trim())) {
      errs.cedula = 'La cédula debe tener entre 6 y 12 dígitos numéricos'
    }
    if (form.telefono && !validarTelefono(form.telefono)) {
      errs.telefono = 'Ingresa un celular colombiano válido (ej: 3001234567)'
    }
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validar()
    if (Object.keys(errs).length) { setErrores(errs); return }

    setLoading(true)
    setError('')

    try {
      const url    = esEdicion ? `/api/clientes/${clienteInicial.id}` : '/api/clientes'
      const method = esEdicion ? 'PATCH' : 'POST'

      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          nombre:     form.nombre.trim(),
          cedula:     form.cedula.trim(),
          telefono:   form.telefono.trim(),
          direccion:  form.direccion.trim() || undefined,
          referencia: form.referencia.trim() || undefined,
          notas:      form.notas.trim()      || undefined,
          rutaId:     form.rutaId || undefined,
          grupoCobroId: form.grupoCobroId || undefined,
          latitud:    form.latitud,
          longitud:   form.longitud,
          ...(diasSinCobro.length > 0 && { diasSinCobro }),
        }),
      })

      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }

      router.push(`/clientes/${data.id}`)
      router.refresh()
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2.5 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[10px] px-4 py-3">
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Nombre completo *"
          placeholder="Ej: Juan García"
          value={form.nombre}
          onChange={set('nombre')}
          error={errores.nombre}
          autoComplete="name"
        />
        <div>
          <Input
            label="Cédula *"
            placeholder="Ej: 1023456789"
            value={form.cedula}
            onChange={set('cedula')}
            error={errores.cedula}
            inputMode="numeric"
            disabled={esEdicion}
          />
          {scoreData?.encontrado && (
            <div className={`mt-1.5 text-xs px-3 py-2 rounded-lg border ${
              scoreData.score === 'rojo'
                ? 'bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.2)] text-[#ef4444]'
                : scoreData.score === 'amarillo'
                ? 'bg-[rgba(245,197,24,0.08)] border-[rgba(245,197,24,0.2)] text-[#f5c518]'
                : 'bg-[rgba(34,197,94,0.08)] border-[rgba(34,197,94,0.2)] text-[#22c55e]'
            }`}>
              {scoreData.score === 'rojo' && 'Cliente con mora activa en otras entidades'}
              {scoreData.score === 'amarillo' && 'Cliente con créditos activos en otras entidades'}
              {scoreData.score === 'verde' && 'Sin historial negativo en la plataforma'}
            </div>
          )}
        </div>
        <Input
          label="Teléfono *"
          placeholder="Ej: 3001234567"
          value={form.telefono}
          onChange={set('telefono')}
          error={errores.telefono}
          inputMode="tel"
        />
        <div className="sm:col-span-2 space-y-2">
          <Input
            label="Dirección"
            placeholder="Calle, barrio, ciudad..."
            value={form.direccion}
            onChange={set('direccion')}
            error={errores.direccion}
          />
          <LocationPicker
            latitud={form.latitud}
            longitud={form.longitud}
            onLocationChange={(lat, lng) => setForm((prev) => ({ ...prev, latitud: lat, longitud: lng }))}
          />
        </div>
        <Input
          label="Referencia"
          placeholder="Ej: Tienda La Esquina"
          value={form.referencia}
          onChange={set('referencia')}
          error={errores.referencia}
          maxLength={100}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#888888] uppercase tracking-[0.05em]">
            Notas
          </label>
          <textarea
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
            placeholder="Notas adicionales sobre el cliente..."
            maxLength={500}
            rows={3}
            className="w-full px-3 py-2 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-[white] placeholder-[#777777] focus:outline-none focus:border-[#f5c518] focus:ring-1 focus:ring-[rgba(245,197,24,0.3)] transition-all resize-none"
          />
          <span className="text-[10px] text-[#888888] text-right">{form.notas.length}/500</span>
        </div>

        {/* Ruta – solo plan standard+ */}
        {plan !== 'basic' && rutas.length > 0 && (
          <Select
            label="Ruta"
            value={form.rutaId}
            onChange={set('rutaId')}
          >
            <option value="">Sin ruta asignada</option>
            {rutas.map((r) => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </Select>
        )}
      </div>

      {/* Avanzado — colapsable */}
      <div className="border-t border-[#2a2a2a] pt-3">
        <button
          type="button"
          onClick={() => setAvanzadoOpen(v => !v)}
          className="flex items-center gap-2 text-xs font-medium text-[#888888] hover:text-white transition-colors w-full"
        >
          <svg className={`w-3.5 h-3.5 transition-transform ${avanzadoOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Opciones avanzadas
          {diasSinCobro.length > 0 && (
            <span className="ml-auto text-[10px] text-[#f59e0b] font-medium">
              {diasSinCobro.length} {diasSinCobro.length === 1 ? 'día' : 'días'} sin cobro
            </span>
          )}
        </button>
        {avanzadoOpen && (
          <div className="mt-3 space-y-3 pl-1">
            {grupos.length > 0 && (
              <div>
                <Select
                  label="Grupo de cobro"
                  value={form.grupoCobroId}
                  onChange={set('grupoCobroId')}
                >
                  <option value="">Sin grupo</option>
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id}>{g.nombre}</option>
                  ))}
                </Select>
                <p className="text-[10px] text-[#666666] mt-1">
                  Opcional. Asigna este cliente a un grupo desde el momento de crearlo.
                </p>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-[#888888] mb-1.5">Días sin cobro</p>
              <p className="text-[10px] text-[#666666] leading-snug mb-2">
                Este cliente no será cobrado estos días. Si no configuras nada, hereda de la ruta o la organización.
              </p>
              <DiasSinCobroSelector value={diasSinCobro} onChange={setDiasSinCobro} compact />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" loading={loading}>
          {esEdicion ? 'Guardar cambios' : 'Crear cliente'}
        </Button>
      </div>
    </form>
  )
}
