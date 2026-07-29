'use client'

// components/pantallas/CarteraVacia.jsx — turno 5 · 04 «Cartera vacía».
//
// ES LA PANTALLA QUE VE EL 75% DE LAS CUENTAS ATASCADAS, así que no puede ser
// un dibujo con un texto. Los clientes cargados predicen el pago: una cuenta
// con 0 clientes convierte al 0%; una con 51-150, al 74%. Esta pantalla es el
// cuello de botella del negocio entero.
//
// Repite LOS TRES MÉTODOS DE CARGA DEL ONBOARDING, con el mismo orden y las
// mismas palabras: quien se saltó ese paso lo vuelve a tener aquí. Cambiarle el
// orden o el nombre a una de las tres obliga a aprenderlas dos veces.
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

export default function CarteraVacia({ puedeCrear = true }) {
  // Un cobrador sin permiso de crear no puede usar ninguna de las tres vías;
  // ofrecérselas es mandarlo a un error.
  const vias = puedeCrear ? VIAS : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--cf-gap-cards)', padding: '24px 0 0' }}>
      {/* Apagada: en una pantalla vacía la mascota celebrando se lee como burla. */}
      <span style={{ opacity: 0.42, filter: 'grayscale(0.35)' }}>
        <MonedaCF pose="vacia" size={92} />
      </span>

      <span style={{ textAlign: 'center', maxWidth: '34ch' }}>
        <span style={{
          display: 'block', fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 21, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)',
        }}>
          Tu cartera está vacía
        </span>
        <span style={{ display: 'block', fontSize: 13.5, color: 'var(--cf-ink-2)', lineHeight: 1.5, marginTop: 6 }}>
          Carga tus clientes y en tres minutos ves quién te debe y cuánto.
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
