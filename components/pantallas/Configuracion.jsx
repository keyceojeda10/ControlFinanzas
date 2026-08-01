'use client'

// components/pantallas/Configuracion.jsx — «01 · Configuración».
//
// REHECHO MIRANDO LA LÁMINA (scripts/ver-diseno.mjs "01 · Configuración").
// Mi primera versión la deduje del texto del handoff y la estructura salió mal,
// no los detalles:
//
//   · Monté PESTAÑAS arriba. Son DOS COLUMNAS: «Configuración es tarea de PC:
//     secciones a la izquierda y contenido a la derecha.»
//   · Enseñaba UNA sección a la vez. Están TODAS APILADAS a la derecha y el
//     menú de la izquierda lleva a cada una. En la lámina se ven «Tu negocio»,
//     «Cómo prestas por defecto» y el plan a la vez.
//   · Puse los ítems como lista. Son TARJETAS: la activa es una tarjeta blanca
//     elevada, las demás van planas sobre el fondo.
//
// ── CORRECCIÓN, 30 de julio ──
//
// Lo de arriba era lo que decía la lámina y lo que construí: todas apiladas, el
// menú llevando a un ancla. EN LA APP DE VERDAD ESO NO FUNCIONA.
//
// La configuración real no son los cuatro bloques que la lámina dibuja: son
// intereses moratorios, mensajes de WhatsApp, campos del recibo, festivos, medios
// de transferencia, notificaciones push, referidos y zona de peligro. Todo eso
// junto en una columna es un rollo por el que se navega a ciegas, y el menú deja
// de ser un menú: se convierte en una tabla de contenidos que te tira a un punto
// del que ya no sabes salir.
//
// Peor: el ítem «activo» del menú no significa nada, porque al hacer scroll el
// contenido se mueve y el menú se queda marcando otra cosa.
//
// AHORA EL MENÚ NAVEGA. Una sección a la vez, la elegida en la URL (`?s=`), igual
// que en el móvil. Es la misma pantalla en los dos anchos, cambia el sitio del
// menú: columna izquierda en PC, lista propia en teléfono.

import { seccionesConfig, modoDeTrabajo } from '@/lib/adaptadores/configuracion'

function Tarjeta({ nombre, cifra, activa, onIr }) {
  return (
    <button type="button" onClick={onIr} aria-current={activa ? 'true' : undefined}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        width: '100%', flex: 'none', minHeight: 52, padding: '0 18px',
        borderRadius: 'var(--cf-r-card)', cursor: 'pointer', textAlign: 'left',
        // La activa es una tarjeta ELEVADA; las demás no tienen superficie.
        background: activa ? 'var(--cf-card)' : 'transparent',
        border: `1px solid ${activa ? 'var(--cf-border)' : 'transparent'}`,
        boxShadow: activa ? '0 1px 3px rgba(0,0,0,.05)' : 'none',
        color: 'var(--cf-ink)',
        fontSize: 15, fontWeight: activa ? 700 : 500,
      }}>
      <span>{nombre}</span>
      {cifra > 0 && (
        <span className="cf-num" style={{
          fontSize: 12, fontWeight: 600, minWidth: 24, height: 24,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 999, background: 'var(--cf-fill)', color: 'var(--cf-ink-3)',
        }}>
          {cifra}
        </span>
      )}
    </button>
  )
}

export default function Configuracion({
  rol = 'owner', cobradores = 0,
  negocio, plan, clientes, limiteClientes,
  activa,                 // id de la sección visible ahora
  onSeccion,              // (id) => void — la elige el que monta, va a la URL
  children,               // (id) => nodo, SOLO el de la sección visible
}) {
  const secciones = seccionesConfig({ rol, cobradores })
  const modo = modoDeTrabajo(cobradores)
  const actual = secciones.find((s) => s.id === activa) ?? secciones[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* De QUÉ negocio son estos ajustes y en qué plan está. «Configuración» a
          secas podría ser de cualquier cuenta. */}
      <div>
        <h1 style={{
          fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 30, fontWeight: 600, letterSpacing: '-.025em',
          color: 'var(--cf-ink)', margin: 0, lineHeight: 1.1,
        }}>
          Configuración
        </h1>
        {(negocio || plan) && (
          <p className="cf-num" style={{ fontSize: 13.5, color: 'var(--cf-ink-3)', margin: '6px 0 0' }}>
            {[negocio, plan && `plan ${plan}`,
              clientes != null && limiteClientes != null && `${clientes} clientes de ${limiteClientes}`,
            ].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      <div className="cf-config">
        <nav aria-label="Secciones de configuración"
          style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 'none' }}>
          {secciones.map((s) => (
            <Tarjeta key={s.id} {...s} activa={s.id === actual?.id} onIr={() => onSeccion?.(s.id)} />
          ))}

          {/* ── Modo de trabajo ──
              Abajo del todo, como en la lámina. Explica POR QUÉ el menú tiene
              las secciones que tiene: sin esta caja, quien contrata a su primer
              cobrador ve aparecer secciones de la nada y no sabe qué tocó. */}
          <div style={{
            marginTop: 'auto', padding: '15px 17px', borderRadius: 'var(--cf-r-card)',
            background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          }}>
            <span style={{
              display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
              textTransform: 'uppercase', color: 'var(--cf-ink-3)',
            }}>
              Modo de trabajo
            </span>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)', marginTop: 6 }}>
              {modo.titulo}
            </span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--cf-ink-3)', marginTop: 6, lineHeight: 1.5 }}>
              {modo.nota}
            </span>
          </div>
        </nav>

        {/* SOLO LA SECCIÓN ELEGIDA. Las demás no se montan: no es solo que no se
            vean —montarlas todas hace ocho peticiones al abrir configuración y
            deja ocho formularios con estado propio compitiendo por el mismo
            dato—. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {actual && (
            <>
              <h2 style={{
                fontFamily: 'var(--font-space-grotesk), system-ui',
                fontSize: 20, fontWeight: 600, letterSpacing: '-.02em',
                color: 'var(--cf-ink)', margin: 0,
              }}>{actual.nombre}</h2>
              {children?.(actual.id, actual)}
            </>
          )}
        </div>
      </div>

      <style>{`
        .cf-config { display: flex; flex-direction: column; gap: 18px; }
        /* Dos columnas SOLO en PC. En un teléfono, 260px de menú al lado del
           contenido deja las dos partes ilegibles — y el diseño lo dice: esto
           es tarea de PC. */
        @media (min-width: 1024px) {
          .cf-config {
            display: grid;
            grid-template-columns: 265px minmax(0, 1fr);
            gap: 22px;
            align-items: stretch;
          }
        }
      `}</style>
    </div>
  )
}
