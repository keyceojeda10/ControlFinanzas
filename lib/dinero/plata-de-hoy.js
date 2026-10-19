/* ══ «¿CUÁNTA PLATA TIENES HOY PARA PRESTAR?» ══════════════════════════════════
 *
 * Decisión de Carlos, 18 oct 2026 (DETALLES-CARTERA #2, opción A).
 *
 * Un préstamo que se pasa del cuaderno SÍ mueve el capital: lo prestado sale y
 * lo abonado entra (cf-v1168). Una cuenta recién creada que pasa su cartera
 * queda en «En caja −$514.000» hasta que dice con cuánta plata trabaja. Y si
 * entonces anota su efectivo como «capital inicial», la caja se queda corta en
 * lo que tiene en la calle: anotar $2.000.000 dejaba la caja en $1.486.000.
 *
 * La pregunta es otra: cuánta plata tiene HOY para prestar, en efectivo y en el
 * banco. Se asienta lo que falta para que la caja diga exactamente eso, con su
 * nombre: «la plata para prestar del 18 oct ($2.000.000), más lo que ya estaba
 * en la calle ($514.000)». Las cuentas no cambian de modelo: nada que revisar
 * en borrar, editar, cancelar o renovar.
 *
 * Se pregunta mientras la caja esté en negativo y el negocio nunca haya dicho
 * con cuánta plata trabaja (ni capital inicial ni una entrada de plata). Si ya
 * lo dijo, un negativo es otra cosa —prestó más de lo que anotó— y se queda
 * como está.
 */
import { registrarMovimientoCapital } from '@/lib/capital'

export const REF_PLATA_DE_HOY = 'plata_de_hoy'

/** ¿Hay que preguntarle? Pura. */
export function faltaLaPlataDeHoy({ saldo, yaLaDijo }) {
  return Number(saldo) < 0 && !yaLaDijo
}

/** Si el negocio ya dijo alguna vez con cuánta plata trabaja. */
export async function yaDijoSuPlata(db, organizationId) {
  const n = await db.movimientoCapital.count({
    where: { organizationId, tipo: { in: ['capital_inicial', 'inyeccion'] } },
  })
  return n > 0
}

const pesos = (n) => `$${Math.round(Math.abs(n)).toLocaleString('es-CO')}`

/**
 * Deja la caja en `monto`. Dentro de una transacción, después de `asegurarCapital`.
 * @returns {Promise<{ antes: number, despues: number, asentado: number }>}
 */
export async function anotarPlataDeHoy(tx, { organizationId, monto, usuarioId, fecha }) {
  const objetivo = Math.round(Number(monto))
  if (!Number.isFinite(objetivo) || objetivo < 0) throw new Error('MONTO_INVALIDO')
  const filas = await tx.$queryRaw`SELECT id, saldo FROM Capital WHERE organizationId = ${organizationId} FOR UPDATE`
  const antes = Math.round(Number(filas?.[0]?.saldo ?? 0))
  const diferencia = objetivo - antes
  if (diferencia === 0) return { antes, despues: antes, asentado: 0 }
  const enLaCalle = antes < 0 ? ` más lo que ya estaba en la calle (${pesos(antes)})` : ''
  await registrarMovimientoCapital(tx, {
    organizationId,
    tipo: diferencia > 0 ? 'capital_inicial' : 'ajuste',
    ...(diferencia < 0 ? { direccion: 'egreso' } : {}),
    monto: Math.abs(diferencia),
    descripcion: diferencia > 0
      ? `Capital inicial: la plata para prestar del ${fecha} (${pesos(objetivo)})${enLaCalle}`
      : `Capital inicial: la plata para prestar del ${fecha} es ${pesos(objetivo)}`,
    referenciaTipo: REF_PLATA_DE_HOY,
    creadoPorId: usuarioId,
  })
  return { antes, despues: objetivo, asentado: diferencia }
}
