'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'

const TIPOS = [
  { value: 'pregunta', label: 'Tengo una pregunta' },
  { value: 'bug', label: 'Encontré un error' },
  { value: 'problema_pago', label: 'Problema con mi pago' },
  { value: 'solicitud', label: 'Solicitar una función' },
  { value: 'otro', label: 'Otro' },
]

export default function NuevoTicketPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    tipo: 'pregunta',
    asunto: '',
    descripcion: '',
    solicitaContacto: false,
    telefonoContacto: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.asunto.trim() || !form.descripcion.trim()) {
      setError('Completa el asunto y la descripción')
      return
    }
    if (form.solicitaContacto && !form.telefonoContacto.trim()) {
      setError('Ingresa tu número de teléfono')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/soporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al crear ticket')
      }
      const ticket = await res.json()
      router.push(`/soporte/${ticket.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-xs text-[#888888] hover:text-white transition-colors mb-2 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <h1 className="text-lg font-bold text-white">Nuevo ticket de soporte</h1>
        <p className="text-xs text-[#888888]">Cuéntanos cómo podemos ayudarte</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Tipo de solicitud"
            value={form.tipo}
            onChange={e => setForm({ ...form, tipo: e.target.value })}
          >
            {TIPOS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>

          <Input
            label="Asunto"
            placeholder="Ej: No puedo registrar un pago"
            value={form.asunto}
            onChange={e => setForm({ ...form, asunto: e.target.value })}
            maxLength={120}
          />

          <Textarea
            label="Descripción"
            placeholder="Describe tu problema o pregunta con el mayor detalle posible..."
            value={form.descripcion}
            onChange={e => setForm({ ...form, descripcion: e.target.value })}
            rows={5}
          />

          {/* Toggle solicitar contacto */}
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-[12px] p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.solicitaContacto}
                onChange={e => setForm({ ...form, solicitaContacto: e.target.checked })}
                className="mt-0.5 w-4 h-4 rounded accent-[#f5c518]"
              />
              <div>
                <p className="text-sm font-medium text-white">Solicitar que me contacten</p>
                <p className="text-xs text-[#888888] mt-0.5">
                  Déjanos tu número y te llamamos para resolver tu caso directamente
                </p>
              </div>
            </label>

            {form.solicitaContacto && (
              <div className="mt-3 ml-7">
                <Input
                  placeholder="Tu número de teléfono"
                  value={form.telefonoContacto}
                  onChange={e => setForm({ ...form, telefonoContacto: e.target.value })}
                  type="tel"
                />
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-[#ef4444] bg-[rgba(239,68,68,0.1)] rounded-[8px] px-3 py-2">{error}</p>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Enviar ticket
          </Button>
        </form>
      </Card>
    </div>
  )
}
