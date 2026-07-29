// lib/__tests__/componentes-receta.test.js
//
// Los valores de 03-COMPONENTES.md, fijados. La receta está en CSS plano, así
// que esto no es interpretación: es cotejo.
//
// Van los de las ocho piezas nuevas y los de las tres correcciones que salieron
// al cotejar las que ya estaban.
//
// OJO CON LOS `not.toMatch`: buscan sobre el archivo ENTERO, comentarios
// incluidos, y estos componentes explican en prosa el valor viejo que se
// corrigió. Una aserción como `not.toMatch(/marginTop: -4/)` se caza a sí misma
// contra el comentario que dice «no lleva marginTop: -4». Ya pasó tres veces:
// hay que atarlas a la FORMA DEL CÓDIGO —con su `var(`, su `?`, su coma— no a
// la palabra suelta.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const leer = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const p1 = leer('components/cf/primitivos.jsx')
const p2 = leer('components/cf/primitivos2.jsx')
const cab = leer('components/armazon/CabeceraMovil.jsx')
const tokens = leer('app/tokens-2026.css')

describe('§6 · campo de monto', () => {
  it('el símbolo va en su propio span y MÁS PEQUEÑO que la cifra', () => {
    // 23–28 el símbolo, 32–44 el número. Con el $ del mismo tamaño compite con
    // el primer dígito y el monto deja de leerse de un vistazo.
    expect(p2).toMatch(/fontSize: 25, color: 'var\(--cf-ink-3\)'/)
    expect(p2).toMatch(/fontSize: 38, letterSpacing: '-\.035em'/)
  })

  it('no es type=number', () => {
    // <input type=number> rechaza el separador que no coincide con el locale del
    // teléfono, y en Colombia deja al usuario sin poder escribir los miles.
    expect(p2).toMatch(/type="text"/)
    expect(p2).toMatch(/inputMode="decimal"/)
  })

  it('sin onCambiar queda readOnly, no muerto y en silencio', () => {
    expect(p2).toMatch(/readOnly=\{!onCambiar\}/)
  })
})

describe('§6 · el placeholder de la receta', () => {
  it('sale #8E929A con peso 400, ganándole al global del diseño viejo', () => {
    // globals.css tiene `html[data-theme=light] ::placeholder { color:#a0a0b5
    // !important }`, que se aplica a TODOS los inputs de la app.
    expect(p1).toMatch(/className=\{\['cf-campo', className\]/)
    expect(tokens).toMatch(/\.cf-campo::placeholder/)
    expect(tokens).toMatch(/html\[data-theme="light"\] \.cf-campo::placeholder/)
    expect(tokens).toMatch(/color: var\(--cf-ink-4\) !important/)
    expect(tokens).toMatch(/--cf-ink-4:\s*#8E929A/)
  })
})

describe('§7 · grupo segmentado y tarjeta de opción', () => {
  it('la opción activa del segmentado es NEGRA, no dorada', () => {
    // El dorado es para la plata; esto es una preferencia.
    expect(p2).toMatch(/background: activa \? 'var\(--cf-ink\)' : 'var\(--cf-card\)'/)
  })

  it('la selección es el MISMO par que el foco de un campo', () => {
    // 1.5px dorado + anillo de 3px. Es la única señal de selección del sistema.
    const patron = /border: seleccionada \? '1\.5px solid var\(--cf-gold\)'/
    expect(p2).toMatch(patron)
    expect(p2).toMatch(/boxShadow: seleccionada \? '0 0 0 3px var\(--cf-gold-focus\)'/)
    // Y el campo lo hace igual, con `foco`:
    expect(p1).toMatch(/foco \? '1\.5px solid var\(--cf-gold\)'/)
    expect(p1).toMatch(/foco \? '0 0 0 3px var\(--cf-gold-focus\)'/)
  })

  it('el radio mide 20px con check de 12 sin marcar contorno de 1.5', () => {
    expect(p2).toMatch(/width: 20, height: 20, minWidth: 20/)
    expect(p2).toMatch(/border: marcado \? 'none' : '1\.5px solid rgba\(20,20,28,\.18\)'/)
    expect(p2).toMatch(/<svg width="12" height="12"/)
  })
})

describe('§8 · interruptor', () => {
  it('la pista mide 46×28 y la perilla 22 a 3px del borde', () => {
    expect(p2).toMatch(/width: 46, height: 28, minWidth: 46/)
    expect(p2).toMatch(/width: 22, height: 22/)
    expect(p2).toMatch(/\(encendido \? \{ right: 3 \} : \{ left: 3 \}\)/)
  })

  it('encendido es dorado SIN borde; apagado lleva borde', () => {
    expect(p2).toMatch(/background: encendido \? 'var\(--cf-gold\)' : 'var\(--cf-fill-2\)'/)
    expect(p2).toMatch(/border: encendido \? 'none' : '1px solid rgba\(20,20,28,\.09\)'/)
  })

  it('se ofrece la FILA hecha, con etiqueta y explicación', () => {
    // Un interruptor suelto no dice qué apaga. La receta lo pide siempre en fila.
    expect(p2).toMatch(/export function FilaInterruptor/)
  })
})

describe('§9 · barras', () => {
  it('la barra partida NO lleva hueco entre tramos y sí leyenda', () => {
    expect(p2).toMatch(/borderRadius: 999, overflow: 'hidden'/)
    expect(p2).toMatch(/leyenda = true/)
    // El punto de la leyenda: 9px con radio 3, según la receta.
    expect(p2).toMatch(/width: 9, height: 9, borderRadius: 3/)
  })

  it('sobre oscuro los colores son #F3F3F6 y #F5B824', () => {
    expect(p2).toMatch(/\['#F3F3F6', '#F5B824', '#8A8E98'\]/)
  })

  it('la espina pinta lo HECHO en dorado, y verde solo en modo ruta', () => {
    // Yo lo tenía verde siempre, y eso convierte cada paso de un formulario en
    // un logro: en «Cobro 3 de 11» los dos primeros salían como si el dinero ya
    // hubiera entrado.
    expect(cab).toMatch(/const hecho = modoRuta \? 'var\(--cf-green\)' : 'var\(--cf-gold\)'/)
  })
})

describe('§12 · tabla', () => {
  it('las filas son flex:none — la receta dice «nunca flex:1»', () => {
    expect(p2).toMatch(/minHeight: 48, flex: 'none', padding: '0 24px'/)
  })

  it('la columna de nombre es flex:1 y las de cifras llevan ancho fijo', () => {
    expect(p2).toMatch(/col\.ancho\s*\n?\s*\?\s*\{ width: col\.ancho, minWidth: col\.ancho, flex: 'none' \}/)
    expect(p2).toMatch(/: \{ flex: 1, minWidth: 0 \}/)
  })

  it('los montos van a la derecha con cifras tabulares', () => {
    expect(p2).toMatch(/textAlign: c\.cifra \? 'right' : 'left'/)
    expect(p2).toMatch(/className=\{c\.cifra \? 'cf-num' : undefined\}/)
  })

  it('cuando la celda mezcla barra y número deja 18px', () => {
    expect(p2).toMatch(/c\.barra \? \{ paddingLeft: 18 \}/)
  })

  it('lleva el espaciador vacío, el ÚNICO encogible permitido', () => {
    expect(p2).toMatch(/<div style=\{\{ flex: 1, minHeight: 0 \}\} \/>/)
  })

  it('usa los tokens que ya existen para subtotal y fila seleccionada', () => {
    // Me había inventado --cf-fill-suave y --cf-row-sel con fallback, cuando
    // --cf-card-alt (#F9F9F6) y --cf-gold-tint-2 (#FDF9EE) ya eran esos valores.
    expect(p2).toMatch(/background: 'var\(--cf-card-alt\)'/)
    expect(p2).toMatch(/var\(--cf-gold-tint-2\)/)
    expect(p2).not.toMatch(/var\(--cf-fill-suave|var\(--cf-row-sel/)
    expect(tokens).toMatch(/--cf-card-alt:\s*#F9F9F6/)
    expect(tokens).toMatch(/--cf-gold-tint-2:\s*#FDF9EE/)
  })

  it('el pie dice el truncado con el monto que falta', () => {
    // «Ves 10 de los 17 · faltan 7 por $4.826.336». Si el usuario suma la
    // columna, tiene que poder llegar al total.
    expect(p2).toMatch(/Ves \{visibles\} de los \{deTotal\}/)
    expect(p2).toMatch(/faltanMonto/)
  })
})

describe('§15 · gráficos', () => {
  it('ninguna librería: los tres son divs', () => {
    expect(p2).not.toMatch(/from 'recharts'|from 'chart\.js'|from 'd3'/)
  })

  it('el contenedor de barras tiene altura RESUELTA en px', () => {
    // La receta lo marca en negrita: con `flex:1` dentro de una columna
    // saturada colapsa a 0 y el gráfico desaparece sin dejar error.
    expect(p2).toMatch(/height: alto, flex: 'none',\s*\/\* altura FIJA/)
    expect(p2).toMatch(/BarrasVerticales\(\{ barras = \[\], alto = 120/)
  })

  it('los 12 meses van con su frase, no solos', () => {
    // «El texto y el gráfico tienen que contar la misma historia.»
    expect(p2).toMatch(/BarrasComportamiento\(\{ meses = \[\], frase/)
  })

  it('el ranking lleva la cifra con ancho fijo y a la derecha', () => {
    expect(p2).toMatch(/width: anchoCifra, minWidth: anchoCifra, flex: 'none', textAlign: 'right'/)
  })
})

describe('§17 · esqueleto', () => {
  it('son tarjetas BLANCAS con bloques grises dentro, no losas grises', () => {
    // La receta: «bloques […] en #F3F3EF sobre #FFF». Puestos sobre la
    // superficie (#F4F4F1) el gris es casi el mismo color y no se ven; y se
    // pierde lo único que importa, que es tener la forma de lo que viene.
    const pila = p2.slice(p2.indexOf('export function PilaEsqueletos'))
    expect(pila).toMatch(/background: 'var\(--cf-card\)'/)
    expect(pila).toMatch(/borderRadius: 'var\(--cf-r-card\)'/)
    // Y la forma: avatar, dos líneas y la barra de progreso.
    expect(pila).toMatch(/<Esqueleto alto=\{40\} radio=\{999\}/)
    expect(pila).toMatch(/<Esqueleto alto=\{5\} radio=\{999\}/)
  })

  it('se desvanece hacia abajo', () => {
    expect(p2).toMatch(/opacity: 1 - i \*/)
  })
})

describe('§2 · el dorado del bloque oscuro', () => {
  it('es #F5B824 literal, no --cf-gold-light', () => {
    // `var(--cf-gold-light, #F5B824)` es un fallback que NUNCA se usa: el token
    // existe y vale #F5C518, que es el borde del logo. El #F5B824 de la receta
    // es lo que vale --cf-gold EN TEMA OSCURO, y este bloque es oscuro siempre.
    expect(p1).toMatch(/tono === 'ganancia' \? '#F5B824'/)
    expect(p1).not.toMatch(/\? 'var\(--cf-gold-light, #F5B824\)'/)
    expect(tokens).toMatch(/--cf-gold-light:\s*#F5C518/)
  })

  it('la cifra no lleva el marginTop -4 que yo le había puesto', () => {
    // La receta dice gap 14 a secas; con el -4 quedaba en 10. `.cf-fig` ya trae
    // line-height 1, que es lo que de verdad ajusta la cifra.
    const bloque = p1.slice(p1.indexOf('export function BloqueOscuro'), p1.indexOf('export function TiraCifras'))
    expect(bloque).not.toMatch(/gap: 9, marginTop: -4/)
    expect(tokens).toMatch(/\.cf-fig[^}]*line-height: 1/s)
  })
})
