// components/ui/BotonCompartirRecibo.jsx
// Comparte el comprobante de pago como IMAGEN (PNG) directo al WhatsApp
// (o cualquier app) via la hoja de compartir nativa — sin descargar archivo.
// Pedido por cliente: "que el comprobante se pueda compartir en imagen
// directamente al WhatsApp y no descargar el archivo".
//
// Se dibuja en canvas (sin dependencias tipo html2canvas) reusando el mismo
// patron probado en QrClienteModal. En escritorio (sin navigator.share de
// archivos) cae a descarga del PNG.
'use client'

import { formatMoney } from '@/lib/i18n'
import { abreviaturaDocumento } from '@/lib/documento'
import { getDefaultCampos } from '@/components/recibos/CamposReciboEditor'
import { resolverCampo } from '@/components/ui/BotonImprimirRecibo'
// El reparto interés/capital lo MIDE el servidor; aquí solo se comprueba que la
// cifra sea de ESTE pago. Misma disciplina que `saldoAntesDeEstePago`.
import { repartoDeEstePago, tituloDelTipoDePago, notaDelReparto } from '@/lib/recibo-derivados'
// Los iconos de línea y la rejilla viven aparte: son dibujo puro, se prueban
// sin montar React y los reusa cualquier papel que se genere como imagen.
import { ico, rejilla, monograma, encoge, apilada, raya } from '@/lib/recibo-dibujo'

const SHARE_ICON = (
  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
  </svg>
)

function fmtFecha(d) {
  if (!d) return 'N/A'
  return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtFechaHora(d) {
  const f = d ? new Date(d) : new Date()
  /* Mes ENTERO y «a las». En corto el ICU nuevo escribe «7 de ago de 2026»,
     con un «de» de mas que chirria, y en un comprobante hay sitio de sobra
     para la fecha completa: es el papel al que se recurre cuando hay una
     discusion sobre si se pago o no. */
  return f.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
    + ' a las ' + f.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

// Dibuja el recibo termico en un canvas y lo devuelve.
// Exportada por la misma razón que `generarHTMLRecibo`: la imagen del recibo se
// pide desde los tres caminos y tiene que salir idéntica en todos.
/* ⚠ LAS PIEZAS DE ABAJO SE EXPORTAN, NO SE COPIAN. La imagen de la simulación
 * (`lib/simulacion-imagen.js`) dibuja con las mismas: si se duplicaran, el día
 * que cambie el dorado cambiaría en un papel y no en el otro, y el cliente
 * recibiría dos documentos del mismo negocio con dos estilos. Es la misma razón
 * por la que `dibujarRecibo` ya estaba exportada.
 */
/* ══ LOS COLORES DE LA MARCA, EN HEX ═══════════════════════════════════════
 *
 * ⚠ CANVAS NO RESUELVE `var(--cf-…)`, y NO AVISA. `ctx.strokeStyle =
 * 'var(--cf-border)'` no lanza nada: la propiedad se descarta y se queda el
 * valor anterior, que de fábrica es NEGRO. Este archivo dibujaba el marco del
 * recibo así, y de ahí el borde negro de 2px alrededor de todo: literalmente
 * «un cuadradito feo». El mismo fallo estaba en `FirmaDigital` (5 veces) y en
 * la pantalla de préstamo nuevo.
 *
 * Aquí van en hex, copiados de `app/tokens-2026.css`. Si cambia el dorado en
 * la app, cambia aquí. */
export const TINTA = {
  gold: '#E7A400', goldInk: '#3A2900', goldTint: '#FDF3D6',
  ink: '#15161A', ink2: '#4A4E57', ink3: '#63676F', ink4: '#8E929A',
  green: '#12A150', greenTint: '#E8F6EE',
  card: '#FFFFFF', cardAlt: '#F9F9F6', border: '#E4E4E1', borderSoft: '#EDEDEA',
  surface: '#F1F1EC',   // el hueso del fondo: el PNG no puede salir transparente
}

/* Las familias REALES que está usando la página. `next/font` genera un nombre
   de familia distinto en cada compilación (`__Manrope_abc123`), así que no se
   puede escribir a mano: se lee del DOM. Si algo falla, sans del sistema. */
export function familias() {
  try {
    const raiz = getComputedStyle(document.documentElement)
    const manrope = raiz.getPropertyValue('--font-manrope').trim()
    const grotesk = raiz.getPropertyValue('--font-space-grotesk').trim()
    const sistema = '"Segoe UI", system-ui, -apple-system, sans-serif'
    return {
      texto: manrope ? `${manrope}, ${sistema}` : sistema,
      cifra: grotesk ? `${grotesk}, ${sistema}` : sistema,
    }
  } catch {
    return { texto: 'sans-serif', cifra: 'sans-serif' }
  }
}


/* ══ LAS PIEZAS DEL PAPEL ══════════════════════════════════════════════════ */

/** Un rectángulo redondeado, con salida para navegadores sin `roundRect`. */
export function caja(ctx, x, y, w, h, r) {
  const radio = Math.min(r, h / 2, w / 2)
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, radio)
  else ctx.rect(x, y, w, h)
  return ctx
}


/**
 * Parte un texto en renglones que quepan en `ancho`, sin cortar palabras.
 *
 * ⚠ AQUÍ SE PERDÍA EL NOMBRE DEL NEGOCIO. Antes se encogía la letra en un bucle
 * con suelo de 13px y, pasado ese suelo, lo que sobraba se iba fuera del papel y
 * el recorte del ticket se lo comía. Con un nombre normal no se nota; PRESTA MIL
 * usa de nombre una frase entera —«PRESTA MIL 3223846884 número SUPERVISOR para
 * información sobre su crédito o reclamos»— y en su comprobante se leía hasta
 * «reclam» y se acababa el mundo. Es el dato por el que el cliente sabe a quién
 * le pagó: no puede quedar cortado.
 */
export function renglones(ctx, texto, ancho, maximo = 3) {
  const palabras = String(texto).split(/\s+/).filter(Boolean)
  const lineas = []
  let actual = ''
  for (const pal of palabras) {
    const prueba = actual ? `${actual} ${pal}` : pal
    if (ctx.measureText(prueba).width <= ancho || !actual) { actual = prueba; continue }
    lineas.push(actual)
    actual = pal
    if (lineas.length === maximo) break
  }
  if (lineas.length < maximo && actual) lineas.push(actual)
  return lineas.slice(0, maximo)
}

/**
 * El fondo de garabatos, como el del papel tapiz de WhatsApp.
 *
 * Lo pidió el dueño para que el comprobante se lea como algo hecho, no como una
 * captura. Son trazos del mundo del negocio —billete, moneda, visto, calendario
 * y las barras del logo— repartidos en una rejilla al tresbolillo y girados un
 * poco, para que no se vea la cuadrícula.
 *
 * ⚠ MUY FLOJO A PROPÓSITO. Es papel tapiz, no decoración: en cuanto se ve, le
 * quita sitio a la cifra, que es lo único que este papel tiene que responder.
 */
export function garabatos(ctx, w, h, alfa = 0.055) {
  const PASO = 96
  ctx.save()
  ctx.globalAlpha = alfa
  ctx.strokeStyle = TINTA.ink3
  ctx.fillStyle = TINTA.ink3
  ctx.lineWidth = 1.6
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  let n = 0
  for (let fy = PASO * 0.5; fy < h + PASO; fy += PASO) {
    for (let fx = (n % 2 ? PASO * 0.5 : 0) + PASO * 0.5; fx < w + PASO; fx += PASO) {
      const cual = (n * 7 + Math.round(fx / PASO) * 3) % 5
      ctx.save()
      ctx.translate(fx, fy)
      // Giro fijo por posición: `Math.random()` daría un fondo distinto en cada
      // comprobante del mismo cobro, y el papel tiene que ser reproducible.
      ctx.rotate((((n * 13 + Math.round(fx / PASO) * 29) % 24) - 12) * Math.PI / 180)
      const R = 13
      if (cual === 0) {                       // billete
        ctx.beginPath(); ctx.rect(-R, -R * 0.62, R * 2, R * 1.24); ctx.stroke()
        ctx.beginPath(); ctx.arc(0, 0, R * 0.3, 0, Math.PI * 2); ctx.stroke()
      } else if (cual === 1) {                // moneda con el signo
        ctx.beginPath(); ctx.arc(0, 0, R * 0.85, 0, Math.PI * 2); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, -R * 0.5); ctx.lineTo(0, R * 0.5); ctx.stroke()
      } else if (cual === 2) {                // el visto
        ctx.beginPath()
        ctx.moveTo(-R * 0.7, 0); ctx.lineTo(-R * 0.15, R * 0.55); ctx.lineTo(R * 0.75, -R * 0.6)
        ctx.stroke()
      } else if (cual === 3) {                // calendario
        ctx.beginPath(); ctx.rect(-R * 0.8, -R * 0.7, R * 1.6, R * 1.5); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(-R * 0.8, -R * 0.2); ctx.lineTo(R * 0.8, -R * 0.2); ctx.stroke()
      } else {                                // las tres barras de la marca
        const anc = R * 0.32
        ;[R * 0.5, R * 0.85, R * 1.2].forEach((alto, i) => {
          ctx.beginPath()
          ctx.rect(-R * 0.75 + i * (anc * 1.7), R * 0.6 - alto, anc, alto)
          ctx.stroke()
        })
      }
      ctx.restore()
      n++
    }
    n++
  }
  ctx.restore()
}


/** La línea fina que separa bloques. */
export function hairline(ctx, x1, y, x2) {
  ctx.save()
  ctx.strokeStyle = TINTA.borderSoft
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x1, y + 0.5)
  ctx.lineTo(x2, y + 0.5)
  ctx.stroke()
  ctx.restore()
}


/* ══ EL COMPROBANTE · «H8 · Verde y oro» ═══════════════════════════════════
 *
 * El dueño eligió esta forma entre nueve el 13 sep 2026. Lo que la define:
 *
 *   · **La franja de estado.** Una banda verde llena de lado a lado que dice
 *     PAGO RECIBIDO. Es lo único que se lee en la miniatura de WhatsApp, antes
 *     de que nadie abra la imagen.
 *   · **Cabecera de dos matices.** La trama de iconos va en el verde del
 *     estado y uno de cada tres en el dorado de la marca. ⚠ Es la única
 *     licencia sobre la regla del dorado: aquí es DIBUJO al 34 % de opacidad,
 *     no una cifra ni un botón. El monto sigue siendo tinta.
 *   · **El papel, degradado.** La misma trama sigue por el cuerpo del 5,5 % al
 *     1,3 %, así que el recibo es una pieza y no una cabecera bonita pegada a
 *     un formulario.
 *   · **A qué se aplicó este pago.** Interés y capital, con su barra. Es la
 *     diferencia entre «te pagué $200.000» y «de tus $200.000, $150.000
 *     bajaron la deuda» — la frase que evita la llamada al cobrador.
 *
 * ── EL ORDEN DE PINTADO, QUE ES LO QUE LO HACE POSIBLE ────────────────────
 *
 * El papel blanco NO se pinta al principio: el lienzo se deja transparente, se
 * escribe el recibo entero y AL FINAL se meten la trama y el blanco POR DEBAJO
 * con `destination-over`. Así no hay forma de que un dibujo tape una cifra, que
 * es justo lo que hacía el fondo de garabatos anterior. Es la idea del papel de
 * seguridad: la trama está impresa antes de que la máquina escriba encima.
 *
 * ── LO QUE ESTE PAPEL HACE, ADEMÁS DE PINTARSE ────────────────────────────
 *
 * Un rediseño pierde funciones en silencio, así que la lista va escrita:
 *   1. El nombre del negocio en hasta tres renglones, sin recortar.
 *   2. El nombre y el documento del cliente bajan de renglón, nunca se cortan.
 *   3. Los campos los elige el prestamista, incluidos los de texto libre.
 *   4. «Progreso» se saca de la lista y se pinta como barra.
 *   5. La referencia son los últimos 8 del id del pago.
 *   6. La línea legal: el software no es el acreedor.
 *   7. Alto mínimo 16:9, y el aire que sobra se reparte entre las filas para
 *      que no quede un palmo en blanco encima del pie.
 */

const VERDE_HONDO = '#0B5F35'
const ROJO = '#9A2C08'
const AZUL = '#1D4E89'

/* Los iconos de la trama. Fuera casa, tienda, teléfono y pin: a tamaño pequeño
   leen como pegatinas. Quedan los del dinero. */
const TRAMA_CABECERA = ['billete', 'moneda', 'recibo', 'grafico', 'hucha', 'bolsa', 'candado', 'visto', 'calendario', 'reloj']
const TRAMA_PAPEL = ['billete', 'moneda', 'recibo', 'hucha', 'bolsa', 'calendario', 'grafico', 'candado']

/** El icono de cada renglón es el de ESE dato, no un adorno. */
const ICONO_DE_CAMPO = {
  totalPagado: 'hucha', saldoAntes: 'reloj', saldoPendiente: 'bolsa',
  totalAPagar: 'billete', cuota: 'calendario', montoPrestado: 'billete',
  frecuencia: 'calendario', fechaVencimiento: 'calendario',
  numeroCuota: 'recibo', cuotasRestantes: 'recibo',
  diasMora: 'reloj', moraDiaria: 'reloj', totalMora: 'reloj',
  excedente: 'moneda', excedenteAplicado: 'grafico',
  clienteCedula: 'recibo', clienteTelefono: 'telefono',
  ruta: 'pin', cobrador: 'persona',
}

/** `Pago.tipo` en palabras del cliente. Sin tipo es una cuota normal. */
/** Una fila de dato: rótulo a la izquierda, valor a la derecha. */
function fila(ctx, L, R, y, rotulo, valor, SANS, MONO, tam) {
  const t = tam || 14
  ctx.textAlign = 'left'
  ctx.fillStyle = TINTA.ink3
  ctx.font = `500 ${t}px ${SANS}`
  ctx.fillText(String(rotulo), L, y)
  ctx.textAlign = 'right'
  ctx.fillStyle = TINTA.ink2
  ctx.font = `700 ${t}px ${MONO}`
  ctx.fillText(String(valor), R, y)
  ctx.textAlign = 'left'
}

/**
 * Un renglón de la tabla, con su icono.
 *
 * ⚠ SI EL VALOR NO CABE, BAJA DE RENGLÓN. No se encoge ni se recorta: en esta
 * tabla van el nombre, el documento, el teléfono y la dirección, que son lo que
 * identifica a la persona, y cortados no sirven para nada. Devuelve la `y` en
 * que acaba, que puede ser dos o tres renglones más abajo.
 */
function filaExtracto(ctx, L, R, y, d, SANS, MONO, colorIcono) {
  const [rotulo, valor, icono, clase] = d
  const esTexto = clase === 'txt'
  const sangria = 30
  if (icono) ico(ctx, icono, L + 9, y - 5, 19, colorIcono, 1.6)

  ctx.textAlign = 'left'
  ctx.fillStyle = TINTA.ink3
  ctx.font = `500 14px ${SANS}`
  const anchoRotulo = ctx.measureText(String(rotulo)).width
  ctx.fillText(String(rotulo), L + sangria, y)

  ctx.font = `${esTexto ? '700' : '500'} 15px ${esTexto ? SANS : MONO}`
  const hueco = (R - L) - sangria - anchoRotulo - 18
  if (ctx.measureText(String(valor)).width <= hueco) {
    ctx.textAlign = 'right'
    ctx.fillStyle = TINTA.ink
    ctx.fillText(String(valor), R, y)
    ctx.textAlign = 'left'
    return y
  }
  // No cabe al lado: va debajo, a la izquierda, partido en renglones enteros.
  ctx.fillStyle = TINTA.ink
  for (const linea of renglones(ctx, valor, (R - L) - sangria, 3)) {
    y += 19
    ctx.fillText(linea, L + sangria, y)
  }
  return y
}

export function dibujarRecibo(cliente, prestamo, pago, orgNombre, camposRecibo) {
  /* ⚠ 540 DE ANCHO, NO 620, Y VERTICAL. A escala 2 salen 1080 px de ancho, que
     es la medida de una foto de móvil. Lo pidió el dueño: «hacerlo más largo,
     más ordenado, el tamaño como el estándar de móvil». */
  const W = 540
  const L = 44
  const R = W - 44
  const { texto: SANS, cifra: MONO } = familias()

  const campos = (Array.isArray(camposRecibo) && camposRecibo.length > 0)
    ? camposRecibo
    : getDefaultCampos()
  const tieneCedula = cliente?.cedula && !String(cliente.cedula).startsWith('SIN-')

  /* Cada fila lleva su icono y si es texto o cifra, para que la tabla los pinte
     sin volver a preguntar qué campo era. */
  const filas = campos
    .map((c) => {
      const v = c.tipo === 'texto' ? c.valor : resolverCampo(c.campo, cliente, prestamo, pago)
      const icono = c.tipo === 'texto' ? 'recibo' : (ICONO_DE_CAMPO[c.campo] || 'recibo')
      // Las cifras van en la familia de los números para que queden a plomo;
      // lo demás, en la de texto.
      const clase = /^[$\d]/.test(String(v ?? '').trim()) ? 'num' : 'txt'
      return [c.nombre, v, icono, clase]
    })
    .filter(([, v]) => v != null && String(v).trim() !== '' && String(v) !== '-' && String(v) !== '—')

  // El progreso se saca de las filas para pintarlo como barra, que dice más que
  // un número suelto.
  const iProg = filas.findIndex(([r]) => /progreso/i.test(String(r)))
  const progreso = iProg >= 0 ? filas.splice(iProg, 1)[0] : null
  const pct = progreso ? Math.max(0, Math.min(100, parseFloat(String(progreso[1])) || 0)) : null

  // El cliente y su documento abren la tabla. La cédula solo se repite si el
  // dueño no la puso ya como campo suyo.
  const yaPideCedula = campos.some((c) => c.tipo === 'dato' && c.campo === 'clienteCedula')
  const cabeceraTabla = [['Cliente', cliente?.nombre ?? '—', 'persona', 'txt']]
  if (tieneCedula && !yaPideCedula) {
    cabeceraTabla.push(['Documento', `${abreviaturaDocumento()} ${cliente.cedula}`, 'recibo', 'txt'])
  }
  const tabla = cabeceraTabla.concat(filas)

  const referencia = pago?.id ? String(pago.id).slice(-8).toUpperCase() : null

  /* ── El estado ─────────────────────────────────────────────────────────
     `diasMora` lo manda el API con la respuesta del pago. ⚠ Cuando NO viene
     —una reimpresión desde la ficha— no se pinta etiqueta: decir «AL DÍA» sin
     saberlo es poner por escrito algo que puede ser falso, en un papel que el
     cliente guarda. */
  /* ⚠ `Number(null)` ES 0, NO NaN. Con `diasMora: null` —que es lo que manda
     una reimpresión desde la ficha— la comprobación de `isFinite` daba cierto,
     la mora salía 0 y el papel estampaba «AL DÍA» sobre un préstamo del que no
     se sabía nada. Medido en la captura del 14 sep 2026. El `== null` va
     PRIMERO y caza también el `undefined`. */
  const mora = prestamo?.diasMora == null || !Number.isFinite(Number(prestamo.diasMora))
    ? null
    : Math.max(0, Math.round(Number(prestamo.diasMora)))
  const enMora = mora != null && mora > 0
  const acento = enMora ? ROJO : TINTA.green
  const tinte = enMora ? '#FDEBE3' : TINTA.greenTint
  const veloBase = enMora ? 'rgba(253,235,227,.98)' : 'rgba(232,246,238,.98)'
  const etiquetaEstado = mora == null ? '' : (enMora ? `EN MORA · ${mora} ${mora === 1 ? 'DÍA' : 'DÍAS'}` : 'AL DÍA')

  const titulo = tituloDelTipoDePago(pago?.tipo)
  const monto = formatMoney(pago?.montoPagado ?? 0)
  const reparto = repartoDeEstePago(prestamo, pago)
  const tramos = []
  if (reparto) {
    if (reparto.interes > 0) tramos.push({ rot: 'Interés del período', v: reparto.interes, color: TINTA.green, ico: 'grafico' })
    if (reparto.capital > 0) tramos.push({ rot: 'Abono al capital', v: reparto.capital, color: AZUL, ico: 'hucha' })
  }
  const nota = reparto ? notaDelReparto(pago?.tipo, reparto.interes, reparto.capital) : null

  /* ── La altura se MIDE, no se estima ───────────────────────────────────
     El nombre del negocio ocupa uno, dos o tres renglones; el número de filas
     lo decide el prestamista, y cualquiera de ellas puede bajar de renglón. La
     única forma honesta de saber cuánto mide es dibujarlo en seco. */
  const pintar = (ctx, H, aire) => {
    const medidor = ctx
    medidor.font = `700 18px ${SANS}`
    const lineasOrg = renglones(medidor, orgNombre || 'Mi negocio', W - L * 2 - 70, 3)
    const yOrg = 50
    const ySub = yOrg + (lineasOrg.length - 1) * 22 + 16
    const ALTO_CAB = ySub + 66

    // ── Cabecera: el tinte, la trama de dos matices y el velo ───────────
    ctx.save()
    ctx.beginPath(); ctx.rect(0, 0, W, ALTO_CAB); ctx.clip()
    ctx.fillStyle = tinte
    ctx.fillRect(0, 0, W, ALTO_CAB)
    rejilla(ctx, 0, 0, W, ALTO_CAB, {
      color: acento, alfa: 0.12,
      // ⚠ El dorado de la marca, y aquí sí: es dibujo al 34 %, no una cifra.
      color2: TINTA.gold, alfa2: 0.34,
      paso: 48, tam: 24, g: 1.6, lista: TRAMA_CABECERA,
    })
    ctx.restore()

    monograma(ctx, L, 30, 42, (orgNombre || 'C')[0], '#FFFFFF', acento, 'rgba(0,0,0,.10)', SANS)

    /* El velo se MIDE contra el nombre: tapa el dibujo justo hasta donde acaba
       el texto y se deshace en 86 px. Uno de ancho fijo dejaba iconos asomando
       por detrás de la última sílaba. Y va de arriba abajo: a media altura
       partía los iconos y parecían recortados. */
    ctx.font = `700 18px ${SANS}`
    let anchoOrg = 0
    for (const linea of lineasOrg) anchoOrg = Math.max(anchoOrg, ctx.measureText(linea).width)
    const vx1 = L + 44
    const vx2 = L + 56 + anchoOrg + 86
    const velo = ctx.createLinearGradient(vx1, 0, vx2, 0)
    velo.addColorStop(0, veloBase)
    velo.addColorStop(Math.min(0.92, (56 + anchoOrg + 10 - 44) / (vx2 - vx1)), veloBase)
    velo.addColorStop(1, veloBase.replace(/[\d.]+\)$/, '0)'))
    ctx.fillStyle = velo
    ctx.fillRect(vx1, 0, vx2 - vx1, ALTO_CAB)

    ctx.textAlign = 'left'
    ctx.fillStyle = TINTA.ink
    ctx.font = `700 18px ${SANS}`
    let yy = yOrg
    for (const linea of lineasOrg) { ctx.fillText(linea, L + 56, yy); yy += 22 }
    ctx.fillStyle = acento
    ctx.font = `600 10px ${SANS}`
    ctx.fillText('COMPROBANTE DE PAGO', L + 56, ySub)

    // ── La franja del estado ────────────────────────────────────────────
    const ALTO_FRANJA = 54
    ctx.fillStyle = enMora ? ROJO : VERDE_HONDO
    ctx.fillRect(0, ALTO_CAB, W, ALTO_FRANJA)
    const cy = ALTO_CAB + ALTO_FRANJA / 2
    ico(ctx, enMora ? 'reloj' : 'visto', L + 13, cy, 24, '#FFFFFF', 2)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `800 14px ${SANS}`
    ctx.fillText(enMora ? 'PAGO RECIBIDO · EN MORA' : 'PAGO RECIBIDO', L + 34, cy + 5)
    if (etiquetaEstado) {
      ctx.textAlign = 'right'
      ctx.fillStyle = 'rgba(255,255,255,.82)'
      ctx.font = `700 11px ${SANS}`
      ctx.fillText(etiquetaEstado, R, cy + 5)
      ctx.textAlign = 'left'
    }

    // ── Qué pagó, cuánto y cuándo ───────────────────────────────────────
    let y = ALTO_CAB + ALTO_FRANJA + 62
    ctx.fillStyle = TINTA.ink3
    ctx.font = `500 13px ${SANS}`
    for (const linea of renglones(ctx, `${titulo} · ${cliente?.nombre ?? '—'}`, R - L, 2)) {
      ctx.fillText(linea, L, y)
      y += 18
    }
    y += 34

    /* La cifra que resuelve el papel. En TINTA, no en dorado: el dorado ya
       está en el dibujo de la cabecera y dos dorados en la misma imagen dejan
       al ojo sin saber dónde mirar. */
    ctx.fillStyle = TINTA.ink
    const tm = encoge(ctx, monto, R - L, 52, 28, '700', MONO)
    ctx.font = `700 ${tm}px ${MONO}`
    ctx.fillText(monto, L, y)
    y += 24
    ctx.fillStyle = TINTA.ink4
    ctx.font = `13px ${SANS}`
    ctx.fillText(fmtFechaHora(pago?.fechaPago), L, y)

    // ── A qué se aplicó ─────────────────────────────────────────────────
    if (tramos.length > 0) {
      y += 44
      ctx.fillStyle = TINTA.ink4
      ctx.font = `700 10px ${SANS}`
      ctx.fillText('A QUÉ SE APLICÓ ESTE PAGO', L, y)
      y += 14
      apilada(ctx, L, y, R - L, tramos, 9, TINTA.borderSoft)
      y += 30
      for (const t of tramos) {
        ctx.beginPath(); ctx.arc(L + 5, y - 5, 5, 0, Math.PI * 2)
        ctx.fillStyle = t.color; ctx.fill()
        ctx.fillStyle = TINTA.ink2
        ctx.font = `500 14px ${SANS}`
        ctx.fillText(t.rot, L + 18, y)
        ctx.textAlign = 'right'
        ctx.fillStyle = TINTA.ink
        ctx.font = `700 14px ${MONO}`
        ctx.fillText(formatMoney(t.v), R, y)
        ctx.textAlign = 'left'
        y += 26
      }
      if (nota) {
        y += 2
        ctx.fillStyle = TINTA.ink4
        ctx.font = `12px ${SANS}`
        for (const linea of renglones(ctx, nota, R - L, 3)) { ctx.fillText(linea, L, y); y += 16 }
        y -= 10
      }
    }

    // ── La tabla del extracto ───────────────────────────────────────────
    y += 22
    raya(ctx, L, y, R, TINTA.border)
    for (const d of tabla) {
      y += 38 + aire
      y = filaExtracto(ctx, L, R, y, d, SANS, MONO, acento)
      y += 16
      raya(ctx, L, y, R, TINTA.borderSoft)
    }

    // ── El avance del préstamo ──────────────────────────────────────────
    if (pct != null) {
      y += 38
      ctx.fillStyle = TINTA.ink3
      ctx.font = `500 13px ${SANS}`
      ctx.fillText(progreso[0], L, y)
      ctx.textAlign = 'right'
      ctx.fillStyle = acento
      ctx.font = `700 13px ${MONO}`
      ctx.fillText(`${Math.round(pct)}%`, R, y)
      ctx.textAlign = 'left'
      y += 14
      caja(ctx, L, y, R - L, 6, 999)
      ctx.fillStyle = TINTA.borderSoft
      ctx.fill()
      if (pct > 0) {
        caja(ctx, L, y, Math.max(6, (R - L) * pct / 100), 6, 999)
        ctx.fillStyle = acento
        ctx.fill()
      }
      y += 6
    }

    // ── El pie, siempre abajo del todo ──────────────────────────────────
    if (H != null) {
      let p = H - 96
      raya(ctx, L, p, R, TINTA.border)
      if (referencia) {
        p += 30
        fila(ctx, L, R, p, 'Referencia', referencia, SANS, SANS, 13)
      }
      p = H - 36
      ctx.textAlign = 'left'
      ctx.fillStyle = TINTA.ink4
      ctx.font = `11px ${SANS}`
      // Dice el papel que cumple, no solo el nombre: esta imagen se le manda al
      // deudor por WhatsApp y es de lo poco que se queda en su teléfono.
      ctx.fillText('Software de gestión: Control Finanzas · no presta dinero ni realiza cobros', L, p)
    }
    return y
  }

  // Pasada en seco: mide. Nada de lo que pinta se ve.
  const seco = document.createElement('canvas').getContext('2d')
  const yFin = pintar(seco, null, 0)

  const MINIMO = Math.round(W * 16 / 9)
  const H = Math.max(MINIMO, Math.ceil(yFin) + 40 + 96)

  /* ⚠ EL AIRE QUE SOBRA SE REPARTE, no se amontona. Con pocas filas el papel
     llegaba al alto de móvil dejando un vacío blanco de un palmo justo encima
     del pie, y parecía que faltaba algo. El tope evita que con dos filas queden
     separadas media página. */
  const sobra = Math.max(0, H - (Math.ceil(yFin) + 40 + 96))
  const aire = Math.min(14, sobra / Math.max(1, tabla.length + 2))

  const escala = 2
  const canvas = document.createElement('canvas')
  canvas.width = W * escala
  canvas.height = H * escala
  const ctx = canvas.getContext('2d')
  ctx.scale(escala, escala)

  pintar(ctx, H, aire)

  /* ── Y AHORA, POR DEBAJO ────────────────────────────────────────────────
     La trama del cuerpo y el papel blanco entran con `destination-over`, así
     que caen bajo el texto ya escrito. Ninguna cifra puede quedar tapada.
     El fondo tampoco se deja transparente: un PNG con alfa sale sobre negro en
     varias vistas de WhatsApp y el recibo acaba ilegible. */
  ctx.save()
  ctx.globalCompositeOperation = 'destination-over'
  const cuerpo0 = 200
  const cuerpo1 = H - 40
  const nFilas = Math.max(1, Math.floor((cuerpo1 - cuerpo0) / 54))
  for (let f = 0; f < nFilas; f++) {
    rejilla(ctx, 0, cuerpo0 + f * 54, W, 54, {
      color: TINTA.ink,
      alfa: 0.055 - (0.042 * f / Math.max(1, nFilas - 1)),
      paso: 54, tam: 26, g: 1.4, semilla: f, lista: TRAMA_PAPEL,
    })
  }
  ctx.fillStyle = TINTA.card
  ctx.fillRect(0, 0, W, H)
  ctx.restore()

  return canvas
}

export default function BotonCompartirRecibo({ cliente, prestamo, pago, orgNombre = '', camposRecibo, label = 'Compartir recibo' }) {
  const handleClick = () => {
    let canvas
    try {
      canvas = dibujarRecibo(cliente, prestamo, pago, orgNombre, camposRecibo)
    } catch {
      return
    }
    const nombre = `Recibo-${(cliente?.nombre || 'pago').replace(/\s+/g, '-')}.png`
    canvas.toBlob(async (blob) => {
      if (!blob) return
      const file = new File([blob], nombre, { type: 'image/png' })
      // Compartir nativo con archivo adjunto (movil): WhatsApp aparece en la hoja
      // con la imagen ya pegada, sin pasar por descargas.
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'Comprobante de pago',
            text: `Comprobante de pago${orgNombre ? ` - ${orgNombre}` : ''}`,
          })
        } catch { /* usuario cancelo */ }
        return
      }
      // Fallback escritorio: descargar el PNG.
      const link = document.createElement('a')
      link.download = nombre
      link.href = canvas.toDataURL('image/png')
      link.click()
    }, 'image/png')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex-1 flex items-center justify-center gap-2 px-3 h-10 rounded-[12px] text-sm font-medium transition-all cursor-pointer bg-[var(--cf-surface)] border border-[var(--cf-border)] text-[var(--cf-ink-3)] hover:text-[var(--cf-ink)] hover:border-[var(--cf-gold)]"
    >
      {SHARE_ICON}
      {label}
    </button>
  )
}
