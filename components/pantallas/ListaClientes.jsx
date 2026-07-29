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

/**
 * El encabezado de la pantalla: título + el conteo con la mora en rojo.
 *
 * VA EN EL CUERPO, no en la cabecera. La cabecera del armazón es la de
 * navegación (glifo, buscar, campana, avatar) y no lleva título; T02-05 pone
 * «Clientes» y «31 · 20 en mora» como primera línea del contenido.
 *
 * EL CONTEO NO ES DECORACIÓN. «31 · 20 en mora» de un vistazo dice que dos
 * tercios de la cartera está atrasada, que es la única cifra que puede cambiar
 * lo que el dueño hace al abrir esta pantalla. Y el rojo va SOLO en la parte de
 * la mora: «31 · 20 en mora» todo en rojo diría que los 31 están mal.
 */
export function EncabezadoLista({ titulo, total, enMora, unidadMora = 'en mora' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flex: 'none' }}>
      <h1 style={{
        flex: 1, minWidth: 0, margin: 0,
        fontFamily: 'var(--font-space-grotesk), system-ui',
        fontSize: 22, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)',
      }}>{titulo}</h1>
      {total != null && (
        <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-3)', flex: 'none' }}>
          {total}
          {enMora > 0 && (
            <> · <span style={{ color: 'var(--cf-red-dark)', fontWeight: 700 }}>{enMora} {unidadMora}</span></>
          )}
        </span>
      )}
    </div>
  )
}

/**
 * El buscador de la lista. NO es el de la cabecera: ese es la búsqueda global
 * (Ctrl+K, salta a cualquier cosa), este filtra la lista que se está mirando.
 *
 * Radio 14 y alto 46, de la lámina. Yo lo tenía como una píldora (radio 999),
 * que es la forma del buscador de la BARRA LATERAL — otra pieza.
 */
export function BuscadorLista({ valor = '', onCambiar, placeholder = 'Nombre o cédula' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flex: 'none',
      height: 46, padding: '0 14px', borderRadius: 'var(--cf-r-control)',
      background: 'var(--cf-card)', border: '1px solid rgba(20,20,28,.09)',
    }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-4)"
        strokeWidth="2" strokeLinecap="round" style={{ flex: 'none' }}>
        <circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" />
      </svg>
      <input
        value={valor}
        onChange={onCambiar}
        placeholder={placeholder}
        className="cf-campo"
        style={{
          flex: 1, minWidth: 0, width: '100%',
          background: 'none', border: 0, outline: 'none', padding: 0,
          fontSize: 16, color: 'var(--cf-ink)',
          fontFamily: 'var(--font-manrope), system-ui',
        }}
      />
    </div>
  )
}

/** Tira de filtros con scroll horizontal. Los chips no se encogen. */
export function BarraFiltros({ filtros = [], activo, onCambiar, onMasFiltros, hayMasFiltros = false }) {
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

      {/* El cuarto chip: SOLO EL ICONO, y abre «Más filtros».
          Está en la lámina al final de la tira, y es el sitio donde vive lo que
          no cabe en la fila —frecuencia, modo de interés, ruta—. En la pantalla
          vieja eran TRES filas de chips apiladas, unos 380px antes del primer
          cliente. Se marca en dorado cuando hay algún filtro puesto ahí dentro,
          porque un filtro activo que no se ve hace que la lista parezca corta
          sin motivo. */}
      {onMasFiltros && (
        <Chip onClick={onMasFiltros} activo={hayMasFiltros} aria-label="Más filtros"
          style={{ padding: '0 12px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M7 12h10M10 17h4" />
          </svg>
        </Chip>
      )}
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
