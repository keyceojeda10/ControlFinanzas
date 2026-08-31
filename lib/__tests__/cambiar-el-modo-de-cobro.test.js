// lib/__tests__/cambiar-el-modo-de-cobro.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Un prestamista, por WhatsApp, el 31 ago 2026:
//
//   «Una persona tiene un préstamo con el modo "Globo", o sea paga solo
//    intereses. Pero este cliente ha decidido comenzar a pagar por cuotas e
//    interés a la vez. O sea "modo banco, intereses sobre saldos".
//    La pregunta es si desde ahí donde está creado puedo hacerles el cambio.»
//
// Y al día siguiente, resignado:
//
//   «Si algún día pudieras le pediría que yo pudiera coger el capital de la
//    persona y solo cambiar el modo.»
//
// No se puede cambiar sobre el préstamo VIVO: el mismo % vale cosas distintas
// en cada modo —entre el más caro y el más barato hay 6,6x— y los pagos ya
// hechos se repartieron con la regla vieja.
//
// Pero «coger el capital y solo cambiar el modo» es EXACTAMENTE lo que ya hacía
// renovar. Lo único que faltaba era poder elegir el modo, y una puerta que se
// llamara así.
//
// ⚠ SE MIRA EL CÓDIGO, NO LOS COMENTARIOS: este fichero cita los patrones
// viejos, y una búsqueda ingenua los encontraría aquí mismo.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const raiz = resolve(__dirname, '../..')
const quitarComentarios = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|\s)\/\/[^\n]*/g, '$1 ')

const hoja    = quitarComentarios(readFileSync(resolve(raiz, 'components/prestamos/RenovarPrestamo.jsx'), 'utf8'))
const pantalla= quitarComentarios(readFileSync(resolve(raiz, 'components/pantallas/Renovar.jsx'), 'utf8'))
const pagina  = quitarComentarios(readFileSync(resolve(raiz, 'app/(dashboard)/prestamos/[id]/page.jsx'), 'utf8'))
const api     = quitarComentarios(readFileSync(resolve(raiz, 'app/api/prestamos/[id]/renovar/route.js'), 'utf8'))

describe('⚠ el modo del préstamo nuevo se puede elegir', () => {
  it('la hoja manda el modo ELEGIDO, no el heredado a la fuerza', () => {
    /* EL FALLO EXACTO: la API ya aceptaba `modoInteres` —y en producción ya hay
       40 renovaciones que cambiaron de modo— pero la pantalla lo clavaba en
       `modoHeredado` y nunca ofrecía elegir. */
    expect(hoja).toMatch(/const \[modo, setModo\] = useState\(modoHeredado\)/)

    // el cuerpo del POST
    const i = hoja.indexOf('/renovar`')
    expect(i).toBeGreaterThan(-1)
    const cuerpo = hoja.slice(i, i + 1400)
    expect(cuerpo).toMatch(/modoInteres:\s+\(cuotaManualActiva[^)]*\) \? 'manual' : modo,/)
    expect(cuerpo).not.toMatch(/: modoHeredado,/)
  })

  it('y la API lo acepta de verdad (no era una pantalla mintiendo)', () => {
    expect(api).toMatch(/const modoRenovacion = \[[^\]]*'saldo'[^\]]*\]\.includes\(modoInteres\)/)
    expect(api).toMatch(/modoInteres: modoRenovacion/)
  })

  it('«interés por adelantado» sigue al modo NUEVO, no al viejo', () => {
    /* Es un ajuste propio del Globo. Arrastrarlo a un préstamo que ya no es
       Globo metería una bandera que ese modo no sabe leer. */
    const i = hoja.indexOf('/renovar`')
    const cuerpo = hoja.slice(i, i + 1400)
    expect(cuerpo).toMatch(/modo === 'solo_interes' && prestamoAnterior\?\.interesAdelantado/)
  })

  it('el selector es el canónico, no una lista nueva', () => {
    /* `ModoInteresSelector` es el único sitio que dice QUÉ SIGNIFICA el % en
       cada modo —«por mes», «de todo el préstamo», «por cada cobro»— y esa
       frase es la que evita el error de 6,6x. Una segunda lista aquí se
       desincronizaría el día que se toque un modo. */
    expect(hoja).toMatch(/import ModoInteresSelector from '@\/components\/prestamos\/ModoInteresSelector'/)
    expect(hoja).toMatch(/<ModoInteresSelector/)
  })
})

describe('⚠ cambiar el modo no mueve un peso', () => {
  it('la hoja arranca con el CAPITAL puesto, no con el total a pagar', () => {
    /* La diferencia no es cosmética. En un Globo con plazo el `totalAPagar`
       trae TODO el interés futuro desde el día uno: hay un préstamo real de
       $60.000.000 de capital cuyo total a pagar son $206.880.000. Arrancar por
       el total convertiría ese capital en 206 millones y cobraría interés sobre
       un interés que nunca corrió.

       `saldo` ya prefiere `capitalRestante` cuando existe; esto comprueba que
       el prellenado usa ESA cifra. */
    expect(hoja).toMatch(/const saldo = capitalRestante != null \? Math\.max\(0, Number\(capitalRestante\)\) : saldoTotal/)
    expect(hoja).toMatch(/if \(soloModo && saldo > 0\) \{ setMontoTecleado\(null\); setMonto\(String\(Math\.round\(saldo\)\)\) \}/)
  })

  it('el botón no dice «entregar $0»', () => {
    /* Renovando por lo justo del saldo no sale un peso, y el botón anunciaba
       una entrega de cero. */
    expect(hoja).toMatch(/entrega=\{montoNum > 0 && enMano > 0 \? formatMoney\(enMano\) : null\}/)
    expect(hoja).toMatch(/botonTexto=\{soloModo \? 'Cambiar el modo de cobro' : undefined\}/)
    expect(pantalla).toMatch(/botonTexto \?\? \(entrega \?/)
  })

  it('los atajos de «préstale más» no salen aquí', () => {
    /* «+ $500.000» y «El doble» contestan otra pregunta. */
    expect(hoja).toMatch(/atajos=\{saldo > 0 && !soloModo \?/)
  })

  it('avisa cuando el interés ya causado se vuelve capital', () => {
    /* En un Globo ABIERTO no hay tabla, así que se arrastra el saldo: capital
       más el interés que YA corrió y no se pagó. Ese interés pasa a ser capital
       del nuevo y desde ahí genera interés él también. Es correcto, pero hay
       que decirlo antes de pulsar, no descubrirlo después. */
    const i = hoja.indexOf('capitalRestante == null && saldoTotal > 0')
    expect(i).toBeGreaterThan(-1)
    expect(hoja.slice(i, i + 400)).toMatch(/queda como capital/)
  })
})

describe('⚠ la puerta se llama por lo que hace', () => {
  it('hay una fila «Cambiar el modo de cobro» en Gestión', () => {
    /* El motor ya existía, pero detrás de una fila que dice «Renovar el
       préstamo». Nadie que quiera cambiar el modo entra ahí — es el mismo error
       que ya costó dos veces: la función existe, se llama de otra cosa, y el
       cliente jura que no está. */
    const i = pagina.indexOf("id: 'cambiar-modo'")
    expect(i).toBeGreaterThan(-1)
    const fila = pagina.slice(i, i + 260)
    expect(fila).toMatch(/nombre: 'Cambiar el modo de cobro'/)
    expect(fila).toMatch(/setModalCambiarModo\(true\)/)
  })

  it('y enseña el modo de AHORA a la derecha', () => {
    /* La mitad de la pregunta es en qué modo está. El resto de filas de esa
       hoja ya traen su valor actual. */
    const i = pagina.indexOf("id: 'cambiar-modo'")
    expect(pagina.slice(i, i + 260)).toMatch(/valor: etiquetaModo\(prestamo\?\.modoInteres\)/)
    expect(pagina).toMatch(/import \{ etiquetaModo \}\s+from '@\/lib\/dinero\/modos'/)
  })

  it('solo en préstamos vivos', () => {
    /* Cambiar el modo de uno completado o cancelado no significa nada, y
       renovar los rechaza igualmente en el servidor. */
    const i = pagina.indexOf("id: 'cambiar-modo'")
    const antes = pagina.slice(Math.max(0, i - 200), i)
    expect(antes).toMatch(/estaActivo && !completado/)
    expect(api).toMatch(/original\.estado !== 'activo'/)
  })

  it('abre la misma hoja, con su propio estado', () => {
    /* Dos instancias y no una compartida: cada una tiene su formulario, y
       compartirlo dejaría el total de una metido en la otra. */
    expect(pagina).toMatch(/soloModo\s*\n\s*open=\{modalCambiarModo\}/)
    expect(pagina).toMatch(/open=\{modalRenovar\}/)
  })
})
