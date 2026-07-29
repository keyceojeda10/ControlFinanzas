'use client'
// Vista previa de «01 · Configuración»: dos columnas, con y sin equipo.
import Configuracion from '@/components/pantallas/Configuracion'

export default function Previa() {
  return (
    <div style={{ background: 'var(--cf-fill)', minHeight: '100vh', padding: 26,
      fontFamily: 'var(--font-manrope), system-ui' }}>
      <div style={{ background: 'var(--cf-surface)', border: '1px solid var(--cf-border)',
        borderRadius: 20, padding: 24, marginBottom: 26 }}>
        <Configuracion
          rol="owner" cobradores={9}
          negocio="Prestamos Castro" plan="Inicial" clientes={31} limiteClientes={150}
        >
          {(sec) => (
            <div style={{ padding: 20, borderRadius: 'var(--cf-r-card)', background: 'var(--cf-card)',
              border: '1px solid var(--cf-border)', minHeight: 320 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
                textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>Contenido de</span>
              <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--cf-ink)', margin: '6px 0 0' }}>{sec}</p>
            </div>
          )}
        </Configuracion>
      </div>

      <div style={{ background: 'var(--cf-surface)', border: '1px solid var(--cf-border)',
        borderRadius: 20, padding: 24 }}>
        <Configuracion rol="owner" cobradores={0} negocio="Doña Marta" plan="Inicial" clientes={12} limiteClientes={100}>
          {(sec) => (
            <div style={{ padding: 20, borderRadius: 'var(--cf-r-card)', background: 'var(--cf-card)',
              border: '1px solid var(--cf-border)', minHeight: 240 }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--cf-ink)', margin: 0 }}>{sec}</p>
            </div>
          )}
        </Configuracion>
      </div>
    </div>
  )
}
