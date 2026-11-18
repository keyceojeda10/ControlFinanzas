'use client'
/* ══ EL ÍNDICE DE INFORMES ═══════════════════════════════════════════════════
 *
 *   «Hay reportes por todos lados. Hay reportes en caja, hay reportes en
 *    reportes, hay reportes en cómo va el negocio. Unos están abajo, otros
 *    arriba en cabecera, otros al lado de los títulos. Si la gente va a buscar
 *    un reporte específico, de pronto ni siquiera está en el apartado de
 *    reportes.»  — el dueño, 16 ago 2026
 *
 * ── LAS TRES DECISIONES ─────────────────────────────────────────────────────
 *
 * · CADA UNO SE PRESENTA POR LO QUE CONTESTA, no por cómo se llama por dentro.
 *   «Lo que entró · cuánto cobraste y, de eso, cuánto ganaste» se busca a
 *   ciegas y se encuentra; «Reporte de ingresos» hay que abrirlo para saber si
 *   es el que se necesitaba. Ese texto sale del catálogo, no de aquí.
 *
 * · EL RENGLÓN LLEVA AL INFORME, NO A SU PANTALLA. Por eso cada uno arrastra su
 *   ancla: mandar a `/reportes` a quien pidió «los cobros del mes» lo deja
 *   arriba de 3.700 píxeles buscando otra vez, que es la queja entera.
 *
 * · LOS QUE EL PLAN NO ALCANZA SE VEN, APAGADOS. Esconderlos deja al
 *   prestamista sin enterarse de que existen, y esta pantalla es justo donde se
 *   decide subir de plan.
 *
 * ⚠ LOS PENDIENTES NO SE PINTAN. El catálogo declara «Para el contador» y
 *   «Movimientos por cuenta» —los pidió Rincón— pero todavía no existen. Un
 *   renglón que no lleva a ningún sitio es el botón muerto que esta app ya tuvo
 *   cuatro veces; entran cuando funcionen, no antes.
 *
 * ⚠ NO ES UNA REJILLA DE TARJETAS. Va dentro de UNA caja con filetes: las
 *   secciones de abajo ya son tarjetas y anidarlas es siempre un error.
 */

import Link from 'next/link'
import { INFORMES, informeBloqueado, destinoDe } from '@/lib/reportes/catalogo'

const Flecha = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink)"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}>
    <path d="M9 5.5l6.5 6.5L9 18.5" />
  </svg>
)

const Candado = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
    <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75" />
    <rect x="4.5" y="10.5" width="15" height="10.5" rx="2" />
  </svg>
)

/* ══ ESTILO «MI CUENTA» (18 nov 2026) ════════════════════════════════════════
 * Eran dieciséis renglones seguidos en una caja: había que leerlos todos para
 * dar con el que se buscaba. Ahora van en grupos con título gris, como el índice
 * de Configuración que el dueño pidió llevar a todo, y cada fila con el nombre
 * grande y debajo lo que contesta.
 *
 * Los grupos son SOLO de esta pantalla: el catálogo no se toca. Un informe nuevo
 * que no esté en ninguno cae en «Otros», nunca desaparece. */
const GRUPOS = [
  { titulo: 'La plata', ids: ['entro', 'calle', 'cobros-mes', 'dia', 'cuentas'] },
  { titulo: 'Cómo va el negocio', ids: ['rendimiento', 'cobradores', 'seguros', 'contador'] },
  { titulo: 'Para imprimir o mandar', ids: ['resumen', 'listado-cobros'] },
  { titulo: 'Listas completas en Excel', ids: ['cartera', 'volcado-clientes', 'volcado-pagos', 'volcado-cobradores', 'crudo'] },
]

function Renglon({ informe, bloqueado, primero }) {
  const destino = bloqueado ? '/configuracion/plan' : destinoDe(informe)

  return (
    <Link
      href={destino}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '16px 20px', minHeight: 72, textDecoration: 'none',
        background: 'var(--cf-card)',
        borderTop: primero ? 0 : '1px solid var(--cf-border)',
        // Apagado, no escondido: se lee que existe y que hace falta otro plan.
        opacity: bloqueado ? 0.55 : 1,
      }}
    >
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 19, fontWeight: 500, letterSpacing: '-.01em', color: 'var(--cf-ink)', lineHeight: 1.2 }}>
            {informe.titulo}
          </span>
          {bloqueado && <Candado />}
        </span>
        {/* Lo que contesta. Envuelve, no se recorta: recortarlo devuelve el
            problema —hay que abrirlo para saber si es el que se buscaba. */}
        <span style={{ fontSize: 14, lineHeight: 1.35, color: 'var(--cf-ink-3)' }}>
          {bloqueado ? `Con otro plan · ${informe.contesta}` : informe.contesta}
        </span>
      </span>
      <Flecha />
    </Link>
  )
}

/**
 * @param {object} p
 * @param {number} p.nivel  `nivelReportes` del plan del negocio
 */
export default function IndiceDeInformes({ nivel = 0 }) {
  // Los pendientes fuera: ver la nota de arriba.
  const lista = INFORMES.filter((i) => !i.pendiente)
  if (!lista.length) return null

  const enGrupo = new Set(GRUPOS.flatMap((g) => g.ids))
  const grupos = [
    ...GRUPOS.map((g) => ({ titulo: g.titulo, informes: g.ids.map((id) => lista.find((i) => i.id === id)).filter(Boolean) })),
    { titulo: 'Otros', informes: lista.filter((i) => !enGrupo.has(i.id)) },
  ].filter((g) => g.informes.length > 0)

  return (
    /* En el teléfono va de borde a borde (los −20px del <main>), como el índice
       de Configuración. En el PC, en su tarjeta y a dos columnas, así no hay que
       deslizar para llegar al último. */
    <section className="cf-indice-informes" style={{ background: 'var(--cf-surface)' }}>
      {/* Con su propia regla y no con `-mx-5 lg:mx-0`: la clase no llegaba a
          aplicarse y el índice quedaba con los 20 px de cada lado. */}
      <style>{`
        .cf-indice-informes { margin-left: -20px; margin-right: -20px; }
        @media (min-width: 1024px) {
          .cf-indice-informes { margin-left: 0; margin-right: 0; border-radius: 16px; overflow: hidden; border: 1px solid var(--cf-border); }
        }
      `}</style>
      <header style={{ padding: '6px 20px 4px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)' }}>
          ¿Qué necesitas sacar?
        </h2>
        <p style={{ fontSize: 15, color: 'var(--cf-ink-3)', marginTop: 4 }}>
          Todos los informes del negocio, en un solo sitio.
        </p>
      </header>

      {grupos.map((g) => (
        <div key={g.titulo}>
          <div style={{ padding: '18px 20px 10px', fontSize: 16, color: 'var(--cf-ink-3)' }}>{g.titulo}</div>
          <div className="lg:grid lg:grid-cols-2" style={{ background: 'var(--cf-card)', borderTop: '1px solid var(--cf-border)', borderBottom: '1px solid var(--cf-border)' }}>
            {g.informes.map((i, n) => (
              <Renglon key={i.id} informe={i} primero={n === 0} bloqueado={informeBloqueado(i, nivel)} />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
