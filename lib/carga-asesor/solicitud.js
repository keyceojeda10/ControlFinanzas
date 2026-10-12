/* ── LA CARGA DE CARTERA CON ASESOR ──────────────────────────────────────────
 *
 * Bloque 4 del plan de seguimiento (12 oct 2026). El dato: de los que declaran
 * más de 100 clientes, solo el 9 % llega a cargar la cartera, y quien no la
 * carga no paga. Pasar el cuaderno es el muro; aquí lo pasa una persona.
 *
 *   1. El dueño sube fotos, Excel o PDF (pantalla o WhatsApp) → `guardarArchivos`.
 *      Queda una SolicitudCarga «recibida», con los archivos en el almacén.
 *   2. `procesarSolicitud` los lee con los lectores de siempre a un ÁREA DE
 *      ESPERA (`filas`), las valida con el importador y la deja «en_revision».
 *      Nada entra a la cartera real. Telegram avisa a Carlos.
 *   3. El superadmin corrige lo dudoso mirando el original y pulsa «Aprobar e
 *      importar» → `aprobarSolicitud`: `importarCartera`, el MISMO camino que la
 *      pantalla de carga masiva y que soporte. El reloj de su prueba arranca hoy.
 *
 * ⚠ UNA SOLA SOLICITUD ABIERTA POR NEGOCIO. Lo que mande después (otra foto por
 *   WhatsApp, el Excel que faltaba) se suma a la misma, y solo se leen los
 *   archivos nuevos: volver a mandar treinta fotos a Gemini por una más es
 *   pagar treinta veces.
 */

import path from 'path'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { prisma } from '@/lib/prisma'
import { directorioAlmacen, rutaSegura } from '@/lib/almacen'
import { validarCartera, importarCartera } from '@/lib/importar-cartera'
import { sendMessage, escapeHtml } from '@/lib/telegram'
import { notificar } from '@/lib/notificar'
import { enviarPaso } from '@/lib/seguimiento/enviar'
import { reiniciarPrueba } from '@/lib/seguimiento/prueba'
import { tipoDeArchivo, leerArchivo } from './lector'
import { limpiarFila, marcarDudas, conValidacion, resumenDe, enLaCalle } from './filas'

export const ESTADOS_ABIERTOS = ['recibida', 'leyendo', 'en_revision']
export const MAX_ARCHIVOS = 40
export const MAX_BYTES = 15 * 1024 * 1024
/** Tras cuántas horas sin aprobar se le recuerda a Carlos. */
export const HORAS_RECORDATORIO = 20
/** Fotos que se leen a la vez (Gemini da 429 si se le manda todo junto). */
const A_LA_VEZ = 3
const URL_APP = 'https://app.control-finanzas.com'

const json = (s, def) => { try { return s ? JSON.parse(s) : def } catch { return def } }
const pesos = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO')
const primerNombre = (n) => String(n || '').trim().split(/\s+/)[0] || 'amigo'

export function archivosDe(sol) { return json(sol?.archivos, []) }
export function filasDe(sol) { return json(sol?.filas, []) }
export function resumenDeSolicitud(sol) { return json(sol?.resumen, null) }

/* ⚠ CANDADO DE FILA para todo lo que reescribe `archivos`. Veinte fotos por
   WhatsApp son veinte webhooks casi a la vez, repartidos en las dos instancias:
   leer-sumar-escribir sin candado pierde archivos (el último pisa al resto).
   `fn` recibe la fila YA bloqueada y devuelve el `data` del update. */
async function conCandado(id, fn) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM SolicitudCarga WHERE id = ${id} FOR UPDATE`
    const fila = await tx.solicitudCarga.findUnique({ where: { id } })
    const data = await fn(fila)
    return data ? tx.solicitudCarga.update({ where: { id }, data }) : fila
  }, { timeout: 15000 })
}

export async function solicitudAbierta(organizationId) {
  return prisma.solicitudCarga.findFirst({
    where: { organizationId, estado: { in: ESTADOS_ABIERTOS } },
    orderBy: { createdAt: 'desc' },
  })
}

async function duenoDe(organizationId) {
  return prisma.user.findFirst({
    where: { organizationId, rol: 'owner' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, nombre: true, telefono: true, email: true },
  })
}

const nombreSeguro = (n) => String(n || 'archivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-60)

/**
 * Guarda los archivos en la solicitud abierta (o en una nueva).
 * @param {{ buffer: Buffer, nombre?: string }[]} archivos
 * @returns {Promise<{ solicitud?: object, nuevos: number, rechazados: string[], nueva: boolean, error?: string }>}
 */
export async function guardarArchivos(organizationId, archivos = [], { origen = 'web', nota = null, wamid = null } = {}) {
  const rechazados = []
  const validos = []
  for (const a of archivos) {
    if (!a?.buffer?.length) { rechazados.push(`${a?.nombre || 'archivo'}: vacío`); continue }
    if (a.buffer.length > MAX_BYTES) { rechazados.push(`${a.nombre || 'archivo'}: pesa más de 15 MB`); continue }
    const t = tipoDeArchivo(a.buffer, a.nombre)
    if (!t) { rechazados.push(`${a.nombre || 'archivo'}: no es foto, Excel ni PDF`); continue }
    validos.push({ ...a, ...t })
  }
  if (!validos.length) return { nuevos: 0, rechazados, nueva: false, error: rechazados.length ? 'Ningún archivo se pudo recibir' : 'No llegó ningún archivo' }

  let sol = await solicitudAbierta(organizationId)
  const nueva = !sol
  if (!sol) {
    // La nota se pone abajo, con el candado, igual que en una solicitud que ya existía.
    sol = await prisma.solicitudCarga.create({ data: { organizationId, origen, archivos: '[]' } })
  }
  /* El disco primero, con un nombre que no choca (el número de orden se pone
     después, con el candado puesto). */
  const dir = path.join(directorioAlmacen(), 'cargas', organizationId, sol.id)
  await mkdir(dir, { recursive: true })
  const escritos = []
  for (const a of validos) {
    const archivo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}-${nombreSeguro(a.nombre || `${a.tipo}.${a.mime.split('/')[1]}`)}`
    await writeFile(path.join(dir, archivo), a.buffer)
    escritos.push({
      ruta: `cargas/${organizationId}/${sol.id}/${archivo}`, nombre: a.nombre || archivo,
      tipo: a.tipo, mime: a.mime, bytes: a.buffer.length, origen, at: new Date().toISOString(),
      ...(wamid ? { wamid } : {}),
    })
  }

  let agregados = []
  let repetido = false
  sol = await conCandado(sol.id, (fila) => {
    // Justo la estaban aprobando: lo nuevo no se cuela en una carga ya cerrada.
    if (!ESTADOS_ABIERTOS.includes(fila.estado)) { rechazados.push('La carga ya se estaba importando: mándelo otra vez en un rato'); return null }
    const previos = archivosDe(fila)
    // Meta reentrega el mismo mensaje a veces: el mismo wamid no entra dos veces.
    if (wamid && previos.some((a) => a.wamid === wamid)) { repetido = true; return null }
    const espacio = Math.max(0, MAX_ARCHIVOS - previos.length)
    for (const a of escritos.slice(espacio)) rechazados.push(`${a.nombre}: pasa de ${MAX_ARCHIVOS} archivos`)
    const siguiente = previos.reduce((m, a) => Math.max(m, a.n), 0)
    agregados = escritos.slice(0, espacio).map((a, k) => ({ n: siguiente + k + 1, ...a }))
    if (!agregados.length) return null
    /* Otra vez «recibida» para que se lean los nuevos. Si estaba «leyendo», la
       lectura en curso los ve al terminar y da otra vuelta (`procesarSolicitud`). */
    return {
      archivos: JSON.stringify([...previos, ...agregados]),
      estado: fila.estado === 'leyendo' ? 'leyendo' : 'recibida',
      ...(nota ? { nota: [fila.nota, nota].filter(Boolean).join('\n') } : {}),
    }
  })
  return { solicitud: sol, nuevos: agregados.length, rechazados, nueva, repetido }
}

/** El archivo tal cual, para enseñarlo al lado de la fila. Solo dentro de `cargas/`. */
export async function leerArchivoGuardado(ruta) {
  if (!String(ruta).startsWith('cargas/')) return null
  const p = rutaSegura(String(ruta).split('/'), directorioAlmacen())
  if (!p) return null
  try { return await readFile(p) } catch { return null }
}

/** Valida las filas con el importador y les pega el resultado. */
async function validarFilas(organizationId, filas) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { plan: true } })
  const v = await validarCartera({ organizationId, plan: org?.plan, filas: filas.map(limpiarFila) })
  return { filas: conValidacion(filas, v.filas), validacion: v }
}

/**
 * Lee los archivos que falten, valida todo y la deja en revisión. Seguro de
 * llamar dos veces: solo una toma la solicitud («recibida» → «leyendo»).
 */
export async function procesarSolicitud(id) {
  const tomada = await prisma.solicitudCarga.updateMany({ where: { id, estado: 'recibida' }, data: { estado: 'leyendo' } })
  if (tomada.count === 0) return { procesada: false, motivo: 'no_estaba_recibida' }

  let vueltas = 0
  let fallosLectura = []
  let primeraRevision = false
  try {
    while (vueltas++ < 5) {
      const sol = await prisma.solicitudCarga.findUnique({ where: { id } })
      const archivos = archivosDe(sol)
      let filas = filasDe(sol).map(({ _estado, _errores, _avisos, ...f }) => f)
      const pendientes = archivos.filter((a) => !a.leidoAt)
      if (!pendientes.length && vueltas > 1) break

      for (let i = 0; i < pendientes.length; i += A_LA_VEZ) {
        await Promise.all(pendientes.slice(i, i + A_LA_VEZ).map(async (a) => {
          const buffer = await leerArchivoGuardado(a.ruta)
          const r = buffer ? await leerArchivo(buffer, { nombre: a.nombre, archivo: a.n }) : { filas: [], fallos: ['El archivo no está en el almacén'] }
          a.leidoAt = new Date().toISOString()
          a.filas = r.filas.length
          a.fallos = r.fallos
          filas.push(...r.filas)
        }))
      }
      // Orden estable: por archivo y, dentro, como venían.
      filas = marcarDudas(filas.map((f, i) => ({ ...f, _i: i })).sort((x, y) => (x._archivo - y._archivo) || (x._i - y._i)).map(({ _i, ...f }) => f))
      const { filas: validadas, validacion } = await validarFilas(sol.organizationId, filas)
      fallosLectura = archivos.flatMap((a) => (a.fallos ?? []).map((f) => `Archivo ${a.n}: ${f}`))
      const resumen = resumenDe(validadas, validacion, { enLaCalle: enLaCalle(validacion.filas), fallos: fallosLectura })

      // Si mientras se leía llegaron archivos nuevos, otra vuelta.
      primeraRevision = primeraRevision || !resumenDeSolicitud(sol)
      let llegaron = []
      await conCandado(id, (fila) => {
        llegaron = archivosDe(fila).filter((a) => !archivos.some((b) => b.n === a.n))
        return {
          archivos: JSON.stringify([...archivos, ...llegaron]),
          filas: JSON.stringify(validadas),
          resumen: JSON.stringify(resumen),
          errorLectura: null,
          estado: llegaron.length ? 'leyendo' : 'en_revision',
        }
      })
      if (!llegaron.length) break
    }
  } catch (e) {
    console.error('[carga-asesor] procesar:', id, e?.message)
    await prisma.solicitudCarga.update({ where: { id }, data: { estado: 'en_revision', errorLectura: String(e?.message ?? e).slice(0, 2000) } }).catch(() => {})
  }

  const sol = await prisma.solicitudCarga.findUnique({ where: { id }, include: { organization: { select: { nombre: true, plan: true } } } })
  if (primeraRevision) await avisarNueva(sol).catch(() => {})
  return { procesada: true, resumen: resumenDeSolicitud(sol) }
}

async function avisarNueva(sol) {
  const r = resumenDeSolicitud(sol) ?? {}
  const dueno = await duenoDe(sol.organizationId)
  const texto = [
    `<b>Carga de cartera para revisar: ${escapeHtml(sol.organization?.nombre ?? '')}</b>`,
    `Dueño: ${escapeHtml(dueno?.nombre ?? '')} · ${escapeHtml(dueno?.telefono || 'sin teléfono')} · plan ${escapeHtml(sol.organization?.plan ?? '')}`,
    `Archivos: ${archivosDe(sol).length} (${sol.origen})`,
    `Leídas ${r.filas ?? 0} filas · a crear ${r.aCrear ?? 0} · ${pesos(r.prestado)} prestado`,
    `Dudosas ${r.dudosas ?? 0} · con error ${r.conError ?? 0}${r.excedePlan ? ' · <b>EXCEDE EL PLAN</b>' : ''}`,
    ...(r.fallos?.length ? [`Sin leer: ${escapeHtml(r.fallos.slice(0, 3).join(' · '))}`] : []),
    `${URL_APP}/admin/cargas/${sol.id}`,
    `<b>Qué hacer:</b> revisar y aprobar antes de 24 h (se le prometió).`,
  ].join('\n')
  await sendMessage(texto, null, 'escalamiento')
}

/** Lo que manda el dueño al recibir sus archivos (una vez por solicitud). */
export async function confirmarRecibida(sol, { ahora = new Date() } = {}) {
  const dueno = await duenoDe(sol.organizationId)
  const n = archivosDe(sol).length
  await notificar({
    organizationId: sol.organizationId, tipo: 'carga', titulo: 'Recibimos tus archivos',
    mensaje: `Tu cartera estará cargada en máximo 24 horas. Te avisamos al terminar.`, href: '/cargar-cartera',
  }).catch(() => null)
  return enviarPaso({
    organizationId: sol.organizationId, telefono: dueno?.telefono, caso: 'carga', claveCaso: `carga:${sol.id}`, paso: 'recibida',
    plantilla: 'cartera_recibida', datos: { nombre: primerNombre(dueno?.nombre), archivos: String(n) }, ahora, ignorarLimiteDiario: true,
  }).catch(() => null)
}

/** El superadmin corrigió filas: se guardan y se vuelven a validar. */
export async function guardarFilas(id, filas) {
  const sol = await prisma.solicitudCarga.findUnique({ where: { id } })
  if (!sol) return { error: 'No existe', status: 404 }
  if (sol.estado !== 'en_revision') return { error: `Está ${sol.estado}: no se puede editar`, status: 409 }
  const limpias = (Array.isArray(filas) ? filas : []).map(({ _estado, _errores, _avisos, ...f }) => f)
  const { filas: validadas, validacion } = await validarFilas(sol.organizationId, limpias)
  const anterior = resumenDeSolicitud(sol) ?? {}
  const resumen = resumenDe(validadas, validacion, { enLaCalle: enLaCalle(validacion.filas), fallos: anterior.fallos ?? [] })
  await prisma.solicitudCarga.update({ where: { id }, data: { filas: JSON.stringify(validadas), resumen: JSON.stringify(resumen) } })
  return { filas: validadas, resumen }
}

/**
 * Aprueba e importa. Valida otra vez (la cuenta pudo cambiar desde la lectura)
 * y no carga NADA si alguna fila tiene error o si excede el plan: el asesor la
 * corrige o la quita antes. Una sola vez: «en_revision» → «importando».
 */
export async function aprobarSolicitud({ id, adminId, ruta = '', noCobrarDomingos = false, ahora = new Date() }) {
  const sol = await prisma.solicitudCarga.findUnique({ where: { id } })
  if (!sol) return { error: 'No existe', status: 404 }
  const filas = filasDe(sol)
  if (!filas.length) return { error: 'No hay filas para importar', status: 400 }

  const tomada = await prisma.solicitudCarga.updateMany({ where: { id, estado: 'en_revision' }, data: { estado: 'importando' } })
  if (tomada.count === 0) return { error: `Está ${sol.estado}: no se puede aprobar`, status: 409 }
  const soltar = () => prisma.solicitudCarga.update({ where: { id }, data: { estado: 'en_revision' } }).catch(() => {})

  try {
    const org = await prisma.organization.findUnique({ where: { id: sol.organizationId }, select: { plan: true, nombre: true } })
    const dueno = await duenoDe(sol.organizationId)
    if (!dueno) { await soltar(); return { error: 'La cuenta no tiene dueño', status: 400 } }

    const v = await validarCartera({ organizationId: sol.organizationId, plan: org.plan, filas: filas.map(limpiarFila) })
    if (v.resumen.filasConError > 0) { await soltar(); return { error: `Hay ${v.resumen.filasConError} filas con error: corrígelas o quítalas`, status: 400 } }
    if (v.resumen.excedePlan) { await soltar(); return { error: `Excede el plan: caben ${v.resumen.espacioDisponible} clientes nuevos y son ${v.resumen.clientesNuevos}`, status: 400 } }
    const aCrear = v.filas.filter((f) => f.estado !== 'error' && f.estado !== 'repetido')
    if (!aCrear.length) { await soltar(); return { error: 'Nada nuevo que importar: todo ya estaba', status: 400 } }

    let rutaId = null
    let crearRuta = null
    const nombreRuta = String(ruta || '').trim()
    if (nombreRuta) {
      const existente = await prisma.ruta.findFirst({ where: { organizationId: sol.organizationId, nombre: nombreRuta, activo: true }, select: { id: true } })
      if (existente) rutaId = existente.id
      else crearRuta = nombreRuta
    }

    const r = await importarCartera({
      organizationId: sol.organizationId, plan: org.plan, usuarioId: dueno.id,
      filas: aCrear, rutaId, crearRuta, noCobrarDomingos: noCobrarDomingos === true,
    })
    if (r.error) { await soltar(); return { error: r.error, status: r.status ?? 400 } }
    const x = r.resultado
    const calle = enLaCalle(aCrear)

    const resumen = { ...(resumenDeSolicitud(sol) ?? {}), importado: { ...x, enLaCalle: calle, ruta: nombreRuta || null } }
    await prisma.solicitudCarga.update({
      where: { id },
      data: { estado: 'aprobada', aprobadaAt: ahora, revisadaPorId: adminId ?? null, resumen: JSON.stringify(resumen) },
    })
    await prisma.actividadLog.create({
      data: {
        organizationId: sol.organizationId, userId: dueno.id, accion: 'carga_masiva', entidadTipo: 'cliente',
        detalle: `Carga de cartera con asesor: ${x.clientesCreados} clientes, ${x.prestamosCreados} préstamos`,
      },
    }).catch(() => {})

    /* El reloj de la prueba arranca hoy, y se le avisa. Nada de esto deshace la
       carga si falla: la cartera ya está dentro. */
    const fin = await reiniciarPrueba(sol.organizationId, { ahora }).catch((e) => { console.error('[carga-asesor] prueba:', e?.message); return null })
    await notificar({
      organizationId: sol.organizationId, tipo: 'carga', titulo: 'Tu cartera quedó cargada',
      mensaje: `${x.clientesCreados} clientes y ${pesos(calle)} en la calle. Ya puedes cobrar desde la app.`, href: '/cobros-hoy',
    }).catch(() => null)
    const wa = await enviarPaso({
      organizationId: sol.organizationId, telefono: dueno.telefono, caso: 'carga', claveCaso: `carga:${id}`, paso: 'cargada',
      plantilla: 'cartera_cargada', datos: { nombre: primerNombre(dueno.nombre), clientes: String(x.clientesCreados), monto: pesos(calle) },
      ahora, ignorarLimiteDiario: true,
    }).catch(() => null)

    return { resultado: x, enLaCalle: calle, finPrueba: fin, whatsapp: wa?.enviado ?? false }
  } catch (e) {
    console.error('[carga-asesor] aprobar:', id, e)
    await soltar()
    return { error: 'Error al importar: ' + (e?.message ?? e), status: 500 }
  }
}

export async function rechazarSolicitud({ id, adminId, motivo = '' }) {
  const r = await prisma.solicitudCarga.updateMany({
    where: { id, estado: { in: ESTADOS_ABIERTOS } },
    data: { estado: 'rechazada', revisadaPorId: adminId ?? null, nota: motivo ? `Rechazada: ${motivo}` : undefined },
  })
  return r.count ? { ok: true } : { error: 'No está abierta', status: 409 }
}

/**
 * Para el cron cada hora: lee las que se quedaron «recibida» (el proceso que
 * las iba a leer murió con un despliegue) y recuerda las que llevan 20 h sin
 * aprobar. El recordatorio sale una vez por solicitud.
 */
export async function vueltaDeCargas({ ahora = new Date() } = {}) {
  const r = { leidas: 0, recordadas: 0 }
  const sueltas = await prisma.solicitudCarga.findMany({
    where: {
      OR: [
        { estado: 'recibida', updatedAt: { lte: new Date(ahora.getTime() - 5 * 60000) } },
        // «leyendo» de más de una hora: el proceso se cayó a mitad.
        { estado: 'leyendo', updatedAt: { lte: new Date(ahora.getTime() - 3600000) } },
      ],
    },
    select: { id: true, estado: true },
  })
  for (const s of sueltas) {
    if (s.estado === 'leyendo') await prisma.solicitudCarga.update({ where: { id: s.id }, data: { estado: 'recibida' } })
    const p = await procesarSolicitud(s.id)
    if (p.procesada) r.leidas++
  }

  const viejas = await prisma.solicitudCarga.findMany({
    where: { estado: { in: ESTADOS_ABIERTOS }, recordatorioAt: null, createdAt: { lte: new Date(ahora.getTime() - HORAS_RECORDATORIO * 3600000) } },
    include: { organization: { select: { nombre: true } } },
  })
  for (const s of viejas) {
    const marcada = await prisma.solicitudCarga.updateMany({ where: { id: s.id, recordatorioAt: null }, data: { recordatorioAt: ahora } })
    if (!marcada.count) continue
    const horas = Math.round((ahora - s.createdAt) / 3600000)
    const ok = await sendMessage([
      `<b>Carga sin aprobar hace ${horas} h: ${escapeHtml(s.organization?.nombre ?? '')}</b>`,
      `Se le prometió en máximo 24 h.`,
      `${URL_APP}/admin/cargas/${s.id}`,
    ].join('\n'), null, 'escalamiento').catch(() => null)
    if (ok?.ok) r.recordadas++
    else await prisma.solicitudCarga.update({ where: { id: s.id }, data: { recordatorioAt: null } }).catch(() => {})
  }
  return r
}
