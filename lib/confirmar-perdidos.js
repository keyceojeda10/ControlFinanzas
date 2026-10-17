// lib/confirmar-perdidos.js — Prestar o renovar a un cliente en perdidos.
//
// El servidor responde 409 con `requiereConfirmar` cuando el DUEÑO intenta
// prestarle o renovarle a un cliente con un préstamo en perdidos (al cobrador
// le responde 403: no puede). Esto pregunta con la cifra que manda el servidor
// y, si confirma, vuelve a enviar con `confirmarClienteEnPerdidos`.
// (DETALLES-PRESTAMOS #17, decisión del dueño del 17 oct 2026.)
//
// `enviar(confirmado)` hace el fetch y devuelve la Response.
export async function enviarConfirmandoPerdidos(enviar, preguntar = (t) => window.confirm(t)) {
  const res = await enviar(false)
  if (res.status !== 409) return res
  const d = await res.clone().json().catch(() => ({}))
  if (!d?.requiereConfirmar) return res
  if (!preguntar(`${d.error}\n\n¿Prestarle igual?`)) return res
  return enviar(true)
}
