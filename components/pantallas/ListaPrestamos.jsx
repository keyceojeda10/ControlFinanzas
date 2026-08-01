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

import { BarraFiltros, PieTruncado, EncabezadoLista } from '@/components/pantallas/ListaClientes'
import TarjetaCliente from '@/components/cf/TarjetaCliente'
import { EstadoVacio, BotonPrimario } from '@/components/cf/primitivos'

/* ══ Las tres cifras de arriba (T02-06) ══
   EN LA CALLE, EN MORA, COBRADO MES. Tres tarjetas de 14 de radio, la cifra a
   19px, y el color SOLO en las dos que lo necesitan: la mora en rojo y lo
   cobrado en verde. «En la calle» va en negro porque no es ni bueno ni malo —
   es el tamaño del negocio.

   Van acá arriba porque responden lo que la lista NO puede: recorriendo 68
   tarjetas no se sabe cuánto hay en total en la calle. */
export function TresCifras({ enLaCalle, enMora, cobradoMes }) {
  const celdas = [
    { rotulo: 'En la calle',  valor: enLaCalle,  color: 'var(--cf-ink)' },
    { rotulo: 'En mora',      valor: enMora,     color: 'var(--cf-red)' },
    { rotulo: 'Cobrado mes',  valor: cobradoMes, color: 'var(--cf-green)' },
  ].filter((c) => c.valor != null)
  if (!celdas.length) return null

  return (
    <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
      {celdas.map((c) => (
        <div key={c.rotulo} style={{
          flex: 1, minWidth: 0,
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          // Relleno lateral 12 y no 14: la cifra mas ancha que NO se abrevia es
          // «$999.999», que a cuerpo 19 con cifras tabulares mide 84px. Con 14
          // de relleno el hueco util eran 82 y se salia. Con 12 son 86.
          borderRadius: 'var(--cf-r-control)', padding: '12px',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
            color: 'var(--cf-ink-3)',
          }}>{c.rotulo}</span>
          <span className="cf-fig" style={{
            fontSize: 19, letterSpacing: '-.025em', color: c.color,
          }}>{c.valor}</span>
        </div>
      ))}
    </div>
  )
}

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
  // Las tres cifras de T02-06 y el conteo del encabezado.
  cifras,
  activos,
  onMasFiltros, hayMasFiltros,
  onAbrir, onVerTodos, onCrear,
  sinMargen = false,
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
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)',
      padding: sinMargen ? '8px 0 0' : '8px var(--cf-pad-screen) 0',
    }}>
      {/* El encabezado de T02-06: «Préstamos» y «68 activos». Faltaba entero,
          igual que en clientes: la cabecera del armazón no lleva título. */}
      <EncabezadoLista titulo="Préstamos" total={activos != null ? `${activos} activos` : null} />

      {cifras && <TresCifras {...cifras} />}

      {filtros.length > 0 && (
        <BarraFiltros filtros={filtros} activo={filtroActivo} onCambiar={onFiltro}
          onMasFiltros={onMasFiltros} hayMasFiltros={hayMasFiltros} />
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
