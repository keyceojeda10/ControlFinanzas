'use client'
// Vista previa de «01 · Configuración» para comparar contra la lámina:
//   node scripts/ver-diseno.mjs "01 · Configuración" .auditoria/d-config.png
import Configuracion from '@/components/pantallas/Configuracion'
import ComoPrestas from '@/components/pantallas/config/ComoPrestas'

function Pendiente({ nombre }) {
  return (
    <section style={{ padding: '20px 22px', borderRadius: 'var(--cf-r-card)',
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
        textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>{nombre}</span>
      <p style={{ fontSize: 13, color: 'var(--cf-ink-4)', margin: '8px 0 0' }}>Sin construir todavía</p>
    </section>
  )
}

export default function Previa() {
  return (
    <div style={{ background: 'var(--cf-surface)', minHeight: '100vh', padding: 28,
      fontFamily: 'var(--font-manrope), system-ui' }}>
      <Configuracion
        rol="owner" cobradores={9}
        negocio="Prestamos Castro" plan="Inicial" clientes={31} limiteClientes={150}
      >
        {(id, s) => id === 'comoPrestas'
          ? <ComoPrestas inicial={{ frecuenciaDefault: 'diario', tasaDefault: 20, modoInteresDefault: 'lineal', diasSinCobro: '["domingo"]' }} />
          : <Pendiente nombre={s.nombre} />}
      </Configuracion>
    </div>
  )
}
