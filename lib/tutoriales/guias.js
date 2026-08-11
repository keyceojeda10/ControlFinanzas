// lib/tutoriales/guias.js — encontrar la guía que contesta lo que se escribió.
//
// ══ POR QUÉ ═══════════════════════════════════════════════════════════════
//
// El dueño, con capturas de las dos mitades del problema:
//
//   «dentro del préstamo, si alguien quiere saber cómo renovar con un tutorial,
//    no va a poder porque no sale. Sale la opción rápida de que lo lleva a
//    renovar el préstamo, pero no le explica cómo.»
//
//   «en el buscador general yo puse instalar y me sale cómo instalar la app.
//    Ahí sí me explica, pero me manda al apartado de tutoriales. […] yo quería
//    que en un modal, ahí mismo sin moverse para ningún otro lado.»
//
// O sea: las 34 guías existen y están escritas, pero solo las conocía el
// buscador general, y encima las servía MANDANDO a `/tutoriales`, que es una
// pantalla que él da por muerta.
//
// ⚠ AQUÍ NO HAY REACT, igual que en `lib/acciones/registro.js` y por la misma
// razón: las pruebas corren en `environment: 'node'` y un `.js` con JSX dentro
// ni se transforma. El emparejador —que es lo que hay que poder probar frase a
// frase— se queda limpio.

import { TUTORIALES } from '@/lib/tutorialesData'
import { buscarAcciones } from '@/lib/acciones/registro'

/* Las guías se buscan con EL MISMO emparejador que las acciones, y no con uno
   propio. Dos buscadores es como se acaba con dos comportamientos distintos
   para la misma frase: «cómo renovo» encontraría la acción y no la guía, o al
   revés, y nadie sabría por qué. */
const COMO_ACCIONES = TUTORIALES.map((t) => ({
  id: t.id,
  label: t.title,
  pista: 'Cómo se hace',
  sinonimos: t.keywords || [],
}))

const POR_ID = new Map(TUTORIALES.map((t) => [t.id, t]))

export function guiaPorId(id) {
  return POR_ID.get(String(id ?? '').replace(/^tut-/, '')) ?? null
}

/**
 * Las guías que contestan a `texto`, en orden de acierto.
 *
 * ⚠ DOS, no cinco. Van SIEMPRE detrás de las acciones —primero hacer, después
 * aprender a hacerlo— y con más de dos empujan la acción fuera de la vista en
 * un teléfono, que es justo invertir la prioridad.
 */
export function buscarGuias(texto = '', limite = 2, acciones = []) {
  const halladas = buscarAcciones(COMO_ACCIONES, texto, Math.max(limite, 6))
    .map((a) => POR_ID.get(a.id))
    .filter(Boolean)

  /* ── ⚠ LAS DE ESTA PANTALLA, PRIMERO ────────────────────────────────────
     El dueño lo preguntó, y con razón: «estoy en el préstamo y desde ahí puedo
     preguntar cómo modificar una ruta. No sé si corresponde».
     Corresponde: una duda es una duda estés donde estés, y el alternativo es
     que no encuentre la respuesta y escriba por WhatsApp — que es justo lo que
     esta caja viene a evitar. Las ACCIONES sí son solo de aquí, porque solo
     aquí pueden funcionar; una explicación no tiene ese límite.
     Lo que sí se arregla es el ORDEN: si la guía termina en un botón que existe
     en esta pantalla, va delante. Así «cobrar» dentro de un préstamo enseña
     antes lo del préstamo que lo de la ruta. */
  const deAqui = (g) => (accionDeGuia(g, acciones) ? 0 : 1)
  return halladas
    .map((g, i) => ({ g, i }))
    .sort((a, b) => deAqui(a.g) - deAqui(b.g) || a.i - b.i)
    .slice(0, limite)
    .map((x) => x.g)
}

/**
 * La acción de ESTA pantalla en la que termina la guía.
 *
 * ══ LA REGLA ═════════════════════════════════════════════════════════════
 *
 * «Dentro de ese mismo modal, que esté la explicación y que al final lo mande a
 * renovar el préstamo.» Leer cómo se renueva y quedarse mirando la explicación
 * obliga a cerrar, acordarse del camino y volver a buscarlo.
 *
 * `guia.accion` es el id —o la lista de ids— de la acción registrada. Lista
 * porque la misma guía termina en sitios distintos según dónde estés: «Cómo
 * hacer el cierre de caja» acaba en `ruta-caja` si estás en una ruta y en
 * `caja-ajuste` si estás en la caja. Gana la primera que esté disponible.
 *
 * Si no hay ninguna —porque la guía se lee desde otra pantalla— se devuelve
 * `null` y el modal se cae a `guia.destino`, que es un enlace normal.
 */
export function accionDeGuia(guia, acciones = []) {
  if (!guia?.accion) return null
  const quiere = Array.isArray(guia.accion) ? guia.accion : [guia.accion]
  for (const id of quiere) {
    const a = acciones.find((x) => x.id === id && x.disponible !== false)
    if (a) return a
  }
  return null
}
