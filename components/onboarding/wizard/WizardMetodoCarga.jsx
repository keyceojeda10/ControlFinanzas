'use client'

// components/onboarding/wizard/WizardMetodoCarga.jsx — «03 · Método de carga».
//
// LA RAZÓN DE SER DE ESTA PANTALLA, en palabras del diseñador: «Hoy el migrador
// pregunta manual o foto EN CADA CLIENTE. Aquí se decide una vez.» Por eso el
// subtítulo lo promete en voz alta: «Eliges una vez. Después no vuelve a
// preguntar.» Si luego el flujo vuelve a preguntar, esta pantalla miente.
//
// Son TRES caminos, no dos. El asistente viejo solo ofrecía foto y manual, y
// por eso no cuadraba con la cartera vacía —que sí ofrece tres— pese a que el
// diseño dice que deben ser las mismas.

import { useState } from 'react'

const VIAS = [
  {
    id: 'foto',
    titulo: 'Foto de la cartulina',
    insignia: 'MÁS RÁPIDO',
    nota: 'Hasta 5 fotos por tanda. Se leen los datos y tú confirmas antes de crear nada.',
    accion: 'Tomar la primera foto',
    icono: <><rect x="2.5" y="6" width="19" height="14" rx="2.5" /><circle cx="12" cy="13" r="3.4" /><path d="M8 6l1.4-2h5.2L16 6" /></>,
  },
  {
    id: 'excel',
    titulo: 'Un Excel o CSV',
    nota: 'Sube el archivo que ya tengas.',
    accion: 'Elegir el archivo',
    icono: <><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" /><path d="M14 3v5h5" /><path d="M8.5 12.5h7M8.5 16h7M12 12.5V16" /></>,
  },
  {
    id: 'manual',
    titulo: 'Los escribo yo',
    nota: 'Uno por uno, a mano.',
    accion: 'Crear el primer cliente',
    icono: <><circle cx="10" cy="8" r="3.4" /><path d="M3.5 20a6.5 6.5 0 0113 0" /><path d="M18 8v6M15 11h6" /></>,
  },
]

export default function WizardMetodoCarga({ onElegir, onSaltar }) {
  // La foto viene marcada de entrada: es la que el diseño destaca con «MÁS
  // RÁPIDO» y la que convierte un cuaderno en cartera sin teclear nada.
  const [elegida, setElegida] = useState('foto')
  const via = VIAS.find((v) => v.id === elegida) ?? VIAS[0]

  return (
    <div className="max-w-lg mx-auto flex flex-col" style={{ gap: 20 }}>
      <div>
        <h2 style={{
          fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 22, fontWeight: 600, letterSpacing: '-.02em',
          color: 'var(--cf-ink)', margin: 0, lineHeight: 1.2,
        }}>
          ¿Cómo tienes tus clientes hoy?
        </h2>
        <p style={{ fontSize: 13.5, color: 'var(--cf-ink-2)', marginTop: 6, lineHeight: 1.45 }}>
          Eliges una vez. Después no vuelve a preguntar.
        </p>
      </div>

      <div role="radiogroup" aria-label="Método de carga" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {VIAS.map((v) => {
          const activa = v.id === elegida
          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={activa}
              onClick={() => setElegida(v.id)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 13, width: '100%',
                padding: '15px 16px', cursor: 'pointer', textAlign: 'left',
                background: 'var(--cf-card)',
                borderRadius: 'var(--cf-r-card)',
                // La selección va en el BORDE, no tiñendo la tarjeta: una
                // superficie de color se lee como estado del dato, y aquí el
                // dato no tiene estado — es una elección.
                border: `1px solid ${activa ? 'var(--cf-gold-border)' : 'var(--cf-border)'}`,
                boxShadow: activa ? '0 0 0 3px rgba(231,164,0,.12)' : 'none',
              }}
            >
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 40, minWidth: 40, height: 40, borderRadius: 12, flex: 'none', marginTop: 1,
                background: activa ? 'var(--cf-gold-tint)' : 'var(--cf-fill)',
                color: activa ? 'var(--cf-gold-dark)' : 'var(--cf-ink-2)',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {v.icono}
                </svg>
              </span>

              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)' }}>
                    {v.titulo}
                  </span>
                  {v.insignia && (
                    <span style={{
                      fontSize: 9.5, fontWeight: 700, letterSpacing: '.07em',
                      padding: '3px 7px', borderRadius: 999,
                      background: 'var(--cf-gold-tint)', color: 'var(--cf-gold-dark)',
                    }}>
                      {v.insignia}
                    </span>
                  )}
                </span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--cf-ink-3)', marginTop: 3, lineHeight: 1.45 }}>
                  {v.nota}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {/* La acción dorada dice lo que va a pasar, no «Continuar». */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => onElegir?.(elegida)}
          style={{
            width: '100%', height: 'var(--cf-h-btn)', cursor: 'pointer',
            borderRadius: 'var(--cf-r-control)', border: 0,
            background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
            fontSize: 15, fontWeight: 700,
          }}
        >
          {via.accion}
        </button>

        <button
          type="button"
          onClick={onSaltar}
          style={{
            background: 'none', border: 0, cursor: 'pointer',
            fontSize: 13, color: 'var(--cf-ink-3)', textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          Empezar con la cartera vacía
        </button>
      </div>
    </div>
  )
}
