// lib/admin/buscar-organizacion.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El dueño: «mi panel de administrador no me deja encontrar los usuarios por
// número de teléfono y es muy importante». Buscó 3008875156 y le salió «0 de 0
// resultados» — con cinco usuarios que tienen ese número en producción.
//
// El comentario del código prometía lo que el código no hacía. Decía literal
// «Búsqueda por nombre de org, email de usuario o teléfono de usuario», y en el
// `OR` no había ninguna cláusula de teléfono. Un comentario que miente es peor
// que no tenerlo: al leerlo se da por resuelto lo que falta.
//
// El mismo hueco estaba en el CRM. Por eso esto vive aquí y no copiado dos
// veces: si mañana aparece una tercera pantalla que busca organizaciones, que
// use esta y no vuelva a olvidarse del teléfono.

/* Con menos de esto, un fragmento numérico devuelve media base. Seis es el
   mínimo que ya identifica a alguien. */
const MINIMO_DIGITOS = 6

/**
 * Las condiciones `OR` para buscar una organización por texto libre.
 *
 * @param {string} texto        lo que el administrador escribió
 * @param {object} opciones
 * @param {boolean} opciones.soloOwner  limitar la búsqueda de personas al dueño
 *                                      de la organización (lo que hace el CRM)
 */
export function condicionesDeBusqueda(texto, { soloOwner = false } = {}) {
  const q = String(texto ?? '').trim()
  if (!q) return []

  const persona = soloOwner ? { rol: 'owner' } : {}

  const condiciones = [
    { nombre: { contains: q } },
    { users: { some: { ...persona, email: { contains: q } } } },
    { users: { some: { ...persona, nombre: { contains: q } } } },
  ]

  /* ── EL TELÉFONO, COMO SE ESCRIBE Y COMO SE GUARDA ──────────────────────
     En producción los 407 teléfonos son dígitos puros: 401 de diez, cinco de
     doce —con el 57 delante— y uno de ocho. Pero quien busca pega lo que tiene
     a mano: «+57 300 887 5156», «(300) 8875156».

     Así que se compara por dígitos, y en las DOS direcciones:
       · escrito 3008875156 contra guardado 573008875156  → `contains` acierta
       · escrito +573008875156 contra guardado 3008875156 → NO acierta, y por
         eso se prueba también con los últimos diez. */
  const digitos = q.replace(/\D/g, '')
  if (digitos.length >= MINIMO_DIGITOS) {
    const variantes = new Set([digitos])
    if (digitos.length > 10) variantes.add(digitos.slice(-10))

    for (const v of variantes) {
      condiciones.push({ telefono: { contains: v } })
      condiciones.push({ users: { some: { ...persona, telefono: { contains: v } } } })
    }
  }

  return condiciones
}
