'use client'

// components/pantallas/ListaRutas.jsx — Turnos 11 y 27 del handoff.
//
// LA DECISIÓN: en la LISTA van solo las cifras de HOY. El acumulado de la ruta
// —capital puesto, con intereses, rendimiento— va en el DETALLE.
//
// Mezclar las dos escalas en la misma tarjeta fue el defecto del diseño
// anterior: "$90.000 recaudado hoy" al lado de "$1.500.000 prestado" no se
// comparan, y el ojo termina leyendo el número grande, que es el que no importa
// cuando estás saliendo a cobrar.
//
// Una ruta sin cobrador no es una fila más: es un problema, y se muestra como
// tal (04-CRITERIOS §E, "los agujeros se muestran como agujeros").

import { Tarjeta, BarraProgreso, Pastilla, BotonTexto, EstadoVacio, BotonPrimario } from '@/components/cf/primitivos'

function TarjetaRuta({ nombre, cobrador, clientes, recaudado, esperado, porcentaje, inactiva, onAbrir }) {
  const sinCobrador = !cobrador
  // Una ruta a la que hoy no se le esperaba nada NO está fallando: no hay nada
  // que cumplir. Pintarla de rojo dice "esta ruta va mal" cuando lo cierto es
  // "esta ruta no tenía cobros". El estado tiene que significar algo.
  const sinNadaQueCobrar = inactiva || !esperado || esperado === '$0'
  const tono = sinNadaQueCobrar ? 'neutro'
             : porcentaje >= 70 ? 'ok'
             : porcentaje >= 30 ? 'oro'
             : 'mal'
  const color = tono === 'neutro' ? 'var(--cf-fill-2)'
              : tono === 'ok'  ? 'var(--cf-green)'
              : tono === 'oro' ? 'var(--cf-gold)'
              : 'var(--cf-red)'

  return (
    <div onClick={onAbrir} role="button" tabIndex={0} style={{
      position: 'relative', cursor: 'pointer', flex: 'none',
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)', padding: '15px 16px 15px 19px',
      display: 'flex', flexDirection: 'column', gap: 11, overflow: 'hidden',
    }}>
      <span aria-hidden style={{
        position: 'absolute', left: 0, top: 14, bottom: 14, width: 4, borderRadius: 999,
        background: sinCobrador ? 'var(--cf-ink-4)' : color,
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'block', fontSize: 16, fontWeight: 700, letterSpacing: '-.015em', color: 'var(--cf-ink)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{nombre}</span>
          <span className="cf-num" style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3, fontSize: 12, color: 'var(--cf-ink-3)' }}>
            {sinCobrador
              ? <Pastilla tono="atraso" style={{ height: 20, fontSize: 10 }}>sin cobrador</Pastilla>
              : cobrador}
            <span>· {clientes} cliente{clientes === 1 ? '' : 's'}</span>
          </span>
        </span>
        <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)', flex: 'none', paddingTop: 2 }}>
          {sinNadaQueCobrar ? '—' : `${porcentaje}%`}
        </span>
      </div>

      {/* Solo lo de HOY. El acumulado vive en el detalle. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
            Recaudado hoy
          </span>
          <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>de {esperado}</span>
        </div>
        <span className="cf-fig" style={{ fontSize: 22, letterSpacing: '-.03em', color: 'var(--cf-ink)' }}>{recaudado}</span>
        <BarraProgreso porcentaje={porcentaje} tono={tono === 'neutro' ? 'oro' : tono} alto={5} />
      </div>
    </div>
  )
}

export default function ListaRutas({ rutas = [], sinRuta, onAbrir, onAsignar }) {
  const activas = rutas.filter(r => !r.inactiva)
  const inactivas = rutas.filter(r => r.inactiva)

  if (rutas.length === 0) {
    return (
      <div style={{ padding: '8px var(--cf-pad-screen) 0' }}>
        <EstadoVacio
          titulo="Todavía no tienes rutas"
          explicacion="Una ruta agrupa clientes por zona. El cobrador ve su recorrido del día en orden."
          accion={<BotonPrimario>Crear la primera ruta</BotonPrimario>}
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)', padding: '8px var(--cf-pad-screen) 0' }}>
      {activas.map((r, i) => <TarjetaRuta key={r.id ?? i} {...r} onAbrir={() => onAbrir?.(r)} />)}

      {inactivas.length > 0 && (
        <>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--cf-ink-3)', padding: '6px 2px 0', flex: 'none' }}>
            Sin cobros hoy
          </span>
          {inactivas.map((r, i) => <TarjetaRuta key={r.id ?? `i${i}`} {...r} onAbrir={() => onAbrir?.(r)} />)}
        </>
      )}

      {/* Un agujero se muestra como agujero, no como una fila más de la lista. */}
      {sinRuta?.cantidad > 0 && (
        <Tarjeta style={{ background: 'var(--cf-card-alt)', borderStyle: 'dashed' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)' }}>
                Sin ruta
              </span>
              <span className="cf-num" style={{ display: 'block', fontSize: 12, color: 'var(--cf-ink-3)', marginTop: 3, lineHeight: 1.4 }}>
                {sinRuta.cantidad} préstamo{sinRuta.cantidad === 1 ? '' : 's'} sin asignar
                {sinRuta.monto && <> · {sinRuta.monto}</>}
              </span>
            </span>
            <BotonTexto onClick={onAsignar} style={{ flex: 'none' }}>Asignar →</BotonTexto>
          </div>
        </Tarjeta>
      )}
    </div>
  )
}
