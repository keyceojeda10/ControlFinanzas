'use client'

// components/armazon/CosasPorResolver.jsx — «02 · Cosas por resolver».
//
// El destino de todo lo que NO ganó la franja de arriba, y lo que abre la
// campana. Palabras del diseñador:
//
//   «Cada aviso trae su acción y, el que cobra, EL PRECIO: "pagar $39.000", no
//   "gestionar suscripción". La línea que evita el susto está en la tarjeta del
//   plan: si se vence sigues cobrando. Y la separación importante: aquí solo van
//   avisos DE LA APP; los de la cartera —mora, renovaciones, clientes sin ruta—
//   se quedan en el panel, porque son TRABAJO, no notificaciones.»
//
// Esa última frase es la que decide qué entra: si al leerlo hay que salir a la
// calle, no es una notificación.

import HojaInferior from '@/components/cf/HojaInferior'

function Tarjeta({ titulo, dato, nota, accion, onAccion, secundaria, onSecundaria }) {
  return (
    <div style={{
      padding: '15px 17px', borderRadius: 'var(--cf-r-card)',
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--cf-ink)' }}>{titulo}</span>
      {dato && (
        <span className="cf-num" style={{ fontSize: 12.5, color: 'var(--cf-ink-3)' }}>{dato}</span>
      )}
      {nota && (
        <span style={{ fontSize: 12.5, color: 'var(--cf-ink-2)', lineHeight: 1.45, marginTop: 3 }}>
          {nota}
        </span>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 9 }}>
        {/* El que cobra lleva EL PRECIO en el botón. «Gestionar suscripción» no
            dice cuánto cuesta, así que se toca a ciegas. */}
        <button type="button" onClick={onAccion} style={{
          height: 40, padding: '0 16px', borderRadius: 'var(--cf-r-control)',
          border: 0, cursor: 'pointer', background: 'var(--cf-gold)',
          color: 'var(--cf-gold-ink)', fontSize: 13.5, fontWeight: 700,
        }}>
          {accion}
        </button>
        {secundaria && (
          <button type="button" onClick={onSecundaria} style={{
            background: 'none', border: 0, cursor: 'pointer',
            fontSize: 13, color: 'var(--cf-ink-3)', textDecoration: 'underline', textUnderlineOffset: 3,
          }}>
            {secundaria}
          </button>
        )}
      </div>
    </div>
  )
}

export default function CosasPorResolver({ abierta, onCerrar, items = [], onIr }) {
  return (
    <HojaInferior abierta={abierta} onCerrar={onCerrar} titulo="Cosas por resolver">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {items.length === 0 && (
          <p style={{ fontSize: 13.5, color: 'var(--cf-ink-2)', margin: 0, lineHeight: 1.5 }}>
            No hay nada pendiente de la app.
          </p>
        )}

        {items.map((it) => (
          <Tarjeta key={it.id} {...it} />
        ))}

        {/* La frase que evita que alguien venga aquí a buscar su mora. */}
        <p style={{ fontSize: 12, color: 'var(--cf-ink-3)', margin: '4px 0 0', lineHeight: 1.5 }}>
          Los avisos de tu cartera —mora, renovaciones, clientes sin ruta— no
          viven aquí: están en «Necesita tu atención», en el panel. Aquí solo lo
          de la app.
        </p>
      </div>
    </HojaInferior>
  )
}
