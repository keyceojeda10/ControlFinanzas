'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'

const validarTelefono = (v) => /^3\d{9}$/.test(v.replace(/\s/g, ''))

export default function WizardCliente({ onComplete }) {
  const [form, setForm] = useState({ nombre: '', cedula: '', telefono: '' })
  const [errores, setErrores] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    setErrores((prev) => ({ ...prev, [field]: '' }))
    setError('')
  }

  const validar = () => {
    const errs = {}
    if (!form.nombre.trim()) errs.nombre = 'El nombre es requerido'
    if (!form.cedula.trim()) errs.cedula = 'La cedula es requerida'
    else if (!/^\d{6,12}$/.test(form.cedula.trim()))
      errs.cedula = 'La cedula debe tener entre 6 y 12 digitos'
    if (!form.telefono.trim()) errs.telefono = 'El telefono es requerido'
    else if (!validarTelefono(form.telefono))
      errs.telefono = 'Ingresa un celular colombiano valido (ej: 3001234567)'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validar()
    if (Object.keys(errs).length) { setErrores(errs); return }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          cedula: form.cedula.trim(),
          telefono: form.telefono.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al crear el cliente')
        return
      }

      onComplete({
        id: data.id,
        nombre: form.nombre.trim(),
        cedula: form.cedula.trim(),
        telefono: form.telefono.trim(),
      })
    } catch {
      setError('Error de conexion. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white">Registra tu primer cliente</h2>
        <p className="text-sm text-[#888888] mt-1">Piensa en el cliente que mejor conoces</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[12px] px-4 py-3">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] p-5 space-y-4">
          <Input
            label="Nombre completo"
            placeholder="Ej: Juan Garcia"
            value={form.nombre}
            onChange={set('nombre')}
            error={errores.nombre}
            autoComplete="off"
          />
          <Input
            label="Cedula"
            placeholder="Ej: 1023456789"
            value={form.cedula}
            onChange={set('cedula')}
            error={errores.cedula}
            inputMode="numeric"
          />
          <Input
            label="Telefono"
            placeholder="Ej: 3001234567"
            value={form.telefono}
            onChange={set('telefono')}
            error={errores.telefono}
            inputMode="tel"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-[12px] bg-[#f5c518] text-[#111111] text-base font-bold transition-all hover:bg-[#f0b800] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
        >
          {loading ? (
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : 'Crear cliente'}
        </button>
      </form>
    </div>
  )
}
