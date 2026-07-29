'use client'
// hooks/useMontado.js
//
// Devuelve false en el servidor Y en el primer render del cliente; true después.
//
// PARA QUÉ: todo lo que depende de `useSession()` cambia entre el HTML que
// manda el servidor y el que React pinta al hidratar, porque en el servidor no
// hay sesión. Si un botón se muestra según un permiso, el servidor no lo pinta
// y el cliente sí → React tira el árbol entero y lo vuelve a pintar.
//
// Ya pasó dos veces en este rediseño: el avatar que decía «·» y luego «CA», y
// el «+» dorado de la cabecera de clientes. El truco de `typeof window` NO
// sirve: el primer render del cliente también tiene window, así que sigue
// difiriendo del servidor. Tiene que ser un efecto.

import { useEffect, useState } from 'react'

export function useMontado() {
  const [montado, setMontado] = useState(false)
  useEffect(() => { setMontado(true) }, [])
  return montado
}

export default useMontado
