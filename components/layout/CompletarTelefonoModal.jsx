'use client'
// components/layout/CompletarTelefonoModal.jsx
// Modal que aparece tras login si el owner no tiene telefono registrado.
// Solo se muestra a owners (cobradores no, no son nuestros "clientes" reales).

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useCountry } from '@/hooks/useCountry'
import { pedirCompartido, olvidarCompartido } from '@/lib/pedir-compartido'

export default function CompletarTelefonoModal() {
  const { data: session, status } = useSession()
  /* ⚠ ESTE MODAL EXIGÍA UN CELULAR COLOMBIANO: `/^3\d{9}$/`, la etiqueta «+57»
     pegada al campo y el mensaje «Ingresa un celular colombiano válido».
     A un dueño de Argentina no le dejaba escribir el suyo, y es lo primero que
     ve al entrar. Ahora lo dice el país de su cuenta. */
  const { validatePhone, phoneConfig, config } = useCountry()
  const [open, setOpen] = useState(false)
  const [telefono, setTelefono] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status !== 'authenticated') return
    if (session?.user?.rol !== 'owner') return
    // Skip si lo pospuso esta sesion
    try {
      if (sessionStorage.getItem('cf-skip-telefono') === '1') return
    } catch {}

    pedirCompartido('/api/configuracion/perfil')
      .then((data) => {
        if (!data?.telefono) setOpen(true)
      })
  }, [status, session])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const limpio = telefono.replace(/\D/g, '')
    if (!validatePhone(limpio)) {
      setError(`Ingresa un ${phoneConfig.label.toLowerCase()} válido (ej: ${phoneConfig.placeholder})`)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/configuracion/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: limpio }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al guardar')
        return
      }
      // El teléfono acaba de cambiar: si alguien vuelve a preguntar en los
      // próximos segundos, que no reciba el perfil de antes y reabra la ventana.
      olvidarCompartido('/api/configuracion/perfil')
      setOpen(false)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    try { sessionStorage.setItem('cf-skip-telefono', '1') } catch {}
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
    >
      <div className="relative w-full max-w-md rounded-[20px] p-6 animate-[fadeUpModal_0.3s_ease-out]"
        style={{
          background: 'linear-gradient(135deg, rgba(20,20,26,0.95) 0%, rgba(13,13,17,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
          isolation: 'isolate',
          pointerEvents: 'auto',
        }}
      >
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full blur-xl opacity-50"
              style={{ background: 'radial-gradient(circle, var(--cf-gold) 0%, transparent 70%)' }}
            />
            <div className="relative w-12 h-12 rounded-[12px] flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--cf-gold) 30%, transparent), color-mix(in srgb, var(--cf-gold) 10%, transparent))',
                border: '1px solid color-mix(in srgb, var(--cf-gold) 35%, transparent)',
              }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
                style={{ color: 'var(--cf-gold)' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </div>
          </div>
        </div>

        <h2 className="text-lg font-bold text-center mb-1.5"
          style={{ color: '#f0f0f0' }}
        >
          Agrega tu número de celular
        </h2>
        <p className="text-sm text-center mb-5"
          style={{ color: 'rgba(255,255,255,0.65)' }}
        >
          Solo lo usamos para contactarte por <strong style={{ color: 'var(--cf-green-dark)' }}>WhatsApp</strong> con avisos de pago, soporte rápido y novedades importantes de tu cuenta.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="flex items-center gap-2 text-sm rounded-[10px] px-3 py-2.5"
              style={{
                background: 'var(--cf-red-pill-bg)',
                border: '1px solid color-mix(in srgb, var(--cf-red-dark) 30%, transparent)',
                color: 'var(--cf-red-dark)',
              }}
            >
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <div className="relative" style={{ position: 'relative', zIndex: 1 }}>
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none font-medium"
              style={{ color: 'rgba(255,255,255,0.6)', zIndex: 2 }}
            >
              {config.phonePrefix}
            </span>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={config.phoneDigits + 1}
              autoFocus
              value={telefono}
              onChange={(e) => { setTelefono(e.target.value.replace(/\D/g, '').slice(0, config.phoneDigits + 1)); setError('') }}
              placeholder={phoneConfig.placeholder}
              className="w-full h-11 rounded-[12px] text-sm transition-all"
              style={{
                /* El hueco lo marca el prefijo, no un 46 fijo: «+593» y «+549»
                   son dos caracteres más que «+57» y se montaban encima de lo
                   que el dueño escribe. */
                paddingLeft: `${22 + config.phonePrefix.length * 8}px`,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#f0f0f0',
                outline: 'none',
                position: 'relative',
                zIndex: 1,
                WebkitAppearance: 'none',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full h-11 rounded-[12px] overflow-hidden font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, var(--cf-gold), color-mix(in srgb, var(--cf-gold) 75%, var(--cf-gold-dark)))',
              color: '#3a2900',
              boxShadow: '0 4px 14px rgba(245,197,24,0.3), inset 0 1px 0 rgba(255,255,255,0.25)',
            }}
          >
            {!loading && (
              <span aria-hidden
                className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)' }}
              />
            )}
            <span className="relative flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Guardando...
                </>
              ) : 'Guardar y continuar'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleSkip}
            className="w-full h-9 text-xs hover:underline transition-colors"
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            Recordar mas tarde
          </button>
        </form>
      </div>

      <style jsx global>{`
        @keyframes fadeUpModal {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
