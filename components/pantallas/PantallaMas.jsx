'use client'

// components/pantallas/PantallaMas.jsx — turno 41·03, adenda 06 §5.
//
// El quinto destino de la pastilla. Es NAVEGACIÓN, así que lleva armazón
// completo: cabecera de 56px + pastilla con el quinto icono activo.
//
// LA DECISIÓN: cada fila lleva SU CIFRA. Un menú de nombres es un índice; con la
// cifra al lado es un panel. "Cobradores · 8 sin registrar nada" es un problema
// que se ve sin entrar.
//
// Ordenadas por FRECUENCIA DE USO, no alfabéticamente.
//
// ⚠️ EN ESCRITORIO NO EXISTE. La barra lateral ya lista todo con sus grupos.

import { Tarjeta } from '@/components/cf/primitivos'

/* Los iconos son de trazo, 20px, en gris. No compiten con las cifras. */
const I = {
  plata:      <><rect x="2.5" y="6" width="19" height="13" rx="2.5" /><path d="M2.5 10.5h19M17 15h1.5" /></>,
  negocio:    <><path d="M3 20h18M6.5 20v-7M12 20V6.5M17.5 20v-11" /></>,
  reportes:   <><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  gastos:     <><path d="M5.5 3h13v18l-2.2-1.6-2.1 1.6-2.2-1.6L9.8 21l-2.1-1.6L5.5 21z" /><path d="M9 8h6M9 12h6" /></>,
  cobradores: <><circle cx="9" cy="8" r="3.4" /><path d="M2.8 20a6.2 6.2 0 0112.4 0M17 5.2a3.4 3.4 0 010 5.9M19.4 20a5.6 5.6 0 00-2.6-4.7" /></>,
  perdidos:   <><circle cx="12" cy="12" r="9" /><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" /></>,
  socios:     <><circle cx="8" cy="9" r="3" /><circle cx="16" cy="9" r="3" /><path d="M2.5 19.5a5.5 5.5 0 0111 0M10.5 19.5a5.5 5.5 0 0111 0" /></>,
  quien:      <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5l3 2" /></>,
  config:     <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5v.2a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H2.7a2 2 0 110-4h.1a1.7 1.7 0 001.6-1.1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V2.7a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1h.2a2 2 0 110 4h-.1a1.7 1.7 0 00-1.6 1z" /></>,
  soporte:    <><path d="M21 11.5a8.4 8.4 0 01-12.6 7.3L3 20.5l1.8-5.2A8.4 8.4 0 1121 11.5z" /></>,
  tutoriales: <><circle cx="12" cy="12" r="9" /><path d="M10 8.5l6 3.5-6 3.5z" /></>,
  cuaderno:   <><path d="M4 4.5A1.5 1.5 0 015.5 3H18a1 1 0 011 1v16a1 1 0 01-1 1H5.5A1.5 1.5 0 014 19.5z" /><path d="M4 17.5h15M8 3v18" /></>,
  excel:      <><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" /><path d="M14 3v5h5M9.5 12l5 5M14.5 12l-5 5" /></>,
}

function Icono({ nombre, tam = 20 }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {I[nombre]}
    </svg>
  )
}

const TONOS = {
  bien:  'var(--cf-green-dark)',
  mal:   'var(--cf-red-dark)',
  ambar: 'var(--cf-gold-text-2)',
}

function Fila({ icono, nombre, cifra, tono, alto = 56, primera, onIr }) {
  return (
    <button type="button" onClick={onIr} style={{
      display: 'flex', alignItems: 'center', gap: 13, width: '100%', flex: 'none',
      minHeight: alto, padding: '0 16px', cursor: 'pointer', textAlign: 'left',
      background: 'none', border: 0,
      borderTop: primera ? 0 : '1px solid var(--cf-hairline)',
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 34, minWidth: 34, height: 34, borderRadius: 10, flex: 'none',
        background: 'var(--cf-fill)', color: 'var(--cf-ink-2)',
      }}>
        <Icono nombre={icono} />
      </span>

      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontSize: 14.5, fontWeight: 600, color: 'var(--cf-ink)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{nombre}</span>
        {/* La cifra es lo que convierte el índice en panel. Sin ella la fila no
            aporta nada que el nombre no diga ya. */}
        {cifra && (
          <span className="cf-num" style={{
            fontSize: 12, lineHeight: 1.3, color: tono ? TONOS[tono] : 'var(--cf-ink-3)',
            fontWeight: tono ? 600 : 400,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{cifra}</span>
        )}
      </span>

      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-4)"
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
        <path d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

function Rotulo({ children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase',
      color: 'var(--cf-ink-3)', padding: '0 2px', flex: 'none',
    }}>{children}</span>
  )
}

/* Los dos importadores son de UN SOLO USO. Fuera de la lista diaria, porque si
   compiten con "Mi plata" ganan atención que no merecen todos los días. */
function TarjetaCarga({ icono, titulo, nota, onIr }) {
  return (
    <button type="button" onClick={onIr} style={{
      flex: 1, minWidth: 0, cursor: 'pointer', textAlign: 'left',
      display: 'flex', flexDirection: 'column', gap: 8, padding: '15px 15px 16px',
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)',
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, borderRadius: 10, flex: 'none',
        background: 'var(--cf-gold-tint)', color: 'var(--cf-gold-dark)',
      }}>
        <Icono nombre={icono} />
      </span>
      <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)', lineHeight: 1.25 }}>
        {titulo}
      </span>
      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--cf-ink-3)', lineHeight: 1.35 }}>
        {nota}
      </span>
    </button>
  )
}

export default function PantallaMas({
  plataLista, rendimiento, gastosMes, cobradoresSinRegistrar,
  perdidos, socios, usuarios = 1, onIr,
  // Dentro del layout el margen lateral ya lo pone el <main>.
  sinMargen = false,
}) {
  const ir = (destino) => () => onIr?.(destino)

  // Se ocultan igual que Rutas y Equipo en el resto del sistema. Catorce filas de
  // las que cuatro no aplican es peor que diez que sí.
  const haySocios = socios?.cantidad > 0
  const hayEquipo = usuarios > 1

  const herramientas = [
    { icono: 'plata',      nombre: 'Mi plata',            cifra: plataLista && `${plataLista} listos para prestar`, destino: '/capital' },
    { icono: 'negocio',    nombre: '¿Cómo va el negocio?', cifra: rendimiento, tono: 'bien', destino: '/analiticas' },
    { icono: 'reportes',   nombre: 'Reportes',            cifra: null, destino: '/reportes' },
    { icono: 'gastos',     nombre: 'Gastos',              cifra: gastosMes, tono: 'ambar', destino: '/gastos' },
    { icono: 'cobradores', nombre: 'Cobradores',          cifra: cobradoresSinRegistrar, tono: 'mal', destino: '/cobradores' },
    { icono: 'perdidos',   nombre: 'Perdidos',            cifra: perdidos, destino: '/perdidos' },
    haySocios && { icono: 'socios', nombre: 'Socios',        cifra: socios.resumen, destino: '/socios' },
    hayEquipo && { icono: 'quien',  nombre: 'Quién hizo qué', cifra: null, destino: '/actividad' },
  ].filter(Boolean)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)', padding: sinMargen ? '0' : '8px var(--cf-pad-screen) 0' }}>
      <Rotulo>Más herramientas</Rotulo>
      <Tarjeta plana>
        {herramientas.map((h, i) => (
          <Fila key={h.nombre} {...h} primera={i === 0} onIr={ir(h.destino)} />
        ))}
      </Tarjeta>

      <Rotulo>Cargar datos</Rotulo>
      <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
        <TarjetaCarga icono="cuaderno" titulo="Pasar mi cuaderno"
          nota="Le tomas foto y se pasa solo" onIr={ir('/importar/cuaderno')} />
        <TarjetaCarga icono="excel" titulo="Importar Excel"
          nota="Si ya lo llevas en el computador" onIr={ir('/importar/excel')} />
      </div>

      <Rotulo>Cuenta</Rotulo>
      <Tarjeta plana>
        <Fila icono="config"     nombre="Configuración" alto={54} primera onIr={ir('/configuracion')} />
        <Fila icono="soporte"    nombre="Soporte"       alto={54} onIr={ir('/soporte')} />
        <Fila icono="tutoriales" nombre="Tutoriales"    alto={54} onIr={ir('/tutoriales')} />
      </Tarjeta>
    </div>
  )
}
