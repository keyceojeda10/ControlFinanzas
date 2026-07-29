'use client'

// components/pantallas/ListaPrestamos.jsx — turno 2 del handoff.
//   "Filtros con conteo; ordenar por atraso"
//
// LA TARJETA ES LA MISMA DE SIEMPRE. La adenda es explícita: un préstamo en
// lista usa la tarjeta de la lista de clientes, sin variantes.
// `totalPagado/totalAPagar` alimenta la barra y `diasMora` el riel de estado.
// Inventar una "tarjeta de préstamo" obligaría al usuario a aprender dos
// objetos que se leen igual y significan lo mismo: alguien que te debe.
//
// Lo único propio de esta pantalla es el ORDEN, y el orden por defecto es POR
// ATRASO. Alfabético es el orden de un archivador; por atraso es el orden en
// que hay que actuar.

import { BarraFiltros, PieTruncado } from '@/components/pantallas/ListaClientes'
import TarjetaCliente from '@/components/cf/TarjetaCliente'
import { EstadoVacio, BotonPrimario } from '@/components/cf/primitivos'

const ORDENES = [
  { id: 'atraso',  nombre: 'Más atrasado' },
  { id: 'monto',   nombre: 'Debe más' },
  { id: 'reciente', nombre: 'Más reciente' },
]

function SelectorOrden({ activo = 'atraso', total, onCambiar }) {
  const actual = ORDENES.find((o) => o.id === activo) ?? ORDENES[0]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none', padding: '2px 2px 0' }}>
      <span className="cf-num" style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--cf-ink-3)' }}>
        {total} préstamo{total === 1 ? '' : 's'}
      </span>
      <button type="button" onClick={onCambiar} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none',
        background: 'none', border: 0, cursor: 'pointer',
        fontSize: 12.5, fontWeight: 700, color: 'var(--cf-ink-2)',
      }}>
        {actual.nombre}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </div>
  )
}

export default function ListaPrestamos({
  filtros = [], filtroActivo, onFiltro,
  orden, onOrden,
  prestamos = [], total = 0, montoFaltante,
  onAbrir, onVerTodos, onCrear,
}) {
  if (prestamos.length === 0 && filtros.length === 0) {
    return (
      <div style={{ padding: '8px var(--cf-pad-screen) 0' }}>
        <EstadoVacio
          titulo="Todavía no has prestado nada"
          explicacion="Cuando le prestes a alguien, aquí ves cuánto falta por cobrar y quién va atrasado."
          accion={<BotonPrimario onClick={onCrear}>Prestarle a alguien</BotonPrimario>}
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)', padding: '8px var(--cf-pad-screen) 0' }}>
      {filtros.length > 0 && (
        <BarraFiltros filtros={filtros} activo={filtroActivo} onCambiar={onFiltro} />
      )}

      <SelectorOrden activo={orden} total={total} onCambiar={onOrden} />

      {/* Sin `etiquetaMonto`: T02-06 pinta el monto SOLO, sin rótulo encima. Lo
          trae el adaptador con `variante: 'prestamo'`, que además le quita el
          avatar. Yo forzaba «Le falta pagar» desde acá. */}
      {prestamos.map((p, i) => (
        <TarjetaCliente key={p.id ?? i} {...p} onClick={() => onAbrir?.(p)} />
      ))}

      {/* Lo que no se ve se declara con su monto. Un "Ver todos" pelado deja al
          dueño creyendo que la lista es toda su cartera. */}
      <PieTruncado visibles={prestamos.length} total={total} montoFaltante={montoFaltante} onVerTodos={onVerTodos} />
    </div>
  )
}
