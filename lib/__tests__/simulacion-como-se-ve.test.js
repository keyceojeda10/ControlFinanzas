// lib/__tests__/simulacion-como-se-ve.test.js
//
// ══ LA SIMULACIÓN SE MANDA COMO SE VE ══════════════════════════════════════
//
// «Cuando se realiza la simulación de un préstamo y se comparte, normalmente se
//  comparte en texto; sería bueno que se compartiera como se ve en la tabla de
//  la simulación.»            — Préstamos Rincón, 23 ago 2026, con la captura
//
// El texto de siempre NO se quita: sirve para pegar cifras en un chat. Esto es
// la otra pregunta —enseñarle al cliente el desglose— y por eso el botón vive
// DENTRO de la hoja del desglose, que es donde él lo estaba mirando.
//
// ⚠ LO QUE ESTA PRUEBA NO PUEDE VER. Un canvas no se mide leyendo el código:
//   con las medidas anteriores la cifra del bloque CAÍA ENCIMA de la línea de
//   contexto —«$260.700–$259.205» sobre «cada mes · 8 veces»— y en el JSX se
//   veía correcto. Eso solo salió generando el PNG en un navegador y mirándolo
//   (`.auditoria/_ver-simulacion.mjs`). Aquí se fija lo que sí es estructura.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
const dibujo = leer('lib/simulacion-imagen.js')

describe('⚠ la imagen de la simulación', () => {
  it('no se copia la paleta: la importa del recibo', () => {
    /* Duplicarla es lo que hace que el día que cambie el dorado cambie en un
       papel y no en el otro, y el cliente reciba dos documentos del mismo
       negocio con dos estilos. */
    expect(dibujo).toMatch(/import \{[^}]*TINTA[^}]*\} from '@\/components\/ui\/BotonCompartirRecibo'/)
    expect(dibujo, 'volvió una segunda tabla de colores').not.toMatch(/const TINTA = \{/)
  })

  it('la cifra va en BLOQUE OSCURO, que es la regla de la casa', () => {
    /* «El fondo dorado no es un estilo, es un error de sistema»: el dorado se
       reserva al monto, y con el fondo dorado el monto queda del color de su
       propia caja. Ver `components/cf/bloqueOscuro`. */
    expect(dibujo).toMatch(/from '@\/components\/cf\/bloqueOscuro'/)
    expect(dibujo).toMatch(/ctx\.fillStyle = BLOQUE\.fondo/)
    expect(dibujo).toMatch(/ctx\.fillStyle = BLOQUE\.oro/)
  })

  it('⚠ el pie del bloque no se monta con la cifra', () => {
    /* La regresión concreta: con `ALTO_BLOQUE = 118` la línea de contexto caía
       a 6 px de la línea base de la cifra y las dos se pisaban. */
    const alto = dibujo.match(/const ALTO_BLOQUE = (\d+)/)
    expect(alto, 'no encuentro la altura del bloque').toBeTruthy()
    expect(Number(alto[1]), 'volvió el solapamiento').toBeGreaterThanOrEqual(130)
    // Y la separación real entre las dos líneas, medida en el propio código.
    const baseCifra = Number(dibujo.match(/ctx\.fillText\(cuotaTexto, L \+ 22, y \+ (\d+)\)/)[1])
    const basePie = Number(alto[1]) - 14 - Number(dibujo.match(/ctx\.fillText\(cuotaPie, L \+ 22, y \+ ALTO_CAJA - (\d+)\)/)[1])
    expect(basePie - baseCifra, 'la cifra y su contexto, a menos de 20px').toBeGreaterThanOrEqual(20)
  })

  it('dice que es una simulación', () => {
    /* Este papel se le enseña a alguien que todavía no ha firmado nada. Sin
       esta línea se lee como un compromiso. */
    expect(dibujo).toMatch(/ctx\.fillText\('Simulación · no es un compromiso/)
  })

  it('el ancho es el mismo que el del recibo', () => {
    /* Dos papeles del mismo negocio no pueden llegar con dos anchos. */
    const recibo = leer('components/ui/BotonCompartirRecibo.jsx')
    expect(dibujo).toMatch(/^const W = 540$/m)
    expect(recibo).toMatch(/const W = 540/)
    expect(dibujo).toMatch(/const escala = 2/)
  })

  it('la fecha corta se arma a mano, sin el «de» del ICU', () => {
    /* `month:'short'` mete «24 de ago» y son 12px que no caben en la columna.
       Ver `bug_icu_de_en_fecha_corta`. */
    expect(dibujo).toMatch(/const MES = \['ene'/)
    expect(dibujo, 'volvió el toLocaleDateString').not.toMatch(/toLocaleDateString/)
  })
})

describe('⚠ un solo camino de canvas a WhatsApp', () => {
  const comun = leer('lib/lienzo-compartir.js')

  it('`compartirLienzo` conserva las tres piezas', () => {
    expect(comun).toMatch(/canvas\.toBlob\(/)
    expect(comun).toMatch(/navigator\.canShare && navigator\.canShare\(\{ files: \[file\] \}\)/)
    expect(comun).toMatch(/navigator\.share\(\{ files: \[file\]/)
    // Y la descarga de respaldo: sin ella el botón parece averiado en PC.
    expect(comun).toMatch(/link\.download = archivo/)
  })

  it('el recibo y la simulación salen por ella, no cada uno por su cuenta', () => {
    const recibo = leer('lib/recibo-acciones.js')
    expect(recibo).toMatch(/from '@\/lib\/lienzo-compartir'/)
    expect(recibo).toMatch(/return compartirLienzo\(canvas, \{/)
    expect(recibo, 'volvió el toBlob escrito a mano').not.toMatch(/canvas\.toBlob\(/)
    expect(dibujo).toMatch(/return compartirLienzo\(canvas, \{/)
  })
})

describe('⚠ el botón, donde él estaba mirando', () => {
  const pagina = leer('app/(dashboard)/prestamos/simulador/page.jsx')

  it('va en la hoja del desglose, no en la pantalla', () => {
    const i = pagina.indexOf('titulo="Cobro por cobro"')
    expect(i).toBeGreaterThan(-1)
    expect(pagina.slice(i, i + 1400)).toMatch(/Mandar esta tabla/)
  })

  it('solo si hay tabla que mandar', () => {
    /* En «cuota fija» no hay desglose: un botón que no puede hacer nada es
       peor que ninguno. */
    expect(pagina).toMatch(/accion=\{calculo\?\.tablaAmortizacion\?\.length \? \(/)
  })

  it('⚠ el compartir en TEXTO no se quita', () => {
    /* Un rediseño pierde funciones en silencio. Son dos preguntas distintas:
       pegar cifras en un chat y enseñar el desglose. */
    expect(pagina).toMatch(/const textoCompartir = useMemo\(/)
    expect(pagina).toMatch(/const mandar = async \(\) => \{/)
  })

  it('sin emojis: el icono es un SVG en línea', () => {
    const i = pagina.indexOf('Mandar esta tabla')
    const bloque = pagina.slice(Math.max(0, i - 700), i + 40)
    expect(bloque).toMatch(/<svg/)
  })
})
