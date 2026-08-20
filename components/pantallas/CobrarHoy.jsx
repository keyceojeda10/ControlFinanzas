'use client'

// components/pantallas/CobrarHoy.jsx — Lámina T02-02, «el arreglo del muro».
//
// LA FILA DE ACÁ NO ES LA TARJETA DE LISTA, y la diferencia es de propósito:
//
//   TarjetaCliente (T02-05)      FilaCobro (T02-02)
//   la pastilla en la 1ª línea   la pastilla en la 2ª, junto a la dirección
//   el monto DEBAJO, con barra   el monto A LA DERECHA, sin barra
//   nombre 16px                  nombre 17px
//
// En la lista de clientes la pregunta es «¿cómo va este cliente?»; acá es
// «¿cuánto le cobro y dónde está?». Por eso la cuota va a la derecha, grande y
// EN NEGRO: el pie de la lámina lo dice —«el monto deja de ser un botón rojo:
// rojo es mora, no cobrar»—. En la pantalla vieja el monto era un botón rojo en
// cada fila, y con veinte filas eso era el muro.
//
// EL COBRADO SE QUEDA, TACHADO. No se colapsa ni desaparece. Yo lo tenía
// colapsado en una línea plegable argumentando que «los que ya cobró no ocupan
// sitio»; la lámina decide lo contrario y tiene razón práctica: el cobrador
// recorre la calle en orden, y si el cobrado desaparece pierde la referencia de
// dónde iba. Tachado sigue siendo el mapa del recorrido.

import { useState } from 'react'
import { BotonPrimario, EstadoVacio } from '@/components/cf/primitivos'
// La tarjeta de parada y su carril viven en @/components/cf/ParadaDeCobro: los
// comparte con /rutas/[id], que pinta LA MISMA parada de LA MISMA ruta.
import { Carril, FilaCobro, AccionParada, COLOR_ESTADO, PASTILLA } from '@/components/cf/ParadaDeCobro'
import { BotonFiltros } from './HojaFiltros'

/* ══ La tarjeta de avance ══
   Blanca, no un bloque oscuro: en esta pantalla el titular es la lista, y un
   bloque negro arriba se la comería. La barra va A LA DERECHA del monto, no
   debajo, para que la tarjeta quepa en 90px. */
function Avance({ recaudado, meta, cobrados = 0, deCuantos = 0, porcentaje = 0 }) {
  return (
    <div style={{
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)', padding: '15px 18px',
      display: 'flex', alignItems: 'center', gap: 16, flex: 'none',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
        <span className="cf-fig" style={{ fontSize: 26, letterSpacing: '-.03em', color: 'var(--cf-ink)' }}>
          {recaudado}
        </span>
        <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)', lineHeight: 1.35 }}>
          {meta ? `de ${meta} · ` : ''}{cobrados} de {deCuantos} cobrados
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7, width: 120, flex: 'none' }}>
        <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'var(--cf-fill)', overflow: 'hidden', flex: 'none' }}>
          <span style={{
            display: 'block', height: 6, borderRadius: 999,
            width: `${Math.max(0, Math.min(100, porcentaje))}%`,
            background: 'var(--cf-gold)',
          }} />
        </div>
        <span className="cf-num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--cf-gold-dark)' }}>
          {porcentaje}%
        </span>
      </div>
    </div>
  )
}

/* ══ El encabezado de grupo ══
   «RUTA #1 ──────── 2 · $79.000». El total suma solo lo PENDIENTE: dice cuánta
   plata queda por levantar en esa ruta, así que baja al ir cobrando. */
function CabezaGrupo({ nombre, pendientes, total }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '2px 4px', flex: 'none' }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
        color: 'var(--cf-ink-3)', flex: 'none',
      }}>{nombre}</span>
      <span aria-hidden style={{ flex: 1, height: 1, background: 'var(--cf-divider)' }} />
      {pendientes > 0 && (
        <span className="cf-num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--cf-ink-3)', flex: 'none' }}>
          {pendientes} · {total}
        </span>
      )}
    </div>
  )
}

/* ══ Los tres órdenes ══
   Segmentado de alto 40 y radio 14, activo negro. «Cerca de mí» se deshabilita
   sin GPS en vez de fingir una ordenación por distancia: mandar al cobrador a
   caminar mal cuesta gasolina y tiempo de verdad. */
function Ordenes({ activo = 'ruta', onCambiar, hayGps = false }) {
  const ops = [
    { id: 'ruta', nombre: 'Orden de ruta' },
    { id: 'atrasados', nombre: 'Más atrasados' },
    { id: 'cerca', nombre: 'Cerca de mí', requiereGps: true },
  ]
  return (
    <div role="radiogroup" style={{ display: 'flex', gap: 7, flex: 'none' }}>
      {ops.map((o) => {
        const a = o.id === activo
        const off = o.requiereGps && !hayGps
        return (
          <button key={o.id} type="button" role="radio" aria-checked={a} disabled={off}
            onClick={() => onCambiar?.(o.id)}
            title={off ? 'Necesita permiso de ubicación' : undefined}
            style={{
              flex: 1, minWidth: 0, height: 40, borderRadius: 'var(--cf-r-control)',
              background: a ? 'var(--cf-ink)' : 'var(--cf-card)',
              border: a ? '1px solid var(--cf-ink)' : '1px solid var(--cf-border)',
              color: a ? 'var(--cf-surface)' : 'var(--cf-ink-2)',
              fontSize: 13, fontWeight: a ? 700 : 600,
              fontFamily: 'var(--font-manrope), system-ui',
              cursor: off ? 'not-allowed' : 'pointer', opacity: off ? 0.45 : 1,
              padding: '0 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
            {o.nombre}
          </button>
        )
      })}
    </div>
  )
}

export default function CobrarHoy({
  avance,
  grupos = [],
  pendientes = 0,
  orden = 'ruta',
  onOrden,
  hayGps = false,
  // T03-02: abre la hoja de «Filtrar y ordenar», y cuantos filtros hay.
  onFiltros,
  nFiltros = 0,
  sinSubir = 0,
  onCobrar,
  onLlamar,
  onMapa,
  // Acciones de la parada actual (T03-01). Cada una es opcional: sin ella, su
  // botón no se pinta.
  onWhatsApp,
  onMas,
  // El nombre y la foto llevan a la ficha del cliente. Va aquí y no solo en la
  // ruta porque ésta es LA MISMA tarjeta: pasarlo en una pantalla y no en la
  // otra es cómo se llegó a tener dos comprobantes, uno arreglado y otro no.
  onAbrirCliente,
  onDeshacerCobro,
  /* Cómo se llama en el DOM la tarjeta de cada fila: `id => 'cliente-x'`. Sin
     ella no hay a dónde volver cuando se regresa de la ficha, y la lista
     aparece arriba del todo. La ruta ya se lo pasaba a su `Carril`; aquí
     faltaba, que es por lo que «Cobros de hoy» perdía el sitio. */
  ancla,
  onEmpezar,
  sinMargen = false,
}) {
  const vacio = grupos.every((g) => g.filas.length === 0)

  // ── CUÁL ES LA PARADA ACTUAL ──
  // La PRIMERA sin cobrar de toda la lista, no la primera de cada grupo: el
  // cobrador va de una en una, y con una ruta ya terminada su primera fila
  // sigue siendo la de arriba pero ya no es donde está.
  const idActual = grupos.flatMap((g) => g.filas).find((f) => !f.cobrada)?.id ?? null

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: sinMargen ? '8px 0 0' : '8px var(--cf-pad-screen) 0',
      // Hueco para la barra de acción fija. Sin él, la última fila queda debajo
      // del botón y no se puede tocar.
      // El hueco del pie lo reserva el ARMAZON (112px). Estos 96 propios se
      // sumaban a aquellos: 208px de blanco al final.
    }}>
      {/* Los que no se han subido. Va arriba y en ámbar porque es lo único de
          esta pantalla que el cobrador no puede resolver caminando: si se queda
          sin batería con dos cobros sin subir, esos cobros no existen. */}
      {sinSubir > 0 && (
        <div style={{
          display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 6,
          height: 28, padding: '0 10px', borderRadius: 999, flex: 'none',
          background: 'var(--cf-gold-bg)', border: '1px solid var(--cf-gold-border)',
        }}>
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--cf-gold)' }} />
          <span className="cf-num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--cf-gold-text-2)' }}>
            {sinSubir} sin subir
          </span>
        </div>
      )}

      {avance && <Avance {...avance} />}

      {/* ── EL SEGMENTADO SE VA, LO SUSTITUYE LA HOJA (T03-02) ──
          Eran tres ordenes fijos ocupando una fila entera. T03-02 los sube a
          cinco y añade filtros, y eso ya no cabe en un segmentado: va a una
          hoja, y aqui queda un solo chip que dice cuantos hay puestos.
          `onFiltros` es opcional — sin el, se conserva el segmentado de antes,
          que es lo que usan el banco de pruebas y las capturas viejas. */}
      {onFiltros ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <BotonFiltros n={nFiltros} onClick={onFiltros} />
        </div>
      ) : (
        <Ordenes activo={orden} onCambiar={onOrden} hayGps={hayGps} />
      )}

      {vacio ? (
        <EstadoVacio
          titulo="Hoy no toca cobrarle a nadie"
          explicacion="Ni un cliente tiene cuota para hoy. Aprovecha para prestarle a alguien nuevo."
        />
      ) : (
        grupos.map((g) => (
          <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 'none' }}>
            <CabezaGrupo nombre={g.nombre} pendientes={g.pendientes} total={g.total} />
            <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-3">
              {g.filas.map((f, i) => (
                <Carril
                  key={f.id}
                  // La posición en la fila, no el índice del array: se cuenta
                  // dentro de su ruta, que es el recorrido que el cobrador hace.
                  orden={i + 1}
                  cobrada={f.cobrada}
                  actual={f.id === idActual}
                  ultima={i === g.filas.length - 1}
                  ancla={ancla ? ancla(f.id) : undefined}
                >
                  <FilaCobro
                    {...f}
                    activa={f.id === idActual}
                    onClick={() => onCobrar?.(f)}
                  onLlamar={onLlamar ? () => onLlamar(f) : undefined}
                  onWhatsApp={onWhatsApp ? () => onWhatsApp(f) : undefined}
                    onMapa={onMapa ? () => onMapa(f) : undefined}
                    onMas={onMas ? () => onMas(f) : undefined}
                    onAbrirCliente={onAbrirCliente ? () => onAbrirCliente(f) : undefined}
                    /* Solo si la página lo pasa Y la fila trae qué borrar: una
                       parada cobrada sin `pagoHoyId` es la que ya no tiene pago
                       de hoy que deshacer. */
                    onDeshacerCobro={onDeshacerCobro && f.pagoHoyId
                      ? () => onDeshacerCobro(f)
                      : undefined}
                  />
                </Carril>
              ))}
            </div>
          </div>
        ))
      )}

      {/* ══ La barra de acción, fija abajo ══
          Va por encima de la pastilla de navegación a propósito: mientras se
          cobra, «el siguiente» pesa más que cambiar de pantalla.

          ⚠ EN ESCRITORIO NO OCUPA TODO EL ANCHO.
          Estaba clavada en `left: 16, right: 16`, que es lo correcto en un
          teléfono de 393px —el pulgar tiene que alcanzarla sin mirar— pero en
          un monitor de 1900 eso es un botón de metro y medio de ancho, encima
          metido por debajo del menú lateral. Reportado: «sale a todo lo ancho
          reventando todo el diseño».
          En escritorio se ancla a la derecha, del ancho de una columna: es un
          botón, no una banda.

          El `left` va por CLASE y no en el `style`: un estilo en línea gana
          siempre a la clase, así que un `left: 16` inline dejaría el
          `lg:left-auto` sin efecto y la barra seguiría estirándose. */}
      {pendientes > 0 && (
        <div
          className="fixed left-4 right-4 lg:left-auto lg:w-[380px] z-[45] flex items-center gap-3"
          style={{ bottom: 18 }}>
          <BotonPrimario onClick={onEmpezar} style={{
            flex: 1, height: 62, borderRadius: 999, fontSize: 17,
            boxShadow: '0 6px 20px rgba(231,164,0,.32)',
          }}>
            Empezar ruta · {pendientes}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--cf-gold-ink)"
              strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </BotonPrimario>
          {/* ⚠ `onClick={() => onMapa()}`, NO `onClick={onMapa}`.
              Así se le pasaba el EVENTO del clic como si fuera la fila, y en
              la página `fila.id` salía `undefined`: no encontraba cliente, no
              armaba destino, y la rama de respaldo pedía ese mismo cliente que
              no existía. El botón no hacía absolutamente nada, sin error ni
              aviso. Reportado: «uno le da clic ahí y no hace nada». */}
          <button type="button" onClick={() => onMapa()} aria-label="Ver la ruta en el mapa" style={{
            width: 62, height: 62, minWidth: 62, borderRadius: 999, flex: 'none',
            background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            boxShadow: 'var(--cf-sh-flotante, 0 6px 20px rgba(20,20,28,.14))',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink)"
              strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 4.5L3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8 9 4.5z" />
              <path d="M9 4.5v12.7M15 6.8v12.7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
