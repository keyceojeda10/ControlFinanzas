'use client'
// components/auth/AuthShell.jsx — Layout para login/registro/forgot
// Simplificado para maxima compatibilidad con WebViews Android

export default function AuthShell({ title, subtitle, children, footer, maxWidth = 'max-w-sm' }) {
  return (
    <div
      className="relative flex flex-col items-center justify-center px-4 py-8 overflow-hidden"
      style={{ background: '#060609', minHeight: '100vh' }}
    >
      {/* Aurora orbs — opacidad baja, blur moderado para no crashear GPUs movil */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '-120px', left: '-120px',
          width: '300px', height: '300px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245,197,24,0.25) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }} />
        <div style={{
          position: 'absolute', top: '33%', right: '-120px',
          width: '280px', height: '280px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34,197,94,0.2) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-120px', left: '25%',
          width: '250px', height: '250px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }} />
      </div>

      <div className={`relative w-full ${maxWidth}`} style={{ zIndex: 1 }}>
        {/* Logo + titulos */}
        <div className="text-center mb-6">
          <div className="relative inline-block mb-4">
            <div
              className="relative flex items-center justify-center"
              style={{
                width: '56px', height: '56px', borderRadius: '16px',
                background: 'linear-gradient(135deg, #f5c518, #f0ad0e)',
                boxShadow: '0 8px 32px rgba(245,197,24,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
              }}
            >
              {/* Logo como img normal — Next Image puede fallar en WebViews */}
              <img src="/logo-icon.svg" alt="Control Finanzas" width={32} height={32} />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#f0f0f5' }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm" style={{ color: '#888', marginTop: '6px' }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Card */}
        <div
          className="relative rounded-[20px] p-6 sm:p-7"
          style={{
            background: 'rgba(17,17,22,0.92)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          {/* Contenido del form — z-index alto para que nada lo bloquee */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            {children}
          </div>
        </div>

        {footer && (
          <div className="mt-6 text-center text-sm" style={{ color: '#888' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
