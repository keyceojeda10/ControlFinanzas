'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await signIn('credentials', { email, password, redirect: false })
      if (result?.error) { setError('Correo o contrasena incorrectos'); return }
      const sessionRes = await fetch('/api/auth/session')
      const session = await sessionRes.json()
      if (session?.user?.rol === 'superadmin') router.push('/admin/dashboard')
      else router.push('/dashboard')
    } catch { setError('Error al iniciar sesion. Intenta de nuevo.') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-[14px] mb-5" style={{ background: 'rgba(245,197,24,0.1)', border: '1px solid rgba(245,197,24,0.2)' }}>
            <svg className="w-7 h-7 text-[#f5c518]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Control Finanzas</h1>
          <p className="text-sm text-[#888888] mt-1">Gestiona tu cartera de prestamos</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[24px] p-8 space-y-4">
          {error && (
            <div className="flex items-center gap-2.5 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[12px] px-4 py-3">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
              {error}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[11px] font-medium text-[#888888] uppercase tracking-[0.05em]">Correo electronico</label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@ejemplo.com" className="w-full h-10 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-white placeholder-[#555555] focus:outline-none focus:border-[#f5c518] focus:ring-1 focus:ring-[rgba(245,197,24,0.2)] transition-all" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-[11px] font-medium text-[#888888] uppercase tracking-[0.05em]">Contrasena</label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full h-10 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-white placeholder-[#555555] focus:outline-none focus:border-[#f5c518] focus:ring-1 focus:ring-[rgba(245,197,24,0.2)] transition-all" />
          </div>
          <button type="button" onClick={handleSubmit} disabled={loading} className="w-full h-11 mt-1 rounded-[12px] bg-[#f5c518] hover:bg-[#f0b800] disabled:opacity-60 text-[#0a0a0a] font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer hover:shadow-[0_0_20px_rgba(245,197,24,0.3)]">
            {loading ? (<><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Ingresando...</>) : 'Ingresar'}
          </button>
        </div>
        <p className="mt-6 text-center text-sm text-[#888888]">No tienes cuenta?{' '}<a href="/registro" className="text-[#f5c518] hover:underline font-medium">Registrate gratis</a></p>
      </div>
    </div>
  )
}
