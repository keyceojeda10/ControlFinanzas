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
  it('CajaResumen no se monta en la caja del DIA', () => {
    // Queda UN <CajaResumen> en la pagina, y esta bien que quede: es la vista de
    // RANGO (7d / 30d / personalizado), que T06-01 no cubre — su lamina es de
    // «Hoy». Rehacerla sin lamina seria inventar, que es justo lo que hundio el
    // primer intento. Va en la tarea del bloque 6 (T06 completo).
    //
    // Se comprueba por POSICION, no cortando el archivo: las dos ramas no estan
    // en el orden que uno supone —«cuadre» va en medio— y un `slice` con anclas
    // mal elegidas sale vacio y la prueba pasa contra la nada.
    // Y se cuenta SOBRE LAS LINEAS DE CODIGO, saltando los comentarios: el
    // comentario que explica QUE se sustituyo nombra «<CajaResumen>» y se cazaba
    // a si mismo. Sexta vez en esta sesion que la prosa dispara una asercion de
    // texto — cuando se busca JSX hay que mirar solo donde puede haber JSX.
    const codigo = pagina
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n')
    const resumenes = codigo.match(/<CajaResumen/g) ?? []
    expect(resumenes).toHaveLength(1)

    const guardaRango = pagina.indexOf("periodo.modo !== 'hoy'")
    const elResumen   = pagina.indexOf('<CajaResumen')
    const guardaHoy   = pagina.indexOf("periodo.modo === 'hoy'")
    const elExtracto  = pagina.indexOf('<CajaDia')

    // El unico CajaResumen que queda esta DENTRO de la rama de rango.
    expect(guardaRango).toBeGreaterThan(-1)
    expect(elResumen).toBeGreaterThan(guardaRango)
    // Y el extracto, dentro de la de hoy.
    expect(guardaHoy).toBeGreaterThan(-1)
    expect(elExtracto).toBeGreaterThan(guardaHoy)
  })

  it('y el extracto si', () => {
    expect(pagina).toMatch(/<CajaDia/)
    expect(pagina).toMatch(/fecha=\{fechaLarga\}/)
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
