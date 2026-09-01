// lib/__tests__/bot-catalogo-vivo.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// `lib/bot-v2/producto.js` es lo único que el bot puede decir: lo que no está
// en `FUNCIONES` no existe, y lo que está en `NO_EXISTE` lo BORRA el sanitizador
// del mensaje antes de enviarlo.
//
// El 1 sep 2026 las dos listas se contradecían: `Lucas IA` estaba en FUNCIONES
// —es el argumento de venta de los planes altos— y a la vez «inteligencia
// artificial para el prestamista» estaba en NO_EXISTE. Comprobado pasando la
// frase por el sanitizador de verdad:
//
//   antes:   «Lucas es la inteligencia artificial para el prestamista que
//             responde sobre su negocio.»
//   después: «Lucas es la que responde sobre su negocio.»
//
// Salía así al cliente. Esta prueba existe para que las dos listas no vuelvan a
// contradecirse sin que nadie se entere.

import { describe, it, expect } from 'vitest'
import { FUNCIONES, NO_EXISTE } from '@/lib/bot-v2/producto'
import { sanitizar } from '@/lib/bot-v2/sanitizador'

describe('⚠ el catálogo del bot no se contradice consigo mismo', () => {
  it('nada de lo que el bot puede decir está a la vez prohibido', () => {
    /* El sanitizador borra por subcadena, así que basta con que un término
       prohibido aparezca dentro de una función para mutilar el mensaje. */
    const choques = []
    for (const f of FUNCIONES) {
      for (const p of NO_EXISTE) {
        if (f.toLowerCase().includes(p.toLowerCase())) choques.push(`«${p}» dentro de «${f.slice(0, 50)}…»`)
      }
    }
    expect(choques, `el sanitizador mutilaría estas frases:\n${choques.join('\n')}`).toEqual([])
  })

  it('y las frases de venta salen enteras del sanitizador', () => {
    /* Se prueban contra el sanitizador REAL, no contra la lista: hay guardas
       por expresión regular además de la lista literal, y una frase puede
       morir en cualquiera de las dos. */
    for (const frase of [
      'Lucas es la inteligencia artificial para el prestamista y responde sobre su negocio.',
      'Importa sus clientes desde un Excel y el sistema detecta las columnas.',
      'Exporta sus datos a Excel cuando quiera.',
      'Tiene modos de interes distintos para ajustarse a como presta.',
      'El simulador le muestra la cuota sin registrar nada.',
    ]) {
      expect(sanitizar(frase, 'hola'), `mutilada: «${frase}»`).toBe(frase)
    }
  })

  it('⚠ pero el débito bancario sigue bloqueado, porque sigue sin existir', () => {
    /* No se le toca ninguna cuenta del banco: se le cobra al medio de pago que
       el mismo cliente guardó. El bot llegó a decirle a una lead «se debita de
       tu cuenta bancaria todos los meses». */
    for (const frase of [
      'Se debita de su cuenta bancaria todos los meses.',
      'Le hacemos un debito automatico cada mes.',
    ]) {
      expect(sanitizar(frase, 'hola'), `debería bloquearse: «${frase}»`).not.toBe(frase)
    }
  })

  it('y tampoco promete la renovación mientras el cron esté apagado', () => {
    /* El cobro recurrente está construido y el cliente ya puede guardar su
       medio, pero `/api/cron/cobro-recurrente` sigue sin encenderse
       (`COBRO_RECURRENTE_ACTIVO`). Cuando se encienda, hay que relajar la
       guarda del sanitizador Y esta prueba, las dos a la vez. */
    const cron = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../app/api/cron/cobro-recurrente/route.js'), 'utf8')
    expect(cron).toMatch(/COBRO_RECURRENTE_ACTIVO === '1'/)
    expect(sanitizar('El cobro es automatico todos los meses.', 'hola')).not.toContain('automatico')
  })
})
