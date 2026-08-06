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

import { useState, useEffect } from 'react'
import AsistenteChat from '@/components/asistente/AsistenteChat'
import { useCabecera } from '@/components/armazon/Armazon'

export default function AsistentePage() {
  // Una llave que sube fuerza a rehacer la conversación desde cero sin que la
  // página tenga que conocer el estado interno del chat.
  const [reinicio, setReinicio] = useState(0)

  /* El scroll fantasma de 56px, apagado mientras se está aquí. Ver el porqué
     donde se monta el chat, abajo. Solo en móvil: en escritorio la pantalla
     fluye con el resto y el documento ya cuadra. */
  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth >= 1024) return
    const antes = {
      html: document.documentElement.style.overflow,
      body: document.body.style.overflow,
    }
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = antes.html
      document.body.style.overflow = antes.body
    }
  }, [])

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
       Reportado en móvil: «la barra donde se escribe sale tapada, se tapa con
       el borde de la pantalla y no se logra ver… no es estática, da mucha
       vuelta… y el contenido sale muy angosto».

       Los tres síntomas son UNA sola causa: esta pantalla se dimensionaba con
       `100dvh` como si ocupara la ventana, pero vive dentro del `<main>` del
       layout, que le añade `px-5 py-5` y arranca en y=56 con un padre
       `min-h-screen`. Medido a 393×852 antes de tocar nada:

           documento 908px en una ventana de 852   ← 56 de más
           aviso del pie   y=846 → 860             ← fuera de la pantalla
           barra           x=36, ancho 321 de 393  ← los 40 del px-5

       Por eso la barra «daba vueltas»: al ser el documento más alto que la
       ventana, rodaba la página ENTERA en vez de quedarse quieta.

       ── LA SALIDA ──
       `fixed` a la ventana en móvil. Los márgenes negativos —que fue lo primero
       que probé— quitan el relleno pero no los 56px del `min-h-screen`, y el
       documento seguía en 908. Anclándola, el alto del `<main>` deja de
       importar: el chat va de debajo de la cabecera al borde de abajo, la barra
       no se mueve y el pie entra.

       No se toca el `<main>`: lo comparten las 46 pantallas y arreglarlo ahí
       por una sola es cambiarle el suelo a todas.

       En escritorio vuelve a fluir (`lg:static`), que es donde el dueño dice que
       ya se ve bien.

       `100dvh` y no `100vh`: en el móvil, al abrir el teclado, `vh` sigue
       midiendo la pantalla completa y el campo se iría debajo del teclado.

       `max-w-3xl`: aquí no hay barra lateral ni tarjetas al costado —la pantalla
       es solo la conversación—, así que 42rem dejaba las burbujas angostas. */
    <>
      {/* ⚠ EL SCROLL FANTASMA DE 56px.
          Con el chat en `fixed`, el `<main>` se queda SIN contenido que lo
          dimensione… y su padre es `min-h-screen`, así que se estira igual a
          852 empezando en y=56: documento de 908 en una ventana de 852, y la
          página rueda 56px en vacío. Es justo el «da mucha vuelta».

          Medido: en las demás pantallas el `main` mide lo que su contenido
          (2.658 en el panel, 11.423 en clientes) y ESE scroll sí es legítimo.
          El fantasma es exclusivo de aquí.

          Probé antes con un hermano de altura cero y NO basta: `min-h-screen`
          gana igual. Se apaga el scroll del documento mientras esta pantalla
          está montada, y se restaura al salir.

          ⚠ Va por `useEffect` y no por un `<style>` en el JSX: aquel lo pintaba
          el servidor y el cliente lo volvía a montar, y React se quejaba con el
          error #418 (desajuste de hidratación). Aquí solo corre en el cliente,
          y el `return` deshace el cambio al salir de la pantalla — que era la
          otra mitad del problema. */}

      <div
        className="fixed inset-x-0 bottom-0 lg:static lg:-mx-6 lg:-my-6"
        style={{
          // `--cf-h-header`, el token de verdad. Mi primera versión inventó
          // `--cf-h-cabecera`, que no existe: el CSS lo resuelve al valor de
          // respaldo y parece funcionar, así que un nombre mal escrito aquí no
          // falla en ningún sitio — solo deja de seguir al token si este cambia.
          height: 'calc(100dvh - var(--cf-h-header, 56px) - env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="mx-auto w-full max-w-3xl h-full flex flex-col">
          <AsistenteChat key={reinicio} />
        </div>
      </div>
    </>
  )
}
