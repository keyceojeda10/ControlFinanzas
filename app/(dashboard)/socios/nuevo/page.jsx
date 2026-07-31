'use client'

import { useState } from 'react'
import { useCabecera } from '@/components/armazon/Armazon'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function NuevoSocioPage() {
  useCabecera({ titulo: 'Nuevo socio' })

  const router = useRouter()
  const { esOwner, loading: authLoading } = useAuth()
  const [form, setForm] = useState({ nombre: '', cedula: '', telefono: '', notas: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) return setError('El nombre es obligatorio')

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/socios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear socio')
      router.push('/socios')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) return null

  if (!esOwner) {
    return (
      <div className="p-4 text-center" style={{ color: 'var(--cf-ink-3)' }}>
        No tienes acceso.
      </div>
    )
  }

  return (
    <div className="pb-28">
      {/* El titulo lo pone el armazon: este <h1> salia DEBAJO del que ya dibuja
          la cabecera. Dos veces «Nuevo socio», una encima de otra. */}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div
          className="rounded-[20px] p-4 space-y-4"
          style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}
        >
          <Input
            label="Nombre"
            value={form.nombre}
            onChange={handleChange('nombre')}
            placeholder="Nombre del socio"
            required
          />
          <Input
            label="Cédula"
            value={form.cedula}
            onChange={handleChange('cedula')}
            placeholder="Número de cédula (opcional)"
          />
          <Input
            label="Teléfono"
            value={form.telefono}
            onChange={handleChange('telefono')}
            placeholder="Teléfono (opcional)"
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: 'var(--cf-ink-3)' }}>
              Notas
            </label>
            <textarea
              value={form.notas}
              onChange={handleChange('notas')}
              placeholder="Notas adicionales (opcional)"
              rows={3}
              className="px-3 py-2 rounded-[12px] text-sm resize-none"
              style={{
                background: 'var(--cf-surface)',
                border: '1px solid var(--cf-border)',
                color: 'var(--cf-ink)',
              }}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-[12px] p-3 text-sm" style={{ background: 'color-mix(in srgb, var(--cf-red-dark) 10%, transparent)', color: 'var(--cf-red-dark)' }}>
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" loading={loading} className="flex-1">
            Crear socio
          </Button>
        </div>
      </form>
    </div>
  )
}
