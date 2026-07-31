'use client'

// app/(dashboard)/asistente/page.jsx — la pantalla dedicada de Lucas.
//
// El título y la flecha los pone el ARMAZÓN, no la pantalla: al montar la
// cabecera de `Lucas` quedaron DOS, una encima de otra y las dos diciendo
// «Lucas». Las dos cosas útiles que llevaba —el contador del plan y «empezar de
// nuevo»— se le pasan al armazón por `acciones`, que es la ranura que existe
// justo para eso: «a la derecha van las acciones DE ESE OBJETO».
//
// Deja de ser componente de servidor y por eso se va el `metadata`: el armazón
// se registra con un hook, y un hook necesita cliente. El título de la pestaña
// lo pone el layout.

import { useState } from 'react'
import AsistenteChat from '@/components/asistente/AsistenteChat'
import { useCabecera } from '@/components/armazon/Armazon'

export default function AsistentePage() {
  // Una llave que sube fuerza a rehacer la conversación desde cero sin que la
  // página tenga que conocer el estado interno del chat.
  const [reinicio, setReinicio] = useState(0)

  useCabecera({
    titulo: 'Lucas',
    subtitulo: 'sabe todo de tu negocio',
    acciones: (
      <button
        type="button"
        onClick={() => setReinicio((n) => n + 1)}
        aria-label="Empezar de nuevo"
        title="Empezar de nuevo"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 36, minWidth: 36, height: 36, borderRadius: 11, flex: 'none',
          background: 'none', border: 0, cursor: 'pointer', color: 'var(--cf-ink-3)',
        }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
        </svg>
      </button>
    ),
  })

  return (
    <div className="min-h-screen" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-2xl mx-auto h-[calc(100vh-80px)] lg:h-[calc(100vh-40px)] flex flex-col">
        <AsistenteChat key={reinicio} />
      </div>
    </div>
  )
}
