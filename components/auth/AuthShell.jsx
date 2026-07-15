'use client'

export default function AuthShell({ title, subtitle, children, footer, maxWidth = 'max-w-sm' }) {
  return (
    <div
      className="relative flex flex-col items-center justify-center px-4 py-8 overflow-hidden"
      style={{ background: 'var(--color-bg-base)', minHeight: '100vh' }}
    >
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '-120px', left: '-120px',
          width: '300px', height: '300px', borderRadius: '50%',
          background: 'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 20%, transparent) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }} />
        <div style={{
          position: 'absolute', top: '33%', right: '-120px',
          width: '280px', height: '280px', borderRadius: '50%',
          background: 'radial-gradient(circle, color-mix(in srgb, var(--color-success) 15%, transparent) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-120px', left: '25%',
          width: '250px', height: '250px', borderRadius: '50%',
          background: 'radial-gradient(circle, color-mix(in srgb, var(--color-info) 12%, transparent) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }} />
      </div>

      <div className={`relative w-full ${maxWidth}`} style={{ zIndex: 1 }}>
        <div className="text-center mb-6">
          <div className="relative inline-block mb-4">
            <div
              className="relative flex items-center justify-center"
              style={{
                width: '56px', height: '56px', borderRadius: '16px',
                background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 85%, #000))',
                boxShadow: '0 2px 8px color-mix(in srgb, var(--color-accent) 15%, transparent)',
              }}
            >
              <img src="/logo-icon.svg" alt="Control Finanzas" width={32} height={32} />
            </div>
          </div>
          <h1 className="text-[25px] font-semibold tracking-tight" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-space-grotesk)' }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-[13px] mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>

        <div
          className="relative rounded-[20px] p-6 sm:p-7"
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 1px 2px rgba(20,20,30,.04), 0 10px 30px rgba(20,20,30,.055)',
          }}
        >
          <div style={{ position: 'relative', zIndex: 2 }}>
            {children}
          </div>
        </div>

        {footer && (
          <div className="mt-6 text-center text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
