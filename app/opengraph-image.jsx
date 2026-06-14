import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'
export const alt = 'Control Finanzas — Gestiona tu cartera de préstamos'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  // Read official logo SVG and encode as base64 data URI
  const logoSvg = readFileSync(join(process.cwd(), 'public', 'logo-icon.svg'))
  const logoBase64 = `data:image/svg+xml;base64,${logoSvg.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#060609',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle gradient overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'radial-gradient(ellipse 80% 60% at 70% 50%, rgba(245,197,24,0.06) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Grid pattern decoration */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 500,
            height: '100%',
            display: 'flex',
            opacity: 0.04,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '80px 80px',
            width: '100%',
            height: '100%',
            position: 'relative',
          }}
        >
          {/* Logo icon + brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 40 }}>
            {/* Official logo SVG */}
            <img
              src={logoBase64}
              width={72}
              height={72}
              style={{ width: 72, height: 72 }}
            />

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: 34,
                  fontWeight: 700,
                  color: '#ffffff',
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                }}
              >
                Control
              </span>
              <span
                style={{
                  fontSize: 34,
                  fontWeight: 700,
                  color: '#f5c518',
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                }}
              >
                Finanzas
              </span>
            </div>
          </div>

          {/* Headline */}
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              marginBottom: 20,
              maxWidth: 700,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span>Gestiona tu cartera</span>
            <span style={{ display: 'flex', flexWrap: 'wrap' }}>
              <span>de préstamos</span>
              <span style={{ width: 14, display: 'flex' }} />
              <span style={{ color: '#f5c518' }}>en tiempo real</span>
            </span>
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 22,
              color: 'rgba(255,255,255,0.5)',
              lineHeight: 1.5,
              maxWidth: 550,
              display: 'flex',
            }}
          >
            Clientes, cobros, rutas y reportes. Todo en una sola plataforma.
          </div>

          {/* Bottom accent bar */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 4,
              background: 'linear-gradient(90deg, #f5c518 0%, #f5c518 30%, transparent 100%)',
              display: 'flex',
            }}
          />

          {/* Domain */}
          <div
            style={{
              position: 'absolute',
              bottom: 36,
              right: 80,
              fontSize: 18,
              color: 'rgba(255,255,255,0.3)',
              display: 'flex',
              letterSpacing: '0.05em',
            }}
          >
            app.control-finanzas.com
          </div>

          {/* Decorative cards on the right side */}
          <div
            style={{
              position: 'absolute',
              right: 80,
              top: 80,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Mini stat card 1 */}
            <div
              style={{
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 12,
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                border: '1px solid rgba(255,255,255,0.08)',
                width: 280,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'rgba(34,197,94,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  color: '#22c55e',
                }}
              >
                $
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                  Recaudo hoy
                </span>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
                  $2.450.000
                </span>
              </div>
            </div>

            {/* Mini stat card 2 */}
            <div
              style={{
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 12,
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                border: '1px solid rgba(255,255,255,0.08)',
                width: 280,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'rgba(59,130,246,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  color: '#3b82f6',
                  fontWeight: 700,
                }}
              >
                42
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                  Clientes activos
                </span>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
                  96% al día
                </span>
              </div>
            </div>

            {/* Mini stat card 3 */}
            <div
              style={{
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 12,
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                border: '1px solid rgba(255,255,255,0.08)',
                width: 280,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'rgba(245,197,24,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  color: '#f5c518',
                  fontWeight: 700,
                }}
              >
                3
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                  Rutas activas
                </span>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
                  8 visitas hoy
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
