// lib/http/json-comprimido.js — una respuesta JSON grande, comprimida.
//
// ⚠ NEXT NO COMPRIME LO QUE DEVUELVE UN ROUTE HANDLER, aunque `compress: true`
// esté en next.config y el navegador mande `Accept-Encoding: gzip`. Medido en
// el espejo (22 oct 2026): el sync offline de PRESTA MIL salía en 13,8 MB
// crudos; comprimido son 1,4 MB. En producción eran 14,6 MB cada 90 s, y en la
// oficina del cliente eso tumbaba el ping y la app decía «Sin señal».
//
// `zlib.gzip` asíncrono corre en el pool de libuv, no en el hilo de Node: no
// frena a los demás mientras comprime.
import { gzip } from 'node:zlib'
import { promisify } from 'node:util'

const comprimir = promisify(gzip)
const MINIMO = 1024 // por debajo, comprimir cuesta más de lo que ahorra

export async function jsonComprimido(request, data, init = {}) {
  const cuerpo = JSON.stringify(data)
  const acepta = request?.headers?.get?.('accept-encoding') || ''
  const headers = { 'Content-Type': 'application/json', Vary: 'Accept-Encoding', ...(init.headers || {}) }
  if (cuerpo.length < MINIMO || !/\bgzip\b/i.test(acepta)) {
    return new Response(cuerpo, { ...init, headers })
  }
  const z = await comprimir(cuerpo, { level: 6 })
  return new Response(z, { ...init, headers: { ...headers, 'Content-Encoding': 'gzip' } })
}
