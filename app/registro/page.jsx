'use client'

import { useState } from 'react'
import { signIn }   from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link          from 'next/link'

export default function RegistroPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    nombreOrganizacion: '',
    nombre: '',
    email: '',
    password: '',
    confirmar: '',
  })
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.nombreOrganizacion.trim() || !form.nombre.trim() || !form.email.trim() || !form.password) {
      setError('Todos los campos son obligatorios')
      return
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (form.password !== form.confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreOrganizacion: form.nombreOrganizacion,
          nombre: form.nombre,
          email: form.email,
          password: form.password,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Error al registrar')
        return
      }

      // Auto-login
      const result = await signIn('credentials', {
        email: form.email,
        password: form.password,
        redirect: false,
      })

      if (result?.error) {
        setError('Registro exitoso pero hubo un error al iniciar sesión. Intenta ingresar manualmente.')
        return
      }

      router.push('/configuracion/plan')
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full h-10 px-3 rounded-[10px] border border-[#2a3245] bg-[#161b27] text-sm text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[rgba(59,130,246,0.3)] transition-all'

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[#0f1117] px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-[14px] mb-5"
            style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)' }}
          >
            <svg className="w-7 h-7 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#f1f5f9] tracking-tight">Crear cuenta</h1>
          <p className="text-sm text-[#64748b] mt-1">15 días gratis para probar la plataforma</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-[#1c2333] border border-[#2a3245] rounded-[18px] p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2.5 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[10px] px-4 py-3">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#94a3b8]">Nombre del negocio</label>
            <input
              type="text"
              value={form.nombreOrganizacion}
              onChange={set('nombreOrganizacion')}
              placeholder="Ej: Préstamos García"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#94a3b8]">Tu nombre</label>
            <input
              type="text"
              value={form.nombre}
              onChange={set('nombre')}
              placeholder="Ej: Carlos García"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#94a3b8]">Correo electrónico</label>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="usuario@ejemplo.com"
              autoComplete="email"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#94a3b8]">Contraseña</label>
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#94a3b8]">Confirmar contraseña</label>
            <input
              type="password"
              value={form.confirmar}
              onChange={set('confirmar')}
              placeholder="Repite tu contraseña"
              autoComplete="new-password"
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 mt-1 rounded-[10px] bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-60 text-white font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creando cuenta...
              </>
            ) : 'Crear cuenta gratis'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#64748b]">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-[#3b82f6] hover:underline font-medium">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
