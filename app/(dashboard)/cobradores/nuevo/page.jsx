'use client'
// app/(dashboard)/cobradores/nuevo/page.jsx

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import { useAuth }             from '@/hooks/useAuth'
import { Input }               from '@/components/ui/Input'
import { Button }              from '@/components/ui/Button'

const LIMITES = { basic: 1, standard: 3, professional: Infinity }

export default function NuevoCobrador() {
  const router = useRouter()
  const { session, esOwner, loading: authLoading } = useAuth()

  const [nombre,    setNombre]    = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [creado,    setCreado]    = useState(null)   // { nombre, email, password }
  const [copiado,   setCopiado]   = useState(false)
  const [totalUsers, setTotalUsers] = useState(null)

  const plan     = session?.user?.plan ?? 'basic'
  const limite   = LIMITES[plan] ?? 1
  const restantes = isFinite(limite) && totalUsers !== null ? Math.max(0, limite - totalUsers) : null

  useEffect(() => {
    if (!authLoading && !esOwner) router.replace('/cobradores')
  }, [authLoading, esOwner, router])

  useEffect(() => {
    fetch('/api/cobradores')
      .then((r) => r.json())
      .then((d) => setTotalUsers((Array.isArray(d) ? d.length : 0) + 1)) // +1 por el owner
      .catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!nombre || !email || !password) { setError('Todos los campos son requeridos'); return }
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/cobradores', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nombre, email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al crear el cobrador'); return }
      setCreado({ nombre, email, password })
    } catch {
      setError('Error de conexión.')
    } finally {
      setLoading(false)
    }
  }

  const copiar = () => {
    navigator.clipboard.writeText(
      `Email: ${creado.email}\nContraseña: ${creado.password}`
    )
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  if (authLoading) return null

  // Cobrador creado exitosamente
  if (creado) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-[#1c2333] border border-[rgba(16,185,129,0.3)] rounded-[14px] p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-[rgba(16,185,129,0.12)] flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-[#f1f5f9] mb-1">¡Cobrador creado!</h2>
          <p className="text-xs text-[#64748b] mb-5">
            Guarda estas credenciales — la contraseña no se mostrará de nuevo.
          </p>

          <div className="bg-[#161b27] border border-[#2a3245] rounded-[10px] p-4 text-left mb-4 space-y-2">
            <div>
              <p className="text-[10px] text-[#64748b]">Nombre</p>
              <p className="text-sm font-medium text-[#f1f5f9]">{creado.nombre}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#64748b]">Email</p>
              <p className="text-sm font-medium text-[#f1f5f9]">{creado.email}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#64748b]">Contraseña temporal</p>
              <p className="text-sm font-bold text-[#3b82f6] font-mono">{creado.password}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={copiar} className="flex-1">
              {copiado ? '¡Copiado!' : 'Copiar credenciales'}
            </Button>
            <Button onClick={() => router.push('/cobradores')} className="flex-1">
              Ir a cobradores
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#f1f5f9] transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <h1 className="text-xl font-bold text-[#f1f5f9]">Nuevo cobrador</h1>
        {restantes !== null && (
          <p className="text-xs text-[#64748b] mt-1">
            Puedes agregar{' '}
            <span className={restantes > 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}>
              {restantes} cobrador{restantes !== 1 ? 'es' : ''}
            </span>{' '}
            más (plan {plan})
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-[#1c2333] border border-[#2a3245] rounded-[14px] p-5 space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[10px] px-4 py-3">
            {error}
          </div>
        )}

        <Input
          label="Nombre completo *"
          placeholder="Ej: Pedro Ramírez"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoComplete="name"
        />
        <Input
          label="Correo electrónico *"
          type="email"
          placeholder="cobrador@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Contraseña temporal *"
          placeholder="Mínimo 6 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-[10px] text-[#64748b]">
          El cobrador deberá usar estas credenciales para ingresar al sistema.
        </p>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={() => router.back()} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Crear cobrador
          </Button>
        </div>
      </form>
    </div>
  )
}
