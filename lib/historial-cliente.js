// lib/historial-cliente.js — CUÁNTOS PRÉSTAMOS HA CERRADO CADA CLIENTE, Y CÓMO.
//
// La materia prima de la estrella. La REGLA que la convierte en color vive en
// `lib/calificacion.js`, que es JS puro y se puede probar sin base de datos;
// aquí solo está la consulta.
//
// ⚠ UNA CONSULTA AGREGADA POR ORGANIZACIÓN, NO UNA POR CLIENTE. La lista de
// clientes trae miles y una ruta hasta 322: un `include` de préstamos
// terminados por cada uno multiplicaría lo que se lee en las pantallas que más
// se abren. Agrupado sale un solo barrido sobre `Prestamo.organizationId`.
//
// ⚠ Y VIVE EN UN SOLO SITIO PORQUE SE MIRA DESDE TRES. La lista, la ficha y la
// parada de la ruta enseñan la misma estrella. Copiar el SQL en cada API es
// exactamente cómo el mismo fallo del comprobante se reportó dos días seguidos:
// se arregla un camino y se deja el otro.

import { prisma } from '@/lib/prisma'

/**
 * @param {string} organizationId
 * @returns {Promise<Map<string, {terminados:number, clavos:number, peorRetraso:number}>>}
 */
export async function historialPorCliente(organizationId) {
  if (!organizationId) return new Map()

  /* Los préstamos CERRADOS —completados y cancelados—, cuántos se dieron por
     perdidos, y el peor retraso al terminar: el último pago contra la fecha de
     fin pactada. Un préstamo cerrado sin ningún pago da `NULL` en el DATEDIFF y
     `Number(null) || 0` lo deja en 0, que es lo correcto: sin pagos no hay
     retraso que medir, y el clavo ya lo cuenta la otra columna. */
  const filas = await prisma.$queryRaw`
    SELECT p.clienteId AS clienteId,
           COUNT(*) AS terminados,
           SUM(p.esClavo = 1) AS clavos,
           MAX(DATEDIFF(
             (SELECT MAX(g.fechaPago) FROM Pago g WHERE g.prestamoId = p.id AND g.montoPagado > 0),
             p.fechaFin
           )) AS peorRetraso
    FROM Prestamo p
    WHERE p.organizationId = ${organizationId}
      AND p.estado IN ('completado', 'cancelado')
    GROUP BY p.clienteId
  `

  return new Map(filas.map((h) => [h.clienteId, {
    terminados: Number(h.terminados) || 0,
    clavos: Number(h.clavos) || 0,
    peorRetraso: Number(h.peorRetraso) || 0,
  }]))
}
