'use client'

// components/pantallas/ListaClientes.jsx y ListaPrestamos — Turno 2 del handoff.
//
// Las dos listas comparten estructura: una tira de filtros con su conteo, y la
// tarjeta de lista. Lo que cambia es qué mide la barra de cada tarjeta:
//   · clientes  → cumplimiento de las cuotas del mes
//   · préstamos → cuánto lleva pagado del total
//
// CRITERIOS QUE SE APLICAN ACÁ:
//
//  · Los chips llevan su conteo cuando lo tienen: "+30d · 13". Un filtro sin
//    conteo obliga a aplicarlo para saber si valía la pena.
//  · El chip activo es NEGRO, no dorado: el dorado es para la plata.
//  · Todo truncado se declara con su monto. "Ves 10 de los 17 · faltan 7 por
//    $4.826.336", nunca un "Ver todos" pelado. Un usuario que suma y no llega
//    deja de confiar en la app entera.
//  · El estado vacío de una búsqueda ofrece crear el cliente con el nombre ya
//    escrito: ninguna pantalla es un callejón.

import TarjetaCliente from '@/components/cf/TarjetaCliente'
import { Chip, EstadoVacio, BotonPrimario, BotonTexto } from '@/components/cf/primitivos'

/** Tira de filtros con scroll horizontal. Los chips no se encogen. */
export function BarraFiltros({ filtros = [], activo, onCambiar }) {
  return (
    <div style={{
      display: 'flex', gap: 'var(--cf-gap-chips)', overflowX: 'auto', flex: 'none',
      padding: '2px var(--cf-pad-screen)', margin: '0 calc(-1 * var(--cf-pad-screen))',
      scrollbarWidth: 'none',
    }}>
      {filtros.map((f) => (
        <Chip key={f.id} activo={activo === f.id} conteo={f.conteo} onClick={() => onCambiar?.(f.id)}>
          {f.nombre}
        </Chip>
      ))}
    </div>
  )
}

/** Pie de lista: dice honestamente lo que NO se está viendo, con su monto. */
export function PieTruncado({ visibles, total, montoFaltante, onVerTodos }) {
  if (visibles >= total) return null
  const faltan = total - visibles
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '13px 19px', flex: 'none',
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)',
    }}>
      <span className="cf-num" style={{ fontSize: 12.5, color: 'var(--cf-ink-3)', lineHeight: 1.4 }}>
        Ves {visibles} de los {total}
        {montoFaltante && <> · faltan {faltan} por <span style={{ color: 'var(--cf-ink-2)', fontWeight: 600 }}>{montoFaltante}</span></>}
      </span>
      <BotonTexto onClick={onVerTodos} style={{ flex: 'none' }}>Ver todos →</BotonTexto>
    </div>
  )
}

export default function ListaClientes({
  filtros = [],
  filtroActivo,
  onFiltrar,
  clientes = [],
  total = 0,
  montoFaltante,
  busqueda = '',
  onCrearConNombre,
  onVerTodos,
  onAbrir,
}) {
  const vacio = clientes.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)', padding: '8px var(--cf-pad-screen) 0' }}>
      {filtros.length > 0 && (
        <BarraFiltros filtros={filtros} activo={filtroActivo} onCambiar={onFiltrar} />
      )}

      {vacio ? (
        busqueda ? (
          // Ninguna pantalla es un callejón: se ofrece crear con lo ya escrito.
          <EstadoVacio
            titulo={`No encontré a "${busqueda}"`}
            explicacion="Puede estar escrito distinto. O todavía no lo has cargado."
            accion={<BotonPrimario onClick={() => onCrearConNombre?.(busqueda)}>Crear a {busqueda}</BotonPrimario>}
          />
        ) : (
          <EstadoVacio
            titulo="Todavía no tienes clientes"
            explicacion="Pasa tu cuaderno con una foto y en cinco minutos tienes la cartera adentro."
            accion={<BotonPrimario>Pasar mi cuaderno</BotonPrimario>}
            secundaria={<BotonTexto>Crear uno a mano</BotonTexto>}
          />
        )
      ) : (
        <>
          {clientes.map((c, i) => (
            <TarjetaCliente key={c.id ?? i} {...c} onClick={() => onAbrir?.(c)} />
          ))}
          <PieTruncado visibles={clientes.length} total={total} montoFaltante={montoFaltante} onVerTodos={onVerTodos} />
        </>
      )}
    </div>
  )
}
