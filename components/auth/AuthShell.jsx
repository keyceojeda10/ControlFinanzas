'use client'
// components/auth/AuthShell.jsx — Layout premium para login/registro/forgot
// Fondo con aurora + grid pattern + card glassmorphic.

import Image from 'next/image'

export default function AuthShell({ title, subtitle, children, footer, maxWidth = 'max-w-sm' }) {
  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center px-4 py-8 overflow-hidden"
      style={{ background: '#060609' }}
    >
      {/* Aurora orbs (fondo) */}
      <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full blur-[120px] opacity-30"
          style={{ background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-1/3 -right-40 w-[450px] h-[450px] rounded-full blur-[120px] opacity-25"
          style={{ background: 'radial-gradient(circle, #22c55e 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-40 left-1/4 w-[400px] h-[400px] rounded-full blur-[120px] opacity-20"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
        />
      </div>

      {/* Grid pattern sutil */}
      <div aria-hidden className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(circle at center, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(circle at center, black 30%, transparent 80%)',
        }}
      />

      <div className={`relative w-full ${maxWidth} animate-[fadeUp_0.4s_ease-out]`}>
        {/* Logo + titulos */}
        <div className="text-center mb-6">
          <div className="relative inline-block mb-4">
            <div
              className="absolute inset-0 rounded-full blur-xl opacity-60"
              style={{ background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)' }}
            />
            <div
              className="relative w-14 h-14 rounded-[16px] flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 70%, #f59e0b))',
                boxShadow: '0 8px 32px rgba(245,197,24,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
              }}
            >
              <Image src="/logo-icon.svg" alt="Control Finanzas" width={32} height={32} priority />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Card con glassmorphism */}
        <div
          className="relative rounded-[20px] p-6 sm:p-7"
          style={{
            background: 'linear-gradient(135deg, rgba(20,20,26,0.85) 0%, rgba(13,13,17,0.92) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {/* Borde gradiente sutil */}
          <div aria-hidden
            className="absolute inset-0 rounded-[20px] pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 20%, transparent), transparent 40%)',
              padding: '1px',
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
            }}
          />
          <div className="relative">
            {children}
          </div>
        </div>

        {footer && (
          <div className="mt-6 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {footer}
          </div>
        )}

        {/* Trust badges */}
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
