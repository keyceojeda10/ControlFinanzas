'use client'

// components/armazon/CosasPorResolver.jsx — «02 · Cosas por resolver».
//
// El destino de todo lo que NO ganó la franja de arriba, y lo que abre la
// campana. Palabras del diseñador:
//
//   «Cada aviso trae su acción y, el que cobra, EL PRECIO: "pagar $39.000", no
//   "gestionar suscripción". La línea que evita el susto está en la tarjeta del
//   plan: si se vence sigues cobrando. Y la separación importante: aquí solo van
//   avisos DE LA APP; los de la cartera —mora, renovaciones, clientes sin ruta—
//   se quedan en el panel, porque son TRABAJO, no notificaciones.»
//
// ⚠ ESA ÚLTIMA REGLA LA REVOCÓ EL DUEÑO (ago 2026):
//
//   «tenemos un apartado de notificaciones y no estamos mandando notificaciones
//    de ninguna clase. Ahí podría llegar una notificación de, este cliente está
//    atrasado, y ahí en las notificaciones se va guardando.»
//
// Y no era solo que no llegaran: la tabla `Notificacion` se escribía desde hacía
// meses —346 filas en producción— y su pantalla, `NotificationsCenter`, vivía
// dentro de `Header.jsx` y `Sidebar.jsx`, que este armazón dejó de montar. Se
// escribía y no lo leía nadie.
//
// La distinción que SÍ se mantiene, y que explica por qué conviven las dos
// cosas: el panel dice QUÉ HAY QUE HACER —a quién le cobro hoy, quién está en
// mora ahora—; esta hoja dice QUÉ PASÓ, y se queda guardado aunque se resuelva.

import HojaInferior from '@/components/cf/HojaInferior'
import { useEffect, useState } from 'react'
import Pendientes from '@/components/armazon/Pendientes'
import { estadoPush, activarPush } from '@/lib/push-cliente'
import { grupoDe } from '@/lib/avisos-preferencias'

/* ══ EL PERMISO SE PIDE DONDE SIRVE ═════════════════════════════════════════
   El interruptor de los avisos del teléfono estaba en Configuración, dentro de
   una pestaña llamada «Avisos por WhatsApp»: lo encontró el 14 % de los dueños
   y 5 de 40 cobradores (19 sep 2026). Aquí se ofrece cuando la persona YA está
   mirando sus avisos —que es cuando entiende para qué sirve—, y solo si su
   teléfono puede y todavía no ha dicho que no. Se puede descartar, y no vuelve
   a salir en ese teléfono. */
function InvitacionPush() {
  const [estado, setEstado] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  useEffect(() => {
    let vivo = true
    try { if (localStorage.getItem('cf-push-no-ofrecer') === '1') return } catch {}
    estadoPush().then((e) => { if (vivo) setEstado(e) })
    return () => { vivo = false }
  }, [])
  if (estado !== 'apagado') return null
  return (
    <div style={{
      borderRadius: 'var(--cf-r-card)', background: 'var(--cf-fill)',
      border: '1px solid var(--cf-border)', padding: '13px 14px',
      display: 'flex', flexDirection: 'column', gap: 9,
    }}>
      <span style={{ fontSize: 14, color: 'var(--cf-ink-2)', lineHeight: 1.45 }}>
        <b style={{ color: 'var(--cf-ink)' }}>Entérate con la app cerrada.</b> Te avisamos al teléfono cuando
        algo espera tu respuesta.
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button type="button" disabled={trabajando} onClick={async () => {
          setTrabajando(true)
          setEstado(await activarPush())
          setTrabajando(false)
        }} style={{
          height: 36, padding: '0 14px', borderRadius: 'var(--cf-r-control)', border: 0, cursor: 'pointer',
          background: 'var(--cf-ink)', color: 'var(--cf-surface)', fontSize: 13, fontWeight: 700,
          opacity: trabajando ? .6 : 1,
        }}>{trabajando ? 'Activando…' : 'Activar avisos'}</button>
        <button type="button" onClick={() => {
          try { localStorage.setItem('cf-push-no-ofrecer', '1') } catch {}
          setEstado(null)
        }} style={{
          background: 'none', border: 0, padding: 0, cursor: 'pointer',
          fontSize: 13, color: 'var(--cf-ink-3)', textDecoration: 'underline', textUnderlineOffset: 3,
        }}>Ahora no</button>
      </div>
    </div>
  )
}

/* El icono y el color de cada aviso salen de su GRUPO, no de su tipo: así un
   tipo nuevo cae en su sitio sin tocar esta pantalla. El rojo es solo para la
   mora; el verde, para las buenas noticias; lo demás, neutro-dorado. */
const ASPECTO = {
  mora:         { tono: 'rojo',  d: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></> },
  cartera:      { tono: 'verde', d: <><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></> },
  logros:       { tono: 'verde', d: <path d="M12 3l2.6 5.6 6 .7-4.4 4.2 1.1 6L12 16.6 6.7 19.500l1.1-6L3.4 9.300l6-.700L12 3z" /> },
  caja:         { tono: 'oro',   d: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 13h18" /></> },
  aprobaciones: { tono: 'oro',   d: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></> },
  resumen:      { tono: 'oro',   d: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></> },
  cuenta:       { tono: 'oro',   d: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></> },
  equipo:       { tono: 'oro',   d: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></> },
}
const TONOS = {
  rojo:  { fondo: 'color-mix(in srgb, var(--cf-red) 14%, transparent)', trazo: 'var(--cf-red-dark)', punto: 'var(--cf-red)' },
  verde: { fondo: 'var(--cf-green-pill-bg)', trazo: 'var(--cf-green-dark)', punto: 'var(--cf-green)' },
  oro:   { fondo: 'var(--cf-gold-tint)', trazo: 'var(--cf-gold-dark)', punto: 'var(--cf-gold)' },
}

function Tarjeta({ titulo, dato, nota, accion, onAccion, secundaria, onSecundaria }) {
  return (
    <div style={{
      padding: '15px 17px', borderRadius: 'var(--cf-r-card)',
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--cf-ink)' }}>{titulo}</span>
      {dato && (
        <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>{dato}</span>
      )}
      {nota && (
        <span style={{ fontSize: 13, color: 'var(--cf-ink-2)', lineHeight: 1.45, marginTop: 3 }}>
          {nota}
        </span>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 9 }}>
        {/* El que cobra lleva EL PRECIO en el botón. «Gestionar suscripción» no
            dice cuánto cuesta, así que se toca a ciegas. */}
        <button type="button" onClick={onAccion} style={{
          height: 40, padding: '0 16px', borderRadius: 'var(--cf-r-control)',
          border: 0, cursor: 'pointer', background: 'var(--cf-gold)',
          color: 'var(--cf-gold-ink)', fontSize: 13.5, fontWeight: 700,
        }}>
          {accion}
        </button>
        {secundaria && (
          <button type="button" onClick={onSecundaria} style={{
            background: 'none', border: 0, cursor: 'pointer',
            fontSize: 13, color: 'var(--cf-ink-3)', textDecoration: 'underline', textUnderlineOffset: 3,
          }}>
            {secundaria}
          </button>
        )}
      </div>
    </div>
  )
}

/* ══ UN AVISO GUARDADO ═════════════════════════════════════════════════════
   Los de mora van en ROJO y con el triángulo. En una lista donde todo se ve
   igual, «se atrasó» y «te crearon un cliente» pesan lo mismo, y no lo pesan.
   Leído se apaga, pero no desaparece: el dueño lo pidió expreso —«ahí en las
   notificaciones se va guardando»—. */
function Guardado({ n, onAbrir, onBorrar }) {
  const aspecto = ASPECTO[grupoDe(n.tipo)] ?? ASPECTO.equipo
  const tono = TONOS[aspecto.tono]
  const cuando = new Date(n.createdAt).toLocaleDateString('es', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  /* ⚠ ERA UN <button> QUE ENVOLVÍA LA FILA ENTERA, y por eso no había dónde
     poner el de borrar: un botón dentro de otro no es HTML válido y el navegador
     lo desarma por su cuenta. Ahora la fila es un contenedor con dos botones
     hermanos: el grande abre, el pequeño borra. */
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', gap: 2,
      borderRadius: 'var(--cf-r-card)', background: 'var(--cf-card)',
      border: '1px solid var(--cf-border)', overflow: 'hidden',
      opacity: n.leida ? 0.55 : 1,
    }}>
      <button
        type="button"
        onClick={() => onAbrir?.(n)}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 11, flex: 1, minWidth: 0,
          padding: '12px 4px 12px 14px', textAlign: 'left', background: 'none',
          border: 0, cursor: 'pointer', font: 'inherit',
        }}
      >
        <span aria-hidden style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 30, height: 30, minWidth: 30, borderRadius: 10, flex: 'none', marginTop: 1,
          background: n.leida ? 'var(--cf-fill)' : tono.fondo,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke={n.leida ? 'var(--cf-ink-3)' : tono.trazo}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{aspecto.d}</svg>
        </span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)' }}>{n.titulo}</span>
          <span style={{ fontSize: 13, color: 'var(--cf-ink-2)', lineHeight: 1.4 }}>{n.mensaje}</span>
          <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)', marginTop: 1 }}>{cuando}</span>
        </span>
        {!n.leida && (
          <span aria-hidden style={{
            width: 8, height: 8, borderRadius: 999, flex: 'none', marginTop: 6,
            background: tono.punto,
          }} />
        )}
      </button>

      {/* Cuadrado, no redondo: el radio de píldora está reservado y un botón
          nunca lo lleva. Va pegado al borde derecho, que es donde el pulgar lo
          encuentra sin tapar el texto. */}
      <button
        type="button"
        aria-label={`Borrar aviso: ${n.titulo}`}
        title="Borrar"
        onClick={(e) => { e.stopPropagation(); onBorrar?.(n.id) }}
        style={{
          width: 46, flex: 'none', display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: 'none', border: 0,
          borderLeft: '1px solid var(--cf-hairline)', cursor: 'pointer',
          color: 'var(--cf-ink-3)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      </button>
    </div>
  )
}

export default function CosasPorResolver({
  abierta, onCerrar, items = [], onIr,
  guardados = [], sinLeer = 0, onLeer, onLeerTodas, onAbrirGuardado,
  onBorrar, onBorrarLeidas,
  pendientes = [], onPendienteResuelto, onAbrirPendiente,
}) {
  const hayLeidas = guardados.some((n) => n.leida)
  const vacio = items.length === 0 && guardados.length === 0 && pendientes.length === 0
  /* ⚠ SE LLAMABA «Cosas por resolver». El dueño: «ese título y lo que pasó, la
     verdad, no me cuenta nada». Y tenía razón: la campana abre esto, y lo que la
     gente espera detrás de una campana son sus notificaciones. El nombre de una
     pantalla no es el sitio para explicar la filosofía del producto.

     Y el comentario va AQUÍ y no dentro del `return`: ahí dentro un comentario
     con llaves es un segundo hijo suelto y el archivo deja de compilar. Está
     anotado en este proyecto y volví a tropezarme igual. */
  return (
    <HojaInferior abierta={abierta} onCerrar={onCerrar} titulo="Notificaciones">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {vacio && (
          <p style={{ fontSize: 13.5, color: 'var(--cf-ink-2)', margin: 0, lineHeight: 1.5 }}>
            No tienes avisos. Aquí sale lo que espera tu respuesta y lo que va pasando en tu negocio.
          </p>
        )}

        {/* PRIMERO lo que espera una decisión: hay alguien parado esperándola. */}
        <Pendientes pendientes={pendientes} onResuelto={onPendienteResuelto} onAbrir={onAbrirPendiente} />

        <InvitacionPush />

        {items.map((it) => (
          <Tarjeta key={it.id} {...it} />
        ))}

        {/* ══ LO QUE PASÓ, GUARDADO ═══════════════════════════════════════════
            Antes acababa aquí una frase que decía que la mora NO vivía en esta
            hoja: «son TRABAJO, no notificaciones». El dueño la revocó:

              «tenemos un apartado de notificaciones y no estamos mandando
               notificaciones de ninguna clase. Ahí podría llegar una
               notificación de, este cliente está atrasado, y ahí se va
               guardando.»

            Y tenía más razón de la que creía: la tabla se escribía desde hacía
            meses y su pantalla ya no la montaba nadie. */}
        {guardados.length > 0 && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 10, marginTop: (items.length > 0 || pendientes.length > 0) ? 6 : 0,
            }}>
              {/* Antes aquí ponía «LO QUE PASÓ» en versalitas. No decía nada que
                  la lista de abajo no dijera sola, y el dueño lo señaló junto
                  con el título. Lo que sí sirve es cuántos quedan sin leer. */}
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cf-ink-3)' }}>
                {sinLeer > 0 ? `${sinLeer} sin leer` : 'Todos leídos'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {sinLeer > 0 && (
                  <button type="button" onClick={onLeerTodas} style={{
                    background: 'none', border: 0, cursor: 'pointer', padding: 0,
                    fontSize: 13, fontWeight: 600, color: 'var(--cf-ink-2)',
                    textDecoration: 'underline', textUnderlineOffset: 3,
                  }}>
                    Marcar leídas
                  </button>
                )}
                {/* Borrar de a una está en cada fila; esto es para la limpieza
                    grande, que es justo lo que faltaba: marcar leídas las dejaba
                    ahí para siempre. Solo las leídas — lo que no se ha visto no
                    se tira de un botón. */}
                {hayLeidas && (
                  <button type="button" onClick={onBorrarLeidas} style={{
                    background: 'none', border: 0, cursor: 'pointer', padding: 0,
                    fontSize: 13, fontWeight: 600, color: 'var(--cf-ink-2)',
                    textDecoration: 'underline', textUnderlineOffset: 3,
                  }}>
                    Borrar leídas
                  </button>
                )}
              </span>
            </div>
            {guardados.map((n) => (
              <Guardado key={n.id} n={n} onBorrar={onBorrar}
                onAbrir={(x) => { onLeer?.(x.id); onAbrirGuardado?.(x) }} />
            ))}
          </>
        )}

      </div>
    </HojaInferior>
  )
}
