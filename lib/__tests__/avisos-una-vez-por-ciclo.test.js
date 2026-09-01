// lib/__tests__/avisos-una-vez-por-ciclo.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El aviso de «tu plan vence en 3 días» y el de «tu plan venció» se decidían con
// un booleano: quien lo gastaba **no lo volvía a recibir nunca**, aunque
// renovara y volviera a vencer.
//
// Medido en producción el 1 sep 2026:
//
//   · 28 organizaciones tenían gastado el aviso de pre-vencimiento
//   · **5 de las 12 que vencían esa semana estaban silenciadas**, una de ellas
//     venciendo ese mismo día
//   · y el desequilibrio que lo delata: en cinco días salió **1** aviso de «vas
//     a vencer» y **22** de «ya venciste». Se avisaba tarde.
//
// ⚠ Esto manda mensajes a clientes reales y cuesta dinero por cada uno. Lo que
// se comprueba aquí no es que avise: es que **no pueda avisar dos veces del
// mismo vencimiento**.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const raiz = resolve(__dirname, '../..')
const sinComentarios = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|\s)\/\/[^\n]*/g, '$1 ')
const cron = sinComentarios(readFileSync(resolve(raiz, 'app/api/cron/churn-whatsapp/route.js'), 'utf8'))
const schema = readFileSync(resolve(raiz, 'prisma/schema.prisma'), 'utf8')

describe('⚠ el aviso sale una vez por ciclo, no una vez en la vida', () => {
  it('las dos fechas existen en el esquema', () => {
    expect(schema).toMatch(/waPreVencSentAt\s+DateTime\?/)
    expect(schema).toMatch(/waChurnSentAt\s+DateTime\?/)
  })

  it('quien decide es la fecha, no el booleano', () => {
    /* Con un booleano no hay forma de saber si el `true` que ves es de este
       vencimiento o de uno de hace tres meses. */
    expect(cron).toMatch(/puedeRecibir\('waPreVencSentAt'\)/)
    expect(cron).toMatch(/puedeRecibir\('waChurnSentAt'\)/)
    expect(cron).not.toMatch(/waPreVencSent: false/)
    expect(cron).not.toMatch(/waChurnSent: false/)
  })

  it('⚠ y no puede repetir dentro del mismo ciclo mensual', () => {
    /* Veinte días: no repite en el mismo ciclo y sí deja avisar en el
       siguiente. Sin esto, el cron diario le escribiría todos los días a la
       misma persona los tres días antes de vencer. */
    expect(cron).toMatch(/DIAS_ENFRIAMIENTO = 20/)
    expect(cron).toMatch(/\{ lt: desdeAviso \}/)
  })

  it('una fecha nula sí entra: es lo que desbloquea a los colgados', () => {
    /* Los que quedaron con el booleano en `true` tienen la fecha vacía, así que
       vuelven a poder recibir. Es el arreglo, no un efecto secundario. */
    expect(cron).toMatch(/OR: \[\{ \[campo\]: null \}/)
  })

  it('la fecha se escribe al enviar, no antes', () => {
    /* Si se marcara antes de mandar y el envío fallara, esa persona se quedaría
       sin aviso durante veinte días sin que nadie se entere. */
    const envioPre = cron.indexOf('TEMPLATE_PREVENC')
    const marcaPre = cron.indexOf('waPreVencSentAt: ahora')
    expect(marcaPre).toBeGreaterThan(envioPre)
    const envioVenc = cron.indexOf('TEMPLATE_VENCIDO')
    const marcaVenc = cron.indexOf('waChurnSentAt: ahora')
    expect(marcaVenc).toBeGreaterThan(envioVenc)
  })

  it('y el booleano se sigue escribiendo, porque el panel lo pinta', () => {
    expect(cron).toMatch(/waPreVencSent: true, waPreVencSentAt: ahora/)
    expect(cron).toMatch(/waChurnSent: true, waChurnSentAt: ahora/)
  })
})
