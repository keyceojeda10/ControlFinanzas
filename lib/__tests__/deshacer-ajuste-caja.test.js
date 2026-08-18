// lib/__tests__/deshacer-ajuste-caja.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Un cliente se fue el 16 de agosto de 2026 por esto.
//
// Registró la cicla de su mamá como GASTO del negocio, vio que la caja no
// cerraba y —para cuadrarla— metió un ajuste manual de +$282.000. Después le
// borramos el gasto, y borrar un gasto asienta su propio reverso de +$282.000.
// Con los dos, su caja pasó a decir $1.564.000 teniendo $1.282.000.
//
// Se le contestó: «puedes borrar los ajustes manuales que fuiste metiendo esta
// mañana, ya no hacen falta».
//
// ⚠ ESO NO SE PODÍA HACER. `app/api/caja/ajustes/route.js` solo tenía `POST`.
// Él contestó «entiendo hermano, pero sigue lo mismo», mandó otra captura con
// la misma cifra mal, y esa noche escribió «mano ya no voy a seguir con el
// sistema».
//
// Comprobado además contra el espejo de punta a punta: meter, ver, deshacer,
// que no se pueda deshacer dos veces, y que deje de ofrecerse.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
const ajustes = leer('app/api/caja/ajustes/route.js')
const caja = leer('app/api/caja/route.js')
const pantalla = leer('components/pantallas/Caja.jsx')
const pagina = leer('app/(dashboard)/caja/page.jsx')

describe('⚠ un ajuste metido a mano se puede deshacer', () => {
  it('el API tiene por dónde', () => {
    expect(ajustes, 'sigue existiendo solo POST').toMatch(/export async function DELETE/)
  })

  it('se asienta un reverso, no se borra el renglón', () => {
    /* `MovimientoCapital` es el libro. Borrar reescribe la historia y deja al
       prestamista sin poder explicar por qué cambió su saldo — que es justo lo
       que hace que deje de creerle a la pantalla. El borrado de gastos ya lo
       hace así. */
    const d = ajustes.slice(ajustes.indexOf('export async function DELETE'))
    expect(d).toMatch(/registrarMovimientoManualCapital/)
    expect(d, 'borra el asiento en vez de compensarlo').not.toMatch(/movimientoCapital\.delete/)
  })

  it('la dirección se LEE del asiento, no se supone', () => {
    /* Un `ajuste` puede ir en las dos direcciones y el tipo no lo dice: se
       compara el saldo de antes con el de después. */
    const d = ajustes.slice(ajustes.indexOf('export async function DELETE'))
    expect(d).toMatch(/mov\.saldoNuevo > mov\.saldoAnterior/)
  })

  it('dos toques no restan dos veces', () => {
    /* Un botón pulsado dos veces con una red lenta descuadraría la caja al
       revés, y esta vez sin que nadie sepa por qué. */
    const d = ajustes.slice(ajustes.indexOf('export async function DELETE'))
    expect(d).toMatch(/ya estaba deshecho/)
  })

  it('el reverso cae en el día del original, no en hoy', () => {
    /* Si cayera hoy, la caja de aquel día seguiría descuadrada para siempre en
       los informes y el prestamista vería un agujero en una fecha ya cerrada. */
    const d = ajustes.slice(ajustes.indexOf('export async function DELETE'))
    expect(d).toMatch(/createdAt: mov\.createdAt/)
  })

  it('⚠ SOLO se deshace lo que esta pantalla creó', () => {
    /* Un recaudo, un desembolso o un gasto tienen su propia pantalla y sus
       propias consecuencias —la deuda del cliente, la cartera—. Dejarlos aquí
       sería una puerta trasera para mover plata sin tocar lo que representa. */
    expect(ajustes).toMatch(/const DESHACIBLES = \['caja_ajuste', 'caja_capital_manual'\]/)
    const d = ajustes.slice(ajustes.indexOf('export async function DELETE'))
    expect(d).toMatch(/DESHACIBLES\.includes\(mov\.referenciaTipo\)/)
  })

  it('y solo el dueño', () => {
    const d = ajustes.slice(ajustes.indexOf('export async function DELETE'))
    expect(d).toMatch(/rol !== 'owner'/)
  })
})

describe('⚠ la pantalla se los enseña', () => {
  it('el API de caja manda el `id` de cada asiento', () => {
    /* Sin el `id` la pantalla no puede ni nombrarlos, y «bórralos» vuelve a ser
       un consejo imposible. */
    const sel = caja.slice(caja.indexOf('const movimientosDia = await prisma.movimientoCapital.findMany'))
    expect(sel.slice(0, 900)).toMatch(/id: true/)
  })

  it('y la lista de los que se metieron a mano', () => {
    expect(caja).toMatch(/const ajustesManuales = movimientosDia/)
    expect(caja).toMatch(/ajustesManuales,/)
  })

  it('los ya deshechos no se ofrecen otra vez', () => {
    /* Se cancelan entre ellos: enseñarlos sería invitar a restar dos veces. */
    expect(caja).toMatch(/yaDeshechos/)
    expect(caja).toMatch(/caja_ajuste_reverso/)
  })

  it('la tarjeta de caja los pinta con su botón', () => {
    expect(pantalla).toMatch(/ajustesManuales\?\.length > 0/)
    expect(pantalla).toMatch(/onDeshacerAjuste/)
    expect(pantalla).toMatch(/Deshacer/)
  })

  it('y la página se los pasa DE VERDAD', () => {
    /* El fallo del selector de cuenta al renovar: el componente estaba puesto y
       nadie le pasaba los datos, así que se guardaba invisible.
       ⚠ Va en `stats.dia`, no en la raíz: ahí me equivoqué la primera vez. */
    expect(pagina).toMatch(/ajustesManuales=\{\(stats\.ajustesManuales/)
    expect(pagina).toMatch(/onDeshacerAjuste=\{/)
    expect(pagina).toMatch(/method: 'DELETE'/)
  })
})

describe('⚠ con la caja en negativo se puede METER plata', () => {
  const capital = leer('lib/capital.js')

  it('la guarda solo frena las salidas', () => {
    /* Antes bloqueaba cualquier movimiento que dejara el saldo bajo cero, y eso
       incluye las ENTRADAS: con la caja ya en rojo, meter plata devolvía «saldo
       insuficiente». La única operación capaz de arreglarlo era la que no se
       dejaba hacer.

       Medido en producción: 112 de 344 negocios (33%) tienen la caja en
       negativo, y 111 con préstamos activos. No es un caso raro. */
    expect(capital).toMatch(/!permitirNegativo && !esIngreso && saldoNuevo < 0/)
  })

  it('pero sacar lo que no hay sigue prohibido', () => {
    expect(capital).toMatch(/No hay saldo suficiente en caja para sacar esa cantidad/)
  })
})
