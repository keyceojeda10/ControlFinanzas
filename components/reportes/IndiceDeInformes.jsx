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
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
    <path d="M9 5l7 7-7 7" />
  </svg>
)

const Candado = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
    <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75" />
    <rect x="4.5" y="10.5" width="15" height="10.5" rx="2" />
  </svg>
)

function Renglon({ informe, bloqueado }) {
  const destino = bloqueado ? '/configuracion/plan' : destinoDe(informe)

  return (
    <Link
      href={destino}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 14px', textDecoration: 'none',
        borderTop: '1px solid var(--cf-hairline)',
        // Apagado, no escondido: se lee que existe y que hace falta otro plan.
        opacity: bloqueado ? 0.55 : 1,
      }}
    >
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)' }}>
            {informe.titulo}
          </span>
          {bloqueado && <Candado />}
        </span>
        {/* Lo que contesta. Envuelve, no se recorta: recortarlo devuelve el
            problema —hay que abrirlo para saber si es el que se buscaba. */}
        <span style={{ fontSize: 12, lineHeight: 1.35, color: 'var(--cf-ink-3)' }}>
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

  return (
    <section
      style={{
        background: 'var(--cf-card)',
        border: '1px solid var(--cf-border)',
        borderRadius: 'var(--cf-r-card)',
        overflow: 'hidden',
      }}
    >
      <header style={{ padding: '13px 14px 11px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--cf-ink)' }}>
          ¿Qué necesitas sacar?
        </h2>
        <p style={{ fontSize: 12, color: 'var(--cf-ink-3)', marginTop: 2 }}>
          Todos los informes del negocio, en un solo sitio.
        </p>
      </header>

      {/* En PC caben en dos columnas y así no hay que deslizar para llegar al
          último. En el teléfono, uno debajo de otro. */}
      <div className="lg:grid lg:grid-cols-2">
        {lista.map((i) => (
          <Renglon key={i.id} informe={i} bloqueado={informeBloqueado(i, nivel)} />
        ))}
      </div>
    </section>
  )
}
