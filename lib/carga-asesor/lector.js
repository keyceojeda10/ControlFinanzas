/* ── LEER UN ARCHIVO DE LA CARGA CON ASESOR ──────────────────────────────────
 *
 * Los mismos lectores que ya usa la app, ahora en el servidor y sin pantalla:
 *   · fotos (cartulinas, hojas de cuaderno, capturas) → Gemini con PROMPT_LOTE,
 *     como `api/herramientas/leer-cartulinas-lote`;
 *   · Excel o CSV → el mapeo de columnas de `/carga-masiva` (PasoSubir +
 *     detectarColumnas), y si no reconoce la hoja, el lector del export de la
 *     otra app (`leerExcel` + `aCargaMasiva`, el del asistente);
 *   · PDF → la «Planilla Recaudador» de Crossbox.
 *
 * Lo que un lector no entiende NO se inventa: el archivo queda como «no se
 * pudo leer» y el asesor lo carga a mano mirando el original. Ese es el punto
 * de tener a una persona revisando.
 */

import * as XLSX from 'xlsx'
import { PROMPT_LOTE, procesarImagen, normalizarCliente, escalaDeLaHoja } from '@/lib/cartulina'
import { dudasDe, cuadreDelTotal } from '@/lib/cartulina-dudas'
import { detectarColumnas, corregirMapeoConDatos, aplicarMapeo } from '@/lib/carga-masiva'
import { leerExcel } from '@/lib/importar/excel'
import { aCargaMasiva } from '@/lib/importar/aCargaMasiva'
import { paginasDePdf } from '@/lib/importar/pdf-texto'
import { leerPlanillaCrossbox } from '@/lib/importar/planilla-crossbox'
import { filaDeCartulina } from './filas'

/** Qué es, por los primeros bytes y, para el Excel/CSV, por el nombre. */
export function tipoDeArchivo(buffer, nombre = '') {
  const b = buffer
  if (!b || b.length < 4) return null
  if (b[0] === 0xFF && b[1] === 0xD8) return { tipo: 'imagen', mime: 'image/jpeg' }
  if (b[0] === 0x89 && b[1] === 0x50) return { tipo: 'imagen', mime: 'image/png' }
  if (b[0] === 0x52 && b[3] === 0x46 && b.subarray(8, 12).toString('latin1') === 'WEBP') return { tipo: 'imagen', mime: 'image/webp' }
  if (b.subarray(0, 5).toString('latin1') === '%PDF-') return { tipo: 'pdf', mime: 'application/pdf' }
  // .xlsx es un zip; .xls el formato viejo de Office.
  if (b[0] === 0x50 && b[1] === 0x4B) return { tipo: 'excel', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  if (b[0] === 0xD0 && b[1] === 0xCF) return { tipo: 'excel', mime: 'application/vnd.ms-excel' }
  if (/\.(csv|txt)$/i.test(nombre)) return { tipo: 'excel', mime: 'text/csv' }
  return null
}

/* Las filas de una hoja como las arma PasoSubir: si el encabezado no está en la
   primera fila (títulos, logos), se salta hasta 3. */
function filasDeHoja(ws) {
  let rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })
  let headers = Object.keys(rows[0] || {})
  for (let skip = 1; skip <= 3; skip++) {
    const basura = headers.filter((h) => h.startsWith('__EMPTY')).length
    if (basura <= headers.length * 0.4) break
    rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, range: skip })
    headers = Object.keys(rows[0] || {})
  }
  return { rows, headers }
}

/** Excel o CSV → filas del importador. Todas las hojas con datos. */
export function leerHojaDeCalculo(buffer, { archivo } = {}) {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const filas = []
  const fallos = []
  for (const nombreHoja of wb.SheetNames) {
    const ws = wb.Sheets[nombreHoja]
    const { rows, headers } = filasDeHoja(ws)
    if (!rows.length) continue

    const mapeo = corregirMapeoConDatos(detectarColumnas(headers).mapeo, rows.slice(0, 20))
    const campos = new Set(Object.values(mapeo))
    if (campos.has('nombre') && (campos.has('montoPrestado') || campos.has('saldoActual'))) {
      for (const f of aplicarMapeo(rows, mapeo)) filas.push({ ...f, _archivo: archivo, _hoja: nombreHoja, _dudas: [] })
      continue
    }

    // El export de la otra app (otro orden y otros nombres): su propio lector.
    const lectura = leerExcel(XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }))
    if (!lectura.error && lectura.filas.length) {
      const { filas: listas, descartadas } = aCargaMasiva(lectura.filas, { semilla: `c${archivo}`, hoy: new Date().toISOString().slice(0, 10) })
      for (const f of listas) filas.push({ ...f, _archivo: archivo, _hoja: nombreHoja, _dudas: [] })
      for (const d of descartadas) fallos.push(`${nombreHoja}: ${d.nombre || 'sin nombre'} (${d.motivo})`)
      continue
    }
    fallos.push(`Hoja «${nombreHoja}»: no reconocí las columnas`)
  }
  return { filas, fallos }
}

/** PDF → filas. Hoy solo la planilla de Crossbox. */
export async function leerPdf(buffer, { archivo } = {}) {
  const leido = await paginasDePdf(buffer)
  if (leido.error) return { filas: [], fallos: [`PDF de ${leido.numPages} páginas: demasiado largo para leerlo solo`] }
  const planilla = leerPlanillaCrossbox(leido.paginas)
  if (!planilla?.filas?.length || !planilla.fechaCorte) return { filas: [], fallos: ['PDF que no es una planilla conocida: cargar a mano'] }
  const fallos = planilla.cuadraConTotales ? [] : ['Las filas no suman lo que dice «Totales»: falta alguna']
  return { filas: planilla.filas.map((f) => ({ ...f, _archivo: archivo, _dudas: [] })), fallos }
}

/** Foto → filas, con las dudas del lector y el cuadre contra el total escrito. */
export async function leerFoto(buffer, mime, { archivo } = {}) {
  const json = await procesarImagen(buffer, mime, PROMPT_LOTE, { lado: 2000, maxTokens: 12288 })
  const lista = Array.isArray(json) ? json : (json?.clientes ?? [])
  const declarada = ['miles', 'pesos'].includes(json?.escala) ? json.escala : null
  const escala = escalaDeLaHoja(lista, declarada)
  const leidos = lista
    .map((c) => ({ crudo: c, normal: normalizarCliente(c, escala) }))
    .filter(({ normal }) => normal.nombre || normal.montoPrestado)
  const clientes = leidos.map(({ crudo, normal }, idx) => ({
    ...normal,
    _dudas: dudasDe(normal, crudo, { anterior: leidos[idx - 1]?.normal, siguiente: leidos[idx + 1]?.normal }),
  }))
  const fallos = []
  const total = Number(json?.totalDeclarado) || null
  if (total) {
    const c = cuadreDelTotal(total, clientes)
    if (c && !c.cuadra) fallos.push(c.texto)
  }
  if (!clientes.length) fallos.push('No encontré clientes en la foto')
  return { filas: clientes.map((c) => filaDeCartulina(c, { archivo })), fallos }
}

/**
 * Lee un archivo, del tipo que sea. Nunca lanza: lo que falla queda en `fallos`.
 * @returns {Promise<{ filas: object[], fallos: string[], tipo: string|null, usoGemini: boolean }>}
 */
export async function leerArchivo(buffer, { nombre = '', archivo } = {}) {
  const t = tipoDeArchivo(buffer, nombre)
  if (!t) return { filas: [], fallos: ['Formato que no sé leer'], tipo: null, usoGemini: false }
  try {
    if (t.tipo === 'imagen') return { ...(await leerFoto(buffer, t.mime, { archivo })), tipo: t.tipo, usoGemini: true }
    if (t.tipo === 'pdf') return { ...(await leerPdf(buffer, { archivo })), tipo: t.tipo, usoGemini: false }
    return { ...leerHojaDeCalculo(buffer, { archivo }), tipo: t.tipo, usoGemini: false }
  } catch (e) {
    return { filas: [], fallos: [`No se pudo leer: ${e?.message ?? e}`], tipo: t.tipo, usoGemini: t.tipo === 'imagen' }
  }
}
