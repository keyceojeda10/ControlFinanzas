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
  /* El `relleno` y el `riel` salieron de aquí con la Adenda 5 · E10: el riel se
     fue, y el relleno pasó a piezas sueltas porque la barra a sangre necesita
     SUS NÚMEROS para anularlo con un margen negativo. */
  it('cliente: hueco 12, huecoFila 12, monto 20', () => {
    expect(tarjeta).toMatch(
      /cliente:\s*\{ hueco: 12, huecoFila: 12, monto: 20, huecoSub: 4 \}/)
  })

  it('préstamo: lo mismo, con huecoFila 10 porque no lleva avatar', () => {
    expect(tarjeta).toMatch(
      /prestamo:\s*\{ hueco: 12, huecoFila: 10, monto: 20, huecoSub: 4 \}/)
  })

  it('y el relleno lateral es SIMÉTRICO', () => {
    /* Era 19 a la izquierda y 16 a la derecha: los 3px de más eran «el hueco
       que deja sitio al riel». Sin riel, el texto quedaba descentrado sin nada
       que lo justificara. */
    expect(tarjeta).toMatch(/const RELLENO_LATERAL = \{ arriba: 15, der: 16, abajo: 15, izq: 16 \}/)
  })

  it('la variante de préstamo no pinta avatar', () => {
    expect(tarjeta).toMatch(/const conAvatar = variante === 'cliente' && !!iniciales/)
  })
})

describe('el estado va en el avatar y en la barra, no en un riel', () => {
  /* ── ESTO CAMBIÓ CON LA ADENDA 5 · E10 ──
     Aquí se exigía lo contrario: «el avatar NO lleva borde de color», porque
     con riel, pastilla y barra ya había tres sitios diciendo el estado y el
     anillo habría sido el cuarto. Era cierto MIENTRAS existía el riel.

     La adenda invierte el reparto: quita el riel —«el cuarto sitio donde se
     dice lo mismo, y el único sin dato»— y le da el estado a los elementos que
     YA identifican a la fila. El anillo deja de ser el cuarto portador y pasa a
     ser el primero. */

  it('el avatar lleva el anillo de estado', () => {
    const avatar = tarjeta.slice(tarjeta.indexOf('{conAvatar && ('), tarjeta.indexOf('El nombre SOLO'))
    expect(avatar).toMatch(/border: `2px solid \$\{color\}`/)
    expect(avatar).toMatch(/background: 'var\(--cf-fill\)'/)
  })

  it('el avatar no se puede aplastar', () => {
    /* De la lista de comprobación de la adenda: «todo contenedor de avatar
       lleva flex:none + min-width + min-height + aspect-ratio:1». Sin eso se
       vuelve un óvalo con un nombre largo al lado, y con el anillo puesto un
       óvalo se ve roto. */
    const avatar = tarjeta.slice(tarjeta.indexOf('{conAvatar && ('), tarjeta.indexOf('El nombre SOLO'))
    for (const pieza of ["flex: 'none'", 'minWidth: 40', 'minHeight: 40', "aspectRatio: '1'"]) {
      expect(avatar, `al avatar le falta ${pieza}`).toContain(pieza)
    }
  })

  it('el riel ya no está', () => {
    expect(tarjeta, 'volvió el filete pegado al borde izquierdo')
      .not.toMatch(/width: 4, borderRadius: 999, background: color/)
  })

  it('la barra va a sangre, pegada al borde inferior', () => {
    /* Último hijo, con el margen negativo que anula el relleno lateral: sin él
       quedaría un renglón de color flotando con 16px de aire a cada lado, que
       se lee como un elemento más y no como el borde de la tarjeta. */
    expect(tarjeta).toMatch(/margin: `0 -\$\{RELLENO_LATERAL\.der\}px 0 -\$\{RELLENO_LATERAL\.izq\}px`/)
    const i = tarjeta.indexOf('RELLENO_LATERAL.der}px 0 -')
    expect(tarjeta.slice(Math.max(0, i - 300), i), 'la barra puede encogerse hasta desaparecer')
      .toMatch(/flex: 'none'/)
  })

  it('y la pastilla sigue llevándolo', () => {
    // La pastilla toma el tono TRADUCIDO: `Pastilla` solo conoce
    // mora/atraso/aldia/neutro, y T02-06 añade `renovar` (verde de «al día») y
    // `pagado` (neutra: no hay color de terminado, hay ausencia de alarma).
    expect(tarjeta).toMatch(/<Pastilla tono=\{TONO_PASTILLA\[estado\] \?\? 'neutro'\}/)
    expect(tarjeta).toMatch(/renovar: 'aldia', pagado: 'neutro'/)
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
    // `piezas` entra en la condición desde que los metadatos se pintan con
    // icono: sin ella, una tarjeta que solo manda piezas perdía la pastilla.
    // Y `nuevo` desde que la pastilla de recién creado bajó aquí — el nombre le
    // perdía 81px de 160 y salía en tres renglones. Se comprueba que las tres
    // banderas estén, sin fijar el orden ni impedir que se sumen más.
    const filaEstado = tarjeta.match(/\{\([^)]*etiquetaEstado[^)]*\) && \(/)?.[0] ?? ''
    for (const bandera of ['etiquetaEstado', 'contexto', 'piezas', 'nuevo']) {
      expect(filaEstado, `la fila de estado ya no reacciona a «${bandera}»`).toContain(bandera)
    }
    expect(tarjeta).toMatch(/<Pastilla tono=\{TONO_PASTILLA\[estado\] \?\? 'neutro'\} numerica style=\{\{ flex: 'none' \}\}>/)
  })

  it('la tarjeta no tiene una segunda pastilla de días', () => {
    expect(tarjeta).not.toMatch(/\{diasAtraso > 0 && \(/)
    expect(tarjeta).not.toMatch(/\{diasAtraso\}d/)
  })

  it('la compone el adaptador, porque el texto cambia en cada pantalla', () => {
    // «10d» en las listas y «Renovar» o «Pagado» cuando el estado manda: el
    // cobrar hoy. Meterlo en la tarjeta la obligaría a saber dónde está.
    expect(etiquetaDe('mora', 10)).toBe('10d')
    expect(etiquetaDe('atraso', 6)).toBe('6d')
    expect(etiquetaDe('aldia', 0)).toBe('Al día')
  })

  it('con cero días no escribe «0d»', () => {
    expect(etiquetaDe('atraso', 0)).toBe('Atraso leve')
    expect(etiquetaDe('mora', null)).toBe('En mora')
  })
})

describe('NADA SE CORTA EN LA TARJETA — ni el nombre ni la información', () => {
  // ⚠ ESTA PRUEBA FIJABA LO CONTRARIO, Y SE CAMBIÓ A CONCIENCIA.
  //
  // Decía «la línea de contexto es UNA sola, y no se parte», con este motivo:
  // con dos líneas las tarjetas cambiaban de alto según lo larga que fuera la
  // dirección, y una lista de alturas distintas se recorre peor.
  //
  // Sigue siendo verdad. Perdió igual, y lo decidió el dueño mirando la app el
  // 2 de agosto: «CC 1003003897 · 300887515…», «Mensual 20% Decr. dinámico ·
  // c…», y nombres largos partidos. Sus palabras: «el nombre nunca se debe
  // cortar, porque es para la fácil identificación del cliente».
  //
  // La simetría de la lista es una preferencia; saber a qué ruta pertenece el
  // cliente al que vas a cobrar es el trabajo. Y la línea la cargué yo de más
  // ese mismo día, al meterle el modo de interés y el autor.

  it('el nombre se ajusta en vez de recortarse', () => {
    const i = tarjeta.indexOf('}}>{nombre}</span>')
    const bloque = tarjeta.slice(Math.max(0, i - 260), i)
    expect(bloque).toMatch(/overflowWrap: 'anywhere'/)
    expect(bloque).not.toMatch(/textOverflow: 'ellipsis'/)
  })

  it('la línea de información se ajusta en vez de recortarse', () => {
    // La cadena de siempre, para las pantallas que aún mandan `contexto`.
    const ctx = tarjeta.slice(tarjeta.indexOf('{!piezas && contexto && ('))
    expect(ctx.slice(0, 400)).toMatch(/overflowWrap: 'anywhere'/)
    expect(ctx.slice(0, 400)).not.toMatch(/textOverflow: 'ellipsis'/)
  })

  it('la fila del contexto puede pasar a un segundo renglón', () => {
    // Sin `flexWrap` la pastilla y el texto se pelean el ancho y el texto se
    // encoge hasta ser ilegible en vez de bajar de línea.
    // Se busca por el arranque de la fila, no por la lista de banderas: esa
    // lista crece y el `indexOf` devolvía -1 en silencio.
    const i = tarjeta.search(/\{\([^)]*etiquetaEstado[^)]*\) && \(/)
    expect(tarjeta.slice(i, i + 600)).toMatch(/flexWrap: 'wrap'/)
  })

  it('los metadatos van A TODO EL ANCHO, no al lado de la pastilla', () => {
    // Medido en el espejo: al lado de la pastilla les quedaban 109px de los 393
    // —el avatar y el monto se llevan el resto— y los cuatro datos piden 359.
    // Se apilaban de uno en uno y la cédula salía cortada con media tarjeta
    // vacía al lado. Aquí caben en dos renglones y no se corta nada.
    //
    // Se defiende el SITIO: el bloque de piezas va DESPUÉS del cierre de la
    // cabecera, no dentro de la fila de la pastilla.
    const cabecera = tarjeta.search(/\{\([^)]*etiquetaEstado[^)]*\) && \(/)
    const bloque = tarjeta.indexOf('{piezas && (')
    expect(bloque).toBeGreaterThan(cabecera)
    expect(tarjeta.slice(bloque, bloque + 600)).toMatch(/<Metadatos/)
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
  // ⚠ NO VIVE AQUI. La pinta `TiraCifras`, en cf/primitivos.jsx, y la comparte
  // con la FilaCobro de cobrar hoy — que no tiene esta estructura pero si esta
  // tira. Llegue a escribir una SEGUNDA tira dentro de este componente sin ver
  // que la primera ya existia; el duplicado no compilaba y por eso se descubrio.
  // Estas pruebas miran el sitio compartido justo para que no vuelva a pasar.
  const primitivos = fs.readFileSync(
    path.join(process.cwd(), 'components/cf/primitivos.jsx'), 'utf8')

  it('la tarjeta NO tiene su propia tira: usa la compartida', () => {
    expect(tarjeta).toMatch(/<TiraCifras columnas=\{cifras\} enTarjeta \/>/)
    expect(tarjeta).not.toMatch(/borderTop: '1px solid var\(--cf-border-soft\)'/)
  })

  it('hay UNA sola TiraCifras en todo el sistema', () => {
    expect(primitivos.match(/export function TiraCifras/g)).toHaveLength(1)
  })

  it('columnas separadas por filetes de 1px', () => {
    expect(primitivos).toMatch(/width: 1, background: sep, flex: 'none'/)
  })

  it('dentro de la tarjeta va sobre un borde superior, con 11 de aire', () => {
    expect(primitivos).toMatch(/paddingTop: 11,\s*borderTop: '1px solid var\(--cf-border-soft\)'/)
  })

  it('el rótulo es 10/700 con letter-spacing .06em', () => {
    expect(primitivos).toMatch(/fontSize: 10, fontWeight: 700, letterSpacing: '\.06em'/)
  })

  it('los valores llevan cifras tabulares (regla global 1)', () => {
    // `cf-fig` es la clase que las pone. Sin ellas las columnas bailan al
    // actualizarse, que es justo lo que hace una lista de cobros.
    expect(primitivos).toMatch(/<span className="cf-fig" style=\{\{\s*fontSize: enTarjeta \? 14/)
  })

  it('dentro de la tarjeta el valor baja a 14, no 15', () => {
    expect(primitivos).toMatch(/fontSize: enTarjeta \? 14 : sobreOscuro \? 16 : 15/)
  })

  it('sin columnas no pinta nada, ni el filete', () => {
    // Un borde superior suelto bajo una tarjeta sin cifras se lee como avería.
    expect(primitivos).toMatch(/if \(!columnas\?\.length\) return null/)
  })
})

describe('la lectura del avance', () => {
  /* ── CAMBIÓ CON E10 ──
     Antes la barra y su lectura compartían fila. Ahora la BARRA baja al borde
     inferior, a sangre, y la lectura —«cuota 13/24 · 54%»— se queda arriba,
     alineada a la derecha. No se pierde: es el mismo dato en dos sitios
     distintos de la misma tarjeta. */
  it('se queda arriba, alineada a la derecha', () => {
    expect(tarjeta).toMatch(/alignSelf: 'flex-end', whiteSpace: 'nowrap',\s*\}\}>\{avance\}/)
  })

  it('y la barra ya no comparte fila con ella', () => {
    expect(tarjeta, 'volvió la barra dentro de una fila con la lectura')
      .not.toMatch(/<BarraProgreso[^>]*style=\{\{ flex: 1 \}\}/)
  })
})

describe('lo que aportan los adaptadores', () => {
  it('NINGUNO trae ya el rótulo «Deuda total»: T03 lo quita', () => {
    // Fijaba que clientes lo trajera. El turno 03 sube el monto a la fila del
    // nombre, donde no hay sitio para un rotulo encima —y no hace falta: en
    // una lista de clientes, la cifra grande solo puede ser lo que deben.
    const [c] = adaptarClientes([{ id: '1', nombre: 'Ana Milena', saldoPendienteTotal: 670000, prestamosActivos: 3 }], 'CO')
    expect(c.etiquetaMonto).toBeUndefined()
    // En su sitio, bajo el monto, va cuantos prestamos tiene.
    expect(c.detalle).toBe('3 préstamos')

    const [p] = adaptarPrestamos([{ id: '1', cliente: { nombre: 'Carlos' }, saldoPendiente: 160000 }], 'CO')
    expect(p.etiquetaMonto).toBeUndefined()
    expect(p.variante).toBe('prestamo')
  })

  it('clientes: la línea de identidad lleva cédula, teléfono y ruta', () => {
    // «El teléfono y la ruta suben a la línea de identidad» (T03-03). Antes
    // llevaba quien lo creo y cuantos prestamos tiene: dos cosas que no sirven
    // para reconocer a la persona que tienes delante.
    const [c] = adaptarClientes([{
      id: '1', nombre: 'Carlos Prueba', cedula: '81283812',
      telefono: '310 452 1188', rutaNombre: 'Ruta sur', saldoPendienteTotal: 4819999,
    }], 'CO')
    expect(c.contexto).toBe('CC 81283812 · 310 452 1188 · Ruta sur')
  })

  it('clientes: sin nada vencido, «Cumple» no sale — no un 0% falso', () => {
    // Un 0% en un cliente que acaba de recibir el prestamo lo pinta como el
    // peor de la lista, y es justo al reves.
    const [nuevo] = adaptarClientes([{ id: '1', nombre: 'Ana', saldoPendienteTotal: 100, cumplimiento: null }], 'CO')
    expect(nuevo.cifras.some((x) => x.etiqueta === 'Cumple')).toBe(false)

    const [viejo] = adaptarClientes([{ id: '2', nombre: 'Ana', saldoPendienteTotal: 100, cumplimiento: 31 }], 'CO')
    const cumple = viejo.cifras.find((x) => x.etiqueta === 'Cumple')
    expect(cumple.valor).toBe('31%')
    expect(cumple.tono).toBe('contra')
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

// ── LA PASTILLA «NUEVO» LE ROBABA EL NOMBRE AL CLIENTE ──────────────────────
//
// Reportado: «la etiqueta de Nuevo en la ficha del cliente desplaza mucho el
// nombre». Medido a 393px con el caso de su captura —cliente recién creado y
// CON préstamo, así que el monto ocupa la derecha—:
//
//     sin la pastilla   nombre 160px · 1 renglón
//     con la pastilla   nombre  79px · 3 renglones
//
// Le robaba 81px de 160: más de la mitad. «Carlos Andres Ojeda» salía partido
// en tres líneas.
//
// ⚠ EL COMENTARIO QUE HABÍA DECÍA QUE NO PODÍA PASAR: «va delante del nombre,
// el `flex: none` impide que le robe ancho». `flex: none` impide que la
// pastilla SE ENCOJA, no que OCUPE. Son dos cosas distintas y me lo creí sin
// medirlo.
describe('el nombre del cliente tiene su línea entera', () => {
  it('la pastilla «Nuevo» NO comparte línea con el nombre', () => {
    // La línea del nombre es el `<span>` que lo envuelve. Si la pastilla
    // vuelve ahí dentro, el nombre pierde la mitad del ancho.
    const iNombre = tarjeta.indexOf('EL NOMBRE NO SE CORTA NUNCA')
    const iCierre = tarjeta.indexOf('</span>', tarjeta.indexOf('{nombre}'))
    const lineaDelNombre = tarjeta.slice(
      tarjeta.lastIndexOf('<span style={{ display: \'flex\'', iNombre), iCierre)
    expect(lineaDelNombre, 'la pastilla volvió a la línea del nombre')
      .not.toMatch(/Creado en las últimas 24 horas/)
  })

  it('y sí está en la fila de estado, con «Al día»', () => {
    // No se pierde: esa fila es donde el ojo va a buscar en qué situación está
    // el cliente, y las dos pastillas juntas se leen de una pasada.
    const iFila = tarjeta.search(/\{\([^)]*etiquetaEstado[^)]*\) && \(/)
    expect(iFila).toBeGreaterThan(-1)
    const fila = tarjeta.slice(iFila, iFila + 2200)
    expect(fila, 'la pastilla «Nuevo» ya no se pinta en la fila de estado')
      .toMatch(/Creado en las últimas 24 horas/)
  })

  it('esa fila envuelve, así que la pastilla no estruja a su vecina', () => {
    /* Aquí sí puede ir delante de «Al día»: con `flexWrap` la que no cabe baja
       de renglón. En la línea del nombre no había esa salida — el nombre no
       podía bajar, solo estrecharse. */
    const iFila = tarjeta.search(/\{\([^)]*etiquetaEstado[^)]*\) && \(/)
    expect(tarjeta.slice(iFila, iFila + 600)).toMatch(/flexWrap: 'wrap'/)
  })
})
