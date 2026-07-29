'use client'

// components/pantallas/Configuracion.jsx — «01 · Configuración».
//
// NO SON PESTAÑAS ARRIBA. El diseño lo dice explícito: «Configuración es tarea
// de PC: DOS COLUMNAS, secciones a la izquierda y contenido a la derecha.
// Cobradores es tarea de móvil: se crea una cuenta y se asigna una ruta desde el
// teléfono, muchas veces con la persona enfrente.»
//
// Y el porqué del orden: «Configuración deja de ser una lista plana de ajustes y
// se ordena por LO QUE EL DUEÑO VA A BUSCAR.»
//
// En móvil la columna izquierda se convierte en la lista, y al elegir una
// sección se ve solo esa: dos columnas de 190px en un teléfono no son dos
// columnas, son dos tiras ilegibles.

import { useState } from 'react'
import { seccionesConfig, modoDeTrabajo } from '@/lib/adaptadores/configuracion'

function Item({ nombre, cifra, activa, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-current={activa ? 'page' : undefined}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        width: '100%', flex: 'none', minHeight: 38, padding: '0 12px',
        borderRadius: 11, cursor: 'pointer', textAlign: 'left', border: 0,
        background: activa ? 'var(--cf-gold-tint)' : 'transparent',
        color: activa ? 'var(--cf-gold-text)' : 'var(--cf-ink-2)',
        fontSize: 14, fontWeight: activa ? 700 : 600,
      }}>
      <span>{nombre}</span>
      {/* La cifra al lado: un «Equipo» pelado no dice si hay uno o nueve. */}
      {cifra > 0 && (
        <span className="cf-num" style={{
          fontSize: 11.5, fontWeight: 700, padding: '1px 7px', borderRadius: 999,
          background: activa ? 'var(--cf-gold)' : 'var(--cf-fill)',
          color: activa ? 'var(--cf-gold-ink)' : 'var(--cf-ink-3)',
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
  seccion, onSeccion,
  children,
}) {
  const secciones = seccionesConfig({ rol, cobradores })
  const [interna, setInterna] = useState(secciones[0]?.id ?? null)
  const activa = seccion ?? interna
  const elegir = (id) => { setInterna(id); onSeccion?.(id) }
  const modo = modoDeTrabajo(cobradores)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* La cabecera dice DE QUÉ NEGOCIO son estos ajustes y en qué plan está.
          Sin eso, «Configuración» a secas podría ser de cualquier cuenta. */}
      <div>
        <h1 style={{
          fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 25, fontWeight: 600, letterSpacing: '-.025em',
          color: 'var(--cf-ink)', margin: 0,
        }}>
          Configuración
        </h1>
        {(negocio || plan) && (
          <p className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-3)', margin: '4px 0 0' }}>
            {[negocio, plan && `plan ${plan}`,
              clientes != null && limiteClientes != null && `${clientes} clientes de ${limiteClientes}`,
            ].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      <div className="cf-config">
        {/* ── Columna izquierda: las secciones ── */}
        <nav aria-label="Secciones de configuración"
          style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 'none' }}>
          {secciones.map((s) => (
            <Item key={s.id} {...s} activa={s.id === activa} onClick={() => elegir(s.id)} />
          ))}

          {/* ── Modo de trabajo ──
              Explica POR QUÉ el menú tiene las secciones que tiene. Sin esta
              caja, quien contrata a su primer cobrador ve aparecer secciones de
              la nada y no sabe qué tocó. */}
          <div style={{
            marginTop: 14, padding: '12px 13px', borderRadius: 'var(--cf-r-card)',
            background: 'var(--cf-fill)', border: '1px solid var(--cf-border)',
          }}>
            <span style={{
              display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
              textTransform: 'uppercase', color: 'var(--cf-ink-3)',
            }}>
              Modo de trabajo
            </span>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--cf-ink)', marginTop: 4 }}>
              {modo.titulo}
            </span>
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--cf-ink-3)', marginTop: 5, lineHeight: 1.45 }}>
              {modo.nota}
            </span>
          </div>
        </nav>

        {/* ── Columna derecha: el contenido de la sección elegida ── */}
        <div style={{ minWidth: 0 }}>
          {typeof children === 'function' ? children(activa) : children}
        </div>
      </div>

      <style>{`
        .cf-config { display: flex; flex-direction: column; gap: 18px; }
        /* Dos columnas SOLO en PC. En un teléfono, 190px de menú al lado del
           contenido deja las dos partes ilegibles. */
        @media (min-width: 1024px) {
          .cf-config {
            display: grid;
            grid-template-columns: 230px minmax(0, 1fr);
            gap: 26px;
            align-items: start;
          }
        }
      `}</style>
    </div>
  )
}
