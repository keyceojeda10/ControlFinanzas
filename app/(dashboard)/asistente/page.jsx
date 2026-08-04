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
    /* ── LA PANTALLA ENTERA ES EL CHAT ────────────────────────────────────
       Antes: `min-h-screen` con un hijo de `h-[calc(100vh-80px)]`, o sea DOS
       alturas distintas. El 80 era a ojo —no salía de ningún token— y con la
       pastilla ya fuera sobraba, así que debajo del campo de escribir quedaba
       un hueco enorme. El dueño mandó la captura: «hay un espacio grandísimo».

       Ahora una sola caja que ocupa lo que hay, con `100dvh` en vez de `100vh`:
       en el móvil, al abrir el teclado, `vh` sigue midiendo la pantalla
       completa y el campo se va debajo del teclado. `dvh` sí encoge.

       Y `max-w-3xl` en vez de `2xl`: aquí no hay barra lateral ni tarjetas al
       costado —la pantalla es solo la conversación—, así que 42rem dejaba las
       burbujas angostas con el resto en blanco. También lo reportó. */
    <div
      className="mx-auto w-full max-w-3xl flex flex-col"
      style={{
        // `--cf-h-header`, el token de verdad. Mi primera versión inventó
        // `--cf-h-cabecera`, que no existe: el CSS lo resuelve al valor de
        // respaldo y parece funcionar, así que un nombre mal escrito aquí no
        // falla en ningún sitio — solo deja de seguir al token si este cambia.
        height: 'calc(100dvh - var(--cf-h-header, 56px) - env(safe-area-inset-bottom, 0px))',
      }}
    >
      <AsistenteChat key={reinicio} />
    </div>
  )
}
