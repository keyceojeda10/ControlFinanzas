// lib/papel/documento.js — el kit con el que se dibujan todos los papeles.
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «La mayoría de los PDF se ven súper feos y siempre tienen hojas de más.»
//
// Los cuatro documentos del sistema estaban escritos por separado —1.757 líneas
// entre los cuatro— y cada uno resolvía a mano la cabecera, las tarjetas, la
// tabla y el pie. No compartían nada, así que no se parecían entre ellos, ni a
// la app, y cada uno arrastraba sus propios fallos de maquetación.
//
// Aquí está el sistema: quien escribe un reporte se ocupa de LA CONSULTA y de
// QUÉ va en el papel. El cómo se ve lo pone este archivo, una sola vez.
//
// ── LAS DOS COSAS QUE ARREGLA, Y QUE NO SE VEN LEYENDO EL CÓDIGO VIEJO ─────
//
// ⚠ 1. LAS HOJAS DE MÁS. El pie se dibujaba a `alto - 32` = 760 con un margen
//    de 40, o sea por debajo del área útil (752). PDFKit, cuando le mandas
//    escribir bajo el margen, ABRE UNA PÁGINA para meterlo. Aquí el pie va
//    dentro del margen y ninguna primitiva escribe por debajo de `HOJA.suelo`.
//
// ⚠ 2. LAS TABLAS CORTADAS. Las filas se dibujaban seguidas y la página se
//    partía donde cayera: cabeceras de grupo solas al final de una hoja, una
//    fila huérfana arriba de la siguiente. `tabla()` no parte si no caben la
//    cabecera y tres filas, y **repite la cabecera de columnas** en cada hoja.
//
// ── UNA REGLA QUE NO SE PUEDE SALTAR ───────────────────────────────────────
//
// El dinero se dibuja SIEMPRE con Space Grotesk y alineado a la derecha. Es la
// misma regla del sistema en pantalla («los números son el producto; se alinean
// y se comparan»), y en papel importa más: una columna de pesos desalineada es
// ilegible para quien la revisa con el dedo.

import PDFDocument from 'pdfkit'
import { PassThrough } from 'stream'
import path from 'path'
import { COLOR, TIPO, HOJA, RADIO, FILETE } from './tokens.js'

/* Las mismas dos familias que la interfaz (`app/layout.js`). Se incrustan desde
   `public/fuentes/`; ver ahí la licencia. PDFKit no admite WOFF, que es lo
   único que trae `@fontsource`, así que son TTF de Google Fonts. */
const DIR_FUENTES = path.join(process.cwd(), 'public', 'fuentes')
export const F = {
  texto: 'Manrope',
  fuerte: 'ManropeBold',
  cifra: 'SpaceGrotesk',
  cifraFuerte: 'SpaceGroteskBold',
}

/* MANROPE NO TIENE EMOJIS, y PDFKit no lo dice: pinta un cuadrito hueco por
   cada glifo que le falta. En el espejo hay un negocio con tres moviles en el
   nombre y salian tres cajas en la cabecera y otra mas en el pie. Se quitan los
   simbolos que la fuente no cubre; los acentos y la enye estan en Latin-1 y no
   se tocan. */
export function limpiarGlifos(txt) {
  return String(txt ?? '')
    /* ⚠ EL MENOS PRIMERO, O SE LO LLEVA LA LÍNEA DE ABAJO.
       `formatMoney` escribe las cifras negativas con el menos tipográfico
       (−, U+2212) porque tiene el mismo ancho que el + y así las columnas no
       bailan. Ese carácter cae DENTRO del rango U+2190–U+2BFF que se borra a
       continuación para quitar emojis y flechas: cada cifra negativa de cada
       PDF de esta app salía SIN SIGNO.

       Lo vi en la hoja de «Movimientos por cuenta»: la fila de Efectivo decía
       «entró $0 · salió $17.225.743 · quedó $17.225.743». Quedó no puede ser
       positivo si no entró nada. En el código `limpiarGlifos(fmt(n))` parece
       correcto y no había prueba que mirara el resultado.

       Se cambia por el guion ASCII y no se salva el tipográfico: un glifo que
       la fuente no tenga se dibuja como una caja o como nada, y volveríamos al
       mismo sitio por otro camino. */
    .replace(/\u{2212}/gu, '-')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function registrarFuentes(doc) {
  doc.registerFont(F.texto, path.join(DIR_FUENTES, 'Manrope-Regular.ttf'))
  doc.registerFont(F.fuerte, path.join(DIR_FUENTES, 'Manrope-Bold.ttf'))
  doc.registerFont(F.cifra, path.join(DIR_FUENTES, 'SpaceGrotesk-Medium.ttf'))
  doc.registerFont(F.cifraFuerte, path.join(DIR_FUENTES, 'SpaceGrotesk-Bold.ttf'))
}

/**
 * Abre un documento y devuelve el `doc` de PDFKit más las primitivas del kit.
 *
 * `pie` es el rótulo de la izquierda del pie; a la derecha va siempre
 * «Página N de M», que se numera al cerrar porque hasta entonces no se sabe
 * cuántas hay.
 */
/* El pie por defecto dice el ROL, no solo la marca: estos PDF llegan a manos
   del deudor y «Control Finanzas» a secas se lee como el acreedor. */
export function abrirDocumento({ pie = 'Software de gestión: Control Finanzas · no presta dinero ni realiza cobros' } = {}) {
  const doc = new PDFDocument({
    size: 'letter',
    margin: HOJA.margen,
    bufferPages: true,   // hace falta para numerar al final
  })
  registrarFuentes(doc)

  const salida = new PassThrough()
  const trozos = []
  salida.on('data', (t) => trozos.push(t))
  const terminado = new Promise((r) => salida.on('end', r))
  doc.pipe(salida)

  const L = HOJA.margen
  const R = HOJA.ancho - HOJA.margen
  const W = HOJA.util

  /* ⚠ `lineBreak: false` en TODO. Sin él, PDFKit reparte el texto en varias
     líneas y avanza el cursor, y basta un nombre largo cerca del pie para que
     abra una hoja nueva. Aquí se coloca cada cosa por coordenadas. */
  const escribir = (txt, x, y, opciones = {}) =>
    doc.text(limpiarGlifos(txt), x, y, { lineBreak: false, ...opciones })

  /** ¿Cabe algo de alto `alto` en `y`? Si no, abre página y devuelve el nuevo y. */
  function sitio(y, alto) {
    if (y + alto <= HOJA.suelo) return y
    doc.addPage()
    return HOJA.margen
  }

  // ── CABECERA ────────────────────────────────────────────────────────────
  /**
   * El nombre del negocio grande, el título del documento debajo, la fecha, y
   * el filete dorado que lo separa del contenido. Es la firma visual: sale
   * igual en los cuatro papeles, que es justo lo que faltaba.
   */
  function cabecera({ negocio, titulo, subtitulo = '', meta = '' }) {
    /* EL NOMBRE DEL NEGOCIO CABE EN UN RENGLON, SIEMPRE.
       En el espejo hay uno de 100 caracteres —«PRESTA MIL 3223846884 numero
       SUPERVISOR para informacion sobre su credito o reclamos»— y se repartia
       en TRES lineas por encima del titulo y de la fecha: la cabecera quedaba
       ilegible. `ellipsis: true` no lo evitaba. Aqui la letra se encoge hasta
       que entra y, si aun asi no entra, se corta. */
    doc.font(F.fuerte).fillColor(COLOR.ink)
    const nombre = limpiarGlifos(negocio || 'Mi negocio')
    let tam = TIPO.titulo
    while (tam > 12 && doc.fontSize(tam).widthOfString(nombre) > W * 0.68) tam -= 1
    doc.fontSize(tam)
    escribir(nombre, L, HOJA.margen + (TIPO.titulo - tam) * 0.6, {
      width: W * 0.68, height: TIPO.titulo + 4, ellipsis: true,
    })

    doc.font(F.fuerte).fontSize(TIPO.seccion).fillColor(COLOR.ink2)
    escribir(titulo, L, HOJA.margen + 26)

    if (subtitulo) {
      doc.font(F.texto).fontSize(TIPO.texto).fillColor(COLOR.ink3)
      escribir(subtitulo, L, HOJA.margen + 44)
    }
    if (meta) {
      doc.font(F.texto).fontSize(TIPO.rotulo).fillColor(COLOR.ink4)
      escribir(meta, L, HOJA.margen + 4, { width: W, align: 'right' })
    }

    const y = HOJA.margen + (subtitulo ? 62 : 48)
    doc.rect(L, y, W, FILETE).fill(COLOR.gold)
    return y + FILETE + 16
  }

  // ── TARJETAS DE RESUMEN ─────────────────────────────────────────────────
  /**
   * La fila de cifras de arriba. `[{ rotulo, valor, tono }]` — `tono` puede ser
   * 'bueno', 'malo' o nada. Se reparten el ancho a partes iguales.
   */
  function tarjetasResumen(tarjetas, y) {
    if (!tarjetas?.length) return y
    const alto = 52
    y = sitio(y, alto)
    const hueco = 10
    const ancho = (W - hueco * (tarjetas.length - 1)) / tarjetas.length

    tarjetas.forEach((t, i) => {
      const x = L + i * (ancho + hueco)
      doc.roundedRect(x, y, ancho, alto, RADIO).fillAndStroke(COLOR.cardAlt, COLOR.border)

      doc.font(F.texto).fontSize(TIPO.rotulo).fillColor(COLOR.ink3)
      escribir(String(t.rotulo).toUpperCase(), x + 10, y + 10, { width: ancho - 20, characterSpacing: 0.4 })

      const color = t.tono === 'malo' ? COLOR.red : t.tono === 'bueno' ? COLOR.green : COLOR.ink
      doc.font(F.cifraFuerte).fontSize(TIPO.cifra).fillColor(color)
      escribir(t.valor, x + 10, y + 25, { width: ancho - 20, ellipsis: true })
    })
    return y + alto + 18
  }

  // ── CIFRAS SUELTAS ──────────────────────────────────────────────────────
  /**
   * Una fila de cifras SIN caja: rótulo arriba, número abajo. Para los bloques
   * de detalle («Clientes y préstamos», «Flujo de capital»), donde meter todo
   * en tarjetas convierte la hoja en un tablero y ya no se sabe qué mirar.
   * Las tarjetas son para lo de arriba, que es lo que manda.
   */
  function cifras(lista, y, { columnas = 4 } = {}) {
    if (!lista?.length) return y
    const hueco = 12
    const ancho = (W - hueco * (columnas - 1)) / columnas
    let maxFila = 0
    lista.forEach((s, i) => {
      const fila = Math.floor(i / columnas)
      maxFila = Math.max(maxFila, fila)
      const x = L + (i % columnas) * (ancho + hueco)
      const yy = y + fila * 38
      doc.font(F.texto).fontSize(TIPO.rotulo).fillColor(COLOR.ink3)
      escribir(String(s.rotulo).toUpperCase(), x, yy, { width: ancho, characterSpacing: 0.4 })
      const color = s.tono === 'malo' ? COLOR.red : s.tono === 'bueno' ? COLOR.green : COLOR.ink
      doc.font(F.cifraFuerte).fontSize(TIPO.texto + 3).fillColor(color)
      escribir(s.valor, x, yy + 13, { width: ancho, ellipsis: true })
      if (s.pie) {
        doc.font(F.texto).fontSize(TIPO.pie).fillColor(COLOR.ink4)
        escribir(s.pie, x, yy + 28, { width: ancho, ellipsis: true })
      }
    })
    return y + (maxFila + 1) * 38 + 6
  }

  // ── BARRAS ──────────────────────────────────────────────────────────────
  /**
   * El día a día del periodo. `datos`: `[{ etiqueta, valor }]`.
   *
   * ⚠ Solo se rotula UNA DE CADA N barras. Con 30 días y las 30 fechas
   * escritas debajo, los rótulos se solapan y el gráfico se vuelve una mancha;
   * el número que importa —el máximo— va arriba, en su barra.
   */
  function barras(datos, y, { alto = 96, titulo = null, formato = String } = {}) {
    if (!datos?.length) return y
    const altoTotal = alto + 34 + (titulo ? 18 : 0)
    y = sitio(y, altoTotal)
    if (titulo) y = seccion(titulo, y)

    const max = Math.max(...datos.map((d) => d.valor), 1)
    const hueco = datos.length > 20 ? 1 : 8
    /* Barra con TOPE de ancho. Seis meses repartidos en 532 puntos daban barras
       de 86: no parecia un grafico sino seis bloques pegados. Con tope, seis
       barras estrechas centradas se leen como una serie. */
    const ancho = Math.min(44, (W - hueco * (datos.length - 1)) / datos.length)
    const sobra = W - (ancho * datos.length + hueco * (datos.length - 1))
    const izq = L + sobra / 2
    const base = y + alto

    doc.moveTo(L, base).lineTo(R, base).lineWidth(0.5).strokeColor(COLOR.border).stroke()

    /* Con pocas barras se rotulan TODAS: seis meses con una sola cifra escrita
       obliga a adivinar las otras cinco. Con muchas (un mes de dias) solo la
       mayor, o los rotulos se pisan y el grafico se vuelve una mancha. */
    const pocas = datos.length <= 12
    const cada = Math.ceil(datos.length / 8)
    datos.forEach((d, i) => {
      const x = izq + i * (ancho + hueco)
      const h = Math.max(1, (d.valor / max) * (alto - 14))
      const esMax = d.valor === max
      doc.rect(x, base - h, ancho, h).fill(esMax ? COLOR.gold : COLOR.goldTint)
      if (esMax || (pocas && d.valor > 0)) {
        doc.font(F.cifra).fontSize(TIPO.pie).fillColor(esMax ? COLOR.ink : COLOR.ink4)
        escribir(formato(d.valor), x - 24, base - h - 10, { width: ancho + 48, align: 'center' })
      }
      if (pocas || i % cada === 0) {
        doc.font(F.texto).fontSize(TIPO.pie).fillColor(COLOR.ink4)
        escribir(d.etiqueta, x - 12, base + 5, { width: ancho + 24, align: 'center' })
      }
    })
    return base + 22
  }

  // ── TÍTULO DE SECCIÓN ───────────────────────────────────────────────────
  function seccion(texto, y) {
    y = sitio(y, 34)
    /* El titulo de seccion va OSCURO y en cuerpo 10; los rotulos de `cifras`
       van grises y en 8. Los tenia a los dos en gris 8 mayusculas, y en la hoja
       no se distinguia «CLIENTES Y PRESTAMOS» (el titulo) de «CLIENTES
       ACTIVOS» (un dato): se leia como una lista de ocho cosas iguales. La
       jerarquia solo se ve mirando la pagina. */
    doc.font(F.fuerte).fontSize(TIPO.texto).fillColor(COLOR.ink)
    escribir(texto, L, y)
    doc.moveTo(L, y + 16).lineTo(R, y + 16).lineWidth(0.5).strokeColor(COLOR.border).stroke()
    return y + 26
  }

  // ── TABLA ───────────────────────────────────────────────────────────────
  /**
   * `columnas`: `[{ clave, titulo, ancho, alinear, fuente }]`
   *   · `ancho` en proporción (se normaliza), `alinear` 'left' | 'right'
   *   · `fuente: 'cifra'` para dinero — Space Grotesk y a la derecha
   * `filas`: objetos con esas claves. Los valores ya vienen formateados.
   * `grupos`: opcional, `[{ titulo, filas }]` para agrupar (por ruta, p. ej.).
   *
   * ⚠ NO PARTE UN GRUPO si no caben su cabecera y tres filas: una cabecera de
   * ruta sola al pie de una hoja es exactamente lo que hacía que los reportes
   * parecieran mal hechos.
   */
  function tabla({ columnas, filas = [], grupos = null }, y) {
    const total = columnas.reduce((a, c) => a + (c.ancho || 1), 0)
    const anchos = columnas.map((c) => ((c.ancho || 1) / total) * W)
    /* ⚠ Un `reduce` aquí me dejaba la segunda columna ENCIMA de la primera:
       arrancaba el acumulador con [L] y luego empujaba otro L, así que `xs`
       quedaba desplazado un puesto. Con un bucle se lee y no engaña. */
    const xs = []
    let acumulado = L
    for (const ancho of anchos) { xs.push(acumulado); acumulado += ancho }
    const ALTO_FILA = 18
    /* ⚠ El renglón se le PREGUNTA a PDFKit, no se estima. Lo puse a ojo en 11pt
       y el real es 12,3: toda fila de una línea medía dos, y la tabla entera
       creció un 70 % sin que ninguna estuviera partida. Se veía en la hoja, no
       en el código. */
    const RENGLON = doc.font(F.texto).fontSize(TIPO.tabla).currentLineHeight(true)
    const RENGLON_SUB = doc.font(F.texto).fontSize(TIPO.pie).currentLineHeight(true)
    const MAX_RENGLONES = 3     // tope, para que un dato basura no reviente la fila

    /* ⚠ La alineación de la cabecera se DEDUCE igual que la de la celda. Antes
       era `c.alinear || 'left'` mientras la celda caía en `'right'` para el
       dinero: los rótulos CUOTA y DEBE quedaban a la izquierda de sus propias
       cifras. En el código no se nota; en la hoja impresa canta. */
    const alineacion = (c) => c.alinear || (c.fuente === 'cifra' ? 'right' : 'left')

    const cabeceraColumnas = (yy) => {
      doc.rect(L, yy, W, 16).fill(COLOR.cardAlt)
      doc.font(F.fuerte).fontSize(TIPO.rotulo).fillColor(COLOR.ink3)
      columnas.forEach((c, i) => {
        escribir(String(c.titulo).toUpperCase(), xs[i] + 5, yy + 5, {
          width: anchos[i] - 10, align: alineacion(c),
        })
      })
      return yy + 16
    }

    /* ⚠ LO QUE IDENTIFICA A UNA PERSONA NO SE RECORTA. Nombre, dirección,
       cédula y teléfono bajan de renglón; nunca puntos suspensivos. Es regla
       del sistema y aquí me la estaba saltando: en la prueba salió «Cra 50 #
       50-100 barrio La» y el cobrador que va a esa casa se queda sin la calle.
       Las columnas se marcan con `identidad: true`. */
    /* `sub` cuelga un segundo dato bajo el principal, en letra pequena: la
       direccion debajo del nombre.

       ⚠ Y no es cosmetico. Con la direccion en COLUMNA PROPIA, cada una tenia
       128 puntos y casi todas se partian en dos o tres renglones: el listado
       del espejo —984 prestamos— salia en 86 hojas, el doble que antes. Debajo
       del nombre dispone del ancho de las dos columnas juntas y entra en una
       linea. Es la misma solucion de la version vieja, y estaba puesta por algo
       que solo se ve contando paginas. */
    const altoDeFila = (fila) => {
      let renglones = 1
      let subs = 0
      columnas.forEach((c, i) => {
        if (c.identidad) {
          const alto = doc.font(F.texto).fontSize(TIPO.tabla)
            .heightOfString(String(fila[c.clave] ?? ''), { width: anchos[i] - 10 })
          renglones = Math.max(renglones, Math.min(MAX_RENGLONES, Math.round(alto / RENGLON)))
        }
        if (c.sub && fila[c.sub]) {
          const alto = doc.font(F.texto).fontSize(TIPO.pie)
            .heightOfString(String(fila[c.sub]), { width: anchos[i] - 10 })
          subs = Math.max(subs, Math.min(2, Math.round(alto / RENGLON_SUB)))
        }
      })
      const cuerpo = renglones * RENGLON + subs * RENGLON_SUB
      return cuerpo + 8 <= ALTO_FILA ? ALTO_FILA : cuerpo + 8
    }

    /* `titulo` se usa para reponer «Ruta sur (viene de la página anterior)»
       cuando un grupo se parte: la cabecera de columnas ya se repetía, pero sin
       el nombre del grupo la segunda hoja no dice de quién son esas filas. */
    const pintarFilas = (lista, yy, titulo = null) => {
      lista.forEach((fila, n) => {
        const alto = altoDeFila(fila)
        if (yy + alto > HOJA.suelo) {
          doc.addPage()
          yy = HOJA.margen
          if (titulo) {
            doc.font(F.fuerte).fontSize(TIPO.texto).fillColor(COLOR.ink)
            escribir(titulo, L, yy)
            doc.font(F.texto).fontSize(TIPO.rotulo).fillColor(COLOR.ink4)
            escribir('viene de la página anterior', L, yy + 3, { width: W, align: 'right' })
            yy += 15
          }
          yy = cabeceraColumnas(yy)
        }
        if (n % 2 === 1) doc.rect(L, yy, W, alto).fill(COLOR.cardAlt)
        columnas.forEach((c, i) => {
          const esCifra = c.fuente === 'cifra'
          doc.font(esCifra ? F.cifra : F.texto).fontSize(TIPO.tabla)
          doc.fillColor(fila[`${c.clave}Color`] || (esCifra ? COLOR.ink : COLOR.ink2))
          const opciones = { width: anchos[i] - 10, align: alineacion(c) }
          /* Pastilla: `fila.moraPastilla = { fondo, color }`. Existe porque la
             mora hay que verla de un vistazo con el papel en la mano y el sol
             encima; un número más en una columna de números no se ve. */
          const past = fila[`${c.clave}Pastilla`]
          if (past) {
            const txt = String(fila[c.clave] ?? '')
            const ancho = Math.min(
              doc.font(F.fuerte).fontSize(TIPO.rotulo).widthOfString(txt) + 12,
              anchos[i] - 8,
            )
            const bx = xs[i] + (anchos[i] - ancho) / 2
            doc.roundedRect(bx, yy + 3, ancho, 13, 6).fill(past.fondo)
            doc.font(F.fuerte).fontSize(TIPO.rotulo).fillColor(past.color)
            escribir(txt, bx, yy + 6, { width: ancho, align: 'center' })
          } else if (c.identidad) {
            // `height` recorta a los renglones que ya se midieron; sin él una
            // cadena larga se comería la fila siguiente.
            doc.text(limpiarGlifos(fila[c.clave]), xs[i] + 5, yy + 5, {
              ...opciones, height: alto - 8, lineGap: 0,
            })
          } else {
            escribir(fila[c.clave], xs[i] + 5, yy + 5, { ...opciones, ellipsis: true })
          }
          if (c.sub && fila[c.sub]) {
            doc.font(F.texto).fontSize(TIPO.pie).fillColor(COLOR.ink4)
            doc.text(limpiarGlifos(fila[c.sub]), xs[i] + 5, yy + 5 + RENGLON, {
              width: anchos[i] - 10, height: RENGLON_SUB * 2, lineGap: 0,
            })
          }
        })
        yy += alto
      })
      return yy
    }

    if (!grupos) {
      y = sitio(y, 16 + ALTO_FILA * 3)
      y = cabeceraColumnas(y)
      return pintarFilas(filas, y) + 10
    }

    for (const g of grupos) {
      if (!g.filas?.length) continue
      // La cabecera del grupo y tres filas van juntas o no van.
      y = sitio(y, 22 + 16 + ALTO_FILA * Math.min(3, g.filas.length))
      doc.font(F.fuerte).fontSize(TIPO.texto).fillColor(COLOR.ink)
      escribir(g.titulo, L, y)
      if (g.nota) {
        doc.font(F.texto).fontSize(TIPO.rotulo).fillColor(COLOR.ink4)
        escribir(g.nota, L, y, { width: W, align: 'right' })
      }
      y = cabeceraColumnas(y + 15)
      y = pintarFilas(g.filas, y, g.titulo) + 14
    }
    return y
  }

  // ── AVISO / NOTA ────────────────────────────────────────────────────────
  /** Un párrafo dentro de un recuadro suave. Para explicaciones y advertencias. */
  function nota(texto, y, { tono = 'neutro' } = {}) {
    const alto = doc.font(F.texto).fontSize(TIPO.texto).heightOfString(texto, { width: W - 24 }) + 18
    y = sitio(y, alto)
    const fondo = tono === 'malo' ? COLOR.redTint : tono === 'acento' ? COLOR.goldTint : COLOR.cardAlt
    doc.roundedRect(L, y, W, alto, RADIO).fillAndStroke(fondo, COLOR.border)
    doc.font(F.texto).fontSize(TIPO.texto).fillColor(COLOR.ink2)
    doc.text(limpiarGlifos(texto), L + 12, y + 9, { width: W - 24 })
    return y + alto + 14
  }

  // ── CIERRE ──────────────────────────────────────────────────────────────
  /**
   * Pinta el pie en todas las páginas y devuelve el Buffer.
   *
   * ⚠ El pie va a `HOJA.pieY`, DENTRO del margen. Escribirlo más abajo es lo
   * que abría una hoja extra por cada página.
   */
  async function cerrar() {
    const rango = doc.bufferedPageRange()
    for (let i = rango.start; i < rango.start + rango.count; i++) {
      doc.switchToPage(i)
      doc.moveTo(L, HOJA.pieY - 8).lineTo(R, HOJA.pieY - 8)
        .lineWidth(0.5).strokeColor(COLOR.borderSoft).stroke()
      doc.font(F.texto).fontSize(TIPO.pie).fillColor(COLOR.ink4)
      /* ⚠ `height` + `ellipsis` OBLIGAN A UN RENGLON, y sin eso el pie era la
         causa de las hojas de mas.
         `lineBreak: false` no basta: PDFKit reparte igual si el texto no cabe
         en `width`. En el espejo hay un negocio cuyo nombre son 100 caracteres,
         el pie se partia en dos, y el segundo renglon —a 742, con el suelo en
         752— ABRIA UNA PAGINA. Una por cada pagina: el listado salia en 90
         hojas y el propio pie decia «Pagina 45 de 45». La ultima llevaba dos
         palabras sueltas y nada mas.
         Se vio contando las paginas del PDF y mirando la ultima; el numero que
         imprime el documento mentia. */
      escribir(pie, L, HOJA.pieY, { width: W * 0.62, height: TIPO.pie + 2, ellipsis: true })
      escribir(`Página ${i - rango.start + 1} de ${rango.count}`, L, HOJA.pieY, {
        width: W, align: 'right', height: TIPO.pie + 2,
      })
    }
    doc.end()
    await terminado
    return Buffer.concat(trozos)
  }

  return { doc, L, R, W, escribir, sitio, cabecera, tarjetasResumen, cifras, barras, seccion, tabla, nota, cerrar }
}

/** La respuesta HTTP de un PDF, con el nombre de archivo ya puesto. */
export function respuestaPdf(buffer, nombre) {
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'no-store',
    },
  })
}
