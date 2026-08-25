// lib/simulacion-imagen.js
//
// ══ LA SIMULACIÓN, COMO SE VE ══════════════════════════════════════════════
//
// «Cuando se realiza la simulación de un préstamo y se comparte, normalmente se
//  comparte en texto; sería bueno que se compartiera como se ve en la tabla de
//  la simulación.»            — Préstamos Rincón, 23 ago 2026, con la captura
//
// El texto de hoy lleva monto, cuota, número de cuotas, total e interés. Lo que
// el prestamista le enseña al cliente en la pantalla —y lo que el cliente
// quiere ver— es el desglose: cuánto de cada cobro es capital y cuánto interés,
// y en qué fecha cae cada uno.
//
// ── POR QUÉ TABLA Y NO FICHAS ──────────────────────────────────────────────
//
// En la app la regla es «PC = tabla, móvil = fichas», y esto se mira en un
// móvil. Pero esto NO es la app: es un papel que sale del teléfono y llega al
// chat de otra persona. Con 12 cobros —530 de las 570 tablas de la base— las
// fichas de la pantalla darían una tira de más de metro y medio de píxeles, y
// en WhatsApp eso se ve como una astilla. En columnas cabe, y además es lo que
// él llamó «la tabla».
//
// ── LA MEDIDA ──────────────────────────────────────────────────────────────
//
// 540 de ancho por 2 de escala = 1080 px, la foto de móvil, IGUAL que el
// recibo. Los dos papeles del mismo negocio no pueden llegar con dos anchos.
//
// ⚠ Y LOS COLORES VAN EN HEX. Canvas no resuelve `var(--cf-…)` y no avisa: la
//   asignación se descarta y se queda el color anterior, que de fábrica es
//   negro. De ahí salió el borde negro del recibo. Aquí se usa `TINTA`, que es
//   la misma tabla que él, importada y no copiada.

import { formatMoney } from '@/lib/i18n'
import { BLOQUE } from '@/components/cf/bloqueOscuro'
import { TINTA, familias, caja, renglones, garabatos, hairline } from '@/components/ui/BotonCompartirRecibo'
import { compartirLienzo } from '@/lib/lienzo-compartir'

const W = 540
const MARGEN = 20
const PAD = 26

/* Cuánto mide cada renglón de la tabla. 34 no es un número suelto: con los 67
   cobros del préstamo más largo de la base el papel queda en 2.700 px de alto,
   que WhatsApp todavía enseña entero. Con los 56 de una ficha se iba a 4.200. */
const ALTO_FILA = 34
const ALTO_CABEZA_TABLA = 30

const ROTULO_PERIODO = {
  diario: 'Día', semanal: 'Semana', quincenal: 'Quincena', mensual: 'Mes',
}

function fmtFechaCorta(d) {
  if (!d) return ''
  const f = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(f.getTime())) return ''
  /* ⚠ SIN EL «de». El ICU nuevo mete «29 de ago» en `month:'short'`, y son
     12 px que no caben en una columna de 96. Se arma a mano. */
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${f.getDate()} ${MES[f.getMonth()]}`
}

/** Encoge la fuente hasta que el texto quepa. Devuelve el tamaño que entró. */
function achicarHasta(ctx, texto, ancho, familia, peso, desde, hasta = 10) {
  let t = desde
  ctx.font = `${peso} ${t}px ${familia}`
  while (t > hasta && ctx.measureText(texto).width > ancho) {
    t -= 1
    ctx.font = `${peso} ${t}px ${familia}`
  }
  return t
}

/**
 * Dibuja la simulación con su desglose y devuelve el lienzo.
 *
 * @param datos.tabla        filas de `calculo.tablaAmortizacion`
 * @param datos.frecuencia   para rotular el período
 * @param datos.orgNombre    quién la manda
 * @param datos.resumen      pares [rótulo, valor] del bloque de arriba
 * @param datos.cuotaTexto   la cifra grande del bloque oscuro
 * @param datos.cuotaPie     la línea de contexto bajo la cifra
 */
export function dibujarSimulacion({ tabla, frecuencia = 'mensual', orgNombre = '', resumen = [], cuotaTexto = '', cuotaPie = '' } = {}) {
  const filas = Array.isArray(tabla) ? [...tabla].sort((a, b) => a.numeroPeriodo - b.numeroPeriodo) : []
  const { texto: SANS, cifra: MONO } = familias()

  const L = MARGEN + PAD
  const R = W - MARGEN - PAD
  const ANCHO = R - L

  // La altura se MIDE antes de crear el lienzo: el nombre del negocio ocupa uno
  // o dos renglones y las filas son las que sean.
  const medidor = document.createElement('canvas').getContext('2d')
  medidor.font = `700 22px ${SANS}`
  const lineasOrg = renglones(medidor, orgNombre || 'Simulación', ANCHO, 2)

  const ALTO_CABECERA = 42 + lineasOrg.length * 28 + 14
  /* ⚠ 134, Y NO 118. Con 118 la línea de contexto caía a 6 px de la línea base
     de la cifra y las dos se PISABAN — «$260.700–$259.205» encima de «cada mes
     · 8 veces». En el código no se ve: solo aparece generando el PNG y
     mirándolo. Las tres alturas de dentro salen de aquí y no de números
     sueltos, para que subir el bloque las mueva a las tres. */
  const ALTO_BLOQUE = 134
  const ALTO_RESUMEN = resumen.length * 28 + 14
  const ALTO_TABLA = filas.length ? ALTO_CABEZA_TABLA + filas.length * ALTO_FILA + 10 : 0
  const ALTO_PIE = 58
  const H = MARGEN * 2 + PAD * 2 + ALTO_CABECERA + ALTO_BLOQUE + 20 + ALTO_RESUMEN + ALTO_TABLA + ALTO_PIE

  const escala = 2
  const canvas = document.createElement('canvas')
  canvas.width = W * escala
  canvas.height = H * escala
  const ctx = canvas.getContext('2d')
  ctx.scale(escala, escala)

  /* El fondo NO se deja transparente: un PNG con alfa sale sobre negro en
     varias vistas de WhatsApp y el papel acaba ilegible. */
  ctx.fillStyle = TINTA.surface
  ctx.fillRect(0, 0, W, H)
  garabatos(ctx, W, H)

  // El papel
  caja(ctx, MARGEN, MARGEN, W - MARGEN * 2, H - MARGEN * 2, 20)
  ctx.save()
  ctx.shadowColor = 'rgba(20,20,28,.14)'
  ctx.shadowBlur = 22
  ctx.shadowOffsetY = 6
  ctx.fillStyle = TINTA.card
  ctx.fill()
  ctx.restore()

  ctx.save()
  caja(ctx, MARGEN, MARGEN, W - MARGEN * 2, H - MARGEN * 2, 20)
  ctx.clip()
  garabatos(ctx, W, H, 0.018)

  // ── Quién la manda ──────────────────────────────────────────────────────
  let y = MARGEN + PAD + 12
  ctx.textAlign = 'left'
  ctx.fillStyle = TINTA.ink4
  ctx.font = `600 11px ${SANS}`
  ctx.fillText('SIMULACIÓN DE CRÉDITO', L, y)

  y += 30
  ctx.fillStyle = TINTA.ink
  ctx.font = `700 22px ${SANS}`
  for (const linea of lineasOrg) { ctx.fillText(linea, L, y); y += 28 }

  y += 6
  hairline(ctx, L, y, R)

  // ── El bloque oscuro: la cifra que resuelve el papel ────────────────────
  /* La regla del sistema: la cifra va en bloque oscuro y NUNCA sobre dorado.
     Ver `components/cf/bloqueOscuro`. */
  y += 20
  caja(ctx, L, y, ANCHO, ALTO_BLOQUE - 14, 20)
  ctx.fillStyle = BLOQUE.fondo
  ctx.fill()

  const ALTO_CAJA = ALTO_BLOQUE - 14
  ctx.fillStyle = BLOQUE.rotulo
  ctx.font = `13px ${SANS}`
  ctx.fillText('Le cobras', L + 22, y + 30)

  /* 36 de tope y no 40: en «interés que baja» la cifra es un RANGO —«$260.700–
     $259.205»— y a 40 llegaba a tocar los dos bordes del bloque. */
  const tam = achicarHasta(ctx, cuotaTexto, ANCHO - 44, MONO, 700, 36, 18)
  ctx.fillStyle = BLOQUE.oro
  ctx.font = `700 ${tam}px ${MONO}`
  ctx.fillText(cuotaTexto, L + 22, y + 78)

  ctx.fillStyle = BLOQUE.apagado
  ctx.font = `13px ${SANS}`
  ctx.fillText(cuotaPie, L + 22, y + ALTO_CAJA - 18)

  y += ALTO_BLOQUE + 6

  // ── El resumen ──────────────────────────────────────────────────────────
  for (const [rot, val] of resumen) {
    ctx.textAlign = 'left'
    ctx.fillStyle = TINTA.ink3
    ctx.font = `13px ${SANS}`
    ctx.fillText(rot, L, y + 14)
    ctx.textAlign = 'right'
    ctx.fillStyle = TINTA.ink
    ctx.font = `600 14px ${MONO}`
    ctx.fillText(val, R, y + 14)
    y += 28
  }
  ctx.textAlign = 'left'

  // ── La tabla ────────────────────────────────────────────────────────────
  if (filas.length) {
    y += 10
    const rotulo = ROTULO_PERIODO[frecuencia] || 'Cobro'

    /* Cuatro columnas. La primera lleva el número y la fecha en el mismo
       renglón porque juntos identifican el cobro y sueltos no dicen nada. */
    const xNum = L
    const xCuota = R
    const xInteres = R - 108
    const xCapital = R - 216

    ctx.fillStyle = TINTA.ink4
    ctx.font = `600 10px ${SANS}`
    ctx.fillText(rotulo.toUpperCase(), xNum, y + 12)
    ctx.textAlign = 'right'
    ctx.fillText('CAPITAL', xCapital, y + 12)
    ctx.fillText('INTERÉS', xInteres, y + 12)
    ctx.fillText('CUOTA', xCuota, y + 12)
    ctx.textAlign = 'left'
    y += 20
    hairline(ctx, L, y, R)
    y += 10

    filas.forEach((f, i) => {
      // Cebra suave: con doce renglones de cifras el ojo se pierde de línea.
      if (i % 2 === 1) {
        ctx.fillStyle = TINTA.cardAlt
        ctx.fillRect(L - 10, y - 12, ANCHO + 20, ALTO_FILA)
      }
      ctx.textAlign = 'left'
      ctx.fillStyle = TINTA.ink
      ctx.font = `600 12px ${SANS}`
      ctx.fillText(`${rotulo} ${f.numeroPeriodo}`, xNum, y + 5)
      const fecha = fmtFechaCorta(f.fechaEsperada)
      if (fecha) {
        ctx.fillStyle = TINTA.ink4
        ctx.font = `11px ${SANS}`
        ctx.fillText(fecha, xNum, y + 19)
      }
      ctx.textAlign = 'right'
      ctx.fillStyle = TINTA.ink2
      ctx.font = `12px ${MONO}`
      ctx.fillText(formatMoney(Math.round(f.capital || 0)), xCapital, y + 12)
      ctx.fillStyle = TINTA.goldInk
      ctx.fillText(formatMoney(Math.round(f.interes || 0)), xInteres, y + 12)
      ctx.fillStyle = TINTA.ink
      ctx.font = `700 12px ${MONO}`
      ctx.fillText(formatMoney(Math.round(f.cuotaTotal || 0)), xCuota, y + 12)
      y += ALTO_FILA
    })
    ctx.textAlign = 'left'
  }

  // ── El pie ──────────────────────────────────────────────────────────────
  /* ⚠ QUE DIGA QUE ES UNA SIMULACIÓN. Este papel se le enseña a alguien que
     todavía no ha firmado nada, y sin esta línea se lee como un compromiso. */
  const yPie = H - MARGEN - PAD - 6
  hairline(ctx, L, yPie - 26, R)
  ctx.fillStyle = TINTA.ink4
  ctx.font = `11px ${SANS}`
  ctx.fillText('Simulación · no es un compromiso ni una deuda registrada', L, yPie)

  ctx.restore()
  return canvas
}

/** Dibuja y lanza la hoja de compartir. `false` si no se pudo dibujar. */
export function compartirSimulacionImagen(datos) {
  let canvas
  try { canvas = dibujarSimulacion(datos) } catch { return false }
  return compartirLienzo(canvas, {
    nombre: 'Simulacion-credito.png',
    titulo: 'Simulación de crédito',
    texto: datos?.orgNombre ? `Simulación de crédito - ${datos.orgNombre}` : 'Simulación de crédito',
  })
}
