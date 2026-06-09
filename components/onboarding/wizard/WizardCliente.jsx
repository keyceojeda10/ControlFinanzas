'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { useCountry } from '@/hooks/useCountry'

const DEMO_DATA = {
  nombre: 'Carlos Ramírez',
  cedula: '1020304050',
  telefono: '3001234567',
}

export default function WizardCliente({ onComplete, modoDemo = false }) {
  const { validatePhone, validateDocument, documentConfig, phoneConfig } = useCountry()
  const [form, setForm] = useState(
    modoDemo ? { ...DEMO_DATA } : { nombre: '', cedula: '', telefono: '' }
  )
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
    if (!form.cedula.trim()) errs.cedula = `${documentConfig.label} es requerido`
    else if (!validateDocument(form.cedula.trim()))
      errs.cedula = `${documentConfig.label} no válido (ej: ${documentConfig.placeholder})`
    if (!form.telefono.trim()) errs.telefono = `El ${phoneConfig.label.toLowerCase()} es requerido`
    else if (!validatePhone(form.telefono.replace(/\s/g, '')))
      errs.telefono = `Ingresa un ${phoneConfig.label.toLowerCase()} válido (ej: ${phoneConfig.placeholder})`
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
          esDemo: modoDemo,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al crear el cliente'); return }
      onComplete({
        id: data.id,
        nombre: form.nombre.trim(),
        cedula: form.cedula.trim(),
        telefono: form.telefono.trim(),
        esDemo: modoDemo,
      })
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
          {modoDemo ? 'Cliente de ejemplo' : 'Tu primer cliente'}
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {modoDemo
            ? 'Datos pre-llenados. Puedes editarlos o dejarlos así.'
            : 'Piensa en el cliente que mejor conoces.'}
        </p>
      </div>

      {modoDemo && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] mb-4"
          style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="#a78bfa" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[11px]" style={{ color: '#a78bfa' }}>
            Modo demo — este cliente se borrará automáticamente al finalizar.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-sm rounded-[12px] px-4 py-3"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <div className="rounded-[16px] p-5 space-y-4"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <Input
            label="Nombre completo"
            placeholder="Ej: Juan García"
            value={form.nombre}
            onChange={set('nombre')}
            error={errores.nombre}
            autoComplete="off"
          />
          <Input
            label={documentConfig.label}
            placeholder={`Ej: ${documentConfig.placeholder}`}
            value={form.cedula}
            onChange={set('cedula')}
            error={errores.cedula}
            inputMode="numeric"
          />
          <Input
            label={phoneConfig.label}
            placeholder={`Ej: ${phoneConfig.placeholder}`}
            value={form.telefono}
            onChange={set('telefono')}
            error={errores.telefono}
            inputMode="tel"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-[12px] text-base font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
          style={{ background: modoDemo ? '#a78bfa' : '#f5c518', color: modoDemo ? '#fff' : '#111' }}>
          {loading ? (
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (modoDemo ? 'Continuar con este cliente' : 'Crear cliente')}
        </button>
      </form>
    </div>
  )
}
