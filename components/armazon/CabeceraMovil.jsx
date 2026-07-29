'use client'

// components/armazon/CabeceraMovil.jsx
//
// La cabecera móvil del rediseño 2026. docs/design_handoff/02-ARMAZON.md sección A.
//
// TRES VARIANTES, UNA SOLA ALTURA. Los 56px no cambian nunca, y la cabecera
// NUNCA se encoge al hacer scroll: en una app que se usa de pie y en movimiento,
// un objetivo que se mueve es un objetivo que se falla.
//
//   navegacion — marca mínima: glifo, buscar, campana, avatar
//   detalle    — atrás + título del objeto + las acciones DE ESE objeto
//   tarea      — cerrar + espina de progreso
//
// El dorado NO aparece aquí. El armazón es gris; el dorado es para la plata.

import Link from 'next/link'
import { CABECERA } from '@/lib/armazon'

const ALTO = 56

/* ── Glifo de marca ──
   Sin logotipo escrito: el usuario ya sabe en qué app está, y el nombre escrito
   solo añade peso. `aspect-ratio` + min-width son blindaje — sin ellos el glifo
   se aplana cuando la fila se satura. */
function Glifo() {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flex: 'none',
        width: 32, minWidth: 32, height: 32, minHeight: 32, aspectRatio: '1',
        borderRadius: 10,
        background: 'var(--cf-gold)',
        border: '2px solid var(--cf-gold-light)',
        fontFamily: 'var(--font-space-grotesk), system-ui',
        fontSize: 16, fontWeight: 700, lineHeight: 1,
        color: 'var(--cf-gold-ink)',
      }}
    >$</span>
  )
}

function BotonIcono({ children, onClick, href, etiqueta, badge = false }) {
  const cuerpo = (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 12 }}>
      {children}
      {badge && (
        // Un PUNTO, no un número: el conteo exacto de avisos no cambia
        // ninguna decisión del usuario.
        <span style={{
          position: 'absolute', top: 7, right: 9,
          width: 8, height: 8, borderRadius: 999,
          background: 'var(--cf-red)',
          border: '2px solid var(--cf-surface)',
        }} />
      )}
    </span>
  )
  const estilo = { background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', display: 'inline-flex' }
  return href
    ? <Link href={href} aria-label={etiqueta} style={estilo}>{cuerpo}</Link>
    : <button type="button" onClick={onClick} aria-label={etiqueta} style={estilo}>{cuerpo}</button>
}

const trazo = { fill: 'none', stroke: 'var(--cf-ink-2)', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' }

const IconoBuscar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...trazo}>
    <circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" />
  </svg>
)

// El path de la campana es el del documento: tiene cuerpo, borde inferior y
// badajo. Un arco simple con una línea NO se reconoce como campana a 20px.
const IconoCampana = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...trazo}>
    <path d="M18 8.5a6 6 0 00-12 0c0 6.5-2.5 8.5-2.5 8.5h17S18 15 18 8.5z" />
    <path d="M13.7 20.5a2 2 0 01-3.4 0" />
  </svg>
)

function Avatar({ iniciales = '', conectado = null, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label="Tu cuenta"
      style={{ background: 'none', border: 0, padding: 0, marginLeft: 4, cursor: 'pointer', flex: 'none' }}>
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flex: 'none',
          width: 32, minWidth: 32, height: 32, minHeight: 32, aspectRatio: '1',
          borderRadius: 999,
          background: 'var(--cf-blue)',   /* azul = persona, NUNCA dinero */
          fontSize: 12, fontWeight: 700, color: '#FFF', letterSpacing: '.01em',
        }}>{iniciales}</span>
        {conectado !== null && (
          <span style={{
            position: 'absolute', bottom: -1, right: -1,
            width: 11, height: 11, borderRadius: 999,
            background: conectado ? 'var(--cf-green)' : 'var(--cf-ink-4)',
            border: '2px solid var(--cf-surface)',
          }} />
        )}
      </span>
    </button>
  )
}

const base = {
  height: ALTO, minHeight: ALTO,
  display: 'flex', alignItems: 'center', gap: 6,
  // Translúcida sobre la superficie: la separación la da el fondo, no un borde.
  background: 'color-mix(in srgb, var(--cf-surface) 86%, transparent)',
  backdropFilter: 'saturate(180%) blur(12px)',
  WebkitBackdropFilter: 'saturate(180%) blur(12px)',
  position: 'sticky', top: 0, zIndex: 40,
}

/* ── Variante de navegación ── */
function Navegacion({ iniciales, conectado, hayAvisos, onBuscar, onAvisos, onCuenta }) {
  return (
    <header style={{ ...base, padding: '0 18px 0 20px' }}>
      <Glifo />
      <span style={{ flex: 1 }} />
      <BotonIcono etiqueta="Buscar" onClick={onBuscar}><IconoBuscar /></BotonIcono>
      <BotonIcono etiqueta="Avisos" onClick={onAvisos} badge={hayAvisos}><IconoCampana /></BotonIcono>
      <Avatar iniciales={iniciales} conectado={conectado} onClick={onCuenta} />
    </header>
  )
}

/* ── Variante de detalle ──
   A la derecha van las acciones DE ESE OBJETO, no las de la app. */
function Detalle({ titulo, subtitulo, onVolver, acciones = null }) {
  return (
    <header style={{ ...base, padding: '0 12px 0 8px' }}>
      <button type="button" onClick={onVolver} aria-label="Volver"
        style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40 }}>
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <span style={{
          fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 17, fontWeight: 600, letterSpacing: '-.015em', lineHeight: 1.2,
          color: 'var(--cf-ink)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{titulo}</span>
        {subtitulo && (
          <span className="cf-num" style={{
            fontSize: 11, color: 'var(--cf-ink-3)', lineHeight: 1.3,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{subtitulo}</span>
        )}
      </span>

      {acciones && <span style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 'none' }}>{acciones}</span>}
    </header>
  )
}

/* ── Variante de tarea ──
   Cerrar arriba a la izquierda, LEJOS DEL PULGAR: salir de una tarea a medias
   pierde datos, así que el botón no puede quedar donde cae el dedo. */
function Tarea({ titulo, paso = 0, total = 0, onCerrar }) {
  return (
    <header style={{ ...base, padding: '8px 20px 12px', alignItems: 'stretch', gap: 0, flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" onClick={onCerrar} aria-label="Cerrar"
          style={{
            flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 12,
            background: 'var(--cf-card)', border: '1px solid rgba(20,20,28,.1)',
            cursor: 'pointer', padding: 0,
          }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink)" strokeWidth="2.2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        {titulo && (
          <span className="cf-num" style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 15, fontWeight: 600, letterSpacing: '-.01em', color: 'var(--cf-ink)',
          }}>{titulo}</span>
        )}
      </div>

      {total > 1 && <EspinaProgreso paso={paso} total={total} style={{ marginTop: 9 }} />}
    </header>
  )
}

/* ── Espina de progreso ──
   UNA SOLA por flujo. Nunca dos indicadores simultáneos.
   `flex:none` en los segmentos: una barra como único hijo encogible de un
   contenedor fijo absorbe el déficit y colapsa a 0px. */
export function EspinaProgreso({ paso = 0, total = 0, style }) {
  if (!(total > 1)) return null
  return (
    <div style={{ display: 'flex', gap: 3, ...style }} aria-label={`Paso ${paso + 1} de ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} style={{
          flex: 1, height: 3, borderRadius: 999, minWidth: 0,
          background: i < paso ? 'var(--cf-green)' : i === paso ? 'var(--cf-gold)' : 'var(--cf-fill-2)',
        }} />
      ))}
    </div>
  )
}

export default function CabeceraMovil({ variante = CABECERA.NAVEGACION, ...props }) {
  if (variante === CABECERA.NINGUNA) return null
  if (variante === CABECERA.DETALLE) return <Detalle {...props} />
  if (variante === CABECERA.TAREA)   return <Tarea {...props} />
  return <Navegacion {...props} />
}
