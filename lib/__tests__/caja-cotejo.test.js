// lib/__tests__/caja-cotejo.test.js
//
// T06-01 «Caja del día». El pie: «la formula deja de ser cinco mosaicos de
// colores y se lee como un extracto: cada linea con su signo y el saldo abajo,
// en grande. Verde suma, rojo resta — el color por fin significa algo».

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const leer = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const caja = leer('components/pantallas/Caja.jsx')
const pagina = leer('app/(dashboard)/caja/page.jsx')

describe('el extracto', () => {
  it('el color lo pone el SIGNO, no la marca', () => {
    // En los mosaicos «prestado» iba en ambar y «gastos» en rojo siendo las dos
    // restas, y «base inicial» en azul siendo un punto de partida: cinco colores
    // para dos operaciones.
    expect(caja).toMatch(/signo === '\+' \? 'var\(--cf-green-dark\)'/)
    expect(caja).toMatch(/signo === '−' \? 'var\(--cf-red-dark\)'/)
  })

  it('NO lleva separadores entre lineas', () => {
    // Cinco lineas de UNA MISMA cuenta. Una raya entre cada dos las convierte en
    // cinco cosas distintas.
    const linea = caja.slice(caja.indexOf('function LineaExtracto'), caja.indexOf('export function CajaDia'))
    expect(linea).not.toMatch(/borderTop/)
  })

  it('la unica raya es la del saldo, y es mas gruesa', () => {
    // Es la del subtotal de un extracto hecho a mano: la unica que separa algo.
    expect(caja).toMatch(/borderTop: '1\.5px solid rgba\(20,20,28,\.14\)'/)
  })

  it('el saldo va SOBRE BLANCO, no en un bloque oscuro', () => {
    // El bloque negro era una invencion mia. La receta §2 reserva el bloque
    // oscuro para «una cifra que es LA RESPUESTA»; aca el saldo es la ULTIMA
    // LINEA DE UNA CUENTA, y lo que la hace creible es verla salir de las cinco
    // lineas de arriba.
    const bloque = caja.slice(caja.indexOf('Saldo en caja') - 900, caja.indexOf('Saldo en caja') + 400)
    expect(bloque).not.toMatch(/background: '#15161A'/)
    expect(caja).toMatch(/fontSize: 30, letterSpacing: '-\.03em', color: 'var\(--cf-ink\)'/)
  })

  it('dice «disponible para prestar», que no es lo mismo que el saldo', () => {
    expect(caja).toMatch(/disponible para prestar/)
  })
})

describe('los movimientos', () => {
  it('llevan el punto de color, que faltaba', () => {
    // Dice si suma o resta ANTES de leer el monto, y con catorce filas eso es la
    // diferencia entre recorrer la lista y leerla.
    expect(caja).toMatch(/width: 7, height: 7, borderRadius: 999, flex: 'none',\s*\n\s*background: m\.entra/)
  })

  it('el detalle lleva la HORA y el QUIEN', () => {
    // El pie de la lamina dice que hoy estan «escondidos tras un desplegable de
    // cobradores». Sin quien ni cuando, un movimiento solo se puede creer.
    expect(pagina).toMatch(/toLocaleTimeString\('es-CO'/)
    expect(pagina).toMatch(/const quien = p\.cobradorNombre/)
  })
})

describe('los cinco mosaicos ya no estan', () => {
  it('CajaResumen ya no existe: ni en «hoy» ni en el rango', () => {
    // Esta prueba decia que quedaba UN <CajaResumen> «y esta bien que quede: es
    // la vista de RANGO, que T06-01 no cubre — su lamina es de Hoy… va en la
    // tarea del bloque 6». Esa tarea es esta.
    //
    // El fallo que destapo: el extracto estaba condicionado a
    // `periodo.modo === 'hoy'`, asi que al pulsar «7 dias» reaparecia el diseño
    // viejo ENTERO —degradado, orbe y cinco mosaicos—. Reportado con captura:
    // «me sale con el diseño viejo».
    //
    // Se cuenta SOBRE LAS LINEAS DE CODIGO, saltando los comentarios: los que
    // explican QUE se sustituyo nombran «CajaResumen» y se cazaban a si mismos.
    // Sexta vez en esta sesion que la prosa dispara una asercion de texto.
    const codigo = pagina
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n')
    expect(codigo.match(/<CajaResumen/g) ?? []).toHaveLength(0)
    expect(codigo).not.toMatch(/^import CajaResumen/m)
  })

  it('el extracto se pinta en las DOS ramas', () => {
    // Una por «hoy» y otra por el rango. Si solo hubiera una, es que el rango
    // se volvio a quedar sin rediseñar.
    const codigo = pagina
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n')
    expect((codigo.match(/<CajaDia/g) ?? []).length).toBeGreaterThanOrEqual(2)
    /* ⚠ Esto exigía `fecha={fechaLarga}` a secas, y con la pastilla nueva del
       filtro (E01) la fecha pasó a mandarse SOLO cuando el periodo no es un día
       suelto: si no, «miércoles, 5 de agosto» salía tres veces en la misma
       pantalla. Lo que la prueba defiende —que la cabecera reciba su fecha—
       sigue igual; lo que cambió es cuándo. */
    expect(pagina).toMatch(/fecha=\{periodo\.modo === 'hoy' \? null : fechaLarga\}/)
  })

  it('el periodo NO finge una apertura', () => {
    // En un dia, «con lo que amaneciste» es el saldo con el que se empieza. En
    // un rango de siete no significa nada —¿el de cual de los siete?—. Por eso
    // el bloque del periodo construye sus lineas a mano en vez de reusar
    // `lineasDeLaBanda`, que siempre antepone la apertura.
    // ⚠ SOBRE EL CODIGO, sin comentarios: el comentario que explica por que NO
    // se usa `lineasDeLaBanda` la nombra, y la prueba se cazaba a si misma.
    // Septima vez en esta sesion — y esta misma prueba ya lo advertia dos
    // bloques mas arriba.
    // El filtro por linea NO sirve aqui: mi comentario es un `{/* */}` de JSX
    // de varias lineas, y sus renglones de en medio no empiezan por `//`.
    const codigo = pagina.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    const rango = codigo.slice(codigo.indexOf("periodo.modo !== 'hoy'"))
    const hastaElExtracto = rango.slice(0, rango.indexOf('<DesgloseMetodoPago'))
    expect(hastaElExtracto).toContain("id: 'recaudo'")
    expect(hastaElExtracto).not.toContain("id: 'apertura'")
    expect(hastaElExtracto).not.toContain('lineasDeLaBanda')
  })
})

describe('ningun control muerto', () => {
  it('«Ver detalle» solo se pinta si hay a donde ir', () => {
    // El desplegable que abria vivia DENTRO del bloque que se sustituyo, y el
    // extracto ya ES ese detalle. Un boton que abriera lo que se esta mirando es
    // ruido; uno que no abre nada es el patron que ya costo cinco esta sesion.
    expect(caja).toMatch(/\{onDetalle && \(/)
    expect(pagina).not.toMatch(/onDetalle=\{/)
  })

  it('«Cerrar el dia» lleva al formulario que YA existe en la pantalla', () => {
    // No se inventa un modal nuevo.
    expect(pagina).toMatch(/id="cf-cierre-del-dia"/)
    expect(pagina).toMatch(/getElementById\('cf-cierre-del-dia'\)/)
  })

  it('«Registrar gasto» solo si tiene permiso', () => {
    expect(pagina).toMatch(/onGasto=\{puedeReportarGastos \? \(\) => setShowGasto\(true\) : undefined\}/)
  })
})
