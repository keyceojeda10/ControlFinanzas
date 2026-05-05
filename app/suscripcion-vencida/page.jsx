'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const WHATSAPP_SOPORTE = '573011993001'

export default function SuscripcionVencida() {
  const [estado, setEstado] = useState(null)

  useEffect(() => {
    fetch('/api/pagos/estado')
      .then((r) => r.json())
      .then(setEstado)
      .catch(() => {})
  }, [])

  const fechaVencimiento = estado?.fechaVencimiento
    ? new Date(estado.fechaVencimiento).toLocaleDateString('es-CO', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  const diasVencida = estado?.fechaVencimiento
    ? Math.max(0, Math.ceil((new Date() - new Date(estado.fechaVencimiento)) / (1000 * 60 * 60 * 24)))
    : 0

  const planNombre = estado?.plan ?? null

  const waMsg = encodeURIComponent('Hola, mi suscripcion de Control Finanzas vencio. Necesito ayuda para renovar.')

  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center px-4 py-8 overflow-hidden"
      style={{ background: '#060609' }}
    >
      {/* Aurora */}
      <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full blur-[120px] opacity-30"
          style={{ background: 'radial-gradient(circle, var(--color-danger) 0%, transparent 70%)' }}
        />
        <div className="absolute top-1/3 -right-40 w-[450px] h-[450px] rounded-full blur-[120px] opacity-25"
          style={{ background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)' }}
        />
      </div>

      <div aria-hidden className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(circle at center, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(circle at center, black 30%, transparent 80%)',
        }}
      />

      <div className="relative w-full max-w-md animate-[fadeUp_0.4s_ease-out]">
        {/* Logo */}
        <div className="text-center mb-5">
          <div className="relative inline-block">
            <div className="absolute inset-0 rounded-full blur-xl opacity-50"
              style={{ background: 'radial-gradient(circle, var(--color-danger) 0%, transparent 70%)' }}
            />
            <div className="relative w-14 h-14 rounded-[16px] flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-danger) 30%, transparent), color-mix(in srgb, var(--color-danger) 10%, transparent))',
                border: '1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)',
              }}
            >
              <Image src="/logo-icon.svg" alt="Control Finanzas" width={32} height={32} priority />
            </div>
          </div>
        </div>

        {/* Card principal */}
        <div className="relative rounded-[20px] p-6 sm:p-7"
          style={{
            background: 'linear-gradient(135deg, rgba(20,20,26,0.85) 0%, rgba(13,13,17,0.92) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {/* Header */}
          <div className="text-center mb-5">
            <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-3"
              style={{
                background: 'color-mix(in srgb, var(--color-danger) 15%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: 'var(--color-danger)' }}
              />
              <span className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--color-danger)' }}
              >
                Acceso suspendido
              </span>
            </div>
            <h1 className="text-2xl font-bold mb-1.5" style={{ color: 'var(--color-text-primary)' }}>
              Tu suscripción venció
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {fechaVencimiento
                ? <>Vencio el <strong style={{ color: 'var(--color-text-primary)' }}>{fechaVencimiento}</strong>
                    {diasVencida > 0 && <> · hace {diasVencida} día{diasVencida !== 1 ? 's' : ''}</>}
                  </>
                : 'Tu plan ya no esta activo.'}
            </p>
          </div>

          {/* Plan info */}
          {planNombre && (
            <div className="rounded-[12px] p-3 mb-5 flex items-center justify-between"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-0.5"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Plan anterior
                </p>
                <p className="text-sm font-semibold capitalize" style={{ color: 'var(--color-text-primary)' }}>
                  {planNombre}
                </p>
              </div>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
            </div>
          )}

          {/* Datos seguros */}
          <div className="flex items-start gap-2.5 rounded-[12px] p-3 mb-5"
            style={{
              background: 'color-mix(in srgb, var(--color-success) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-success) 20%, transparent)',
            }}
          >
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
              style={{ color: 'var(--color-success)' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <div>
              <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--color-success)' }}>
                Tus datos estan seguros
              </p>
              <p className="text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                Clientes, prestamos y pagos quedan intactos. Al renovar todo vuelve donde lo dejaste.
              </p>
            </div>
          </div>

          {/* Botones */}
          <div className="flex flex-col gap-2.5">
            <Link
              href="/configuracion/plan"
              className="group relative h-12 rounded-[12px] overflow-hidden font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 75%, #f59e0b))',
                color: '#0a0a0a',
                boxShadow: '0 4px 14px rgba(245,197,24,0.3), inset 0 1px 0 rgba(255,255,255,0.25)',
              }}
            >
              <span aria-hidden
                className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)' }}
              />
              <span className="relative flex items-center gap-2">
                Renovar mi plan
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </Link>

            <a
              href={`https://wa.me/${WHATSAPP_SOPORTE}?text=${waMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-11 rounded-[12px] font-medium text-sm transition-all flex items-center justify-center gap-2"
              style={{
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.25)',
                color: '#22c55e',
              }}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
              </svg>
              Hablar con soporte por WhatsApp
            </a>
          </div>
        </div>

        {/* Sign out */}
        <div className="mt-5 text-center">
          <Link href="/api/auth/signout"
            className="text-xs hover:underline"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Cerrar sesión
          </Link>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
