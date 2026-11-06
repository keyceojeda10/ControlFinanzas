// lib/tarjeta/reclamo.js — lo que se acepta de «pagué y no aparece», y lo que se anotó ese día.

const DIAS_ATRAS = 90
const MONTO_MAXIMO = 1e12

/** El día de hoy (YYYY-MM-DD) en el país del negocio. */
export function hoyEnElPais(offsetHoras, ahora = Date.now()) {
  return new Date(ahora + offsetHoras * 3600000).toISOString().slice(0, 10)
}

/**
 * Viene de una página pública: no se confía en nada. La fecha se guarda a las 12:00 UTC
 * y se lee como día de calendario (`formatFechaCalendario`, en UTC): no cambia de día
 * en ningún país.
 */
export function validarReclamo(body, { offsetHoras = -5, ahora = Date.now() } = {}) {
  if (!body || typeof body !== 'object') return { error: 'Revisa los datos.' }

  let monto = null
  if (body.monto != null && body.monto !== '') {
    monto = Math.round(Number(body.monto))
    if (!Number.isFinite(monto) || monto <= 0 || monto > MONTO_MAXIMO) return { error: 'Revisa el valor que pagaste.' }
  }

  const dia = String(body.fecha ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return { error: 'Elige el día en que pagaste.' }
  const fecha = new Date(`${dia}T12:00:00.000Z`)
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== dia) return { error: 'Elige el día en que pagaste.' }
  if (dia > hoyEnElPais(offsetHoras, ahora)) return { error: 'Ese día todavía no ha pasado.' }
  if (ahora - fecha.getTime() > DIAS_ATRAS * 86400000) return { error: 'Ese día es muy antiguo. Háblalo directamente con quien te prestó.' }

  const nota = body.nota == null ? null
    : (String(body.nota).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 200) || null)

  return { monto, fecha, nota }
}

/** El tramo [desde, hasta) en UTC de ese día de calendario, en el país del negocio. */
export function tramoDelDia(fecha, offsetHoras) {
  const dia = new Date(fecha).toISOString().slice(0, 10)
  const desde = new Date(new Date(`${dia}T00:00:00.000Z`).getTime() - offsetHoras * 3600000)
  return { desde, hasta: new Date(desde.getTime() + 86400000) }
}
