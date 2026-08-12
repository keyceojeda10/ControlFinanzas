// lib/__tests__/bot-el-monologo-no-es-conversacion.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El dueño, con la captura del Telegram: un lead volvió a llenar el formulario
// y «esta vez el bot no le envió ni siquiera el hook inicial».
//
// El bot lo hizo A PROPÓSITO, y el motivo estaba escrito: no pisarle el
// historial a alguien que ya venía hablando. Pero contaba TODOS los mensajes,
// así que tomaba **su propio monólogo** por una conversación.
//
// Eliecer Anaya, el de la captura: volvió a llenar el formulario el 11 de
// agosto. Su «conversación» eran SEIS mensajes del bot y CERO suyos, el último
// del 17 de julio. Nunca escribió una palabra — y el bot se calló.
//
// MEDIDO en producción antes de tocar nada:
//   · 452 de 1.343 leads tienen «conversación» sin una sola línea suya
//   · 13 volvieron a llenar el formulario —uno CUATRO veces— y nunca
//     recibieron un saludo
//
// Cada uno es un lead pagado dos veces y dejado en silencio.
//
// La prueba no monta Prisma: comprueba la REGLA, que es lo que estaba mal.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(process.cwd(), 'lib/bot/bridge.js'), 'utf8')
const sinNotas = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/* La regla, aislada, tal como la aplica `bridge.js`. Si cambia allí y no aquí,
   la prueba de abajo lo canta. */
function seLeSaluda({ escribioElLead, horasDesdeElUltimo }, horas = 48) {
  return !(escribioElLead > 0 || horasDesdeElUltimo < horas)
}

describe('el monólogo del bot no es una conversación', () => {
  it('⚠ EL CASO DE ELIECER: 6 mensajes del bot, 0 suyos, hace 25 días → se le saluda', () => {
    expect(seLeSaluda({ escribioElLead: 0, horasDesdeElUltimo: 25 * 24 })).toBe(true)
  })

  it('si el lead SÍ escribió, no se le pisa el historial', () => {
    /* La intención original, que sigue siendo buena: a quien ya venía hablando
       no se le habla como a un desconocido. */
    expect(seLeSaluda({ escribioElLead: 1, horasDesdeElUltimo: 30 * 24 })).toBe(false)
    expect(seLeSaluda({ escribioElLead: 12, horasDesdeElUltimo: 90 * 24 })).toBe(false)
  })

  it('⚠ y no se le saluda dos veces si llenó el formulario dos veces seguidas', () => {
    /* `esRetorno` no tiene ventana de tiempo: dos formularios en la misma hora
       ya cuentan como retorno. Sin el reloj, el arreglo crearía el defecto
       contrario — dos saludos idénticos en minutos. */
    expect(seLeSaluda({ escribioElLead: 0, horasDesdeElUltimo: 0.5 })).toBe(false)
    expect(seLeSaluda({ escribioElLead: 0, horasDesdeElUltimo: 47 })).toBe(false)
    expect(seLeSaluda({ escribioElLead: 0, horasDesdeElUltimo: 49 })).toBe(true)
  })

  it('un lead completamente nuevo se saluda siempre', () => {
    expect(seLeSaluda({ escribioElLead: 0, horasDesdeElUltimo: Infinity })).toBe(true)
  })
})

describe('la regla vive en bridge.js y cuenta SOLO al lead', () => {
  it('el conteo filtra por rol lead', () => {
    expect(sinNotas).toMatch(/count\(\{\s*where:\s*\{\s*botLeadId:\s*lead\.id,\s*rol:\s*'lead'\s*\}\s*\}\)/)
  })

  it('ya NO cuenta todos los mensajes', () => {
    /* Si esto vuelve, vuelve el silencio: el bot toma su monólogo por una
       conversación. */
    expect(sinNotas).not.toMatch(/count\(\{\s*where:\s*\{\s*botLeadId:\s*lead\.id\s*\}\s*\}\)/)
  })

  it('y mira el reloj del último mensaje del bot', () => {
    expect(sinNotas).toMatch(/HORAS_PARA_VOLVER_A_SALUDAR/)
    expect(sinNotas).toMatch(/horasDesdeElUltimo/)
  })
})
