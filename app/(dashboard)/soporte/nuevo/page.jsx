'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

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
  const [imagenes, setImagenes] = useState([])
  const fileInputRef = useRef(null)

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || [])
    const nuevas = []
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError('Solo se permiten imágenes JPG, PNG, WebP o GIF')
        continue
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Cada imagen debe ser menor a 5MB')
        continue
      }
      if (imagenes.length + nuevas.length >= 3) break
      nuevas.push({ file, preview: URL.createObjectURL(file) })
    }
    if (nuevas.length) setImagenes(prev => [...prev, ...nuevas])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeImage = (idx) => {
    setImagenes(prev => prev.filter((_, i) => i !== idx))
  }

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

      // Subir imágenes adjuntas como primeros mensajes
      for (const img of imagenes) {
        const fd = new FormData()
        fd.append('imagen', img.file)
        fd.append('contenido', '')
        await fetch(`/api/soporte/${ticket.id}/upload`, { method: 'POST', body: fd })
      }

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
        <button onClick={() => router.back()} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-2 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <h1 className="text-lg font-bold text-[var(--color-text-primary)]">Nuevo ticket de soporte</h1>
        <p className="text-xs text-[var(--color-text-muted)]">Cuéntanos cómo podemos ayudarte</p>
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

          {/* Adjuntar imágenes */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
              Capturas de pantalla (opcional, máx. 3)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />
            <div className="flex items-center gap-2 flex-wrap">
              {imagenes.map((img, idx) => (
                <div key={idx} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.preview} alt={`Adjunto ${idx + 1}`} className="h-20 w-20 object-cover rounded-[10px] border border-[var(--color-border)]" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--color-danger)] flex items-center justify-center text-[var(--color-text-primary)] text-[10px]"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {imagenes.length < 3 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-20 w-20 rounded-[10px] border border-dashed border-[var(--color-border)] flex flex-col items-center justify-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:border-[#f5c518] transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-[9px]">Agregar</span>
                </button>
              )}
            </div>
          </div>

          {/* Toggle solicitar contacto */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[12px] p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.solicitaContacto}
                onChange={e => setForm({ ...form, solicitaContacto: e.target.checked })}
                className="mt-0.5 w-4 h-4 rounded accent-[#f5c518]"
              />
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Solicitar que me contacten</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
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
            <p className="text-xs text-[var(--color-danger)] bg-[rgba(239,68,68,0.1)] rounded-[8px] px-3 py-2">{error}</p>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Enviar ticket
          </Button>
        </form>
      </Card>
    </div>
  )
}
