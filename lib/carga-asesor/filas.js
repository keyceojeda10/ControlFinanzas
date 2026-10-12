/* ── EL ÁREA DE ESPERA: LAS FILAS QUE LEYÓ EL SISTEMA ────────────────────────
 *
 * Bloque 4 del plan de seguimiento (12 oct 2026). El cliente sube fotos del
 * cuaderno, Excel o PDF; los lectores que ya existen los leen y aquí se pasan
 * a la forma ÚNICA que entiende el importador (`COLUMNAS` de lib/carga-masiva.js).
 * Nada de esto toca la cartera real: vive en `SolicitudCarga.filas` hasta que el
 * superadmin lo revisa y aprueba.
 *
 * Cada fila lleva sus marcas, con prefijo `_` para que nunca lleguen al
 * importador (`limpiarFila`):
 *   _archivo  el número del archivo (1, 2, …) del que salió, para enseñarlo al lado
 *   _hoja     la hoja del Excel o la página, si aplica
 *   _dudas    qué celda mirar: las del lector de fotos y las de aquí (montos raros,
 *             repetidas dentro de la misma carga)
 *   _estado / _errores / _avisos   lo que dijo `validarCartera` la última vez
 *
 * Aquí no hay red ni disco: se prueba sin Gemini ni base.
 */

import { montoConTasa } from '@/lib/cartulina-datos'
import { cedulaDeFila, parsearNumero } from '@/lib/carga-masiva'

/** Los campos que entiende el importador (los de `COLUMNAS` + `fechaCorte`). */
export const CAMPOS_FILA = [
  'nombre', 'cedula', 'telefono', 'direccion', 'referencia',
  'tipo', 'montoPrestado', 'tasaInteres', 'diasPlazo', 'numeroCuotas', 'valorCuota', 'frecuencia',
  'fechaInicio', 'abonadoHasta', 'saldoActual', 'fechaCorte',
]

/* Un préstamo de menos de $20.000 o de más de $100.000.000 en una cartera de
   cobro diario casi siempre es una cifra mal leída (miles de más o de menos). */
const MONTO_RARO_BAJO = 20000
const MONTO_RARO_ALTO = 100000000

const vacio = (v) => v == null || v === ''

/** Solo los campos del importador, sin las marcas. */
export function limpiarFila(f = {}) {
  const out = {}
  for (const c of CAMPOS_FILA) if (!vacio(f[c])) out[c] = f[c]
  return out
}

/**
 * Un cliente leído de una foto (ya pasado por `normalizarCliente`) → fila del
 * importador. Igual que `LoteFotos`: el capital sale del total y la tasa cuando
 * el papel no lo dice (`montoConTasa`), y «8 x 150» son 8 cuotas, no 8 días.
 */
export function filaDeCartulina(c = {}, { archivo, tasaPorDefecto = null } = {}) {
  const tasa = Number(c.tasaInteres) > 0 ? Number(c.tasaInteres) : null
  return {
    nombre: c.nombre ?? '',
    cedula: c.cedula ?? '',
    telefono: c.telefono ?? '',
    direccion: c.direccion ?? '',
    tipo: c.tipoPrestamo === 'mercancia' ? 'mercancia' : '',
    montoPrestado: montoConTasa(c, tasaPorDefecto) ?? '',
    tasaInteres: tasa ?? '',
    numeroCuotas: c.numeroCuotas ?? '',
    diasPlazo: c.numeroCuotas ? '' : (c.diasPlazo ?? ''),
    valorCuota: c.valorCuota ?? '',
    frecuencia: c.frecuencia ?? '',
    fechaInicio: c.fechaInicio ?? '',
    abonadoHasta: c.montoPagadoHasta ?? '',
    saldoActual: c.saldoPendiente ?? '',
    _archivo: archivo,
    // `dudasDe` da { campo, texto, dato }: se guarda la frase y lo que dice el papel.
    _dudas: Array.isArray(c._dudas)
      ? c._dudas.map((d) => (typeof d === 'string' ? d : [d?.texto, d?.dato ? `(el papel dice «${d.dato}»)` : ''].filter(Boolean).join(' '))).filter(Boolean)
      : [],
  }
}

/** Las dudas que se ven sin preguntarle a la base. */
function dudasPropias(f) {
  const dudas = []
  const monto = parsearNumero(f.montoPrestado)
  if (monto > 0 && monto < MONTO_RARO_BAJO) dudas.push(`Monto muy bajo (${monto}): ¿faltan ceros?`)
  if (monto > MONTO_RARO_ALTO) dudas.push(`Monto muy alto (${monto}): ¿sobran ceros?`)
  if (vacio(f.nombre)) dudas.push('Sin nombre')
  if (vacio(f.montoPrestado)) dudas.push('Sin monto')
  return dudas
}

/**
 * Marca las dudas propias y las REPETIDAS dentro de la misma carga: la misma
 * cartulina fotografiada dos veces, o la misma hoja subida en foto y en Excel.
 * Misma persona (cédula, o nombre si no hay) y mismo monto.
 */
export function marcarDudas(filas = []) {
  const vistas = new Map()
  return filas.map((f, i) => {
    const dudas = [...new Set([...(f._dudas ?? []), ...dudasPropias(f)])]
    const llave = `${cedulaDeFila(f)}|${Math.round(parsearNumero(f.montoPrestado))}`
    if (cedulaDeFila(f) && vistas.has(llave)) {
      dudas.push(`Repetida con la fila ${vistas.get(llave) + 1}`)
    } else if (cedulaDeFila(f)) {
      vistas.set(llave, i)
    }
    return { ...f, _dudas: dudas }
  })
}

/**
 * Pega a cada fila lo que dijo `validarCartera` (mismo orden: valida las filas
 * limpias en el mismo orden en que están).
 */
export function conValidacion(filas = [], validadas = []) {
  return filas.map((f, i) => {
    const v = validadas[i]
    return {
      ...f,
      _estado: v?.estado ?? 'error',
      _errores: v?.errores ?? [],
      _avisos: v?.advertencias ?? [],
    }
  })
}

/** El resumen que ven el superadmin y el mensaje de «cartera cargada». */
export function resumenDe(filas = [], validacion = null, extra = {}) {
  const aCrear = filas.filter((f) => f._estado !== 'error' && f._estado !== 'repetido')
  return {
    filas: filas.length,
    aCrear: aCrear.length,
    clientes: validacion?.resumen?.clientesNuevos ?? null,
    prestado: Math.round(aCrear.reduce((a, f) => a + (parsearNumero(f.montoPrestado) || 0), 0)),
    conError: filas.filter((f) => f._estado === 'error').length,
    repetidas: filas.filter((f) => f._estado === 'repetido').length,
    dudosas: filas.filter((f) => (f._dudas?.length ?? 0) > 0 || (f._errores?.length ?? 0) > 0).length,
    excedePlan: validacion?.resumen?.excedePlan ?? false,
    sinDomingosSugerido: validacion?.resumen?.sinDomingosSugerido ?? null,
    ...extra,
  }
}

/** Lo que queda «en la calle» de las filas a crear: el saldo si lo trae, si no el monto. */
export function enLaCalle(validadas = []) {
  return Math.round(validadas
    .filter((v) => v.estado !== 'error' && v.estado !== 'repetido' && v.datos?.tienePrestamo)
    .reduce((a, v) => a + Math.max(0, (v.calculado?.totalAPagar ?? v.datos.montoPrestado ?? 0) - (v.datos.abonadoHasta ?? 0)), 0))
}
