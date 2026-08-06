'use client'

// components/pantallas/PlanExcedido.jsx — «03 · Plan excedido».
//
// «La pantalla más delicada del sistema, porque es donde la app le cobra al
// usuario.» Las tres decisiones del diseñador:
//
// 1. SE BLOQUEA PRESTAR, NUNCA COBRAR — y se dice explícitamente, con la lista
//    de lo que sigue funcionando. «Un prestamista al que le corten el cobro
//    pierde plata ese día y se va.» Por eso el bloque verde no es un adorno de
//    consuelo: es la información más importante de la pantalla.
//
// 2. El plan se recomienda POR LA CARTERA, no por el mínimo que cabe (la
//    decisión vive en lib/adaptadores/planes.js, con su prueba).
//
// 3. El precio va EN CONTEXTO DE SU NEGOCIO: «0,3% de lo que tienes en la
//    calle». Un precio a secas no se puede juzgar; contra la cartera, sí.
//
// Y la acción dice el precio —«Subir a Básico · $59.000»—, no «gestionar
// suscripción». La salida secundaria, «seguir cobrando sin crear el cliente»,
// es la que hace verdad la promesa de arriba.
//
// Ni un tope, ni un precio, ni un nombre de plan escrito aquí: todo llega ya
// derivado de PLANES_CONFIG.

function Opcion({ plan, destacada, onElegir }) {
  if (!plan) return null
  return (
    <button
      type="button"
      onClick={() => onElegir?.(plan.id)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, width: '100%', padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
        background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card)',
        border: `1px solid ${destacada ? 'var(--cf-gold-border)' : 'var(--cf-border)'}`,
        boxShadow: destacada ? '0 0 0 3px rgba(231,164,0,.12)' : 'none',
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: 'var(--cf-ink)' }}>
          {plan.texto}
        </span>
        {plan.razon && (
          <span style={{ display: 'block', fontSize: 12.5, color: 'var(--cf-ink-3)', marginTop: 2 }}>
            {plan.razon}
          </span>
        )}
      </span>
      <span className="cf-fig" style={{ flex: 'none', fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)' }}>
        {plan.precio}
      </span>
    </button>
  )
}

export default function PlanExcedido({
  rotulo, titulo, detalle, peso,
  recomendado, alternativa, accion,
  clientes = 0,
  onSubir, onElegirPlan, onSeguir,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)' }}>
      <div>
        {rotulo && (
          <span style={{
            display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
            textTransform: 'uppercase', color: 'var(--cf-ink-3)',
          }}>
            {rotulo}
          </span>
        )}
        <h2 style={{
          fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 20, fontWeight: 600, letterSpacing: '-.02em',
          color: 'var(--cf-ink)', margin: '5px 0 0', lineHeight: 1.22,
        }}>
          {titulo}
        </h2>
        <p style={{ fontSize: 13.5, color: 'var(--cf-ink-2)', marginTop: 6, lineHeight: 1.45 }}>
          {detalle}
        </p>
      </div>

      {/* El precio contra su propia cartera. Sin cartera no se pinta: un
          porcentaje sobre cero no significa nada. */}
      {peso != null && (
        <p style={{ fontSize: 13, color: 'var(--cf-ink-2)', margin: 0, lineHeight: 1.5 }}>
          El plan te cuesta el{' '}
          <span className="cf-fig" style={{ fontWeight: 700, color: 'var(--cf-ink)' }}>
            {String(peso).replace('.', ',')}%
          </span>{' '}
          de lo que tienes en la calle.
        </p>
      )}

      {/* ── LO QUE SIGUE FUNCIONANDO ──
          La parte más importante, y va en verde, no en gris: si esto se lee
          como letra pequeña, la pantalla se convierte en un corte de servicio. */}
      <div style={{
        padding: '14px 16px', borderRadius: 'var(--cf-r-card)',
        background: 'color-mix(in srgb, var(--cf-green) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--cf-green) 26%, transparent)',
      }}>
        <span style={{
          display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
          textTransform: 'uppercase', color: 'var(--cf-green-dark)',
        }}>
          Esto sigue funcionando
        </span>
        <p style={{ fontSize: 12.5, color: 'var(--cf-ink-2)', margin: '6px 0 0', lineHeight: 1.5 }}>
          Cobrar y registrar pagos de tus {clientes} clientes, renovar los
          préstamos que ya existen, caja, reportes y bajar tu información.
        </p>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--cf-green-dark)', margin: '7px 0 0', lineHeight: 1.5 }}>
          Nunca vamos a bloquearte el cobro. Tu plata entra pase lo que pase.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Opcion plan={recomendado} destacada onElegir={onElegirPlan} />
        <Opcion plan={alternativa} onElegir={onElegirPlan} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <button type="button" onClick={onSubir} style={{
          width: '100%', height: 'var(--cf-h-btn)', border: 0,
          borderRadius: 'var(--cf-r-control)', cursor: 'pointer',
          background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
          fontSize: 15, fontWeight: 700,
        }}>
          {accion}
        </button>
        {/* La salida que hace verdad la promesa de arriba. */}
        <button type="button" onClick={onSeguir} style={{
          background: 'none', border: 0, cursor: 'pointer',
          fontSize: 13, color: 'var(--cf-ink-3)', textDecoration: 'underline', textUnderlineOffset: 3,
        }}>
          Seguir cobrando sin crear el cliente
        </button>
      </div>
    </div>
  )
}
