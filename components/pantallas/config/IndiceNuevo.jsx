'use client'

/* ══ CONFIGURACIÓN, ESTILO NUEVO (PROPUESTA, 17 nov 2026) ══════════════════════
 *
 * Referencia del dueño: la «Mi cuenta» de una app de domicilios, «espaciosa,
 * bonita, seria, pero a la vez bastante moderna y limpia». Lo que se toma:
 *   · arriba, tarjetas destacadas (la del negocio con su plan en píldora, y la
 *     de invitar, que aquí es Referidos: un mes gratis por cada referido que pague);
 *   · la lista a todo el ancho: título grande, una línea gris que dice qué hay
 *     dentro, flecha y separador fino; sin una caja por fila;
 *   · los grupos con un rótulo sobre una franja gris;
 *   · «Salir» en rojo, solo, centrado;
 *   · al pie, una tarjeta gris clara con quién es quién y la versión.
 * Mismos datos y mismos destinos que `IndiceConfiguracion`: solo cambia cómo se ve.
 */
import { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import { EnlaceProfe } from '@/components/tutoriales/PiezasProfe'
import { pedirInstalar } from '@/components/layout/PuertaInstalacion'

/* Qué hay DENTRO de cada sección, en una línea (leído de su panel, no inventado). */
const QUE_HAY = {
  negocio: 'Nombre, país y cómo se ven los montos',
  comoPrestas: 'Lo que se llena solo al prestar, moras y festivos',
  plan: 'Tu plan, tus pagos y tus referidos',
  equipo: 'Tus cobradores y lo que pueden hacer',
  portal: 'Lo que ve tu cliente cuando entra con su cédula',
  avisos: 'Lo que te avisa la app en este teléfono',
  whatsapp: 'Los mensajes automáticos a tus clientes',
  seguridad: 'Los teléfonos con tu cuenta abierta y lo delicado',
  datos: 'Tu nombre, tu correo y tu contraseña',
  ayuda: 'Los videos del profe y cuáles quieres ver',
}

const Flecha = ({ tam = 22 }) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}>
    <path d="M9 5.5l6.5 6.5L9 18.5" />
  </svg>
)

function Fila({ titulo, nota, alerta, onIr, primera = false }) {
  return (
    <button type="button" onClick={onIr} style={{
      display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', font: 'inherit',
      padding: '20px 20px', background: 'var(--cf-card)', border: 0, cursor: 'pointer',
      borderTop: primera ? 0 : '1px solid var(--cf-border)',
    }}>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 19, fontWeight: 500, color: 'var(--cf-ink)', letterSpacing: '-.01em' }}>{titulo}</span>
        {nota && <span style={{ fontSize: 14.5, color: 'var(--cf-ink-3)', lineHeight: 1.35 }}>{nota}</span>}
      </span>
      {alerta && (
        <span className="cf-num" style={{
          display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 10px', borderRadius: 999, flex: 'none',
          background: 'var(--cf-gold-bg)', border: '1px solid var(--cf-gold-border)', fontSize: 12.5, fontWeight: 700, color: 'var(--cf-gold-text-2)',
        }}>{alerta}</span>
      )}
      <Flecha />
    </button>
  )
}

function Grupo({ titulo }) {
  return (
    <div style={{ padding: '16px 20px 12px', fontSize: 16, color: 'var(--cf-ink-3)', background: 'var(--cf-surface)' }}>{titulo}</div>
  )
}

export default function IndiceNuevo({
  negocio, iniciales = '$', plan, clientesNota, filas = [], tema, temas = [], onTema,
  esOwner = false, onIr,
}) {
  /* Lo que hacía la tarjeta de instalar que este índice reemplaza: si ya está
     instalada se dice, y no se ofrece instalarla otra vez. */
  const [instalada, setInstalada] = useState(true)
  useEffect(() => {
    setInstalada(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true)
    const ya = () => setInstalada(true)
    window.addEventListener('cf:instalada', ya)
    return () => window.removeEventListener('cf:instalada', ya)
  }, [])

  const nota = (f) => {
    if (f.id === 'plan' && f.valor) return `${plan ? `Plan ${plan} · ` : ''}${f.valor}`
    if (f.id === 'negocio' && f.valor) return `${f.valor} · nombre y formato de los montos`
    if (f.id === 'equipo' && f.valor) return `${f.valor} · lo que pueden hacer`
    return QUE_HAY[f.id] ?? f.valor ?? null
  }

  return (
    /* -20px a los lados: la lista va de borde a borde, como en la referencia. */
    <div style={{ margin: '0 -20px', display: 'flex', flexDirection: 'column', background: 'var(--cf-surface)' }}>
      {/* ── LAS TARJETAS DE ARRIBA ── */}
      <div style={{ padding: '4px 16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button type="button" onClick={() => onIr?.('plan')} style={{
          display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', font: 'inherit', cursor: 'pointer',
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderRadius: 16, padding: '18px 16px',
        }}>
          <span aria-hidden style={{
            width: 48, height: 48, borderRadius: 14, flex: 'none', display: 'grid', placeItems: 'center',
            background: '#15161A', color: 'var(--cf-gold)', fontSize: 18, fontWeight: 800,
          }}>{iniciales}</span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 19, fontWeight: 600, color: 'var(--cf-ink)', overflowWrap: 'anywhere' }}>{negocio}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {plan && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 12px', borderRadius: 999,
                  background: 'var(--cf-gold-tint)', color: 'var(--cf-gold-text-2, var(--cf-gold-dark))', fontSize: 13, fontWeight: 700,
                }}>Plan {plan}</span>
              )}
              {clientesNota && <span className="cf-num" style={{ fontSize: 14, color: 'var(--cf-ink-3)' }}>{clientesNota}</span>}
            </span>
          </span>
          <Flecha />
        </button>

        {esOwner && (
          <button type="button" onClick={() => onIr?.('plan')} style={{
            display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', font: 'inherit', cursor: 'pointer',
            background: 'var(--cf-card)', border: 0, borderRadius: 16, padding: '16px 16px', boxShadow: '0 2px 10px rgba(21,22,26,.06)',
          }}>
            {/* Dos manos que se pasan un teléfono: invitar a un colega. */}
            <svg width="76" height="64" viewBox="0 0 76 64" aria-hidden style={{ flex: 'none' }}>
              <circle cx="38" cy="34" r="27" fill="var(--cf-gold-tint)" />
              <rect x="14" y="20" width="18" height="30" rx="4" fill="#15161A" transform="rotate(-14 23 35)" />
              <rect x="44" y="20" width="18" height="30" rx="4" fill="#15161A" transform="rotate(14 53 35)" />
              <rect x="17" y="24" width="12" height="20" rx="2" fill="var(--cf-gold)" transform="rotate(-14 23 35)" />
              <rect x="47" y="24" width="12" height="20" rx="2" fill="var(--cf-gold)" transform="rotate(14 53 35)" />
              <path d="M38 6l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="var(--cf-gold)" />
            </svg>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--cf-ink)', lineHeight: 1.2 }}>Invita a otro prestamista</span>
              <span style={{ fontSize: 15, color: 'var(--cf-ink-2)', lineHeight: 1.4 }}>Por cada uno que pague su primer plan, ganas un mes gratis.</span>
            </span>
          </button>
        )}
      </div>

      {/* ── LA LISTA, A TODO EL ANCHO ── */}
      <div style={{ background: 'var(--cf-card)' }}>
        {filas.map((f, i) => (
          <Fila key={f.id} primera={i === 0} titulo={f.nombre} nota={nota(f)} alerta={f.alerta} onIr={f.onIr} />
        ))}
      </div>

      {/* ── LO DE ESTE TELÉFONO ── */}
      <Grupo titulo="En este teléfono" />
      <div style={{ background: 'var(--cf-card)' }}>
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 19, fontWeight: 500, color: 'var(--cf-ink)' }}>Tema</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {temas.map((t) => (
              <button key={t.id} type="button" onClick={() => onTema?.(t.id)} style={{
                flex: 1, height: 44, borderRadius: 999, font: 'inherit', fontSize: 15, cursor: 'pointer',
                fontWeight: tema === t.id ? 700 : 500,
                border: tema === t.id ? '2px solid var(--cf-ink)' : '1px solid var(--cf-border)',
                background: 'var(--cf-card)', color: 'var(--cf-ink)',
              }}>{t.etiqueta}</button>
            ))}
          </div>
        </div>
        {instalada ? (
          <div style={{ padding: '18px 20px', borderTop: '1px solid var(--cf-border)', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 19, fontWeight: 500, color: 'var(--cf-ink)' }}>Instalar la app</span>
            <span style={{ fontSize: 14.5, color: 'var(--cf-green-dark)' }}>Ya está instalada en este teléfono</span>
          </div>
        ) : (
          <>
            <Fila titulo="Instalar la app" nota="Para abrirla de un toque, como cualquier app" onIr={() => pedirInstalar('configuracion')} />
            <div style={{ padding: '0 20px 14px' }}>
              <EnlaceProfe id="inicio-instalar" junto="Instalar la app" pregunta="¿Cómo se instala?" style={{ margin: '-6px 0 0 -8px' }} />
            </div>
          </>
        )}
      </div>

      {/* ── SALIR, SOLO Y EN ROJO ── */}
      <button type="button" onClick={() => signOut({ callbackUrl: '/login' })} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, height: 64, font: 'inherit', cursor: 'pointer',
        background: 'var(--cf-card)', border: 0, borderTop: '1px solid var(--cf-border)', borderBottom: '1px solid var(--cf-border)',
        fontSize: 17, fontWeight: 600, color: 'var(--cf-ink)',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--cf-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M10 5H6.5A1.5 1.5 0 005 6.5v11A1.5 1.5 0 006.5 19H10M15 8.5l3.5 3.5L15 15.5M18.5 12H9" />
        </svg>
        Salir
      </button>

      {/* ── AL PIE: QUIÉN ES QUIÉN ── */}
      <div style={{ padding: '24px 16px 8px' }}>
        <div style={{ background: 'var(--cf-card)', borderRadius: 16, padding: '18px 18px', fontSize: 14, lineHeight: 1.55, color: 'var(--cf-ink-3)' }}>
          Control Finanzas es el programa con el que llevas tu negocio: no presta plata ni es parte de tus préstamos.
          Los préstamos, las tasas y los cobros son entre tú y tus clientes.
          <br />Soporte: desde «Ayuda y tutoriales» o por WhatsApp.
        </div>
      </div>
      <p style={{ margin: 0, padding: '8px 0 24px', textAlign: 'center', fontSize: 13, color: 'var(--cf-ink-3)' }}>app.control-finanzas.com</p>
    </div>
  )
}
