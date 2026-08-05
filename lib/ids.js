// lib/ids.js — comprobar que un identificador es texto antes de consultarlo.
//
// ── POR QUÉ EXISTE ESTE FICHERO ─────────────────────────────────────────────
//
// Los ids de este sistema son cuid guardados en columnas `varchar(191)`.
// En MariaDB, comparar una columna de TEXTO con un NÚMERO no compara textos:
// convierte cada texto a número. Y un cuid empieza por letra, así que TODOS
// valen 0. Comprobado contra la base:
//
//     SELECT id, nombre FROM Cliente WHERE id = 0 LIMIT 5
//     -> devuelve cinco clientes cualesquiera
//
// O sea que `where: { id: 0 }` no falla ni devuelve vacío: **casa con toda la
// tabla** y el `findFirst` trae la primera fila que pille.
//
// Así se coló el fallo de «quitar de la ruta»: a la pantalla de ordenar se le
// olvidó pasar el id del cliente, mandó el ÍNDICE de la parada, y el índice de
// la primera parada es 0. Quitar la primera parada desenrutaba a un cliente que
// no era, sin dar error. Quitar cualquier otra daba 404 y el aviso rojo.
//
// El `if (!id)` de toda la vida NO protege: `0` es falso, sí, pero `"0"`, `[0]`
// y cualquier número distinto de cero pasan de largo.

/** ¿Es un identificador utilizable en un `where`? Texto, y no en blanco. */
export function esId(valor) {
  return typeof valor === 'string' && valor.trim().length > 0
}

/** Lo mismo para una lista: no vacía y con todos sus elementos válidos. */
export function sonIds(valor) {
  return Array.isArray(valor) && valor.length > 0 && valor.every(esId)
}
