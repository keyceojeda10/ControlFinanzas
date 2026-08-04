'use client'

// components/pantallas/CarteraVacia.jsx — turno 5 · 04 «Cartera vacía».
//
// ES LA PANTALLA QUE VE EL 75% DE LAS CUENTAS ATASCADAS, así que no puede ser
// un dibujo con un texto. Los clientes cargados predicen el pago: una cuenta
// con 0 clientes convierte al 0%; una con 51-150, al 74%. Esta pantalla es el
// cuello de botella del negocio entero.
//
// LOS TRES MÉTODOS YA CUADRAN CON EL ASISTENTE.
//
// Este comentario decía que NO: el asistente ofrecía dos caminos —la foto y
// registrar a mano— y aquí salían tres, así que quien se saltó el onboarding
// veía después una opción que antes no existía. Se resolvió en la dirección que
// pide el diseño: el Excel se AÑADIÓ al asistente (`WizardCartulina`), no se
// quitó de aquí.
//
// Medido contra producción antes de decidir, porque una opción de más en el
// primer paso también estorba:
//   · 39 de las 56 cuentas que arrancaron cargaron 10+ clientes EN UNA HORA.
//     Se arranca en sesiones, no de a uno cuando uno se acuerda.
//   · De las 311 atascadas en ≤5 clientes, NINGUNA ha hecho una sesión así, y
//     132 llevan más de 30 días sin cargar a nadie: no van despacio, pararon.
//
// ⚠ Si se toca el orden o las palabras de las tres vías, hay que tocarlas EN
// LOS DOS SITIOS. Hay prueba que lo comprueba.
//
// La moneda va APAGADA Y DE CONTORNO. No hay nada que celebrar.

import Link from 'next/link'
import MonedaCF from '@/components/ui/MonedaCF'

const VIAS = [
  {
    id: 'foto',
    titulo: 'Foto de la cartulina',
    nota: 'La IA lee los datos por ti',
    destino: '/migrador',
    icono: <><rect x="2.5" y="6" width="19" height="14" rx="2.5" /><circle cx="12" cy="13" r="3.4" /><path d="M8 6l1.4-2h5.2L16 6" /></>,
  },
  {
    id: 'excel',
    titulo: 'Un Excel o CSV',
    nota: 'El archivo que ya tengas',
    destino: '/carga-masiva',
    // Rejilla, no una «X»: la X dentro de un documento se lee como error o
    // como «borrar», que es lo contrario de lo que hace este botón.
    icono: <><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" /><path d="M14 3v5h5" /><path d="M8.5 12.5h7M8.5 16h7M12 12.5V16" /></>,
  },
  {
    id: 'mano',
    titulo: 'Escribir el primero',
    nota: 'Un cliente a mano',
    destino: '/clientes/nuevo',
    icono: <><circle cx="10" cy="8" r="3.4" /><path d="M3.5 20a6.5 6.5 0 0113 0" /><path d="M18 8v6M15 11h6" /></>,
  },
]

/* `arrancada`: ya tiene uno o dos clientes, pero sigue lejos de una cartera.
   No es la misma pantalla —ni el mismo tono—: decirle «tu cartera está vacía» a
   quien acaba de cargar a su primer cliente es negarle lo que sí hizo. */
export default function CarteraVacia({ puedeCrear = true, arrancada = false, cuantos = 0 }) {
  // Un cobrador sin permiso de crear no puede usar ninguna de las tres vías;
  // ofrecérselas es mandarlo a un error.
  // Con la cartera arrancada se cae «escribir el primero»: ya lo escribió, y
  // seguir ofreciéndoselo es proponerle justo lo que le tiene atascado —cargar
  // de a uno—. El botón de crear a mano sigue estando en la pantalla (el FAB).
  const vias = !puedeCrear ? [] : arrancada ? VIAS.filter((v) => v.id !== 'mano') : VIAS

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 'var(--cf-gap-cards)',
      padding: arrancada ? '20px 16px' : '24px 0 0',
      ...(arrancada ? {
        background: 'var(--cf-card)',
        border: '1px solid var(--cf-border)',
        borderRadius: 'var(--cf-r-card)',
      } : null),
    }}>
      {/* La moneda solo en la vacía de verdad: quien ya cargó clientes está
          viendo su lista justo encima y no necesita una ilustración, necesita
          los botones. */}
      {!arrancada && (
        /* Apagada: en una pantalla vacía la mascota celebrando se lee como burla. */
        <span style={{ opacity: 0.42, filter: 'grayscale(0.35)' }}>
          <MonedaCF pose="vacia" size={92} />
        </span>
      )}

      <span style={{ textAlign: 'center', maxWidth: '38ch' }}>
        <span style={{
          display: 'block', fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: arrancada ? 17 : 21, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)',
        }}>
          {arrancada
            ? `Llevas ${cuantos} ${cuantos === 1 ? 'cliente' : 'clientes'}`
            : 'Tu cartera está vacía'}
        </span>
        <span style={{ display: 'block', fontSize: 13.5, color: 'var(--cf-ink-2)', lineHeight: 1.5, marginTop: 6 }}>
          {arrancada
            /* Sin cifras de conversión ni promesas: lo que le sirve es que el
               resto de la cartera se puede subir de una vez, no de a uno. */
            ? 'Sube el resto de una vez y ves toda tu cartera junta.'
            : 'Carga tus clientes y en tres minutos ves quién te debe y cuánto.'}
        </span>
      </span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 420, marginTop: 4 }}>
        {vias.map((v, i) => (
          <Link
            key={v.id}
            href={v.destino}
            style={{
              display: 'flex', alignItems: 'center', gap: 13, width: '100%', flex: 'none',
              minHeight: 68, padding: '0 16px', cursor: 'pointer', textAlign: 'left',
              background: 'var(--cf-card)',
              // La primera va destacada: es la que más gente completa, y la que
              // convierte un cuaderno en cartera sin teclear nada.
              border: `1px solid ${i === 0 ? 'var(--cf-gold-border)' : 'var(--cf-border)'}`,
              borderRadius: 'var(--cf-r-card)',
              boxShadow: i === 0 ? '0 0 0 3px rgba(231,164,0,.10)' : 'none',
            }}
          >
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 40, minWidth: 40, height: 40, borderRadius: 12, flex: 'none',
              background: i === 0 ? 'var(--cf-gold-tint)' : 'var(--cf-fill)',
              color: i === 0 ? 'var(--cf-gold-dark)' : 'var(--cf-ink-2)',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {v.icono}
              </svg>
            </span>

            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)' }}>
                {v.titulo}
              </span>
              <span style={{ display: 'block', fontSize: 12.5, color: 'var(--cf-ink-3)', marginTop: 2 }}>
                {v.nota}
              </span>
            </span>

            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-4)"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
              <path d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  )
}
