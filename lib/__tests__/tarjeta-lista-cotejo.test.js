// lib/__tests__/tarjeta-lista-cotejo.test.js
//
// La pieza más repetida del sistema, cotejada contra T02-05 (clientes) y T02-06
// (préstamos) con `node scripts/medir.mjs`. Las cifras salen de MEDIR.
//
// OJO CON LOS `not.toMatch`: el archivo explica en prosa lo que se corrigió, así
// que hay que atarlos a la forma del código, no a la palabra.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { etiquetaDe, adaptarClientes } from '@/lib/adaptadores/clientes'
import { adaptarPrestamos, detalleDe } from '@/lib/adaptadores/prestamos'

const tarjeta = fs.readFileSync(path.join(process.cwd(), 'components/cf/TarjetaCliente.jsx'), 'utf8')

describe('las dos variantes — el turno 03 las hace converger', () => {
  // Fijaban los SEIS numeros del turno 02, en los que las dos variantes se
  // separaban (relleno 15 vs 14, riel 14 vs 13, monto 23 vs 21). T03-03 y
  // T03-04 dibujan el mismo relleno y el mismo riel: con la tira de cifras
  // dentro, lo unico que las separa es el avatar.
  it('cliente: relleno 15, hueco 12, riel 14, huecoFila 12, monto 20', () => {
    expect(tarjeta).toMatch(
      /cliente:\s*\{ relleno: '15px 16px 15px 19px', hueco: 12, riel: 14, huecoFila: 12, monto: 20, huecoSub: 4 \}/)
  })

  it('préstamo: lo mismo, con huecoFila 10 porque no lleva avatar', () => {
    expect(tarjeta).toMatch(
      /prestamo:\s*\{ relleno: '15px 16px 15px 19px', hueco: 12, riel: 14, huecoFila: 10, monto: 20, huecoSub: 4 \}/)
  })

  it('la variante de préstamo no pinta avatar', () => {
    expect(tarjeta).toMatch(/const conAvatar = variante === 'cliente' && !!iniciales/)
  })
})

describe('el estado tiene TRES portadores, no cuatro', () => {
  it('el avatar NO lleva borde de color', () => {
    // La receta §3 lo permite («cuando el estado importa»), pero ninguna de las
    // tres láminas lo usa: los nueve avatares son #F3F3EF pelado. Con riel,
    // pastilla y barra ya hay tres sitios diciendo lo mismo.
    const avatar = tarjeta.slice(tarjeta.indexOf('{conAvatar && ('), tarjeta.indexOf('El nombre SOLO'))
    expect(avatar).not.toMatch(/border: .*solid \$\{color\}/)
    expect(avatar).toMatch(/background: 'var\(--cf-fill\)'/)
  })

  it('el riel, la pastilla y la barra sí lo llevan', () => {
    expect(tarjeta).toMatch(/width: 4, borderRadius: 999, background: color/)
    // La pastilla toma el tono TRADUCIDO: `Pastilla` solo conoce
    // mora/atraso/aldia/neutro, y T02-06 añade `renovar` (verde de «al día») y
    // `pagado` (neutra: no hay color de terminado, hay ausencia de alarma).
    expect(tarjeta).toMatch(/<Pastilla tono=\{TONO_PASTILLA\[estado\] \?\? 'neutro'\}/)
    expect(tarjeta).toMatch(/renovar: 'aldia', pagado: 'neutro'/)
    expect(tarjeta).toMatch(/<BarraProgreso porcentaje=\{porcentaje\} tono=\{TONO_BARRA\[estado\]\} alto=\{5\}/)
  })

  it('el fondo de la tarjeta es SIEMPRE blanco', () => {
    // Era el muro chillón que este rediseño corrige.
    expect(tarjeta).toMatch(/background: 'var\(--cf-card\)'/)
  })
})

describe('UNA sola pastilla, con los días dentro', () => {
  it('en el turno 03 baja a la segunda línea, junto al contexto', () => {
    // T02 la ponia a la derecha del nombre, en su propia esquina. T03-03 y
    // T03-04 la bajan a compartir linea con el contexto: el contexto se
    // encoge, la pastilla no, asi que con una ruta de nombre largo se recorta
    // la ruta y nunca los dias de mora.
    expect(tarjeta).toMatch(/\{\(etiquetaEstado \|\| contexto\) && \(/)
    expect(tarjeta).toMatch(/<Pastilla tono=\{TONO_PASTILLA\[estado\] \?\? 'neutro'\} numerica style=\{\{ flex: 'none' \}\}>/)
  })

  it('la tarjeta no tiene una segunda pastilla de días', () => {
    expect(tarjeta).not.toMatch(/\{diasAtraso > 0 && \(/)
    expect(tarjeta).not.toMatch(/\{diasAtraso\}d/)
  })

  it('la compone el adaptador, porque el texto cambia en cada pantalla', () => {
    // «10d mora» en clientes, «36d mora» en préstamos, «36d de atraso» en
    // cobrar hoy. Meterlo en la tarjeta la obligaría a saber dónde está.
    expect(etiquetaDe('mora', 10)).toBe('10d mora')
    expect(etiquetaDe('atraso', 6)).toBe('6d vencido')
    expect(etiquetaDe('aldia', 0)).toBe('Al día')
  })

  it('con cero días no escribe «0d»', () => {
    expect(etiquetaDe('atraso', 0)).toBe('Atraso leve')
    expect(etiquetaDe('mora', null)).toBe('En mora')
  })
})

describe('la línea de contexto es UNA sola, y no se parte', () => {
  it('lleva nowrap con ellipsis, no clamp de dos líneas', () => {
    // Con `WebkitLineClamp: 2` las tarjetas cambiaban de alto según lo larga que
    // fuera la dirección. Una lista de alturas distintas se recorre peor, y la
    // lámina las dibuja todas iguales.
    // Se comprueba en POSITIVO. El `not.toMatch(/WebkitLineClamp/)` que tenía
    // acá se cazaba contra el comentario de arriba, que nombra la propiedad para
    // explicar por qué se fue. Y sobra: `nowrap` y un clamp de dos líneas no
    // pueden convivir, así que afirmar el primero descarta el segundo.
    const ctx = tarjeta.slice(tarjeta.indexOf('{contexto && ('))
    expect(ctx.slice(0, 400)).toMatch(/whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'/)
    expect(ctx.slice(0, 400)).not.toMatch(/display: '-webkit-box'/)
  })
})

describe('el monto sube a la fila del nombre (T03-03 y T03-04)', () => {
  // ESTO ES LO QUE EL USUARIO VIO Y YO NO. El turno 02 le daba al monto una
  // fila propia debajo, con el rotulo «DEUDA TOTAL» encima y el «% pagado» a su
  // derecha. El turno 03 lo sube a la fila del nombre, alineado a la derecha,
  // con «de $1.200.000» debajo — y ese hueco lo ocupa la tira de cifras.
  it('el monto va en columna alineada a la derecha, con flex none', () => {
    expect(tarjeta).toMatch(
      /flexDirection: 'column', alignItems: 'flex-end',\s*gap: 2, flex: 'none'/)
  })

  it('ya NO hay una fila de monto con flex-end + space-between', () => {
    expect(tarjeta).not.toMatch(/alignItems: 'flex-end', justifyContent: 'space-between'/)
  })

  it('el rótulo «DEUDA TOTAL» desaparece: la lámina no lo dibuja', () => {
    expect(tarjeta).not.toMatch(/etiquetaMonto/)
  })

  it('la fila del nombre alinea arriba, no al centro', () => {
    // Con dos lineas a la izquierda y dos a la derecha, centrar descuadra el
    // nombre respecto al monto, que es la pareja que se lee junta.
    expect(tarjeta).toMatch(/alignItems: 'flex-start', gap: m\.huecoFila/)
  })
})

describe('la tira de cifras — lo que faltaba', () => {
  // «Faltaba lo mas basico: la cuota. Y la ganancia acumulada, que es la razon
  // de ser del prestamo y no aparecia en ninguna lista» (pie de T03-04).
  it('cuatro columnas iguales separadas por filetes de 1px', () => {
    expect(tarjeta).toMatch(/width: 1, flex: 'none', background: 'var\(--cf-border-soft\)'/)
    expect(tarjeta).toMatch(/cifras\?\.length > 0/)
  })

  it('va sobre un borde superior, con 11 de aire', () => {
    expect(tarjeta).toMatch(/paddingTop: 11, borderTop: '1px solid var\(--cf-border-soft\)'/)
  })

  it('el rótulo es 10/700 con letter-spacing .06em', () => {
    expect(tarjeta).toMatch(/fontSize: 10, fontWeight: 700, letterSpacing: '\.06em'/)
  })

  it('solo DOS valores se tiñen: el atraso y la ganancia', () => {
    // Si se tiñeran los cuatro, la tira dejaria de señalar nada.
    const m = tarjeta.match(/const TONO_CIFRA = \{([^}]*)\}/)
    expect(m).toBeTruthy()
    expect(m[1].split(',').filter((x) => x.trim()).length).toBe(2)
  })

  it('los valores llevan cifras tabulares (regla global 1)', () => {
    // `cf-fig` es la clase que las pone. Sin ellas las columnas bailan al
    // actualizarse, que es justo lo que hace una lista de cobros.
    expect(tarjeta).toMatch(/<span className="cf-fig" style=\{\{\s*fontSize: 14/)
  })
})

describe('el avance va al lado de la barra, no arriba', () => {
  it('barra y lectura comparten fila, con hueco 9', () => {
    expect(tarjeta).toMatch(/alignItems: 'center', gap: 9/)
  })

  it('la barra es flex 1 y la lectura flex none', () => {
    // Regla global 3: si la barra fuera encogible colapsa a 0px y el estado
    // desaparece. Aca es al reves — se estira— pero la lectura NO puede.
    expect(tarjeta).toMatch(/<BarraProgreso porcentaje=\{porcentaje\} tono=\{TONO_BARRA\[estado\]\} alto=\{5\} style=\{\{ flex: 1 \}\} \/>/)
    expect(tarjeta).toMatch(/flex: 'none', whiteSpace: 'nowrap',\s*\}\}>\{avance\}/)
  })
})

describe('lo que aportan los adaptadores', () => {
  it('clientes trae el rótulo «Deuda total» y préstamos NO trae rótulo', () => {
    const [c] = adaptarClientes([{ id: '1', nombre: 'Ana Milena', saldoPendienteTotal: 670000 }], 'CO')
    expect(c.etiquetaMonto).toBe('Deuda total')

    const [p] = adaptarPrestamos([{ id: '1', cliente: { nombre: 'Carlos' }, saldoPendiente: 160000 }], 'CO')
    expect(p.etiquetaMonto).toBeUndefined()
    expect(p.variante).toBe('prestamo')
  })

  it('préstamos dice el total al lado del porcentaje', () => {
    // «de $1.200.000 · 54% pagado». El saldo solo no dice nada: $160.000
    // pendientes puede ser un préstamo casi saldado o uno pequeño recién dado.
    expect(detalleDe({ totalAPagar: 1200000, porcentajePagado: 54 }, 'CO')).toMatch(/^de \$1\.200\.000 · 54% pagado$/)
  })

  it('sin total no escribe «de $0»', () => {
    expect(detalleDe({ porcentajePagado: 12 }, 'CO')).toBe('12% pagado')
    expect(detalleDe({ totalAPagar: 0, porcentajePagado: 0 }, 'CO')).toBe('0% pagado')
  })
})
