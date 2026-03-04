'use client'
// components/clientes/ClienteForm.jsx - Formulario reutilizable para crear/editar cliente

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import { Input, Select }       from '@/components/ui/Input'
import { Button }              from '@/components/ui/Button'

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
  })
  const [errores, setErrores]   = useState({})
  const [rutas,   setRutas]     = useState([])
  const [loading, setLoading]   = useState(false)
  const [error,   setError]     = useState('')

  // Cargar rutas solo para plan standard+
  useEffect(() => {
    if (plan === 'basic') return
    fetch('/api/rutas')
      .then((r) => r.json())
      .then((data) => setRutas(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [plan])

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
        <Input
          label="Cédula *"
          placeholder="Ej: 1023456789"
          value={form.cedula}
          onChange={set('cedula')}
          error={errores.cedula}
          inputMode="numeric"
          disabled={esEdicion}
        />
        <Input
          label="Teléfono *"
          placeholder="Ej: 3001234567"
          value={form.telefono}
          onChange={set('telefono')}
          error={errores.telefono}
          inputMode="tel"
        />
        <Input
          label="Dirección"
          placeholder="Opcional"
          value={form.direccion}
          onChange={set('direccion')}
          error={errores.direccion}
        />
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
            className="w-full px-3 py-2 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-[white] placeholder-[#555555] focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[rgba(59,130,246,0.3)] transition-all resize-none"
          />
          <span className="text-[10px] text-[#555555] text-right">{form.notas.length}/500</span>
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
