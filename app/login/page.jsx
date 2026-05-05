'use client'
import { useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AuthShell  from '@/components/auth/AuthShell'
import AuthInput  from '@/components/auth/AuthInput'
import AuthButton from '@/components/auth/AuthButton'

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
      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      })

      if (result?.error) {
        const msg = result.error
        if (msg === 'VERIFY_EMAIL') {
          router.push(`/verificar-email?email=${encodeURIComponent(email.trim().toLowerCase())}`)
          return
        }
        if (msg.includes('desactivada') || msg.includes('suspendida')) {
          setError(msg)
        } else {
          setError('Correo o contraseña incorrectos')
        }
        return
      }

      const sessionRes = await fetch('/api/auth/session')
      const session    = await sessionRes.json()

      if (session?.user?.rol === 'superadmin') {
        router.push('/admin/dashboard')
      } else {
        router.push('/dashboard')
      }
    } catch {
      setError('Error al iniciar sesión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Bienvenido de vuelta"
      subtitle="Ingresa para gestionar tu cartera"
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link href="/registro" className="font-medium hover:underline" style={{ color: 'var(--color-accent)' }}>
            Regístrate gratis
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2.5 text-sm rounded-[10px] px-4 py-3"
            style={{
              background: 'var(--color-danger-dim)',
              border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
              color: 'var(--color-danger)',
            }}
          >
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <AuthInput
          id="email"
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="usuario@ejemplo.com"
          icon={
            <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          }
        />

        <AuthInput
          id="password"
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          showPasswordToggle
          icon={
            <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          }
        />

        <div className="text-right">
          <Link href="/forgot-password" className="text-xs hover:underline transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <AuthButton loading={loading} loadingLabel="Ingresando...">
          Ingresar
        </AuthButton>
      </form>
    </AuthShell>
  )
}
