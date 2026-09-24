/* Las cuentas guardadas EN ESTE TELÉFONO. Todo va en try/catch: en modo privado,
   o con el almacenamiento lleno, `localStorage` lanza. Entonces no hay tarjetas
   y la pantalla es el formulario de siempre. */
export const CLAVE_CUENTAS = 'cf-cuentas-guardadas'

export function leerCuentasGuardadas() {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE_CUENTAS) || '[]')
    return Array.isArray(lista) ? lista.filter((c) => c && c.id && c.userId) : []
  } catch { return [] }
}

function escribir(lista) {
  try { localStorage.setItem(CLAVE_CUENTAS, JSON.stringify(lista)) } catch { /* sin almacenamiento: no se guarda */ }
}

export function guardarCuentaEnTelefono(cuenta) {
  const resto = leerCuentasGuardadas().filter((c) => c.userId !== cuenta.userId)
  escribir([cuenta, ...resto])
}

export function quitarCuentaDelTelefono(id) {
  escribir(leerCuentasGuardadas().filter((c) => c.id !== id))
}
