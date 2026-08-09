'use client'

// components/onboarding/wizard/WizardPlan.jsx — «02 · Elegir plan — invertido».
//
// «El cambio de fondo del turno», en palabras del diseñador. Hoy este paso pide
// ESCOGER ENTRE TRES PLANES CON CERO CLIENTES EN LA APP: es adivinar, y es una
// pantalla de cobro puesta justo antes del paso que decide si el negocio se
// queda.
//
// Invertida, aquí no hay nada que elegir: la prueba es gratis y sin
// tarjeta, y los precios se enseñan solo como información de lo que viene. La
// acción dorada NO es «continuar», es CARGAR MI CARTERA — y el rótulo de
// progreso lo dice: «falta cargar tu cartera», porque el registro no termina
// cuando la cuenta existe, termina cuando hay datos dentro.
//
// «Pagar un plan desde ya» se queda para quien lo quiera, pero en texto: tiene
// su enlace, no manda la pantalla.

// NI UN NÚMERO ESCRITO AQUÍ. Los tramos y el límite salen de PLANES_CONFIG y de
// getPrecioPlan (lib/adaptadores/planes.js), que es lo que de verdad se cobra y
// lo que de verdad se limita.
//
// Esta pantalla llegó a decir «Hasta 20 clientes · $39.000», copiado del
// handoff. El precio era correcto; el límite real de ese plan son 150. Vendía
// el producto siete veces peor de lo que es — y a quien tiene 68 clientes en un
// cuaderno, un «hasta 20» le dice que no le van a caber.

import { tramosDePlan } from '@/lib/adaptadores/planes'
import { DIAS_PRUEBA } from '@/lib/planes'
import { useCountry } from '@/hooks/useCountry'
import { useState } from 'react'

/* ⚠ LOS PLANES SE ELIGEN AQUÍ, y no es una pantalla nueva: son las mismas
   tarjetas que ya estaban, ahora pulsables.
   El dueño: «si en cobra solo le permitimos el plan de 100 clientes y el
   usuario tiene 200, dice ah, no me va a servir». Tenía razón, y el problema
   era real: durante la prueba la cuenta nace en Inicial y el migrador corta en
   100 clientes, 1 ruta y CERO cobradores, mientras la pantalla promete «todo
   abierto».
   Yo propuse levantar los límites durante la prueba y él propuso esto. Es
   mejor: no añade una vía de excepción en los tres sitios que aplican
   límites, y el plan elegido es la señal de compra de quien va a pagar.
   ⚠ Y no regala nada al vencer: el `middleware` corta el API entero cuando la
   suscripción vence, tenga el plan que tenga. */
export default function WizardPlan({ onCargar, onPagar, hasta, perfil }) {
  const { country, formatMoney } = useCountry()
  // Quien contestó «tengo cobradores» ve la escalera desde el primer plan que
  // se los permite. Ofrecerle Inicial sería ofrecerle un plan donde lo que
  // acaba de decir que hace no se puede hacer.
  const tramos = tramosDePlan(country, (n) => formatMoney(n), 3, perfil)

  /* Preseleccionado el que le corresponde por lo que ya dijo, para que quien no
     quiera pensar no tenga que hacerlo. `equipo` arranca en el primero de SU
     escalera, que ya es el primero con cobradores. */
  const [elegido, setElegido] = useState(perfil === 'equipo' ? (tramos[0]?.id ?? 'growth') : 'starter')
  const [guardando, setGuardando] = useState(null)

  /* Se guarda al tocar, no al continuar: si se cierra el asistente a medias, la
     elección ya está hecha. El endpoint solo acepta cambios durante el
     onboarding, así que no puede colarse un cambio de plan más tarde. */
  const elegir = async (id) => {
    if (id === elegido) return
    const antes = elegido
    setElegido(id)
    setGuardando(id)
    try {
      const r = await fetch('/api/onboarding/cambiar-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: id }),
      })
      // Si el servidor no lo acepta se vuelve atrás: dejar la tarjeta marcada
      // sin que el plan haya cambiado es peor que no dejar elegir.
      if (!r.ok) setElegido(antes)
    } catch {
      setElegido(antes)
    } finally {
      setGuardando(null)
    }
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col" style={{ gap: 18 }}>
      <div>
        <h2 style={{
          fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 22, fontWeight: 600, letterSpacing: '-.02em',
          color: 'var(--cf-ink)', margin: 0, lineHeight: 1.2,
        }}>
          Empieza sin pagar nada
        </h2>
        <p style={{ fontSize: 13.5, color: 'var(--cf-ink-2)', marginTop: 6, lineHeight: 1.45 }}>
          {/* LA PRUEBA ES POR TIEMPO, NO POR CLIENTES. La frase anterior
              —«cuando pases de N clientes te decimos qué plan te sirve»— con N
              = 150 se leía como «tienes 150 clientes gratis», que NO es lo que
              vendemos. En el handoff ese N era 20 y funcionaba como empujón;
              al meterle el tope real del plan, la frase cambió de significado.
              Sustituir un número dentro de una frase puede cambiar lo que la
              frase promete. */}
          Usa la app completa {DIAS_PRUEBA} días, con todo abierto. Al terminar
          eliges plan según el tamaño de tu cartera.
        </p>
      </div>

      {/* El único momento dorado de la pantalla, y no es un botón de compra. */}
      <div style={{
        padding: '17px 19px', borderRadius: 'var(--cf-r-card)',
        background: 'var(--cf-gold-tint)', border: '1px solid var(--cf-gold-border)',
      }}>
        <span style={{
          display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em',
          padding: '3px 8px', borderRadius: 999,
          background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
        }}>
          GRATIS {DIAS_PRUEBA} DÍAS
        </span>
        <span className="cf-fig" style={{
          display: 'block', fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 34, fontWeight: 600, letterSpacing: '-.02em',
          color: 'var(--cf-ink)', marginTop: 8, lineHeight: 1.1,
        }}>
          $0
        </span>
        {hasta && (
          <span className="cf-num" style={{ display: 'block', fontSize: 12.5, color: 'var(--cf-gold-text)', marginTop: 2 }}>
            hasta el {hasta}
          </span>
        )}
        <p style={{ fontSize: 12.5, color: 'var(--cf-ink-2)', margin: '10px 0 0', lineHeight: 1.5 }}>
          Todo abierto: clientes, préstamos, rutas, cobradores, caja y reportes.
          Sin tarjeta y sin cobro automático.
        </p>
      </div>

      {/* Los precios, como INFORMACIÓN de lo que viene. Sin botón por tramo: en
          cuanto cada fila es pulsable vuelve a ser una pantalla de elegir. */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <span style={{
            fontSize: 10.5, fontWeight: 700, letterSpacing: '.09em',
            textTransform: 'uppercase', color: 'var(--cf-ink-3)',
          }}>
            Después, según tu cartera
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--cf-ink-4)' }}>al mes</span>
        </div>
        <div style={{
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
        }}>
          {tramos.map((t, i) => {
            // A quien cobra solo se le marca Crecimiento: es donde deja de
            // estar solo. No es publicidad — es enseñarle dónde está la puerta.
            const puerta = perfil !== 'equipo' && t.id === 'growth'
            const activo = t.id === elegido
            return (
            <button
              key={t.id}
              type="button"
              onClick={() => elegir(t.id)}
              aria-pressed={activo}
              style={{
              width: '100%', textAlign: 'left', font: 'inherit', cursor: 'pointer',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              gap: 12, padding: '12px 16px',
              borderTop: i ? '1px solid var(--cf-divider)' : 0,
              borderLeft: 0, borderRight: 0, borderBottom: 0,
              /* El dorado marca la SELECCIÓN, que es uno de los tres papeles que
                 tiene reservados en el sistema. La «puerta» —dónde deja de
                 cobrar solo— ya no se pinta de fondo: si lo hiciera, competiría
                 con lo elegido y habría dos filas doradas diciendo cosas
                 distintas. Se queda con su pastilla, que es la que lo explica. */
              background: activo ? 'var(--cf-gold-tint)' : 'transparent',
              opacity: guardando && guardando !== t.id ? 0.6 : 1,
              transition: 'background 160ms ease',
            }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--cf-ink)' }}>{t.texto}</span>
                  {puerta && (
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
                      padding: '2px 7px', borderRadius: 999,
                      background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }}>
                      AQUÍ YA NO COBRAS SOLO
                    </span>
                  )}
                </span>
                {/* Lo que DESBLOQUEA, que es lo que decide la compra. El techo
                    de clientes baja a la tercera línea: alguien con 60 clientes
                    puede pagar Crecimiento solo por tener un cobrador. */}
                <span style={{ display: 'block', fontSize: 12, color: 'var(--cf-ink-2)', marginTop: 1 }}>
                  {t.desbloquea}
                </span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--cf-ink-4)', marginTop: 1 }}>
                  {t.techo}
                </span>
              </span>
              <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 9 }}>
                <span className="cf-fig" style={{ fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)' }}>
                  {t.precio}
                </span>
                {/* El visto va DIBUJADO y siempre ocupa su sitio, marcado o no:
                    si apareciera y desapareciera, el precio bailaría a cada
                    toque. */}
                <span aria-hidden style={{
                  width: 20, height: 20, borderRadius: 999, flex: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: activo ? 'var(--cf-gold)' : 'transparent',
                  border: activo ? 0 : '1.5px solid var(--cf-border-strong)',
                }}>
                  {activo && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                      stroke="var(--cf-gold-ink)" strokeWidth="3.5"
                      strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </span>
              </span>
            </button>
            )
          })}
        </div>
      </div>

      {/* La frase que quita la presión: el límite no corta el negocio. */}
      <p style={{ fontSize: 12.5, color: 'var(--cf-ink-3)', margin: 0, lineHeight: 1.5 }}>
        No tienes que elegir ahora. Cuando llegues al límite te avisamos y sigues
        cobrando igual.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <button type="button" onClick={onCargar} style={{
          width: '100%', height: 'var(--cf-h-btn)', border: 0,
          borderRadius: 'var(--cf-r-control)', cursor: 'pointer',
          background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
          fontSize: 15, fontWeight: 700,
        }}>
          Cargar mi cartera
        </button>
        <button type="button" onClick={onPagar} style={{
          background: 'none', border: 0, cursor: 'pointer',
          fontSize: 13, color: 'var(--cf-ink-3)', textDecoration: 'underline', textUnderlineOffset: 3,
        }}>
          Pagar un plan desde ya
        </button>
      </div>
    </div>
  )
}
