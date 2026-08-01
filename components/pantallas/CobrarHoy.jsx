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

import { BotonPrimario, EstadoVacio , TiraCifras} from '@/components/cf/primitivos'
import { BotonFiltros } from './HojaFiltros'

const COLOR_ESTADO = {
  mora:   'var(--cf-red)',
  atraso: 'var(--cf-gold)',
  aldia:  'var(--cf-green)',
}

const PASTILLA = {
  mora:   { bg: 'var(--cf-red-pill-bg)',   bd: 'var(--cf-red-pill-border)',   fg: 'var(--cf-red-dark)' },
  atraso: { bg: 'var(--cf-gold-bg)',       bd: 'var(--cf-gold-border)',       fg: 'var(--cf-gold-text-2)' },
  aldia:  { bg: 'var(--cf-green-pill-bg)', bd: 'var(--cf-green-pill-border)', fg: 'var(--cf-green-dark)' },
}

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
        <span className="cf-fig" style={{ fontSize: 25, letterSpacing: '-.03em', color: 'var(--cf-ink)' }}>
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

/* ══ La fila de cobro ══ */
function FilaCobro({
  nombre, iniciales, estado = 'aldia', etiquetaEstado, donde,
  cuota, debe, cobrada = false, cobradoA, montoCobrado, cifras, onClick,
}) {
  const color = COLOR_ESTADO[estado] || COLOR_ESTADO.aldia
  const p = PASTILLA[estado] || PASTILLA.aldia

  return (
    <div
      onClick={cobrada ? undefined : onClick}
      role={cobrada ? undefined : 'button'}
      tabIndex={cobrada ? undefined : 0}
      style={{
        position: 'relative',
        background: 'var(--cf-card)',
        border: '1px solid var(--cf-border)',
        borderRadius: 'var(--cf-r-card)',
        padding: '14px 16px 14px 19px',
        // COLUMNA, no fila. Antes era una sola fila —avatar, nombre, cuota— y
        // T03-01 le pone debajo la tira de cifras. La fila de siempre baja un
        // nivel y se queda igual; lo que cambia es que ahora tiene hermana.
        display: 'flex', flexDirection: 'column', gap: 11,
        overflow: 'hidden', flex: 'none',
        // El cobrado se atenúa, no se borra. .6 es de la lámina.
        opacity: cobrada ? 0.6 : 1,
        cursor: cobrada ? 'default' : 'pointer',
      }}
    >
      <span aria-hidden style={{
        position: 'absolute', left: 0, top: 12, bottom: 12,
        width: 4, borderRadius: 999,
        background: cobrada ? 'var(--cf-green)' : color,
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>

      {/* El avatar del cobrado es un CHECK, no sus iniciales: la fila ya está
          tachada, y un avatar normal invita a volver a tocarla. */}
      {cobrada ? (
        <span aria-hidden style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 40, height: 40, minWidth: 40, borderRadius: 999, flex: 'none',
          background: 'var(--cf-green-pill-bg)',
        }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--cf-green)"
            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
      ) : (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 40, height: 40, minWidth: 40, aspectRatio: '1', borderRadius: 999, flex: 'none',
          background: 'var(--cf-fill)', fontSize: 15, fontWeight: 700, color: 'var(--cf-ink-2)',
        }}>{iniciales}</span>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 17, fontWeight: 700, letterSpacing: '-.015em', color: 'var(--cf-ink)',
          minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          textDecoration: cobrada ? 'line-through' : 'none',
        }}>{nombre}</span>

        {cobrada ? (
          <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>
            {cobradoA ? `Cobrado ${cobradoA}` : 'Cobrado'}
          </span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            {etiquetaEstado && (
              <span className="cf-num" style={{
                display: 'inline-flex', alignItems: 'center', flex: 'none',
                height: 20, padding: '0 8px', borderRadius: 'var(--cf-r-pill)',
                background: p.bg, border: `1px solid ${p.bd}`, color: p.fg,
                fontSize: 11, fontWeight: 700,
              }}>{etiquetaEstado}</span>
            )}
            {donde && (
              <span style={{
                fontSize: 12, color: 'var(--cf-ink-3)',
                minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{donde}</span>
            )}
          </div>
        )}
      </div>

      {cobrada ? (
        <span className="cf-fig" style={{
          fontSize: 20, letterSpacing: '-.025em', color: 'var(--cf-green-dark)', flex: 'none',
        }}>{montoCobrado}</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flex: 'none' }}>
          {/* EN NEGRO. Era un botón rojo en cada fila, y con veinte filas eso
              era el muro: rojo es mora, no «cobrar». */}
          <span className="cf-fig" style={{ fontSize: 20, letterSpacing: '-.025em', color: 'var(--cf-ink)' }}>
            {cuota}
          </span>
          {debe && (
            <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>{debe}</span>
          )}
        </div>
      )}
      </div>

      {/* «Atraso $48.000 · Cumple 62% · Cuota 13/24 · Últ. pago 21 jun».
          El adaptador no la manda en el cobrado: ya está tachado y con su hora,
          y enseñarle el atraso a alguien que acaba de pagar es ruido. */}
      <TiraCifras columnas={cifras} enTarjeta />
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
  onMapa,
  onEmpezar,
  sinMargen = false,
}) {
  const vacio = grupos.every((g) => g.filas.length === 0)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: sinMargen ? '8px 0 0' : '8px var(--cf-pad-screen) 0',
      // Hueco para la barra de acción fija. Sin él, la última fila queda debajo
      // del botón y no se puede tocar.
      paddingBottom: 96,
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
              {g.filas.map((f) => (
                <FilaCobro key={f.id} {...f} onClick={() => onCobrar?.(f)} />
              ))}
            </div>
          </div>
        ))
      )}

      {/* ══ La barra de acción, fija abajo ══
          Va por encima de la pastilla de navegación a propósito: mientras se
          cobra, «el siguiente» pesa más que cambiar de pantalla. */}
      {pendientes > 0 && (
        <div style={{
          position: 'fixed', left: 16, right: 16, bottom: 18, zIndex: 45,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
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
          <button type="button" onClick={onMapa} aria-label="Ver en el mapa" style={{
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
