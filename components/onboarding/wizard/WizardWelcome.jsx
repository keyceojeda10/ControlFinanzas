'use client'

// components/onboarding/wizard/WizardWelcome.jsx — «01 · Perfil».
//
// Paso 1 de 4: «¿Quién cobra?». Una sola pregunta.
//
// AQUÍ YA NO SE ELIGE PLAN, y es la decisión del diseñador que más cambia el
// producto. Sus palabras: «Hoy este paso pide escoger entre tres planes CON
// CERO CLIENTES EN LA APP: es adivinar, y es una pantalla de cobro puesta justo
// antes del paso que decide si el negocio se queda.» El plan pasa a después del
// primer cliente cargado, cuando ya hay con qué decidir.
//
// ⚠ PENDIENTE, y es importante: el paso del plan todavía NO se ha puesto en su
// sitio nuevo. Mientras tanto, quien elija «tengo cobradores» se queda en el
// plan por defecto de su cuenta en vez de subirlo aquí. Si empieza a chocar con
// los límites antes de que exista la pantalla nueva, hay que adelantarla.

import { useState } from 'react'

const PERFILES = [
  { id: 'solo',   titulo: 'Yo cobro',         nota: 'Manejo mi cartera directamente.' },
  { id: 'equipo', titulo: 'Tengo cobradores', nota: 'Creo sus cuentas y asigno rutas.' },
]

export default function WizardWelcome({ nombre, onSelect, onMinimize }) {
  const primerNombre = nombre ? String(nombre).trim().split(/\s+/)[0] : null
  // «19 de cada 20 cobran solos»: si la mayoría abrumadora elige una, esa va
  // marcada de entrada y el paso se contesta con un solo toque.
  const [perfil, setPerfil] = useState('solo')

  return (
    <div className="max-w-lg mx-auto flex flex-col" style={{ gap: 20 }}>
      <div>
        <h2 style={{
          fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 22, fontWeight: 600, letterSpacing: '-.02em',
          color: 'var(--cf-ink)', margin: 0, lineHeight: 1.25,
        }}>
          {primerNombre ? `${primerNombre}, vamos a cargar tu cartera` : 'Vamos a cargar tu cartera'}
        </h2>
        <p style={{ fontSize: 13.5, color: 'var(--cf-ink-2)', marginTop: 6, lineHeight: 1.45 }}>
          Tres minutos. Todo lo que crees aquí lo puedes editar o borrar después.
        </p>
      </div>

      <div>
        <span style={{
          display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: '.09em',
          textTransform: 'uppercase', color: 'var(--cf-ink-3)', marginBottom: 9,
        }}>
          ¿Quién cobra?
        </span>

        <div role="radiogroup" aria-label="¿Quién cobra?" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PERFILES.map((p) => {
            const activo = p.id === perfil
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => setPerfil(p.id)}
                style={{
                  display: 'block', width: '100%', padding: '14px 16px',
                  cursor: 'pointer', textAlign: 'left',
                  background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card)',
                  // El estado va en el borde, no tiñendo la superficie.
                  border: `1px solid ${activo ? 'var(--cf-gold-border)' : 'var(--cf-border)'}`,
                  boxShadow: activo ? '0 0 0 3px rgba(231,164,0,.12)' : 'none',
                }}
              >
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)' }}>
                  {p.titulo}
                </span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--cf-ink-3)', marginTop: 2 }}>
                  {p.nota}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* El dato que quita el miedo a equivocarse, con la salida dicha: no es
          una puerta que se cierra. */}
      <p style={{ fontSize: 12.5, color: 'var(--cf-ink-3)', margin: 0, lineHeight: 1.5 }}>
        19 de cada 20 negocios cobran solos. Si más adelante contratas, activas
        el modo equipo desde Más.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => onSelect?.(perfil)}
          style={{
            width: '100%', height: 'var(--cf-h-btn)', border: 0,
            borderRadius: 'var(--cf-r-control)', cursor: 'pointer',
            background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
            fontSize: 15, fontWeight: 700,
          }}
        >
          Continuar
        </button>
        <button
          type="button"
          onClick={onMinimize}
          style={{
            background: 'none', border: 0, cursor: 'pointer',
            fontSize: 13, color: 'var(--cf-ink-3)', textDecoration: 'underline', textUnderlineOffset: 3,
          }}
        >
          Ya conozco el sistema, saltar
        </button>
      </div>
    </div>
  )
}
