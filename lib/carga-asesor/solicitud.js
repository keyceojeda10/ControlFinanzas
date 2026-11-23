/* ── LA CARGA DE CARTERA CON ASESOR ──────────────────────────────────────────
 *
 * Bloque 4 del plan de seguimiento (12 oct 2026). El dato: de los que declaran
 * más de 100 clientes, solo el 9 % llega a cargar la cartera, y quien no la
 * carga no paga. Pasar el cuaderno es el muro; aquí lo pasa una persona.
 *
 *   1. El dueño sube fotos, Excel o PDF (pantalla o WhatsApp) → `guardarArchivos`.
 *      Queda una SolicitudCarga «recibida», con los archivos en el almacén.
 *   2. `procesarSolicitud` los lee con los lectores de siempre a un ÁREA DE
 *      ESPERA (`filas`), les da su `_id`, las valida con el importador y la deja
 *      «en_revision». Nada entra a la cartera real. La campana (y WhatsApp si
 *      hay plantilla) avisa al DUEÑO: ya puede revisar (`avisarListaParaRevisar`).
 *   3. El DUEÑO revisa y carga él mismo (22 nov 2026, plan «La carga de cartera la
 *      revisa y la carga el dueño»): cada fila que crea se apunta
 *      (`apuntarCreada`) y al terminar `terminarCarga` hace lo de después
 *      (`despuesDeCargar`). Si pulsa «Necesito ayuda», `pedirAyuda` la pasa a
 *      «ayuda» y SOLO entonces le llega a Carlos.
 *   4. El superadmin corrige lo dudoso mirando el original y pulsa «Aprobar e
 *      importar» → `aprobarSolicitud`: `importarCartera`, el MISMO camino que la
 *      pantalla de carga masiva y que soporte, SIN las filas que el dueño ya
 *      creó. Termina con el mismo `despuesDeCargar`. El reloj de su prueba
 *      arranca hoy.
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

/* «esperando»: la abrió el botón «Que me la carguen» de WhatsApp y todavía no
   llega ningún archivo. Cuenta como abierta para que lo que mande por WhatsApp
   se pegue a ella, pero no se lee, no se avisa ni se recuerda hasta que llega
   el primer archivo (entonces pasa a «recibida»).
   «ayuda»: el dueño pidió que Carlos la mire (`pedirAyuda`). El estado es texto:
   no hay migración. */
export const ESTADOS_ABIERTOS = ['esperando', 'recibida', 'leyendo', 'en_revision', 'ayuda']
/** Las que esperan a Carlos: solo las que el dueño le pasó. Ya no se le avisa de
 *  lo que el dueño todavía está revisando (plan «La carga de cartera la revisa y
 *  la carga el dueño», 22 nov 2026). */
export const ESTADOS_POR_ATENDER = ['ayuda']
/** Donde se pueden corregir filas: con el dueño y con Carlos. */
export const ESTADOS_EDITABLES = ['en_revision', 'ayuda']
/** Ya no admiten nada: terminó o la rechazó Carlos. */
const ESTADOS_CERRADAS = ['aprobada', 'rechazada']
export const MAX_ARCHIVOS = 40
export const MAX_BYTES = 15 * 1024 * 1024
/** Desde cuántas horas de haber pedido ayuda se le recuerda a Carlos. */
export const HORAS_RECORDATORIO = 20
/* `SolicitudCarga.resumen` es LONGTEXT (antes TEXT, 64 KB: truncaba en silencio
   y se perdía lo creado). `creadas` crece ~90 bytes por fila y hay negocios con
   1.452 clientes. Solo se corta si el JSON pasa de 50 MB, que ya no es una carga. */
const MAX_BYTES_RESUMEN = 50 * 1024 * 1024
/** Fotos que se leen a la vez (Gemini da 429 si se le manda todo junto). */
const A_LA_VEZ = 3
const URL_APP = 'https://app.control-finanzas.com'

const json = (s, def) => { try { return s ? JSON.parse(s) : def } catch { return def } }
const pesos = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO')
const primerNombre = (n) => String(n || '').trim().split(/\s+/)[0] || 'amigo'

/**
 * A cada fila su `_id` estable: `${archivo}-${posición dentro de ESE archivo}`.
 * Solo a las que no lo traen, así que un archivo que llega después (con su
 * propio número) nunca renumera las de antes. Con él el dueño apunta qué fila
 * ya creó (`apuntarCreada`) y nadie la carga dos veces.
 * Si el candidato ya está tomado, sube hasta uno libre. «Tomado» es lo que llevan
 * las otras filas Y lo que se reserva aparte (`reservados`: los ids de
 * `resumen.creadas` y `resumen.quitadas`, aunque esa fila ya no figure en
 * `filas`): sin eso una fila nueva podía heredar el id de una creada o quitada y
 * `filasPendientes` la escondía, un cliente perdido en silencio.
 */
export function conIds(filas = [], reservados = []) {
  const usadas = new Set([...reservados, ...filas.map((f) => f?._id).filter(Boolean)])
  const vistas = new Map()
  return filas.map((f) => {
    const a = f?._archivo ?? 0
    const pos = vistas.get(a) ?? 0
    vistas.set(a, pos + 1)
    if (f?._id) return f
    let k = pos
    while (usadas.has(`${a}-${k}`)) k++
    const _id = `${a}-${k}`
    usadas.add(_id)
    return { ...f, _id }
  })
}

/** Los ids de fila que la vida de la solicitud ya usó: creadas y quitadas. */
const reservadasDe = (resumen) => [
  ...Object.keys(resumen?.creadas && typeof resumen.creadas === 'object' && !Array.isArray(resumen.creadas) ? resumen.creadas : {}),
  ...(Array.isArray(resumen?.quitadas) ? resumen.quitadas : []),
]

export function archivosDe(sol) { return json(sol?.archivos, []) }
/* Las solicitudes de antes del plan del 22 nov no traen `_id`: se les da aquí,
   por posición, y es el mismo en cada lectura mientras nadie quite una fila sin
   guardar (todo lo que escribe `filas` guarda también los `_id`). Aquí NO se
   reservan creadas/quitadas: esos ids salieron de esta misma derivación, y
   reservarlos movería a la fila que ya los tiene. */
export function filasDe(sol) {
  const filas = json(sol?.filas, [])
  return Array.isArray(filas) ? conIds(filas) : []
}
export function resumenDeSolicitud(sol) { return json(sol?.resumen, null) }

/** Lo que cuenta la vida de la solicitud y NINGUNA relectura puede borrar: si
 *  `creadas` se pierde, esas filas vuelven a salir como pendientes y se cargan
 *  dos veces; si `ayuda` se pierde, Carlos deja de verla. `ayuda` = { at, nota }. */
const VIDA = ['creadas', 'quitadas', 'importado', 'ayuda']
const vidaDe = (resumen) => Object.fromEntries(VIDA.filter((k) => resumen?.[k] !== undefined).map((k) => [k, resumen[k]]))

/** Las filas que el dueño ya creó: `{ [filaId]: { clienteId, prestamoId } }`. */
export function creadasDe(sol) {
  const c = resumenDeSolicitud(sol)?.creadas
  return c && typeof c === 'object' && !Array.isArray(c) ? c : {}
}
/** Las que el dueño quitó sin crearlas (ids de fila). */
export function quitadasDe(sol) {
  const q = resumenDeSolicitud(sol)?.quitadas
  return Array.isArray(q) ? q : []
}
/** Lo que falta por cargar: todas menos las creadas y las quitadas. */
export function filasPendientes(sol) {
  const creadas = creadasDe(sol)
  const quitadas = new Set(quitadasDe(sol))
  return filasDe(sol).filter((f) => !(f._id != null && (Object.hasOwn(creadas, f._id) || quitadas.has(f._id))))
}

/** Dónde queda la solicitud al terminar de leer: con el dueño, o en «ayuda» si
 *  Carlos ya la tenía (que llegue un archivo no le quita la ayuda pedida). */
const estadoAlTerminarLectura = (resumen) => (resumen?.ayuda ? 'ayuda' : 'en_revision')

/** El resumen a texto, sin pasarse de lo que la columna admite. */
function resumenATexto(resumen) {
  const texto = JSON.stringify(resumen)
  return Buffer.byteLength(texto) > MAX_BYTES_RESUMEN ? null : texto
}
const DEMASIADO_GRANDE = { error: 'El resumen de la carga es demasiado grande', status: 413 }

/* ⚠ CANDADO DE FILA para todo lo que reescribe `archivos`, `filas` o `resumen`.
   Veinte fotos por WhatsApp son veinte webhooks casi a la vez, repartidos en las
   dos instancias: leer-sumar-escribir sin candado pierde archivos (el último
   pisa al resto). `fn` recibe la fila YA bloqueada (y la transacción) y
   devuelve el `data` del update. */
async function conCandado(id, fn) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM SolicitudCarga WHERE id = ${id} FOR UPDATE`
    const fila = await tx.solicitudCarga.findUnique({ where: { id } })
    const data = await fn(fila, tx)
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
  // «Nueva» = la primera tanda de archivos, aunque la solicitud ya existiera
  // («esperando», abierta por el botón de WhatsApp): es cuando se confirma.
  let nueva = false
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
    nueva = previos.length === 0
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

/**
 * La abre el botón «Que me la carguen» de WhatsApp, antes de que llegue nada:
 * así las fotos que mande después se pegan aquí (`adjuntarDesdeWhatsApp` solo
 * adjunta a una carga abierta). Si ya hay una abierta, devuelve esa.
 */
export async function abrirSolicitud(organizationId, { origen = 'whatsapp' } = {}) {
  return (await solicitudAbierta(organizationId))
    ?? prisma.solicitudCarga.create({ data: { organizationId, origen, estado: 'esperando', archivos: '[]' } })
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
      /* Orden estable: por archivo y, dentro, como venían. Los `_id` se ponen
         después de ordenar y antes de las dudas, solo a las que no lo traen. */
      filas = marcarDudas(conIds(
        filas.map((f, i) => ({ ...f, _i: i })).sort((x, y) => (x._archivo - y._archivo) || (x._i - y._i)).map(({ _i, ...f }) => f),
        reservadasDe(resumenDeSolicitud(sol)),
      ))
      const { filas: validadas, validacion } = await validarFilas(sol.organizationId, filas)
      fallosLectura = archivos.flatMap((a) => (a.fallos ?? []).map((f) => `Archivo ${a.n}: ${f}`))
      const resumen = resumenDe(validadas, validacion, { enLaCalle: enLaCalle(validacion.filas), fallos: fallosLectura })

      // Si mientras se leía llegaron archivos nuevos, otra vuelta.
      primeraRevision = primeraRevision || !resumenDeSolicitud(sol)
      let llegaron = []
      await conCandado(id, (fila) => {
        llegaron = archivosDe(fila).filter((a) => !archivos.some((b) => b.n === a.n))
        // ⚠ Lo ya creado, lo quitado y la ayuda pedida se conservan: leer un archivo nuevo no los borra.
        const vida = vidaDe(resumenDeSolicitud(fila))
        return {
          archivos: JSON.stringify([...archivos, ...llegaron]),
          filas: JSON.stringify(validadas),
          resumen: JSON.stringify({ ...resumen, ...vida }),
          errorLectura: null,
          estado: llegaron.length ? 'leyendo' : estadoAlTerminarLectura(vida),
        }
      })
      if (!llegaron.length) break
    }
  } catch (e) {
    console.error('[carga-asesor] procesar:', id, e?.message)
    const actual = await prisma.solicitudCarga.findUnique({ where: { id } }).catch(() => null)
    await prisma.solicitudCarga.update({ where: { id }, data: { estado: estadoAlTerminarLectura(resumenDeSolicitud(actual)), errorLectura: String(e?.message ?? e).slice(0, 2000) } }).catch(() => {})
  }

  const sol = await prisma.solicitudCarga.findUnique({ where: { id }, include: { organization: { select: { nombre: true, plan: true } } } })
  if (primeraRevision) await avisarListaParaRevisar(sol).catch(() => {})
  return { procesada: true, resumen: resumenDeSolicitud(sol) }
}

/**
 * Al terminar la lectura (la primera vez): avisa al DUEÑO de que ya puede
 * revisar. Campana siempre; WhatsApp solo si hay plantilla aprobada
 * (`WA_PLANTILLA_CARTERA_POR_REVISAR`). A Carlos ya no le llega nada: le llega
 * cuando el dueño pide ayuda (`pedirAyuda`).
 */
export async function avisarListaParaRevisar(sol) {
  const filas = filasPendientes(sol)
  /* «Listos» = sin error ni duda; «por revisar» = el resto. Es una aproximación
     de la luz verde del semáforo de `LoteFotos`, que además mira lo que falta
     en cada fila y lo de toda la carga. */
  const listos = filas.filter((f) => !(f._errores?.length) && !(f._dudas?.length)).length
  const revisar = filas.length - listos
  await notificar({
    organizationId: sol.organizationId, tipo: 'carga', titulo: 'Ya leímos tu cartera',
    mensaje: filas.length
      ? `${listos} clientes listos y ${revisar} por revisar. Entra a terminar de cargarlos.`
      : 'No pudimos sacar clientes de tus archivos. Entra para ver por qué.',
    href: '/cargar-cartera',
  }).catch(() => null)

  const plantilla = process.env.WA_PLANTILLA_CARTERA_POR_REVISAR
  // Con cero filas la plantilla diría «0 listos y 0 por revisar»: ahí solo la campana.
  if (!plantilla || !filas.length) return null
  const dueno = await duenoDe(sol.organizationId)
  return enviarPaso({
    organizationId: sol.organizationId, telefono: dueno?.telefono, caso: 'carga', claveCaso: `carga:${sol.id}`, paso: 'por_revisar',
    plantilla, datos: { nombre: primerNombre(dueno?.nombre), listos: String(listos), revisar: String(revisar) },
    ignorarLimiteDiario: true,
  }).catch(() => null)
}

/** Lo que manda el dueño al recibir sus archivos (una vez por solicitud). */
export async function confirmarRecibida(sol, { ahora = new Date() } = {}) {
  await notificar({
    organizationId: sol.organizationId, tipo: 'carga', titulo: 'Recibimos tus archivos',
    mensaje: 'Los estamos leyendo. En unos minutos te enseñamos lo que encontramos para que lo revises y lo cargues.', href: '/cargar-cartera',
  }).catch(() => null)
  /* WhatsApp solo con la plantilla nueva (`WA_PLANTILLA_CARTERA_RECIBIDA`): la
     de antes prometía un asesor en 24 horas y eso ya no es cierto. */
  const plantilla = process.env.WA_PLANTILLA_CARTERA_RECIBIDA
  if (!plantilla) return null
  const dueno = await duenoDe(sol.organizationId)
  const n = archivosDe(sol).length
  return enviarPaso({
    organizationId: sol.organizationId, telefono: dueno?.telefono, caso: 'carga', claveCaso: `carga:${sol.id}`, paso: 'recibida',
    plantilla, datos: { nombre: primerNombre(dueno?.nombre), archivos: String(n) }, ahora, ignorarLimiteDiario: true,
  }).catch(() => null)
}

/**
 * Se corrigieron filas (Carlos, o el dueño desde su pantalla): se guardan y se
 * vuelven a validar. Con el candado: Carlos y el dueño no se pisan. Lo ya
 * creado y lo quitado se conserva.
 */
export async function guardarFilas(id, filas) {
  let falla = null
  let salida = null
  await conCandado(id, async (sol) => {
    if (!sol) { falla = { error: 'No existe', status: 404 }; return null }
    if (!ESTADOS_EDITABLES.includes(sol.estado)) { falla = { error: `Está ${sol.estado}: no se puede editar`, status: 409 }; return null }
    const limpias = (Array.isArray(filas) ? filas : []).map(({ _estado, _errores, _avisos, ...f }) => f)
    // Los `_id` se guardan con las filas: así no cambian la próxima vez que se lean.
    const { filas: validadas, validacion } = await validarFilas(sol.organizationId, conIds(limpias, reservadasDe(resumenDeSolicitud(sol))))
    const anterior = resumenDeSolicitud(sol) ?? {}
    const resumen = { ...resumenDe(validadas, validacion, { enLaCalle: enLaCalle(validacion.filas), fallos: anterior.fallos ?? [] }), ...vidaDe(anterior) }
    salida = { filas: validadas, resumen }
    return { filas: JSON.stringify(validadas), resumen: JSON.stringify(resumen) }
  })
  return falla ?? salida
}

/** Los que no son plata prestada: el cancelado y el que espera aprobación (los mismos
 *  que deja fuera `lib/dinero/desembolsado.js`). */
const PRESTAMOS_SIN_CONTAR = ['cancelado', 'pendiente_aprobacion']

/**
 * Cuántos clientes, préstamos y plata en la calle son las filas ya creadas.
 * Cuenta solo los préstamos que siguen vivos: uno cancelado o pendiente de
 * aprobación no es cartera cargada ni plata en la calle (es la cifra que ve el
 * dueño en la campana y en el WhatsApp).
 */
async function cifrasDeCreadas(creadas, organizationId, db = prisma) {
  const prestamoIds = [...new Set(Object.values(creadas).map((c) => c?.prestamoId).filter(Boolean))]
  if (!prestamoIds.length) return { clientes: 0, prestamos: 0, enLaCalle: 0 }
  // Uno tras otro: con `tx` (una sola conexión) no tiene sentido pedirlos a la vez.
  const prestamos = await db.prestamo.findMany({
    where: { id: { in: prestamoIds }, organizationId, estado: { notIn: PRESTAMOS_SIN_CONTAR } },
    select: { id: true, clienteId: true, totalAPagar: true },
  })
  if (!prestamos.length) return { clientes: 0, prestamos: 0, enLaCalle: 0 }
  // Recargo y descuento no son plata que entró: no bajan lo que se debe aquí.
  const pagos = await db.pago.findMany({ where: { prestamoId: { in: prestamos.map((p) => p.id) }, organizationId, tipo: { notIn: ['recargo', 'descuento'] } }, select: { prestamoId: true, montoPagado: true } })
  const pagado = new Map()
  for (const p of pagos) pagado.set(p.prestamoId, (pagado.get(p.prestamoId) ?? 0) + (Number(p.montoPagado) || 0))
  const calle = Math.round(prestamos.reduce((a, p) => a + Math.max(0, (Number(p.totalAPagar) || 0) - (pagado.get(p.id) ?? 0)), 0))
  return { clientes: new Set(prestamos.map((p) => p.clienteId).filter(Boolean)).size, prestamos: prestamos.length, enLaCalle: calle }
}

/**
 * El dueño creó una fila (cliente y préstamo por las puertas de siempre): se
 * apunta aquí. Idempotente por `filaId`. Vale en cualquier estado menos
 * «aprobada» y «rechazada» (leyendo, recibida y ayuda incluidos): el préstamo ya
 * existe, y no apuntarlo lo deja suelto y a un toque de crearse dos veces.
 * El préstamo tiene que ser de ESTE negocio y de ESE cliente.
 * @returns {Promise<{ ok: true, yaEstaba?: boolean, quedan: number } | { error: string, status: number }>}
 */
export async function apuntarCreada({ id, organizationId, filaId, clienteId, prestamoId }) {
  if (!filaId || !clienteId || !prestamoId) return { error: 'Faltan la fila, el cliente o el préstamo', status: 400 }
  const prestamo = await prisma.prestamo.findFirst({ where: { id: prestamoId, organizationId, clienteId }, select: { id: true } })
  if (!prestamo) return { error: 'Ese préstamo no es de este negocio', status: 404 }

  let falla = null
  let salida = null
  await conCandado(id, (sol) => {
    if (!sol || sol.organizationId !== organizationId) { falla = { error: 'No existe', status: 404 }; return null }
    // Un préstamo que YA existe se apunta siempre que la solicitud siga abierta: rechazarlo
    // deja un préstamo real sin apuntar y abre la puerta a crearlo otra vez.
    if (ESTADOS_CERRADAS.includes(sol.estado)) { falla = { error: `Está ${sol.estado}: ya no se puede apuntar`, status: 409 }; return null }
    const resumen = resumenDeSolicitud(sol) ?? {}
    const creadas = creadasDe(sol)
    if (Object.hasOwn(creadas, filaId)) { salida = { ok: true, yaEstaba: true, quedan: filasPendientes(sol).length }; return null }
    const nuevo = { ...resumen, creadas: { ...creadas, [filaId]: { clienteId, prestamoId } } }
    const texto = resumenATexto(nuevo)
    if (!texto) { falla = DEMASIADO_GRANDE; return null }
    salida = { ok: true, quedan: filasPendientes({ ...sol, resumen: texto }).length }
    return { resumen: texto }
  })
  return falla ?? salida
}

/**
 * Lo que pasa DESPUÉS de cargar la cartera, sea quien sea el que la cargó (el
 * dueño en `terminarCarga` o Carlos en `aprobarSolicitud`): el registro, el
 * reloj de la prueba, la campana y el WhatsApp. Nada de esto deshace la carga
 * si falla: la cartera ya está dentro.
 */
export async function despuesDeCargar({ sol, dueno, clientes, prestamos, enLaCalle: calle, ahora = new Date(), porElDueno = false }) {
  if (dueno?.id) {
    await prisma.actividadLog.create({
      data: {
        organizationId: sol.organizationId, userId: dueno.id, accion: 'carga_masiva', entidadTipo: 'cliente',
        detalle: `${porElDueno ? 'Carga de cartera revisada por el dueño' : 'Carga de cartera con asesor'}: ${clientes} clientes, ${prestamos} préstamos`,
      },
    }).catch(() => {})
  }

  /* El reloj de la prueba arranca hoy, y se le avisa. */
  const fin = await reiniciarPrueba(sol.organizationId, { ahora }).catch((e) => { console.error('[carga-asesor] prueba:', e?.message); return null })
  await notificar({
    organizationId: sol.organizationId, tipo: 'carga', titulo: 'Tu cartera quedó cargada',
    mensaje: `${clientes} clientes y ${pesos(calle)} en la calle. Ya puedes cobrar desde la app.`, href: '/cobros-hoy',
  }).catch(() => null)
  const wa = await enviarPaso({
    organizationId: sol.organizationId, telefono: dueno?.telefono, caso: 'carga', claveCaso: `carga:${sol.id}`, paso: 'cargada',
    // v2 (19 nov 2026): sin «7 días», que ya no es cierto para las cuentas nuevas.
    plantilla: 'cartera_cargada_v3', datos: { nombre: primerNombre(dueno?.nombre), clientes: String(clientes), monto: pesos(calle) },
    ahora, ignorarLimiteDiario: true,
  }).catch(() => null)
  return { finPrueba: fin, whatsapp: wa?.enviado ?? false }
}

/**
 * El dueño terminó: `en_revision` → `aprobada` cuando no queda ninguna fila por
 * cargar (descontadas las que acaba de quitar sin crear, `quitadas`). UNA sola
 * vez: la que hace el cambio de estado (con el candado) es la única que corre
 * `despuesDeCargar`; la segunda llamada solo contesta `yaTerminada`.
 * Si quedan filas devuelve `{ ok: false, quedan }` y no pasa nada más.
 */
export async function terminarCarga({ id, organizationId, quitadas = [], ahora = new Date() }) {
  let falla = null
  let yaTerminada = false
  let quedan = 0
  let cierre = null
  const sol = await conCandado(id, async (fila, tx) => {
    if (!fila || fila.organizationId !== organizationId) { falla = { error: 'No existe', status: 404 }; return null }
    if (fila.estado === 'aprobada') { yaTerminada = true; return null }
    if (fila.estado !== 'en_revision') {
      falla = { error: fila.estado === 'ayuda' ? 'Carlos la está revisando: no se puede terminar hasta que te la devuelva' : `Está ${fila.estado}: no se puede terminar`, status: 409 }
      return null
    }
    const resumen = resumenDeSolicitud(fila) ?? {}
    const creadas = creadasDe(fila)
    // Solo cuentan las quitadas que son filas de esta carga y que no se crearon.
    const existentes = new Set(filasDe(fila).map((f) => f._id))
    const previas = quitadasDe(fila)
    const todas = [...new Set([...previas, ...(Array.isArray(quitadas) ? quitadas : []).filter((q) => typeof q === 'string' && existentes.has(q) && !Object.hasOwn(creadas, q))])]
    const conQuitadas = { ...resumen, ...(todas.length ? { quitadas: todas } : {}) }
    const guardarQuitadas = () => {
      if (todas.length === previas.length) return null
      const texto = resumenATexto(conQuitadas)
      if (!texto) { falla = DEMASIADO_GRANDE; return null }
      return { resumen: texto }
    }
    quedan = filasPendientes({ ...fila, resumen: JSON.stringify(conQuitadas) }).length
    // Lo que quitó es decisión suya: se guarda aunque todavía queden filas.
    if (quedan > 0) return guardarQuitadas()
    // Nada creado: no hay cartera que celebrar ni prueba que reiniciar.
    if (!Object.keys(creadas).length) {
      falla = { error: 'Todavía no cargaste ningún cliente: sube otro archivo o pide ayuda', status: 400 }
      return guardarQuitadas()
    }

    const cifras = await cifrasDeCreadas(creadas, organizationId, tx)
    // Todo lo creado se canceló o espera aprobación: tampoco hay cartera que celebrar.
    if (!cifras.prestamos) {
      falla = { error: 'Los préstamos que cargaste están cancelados o esperan aprobación: no hay cartera cargada todavía', status: 400 }
      return guardarQuitadas()
    }
    cierre = { clientes: cifras.clientes, prestamos: cifras.prestamos, enLaCalle: cifras.enLaCalle }
    const texto = resumenATexto({ ...conQuitadas, importado: { clientesCreados: cifras.clientes, prestamosCreados: cifras.prestamos, enLaCalle: cifras.enLaCalle } })
    if (!texto) { falla = DEMASIADO_GRANDE; cierre = null; return null }
    return { estado: 'aprobada', aprobadaAt: ahora, resumen: texto }
  })
  if (falla) return falla
  if (yaTerminada) return { ok: true, yaTerminada: true }
  if (!cierre) return { ok: false, quedan }

  const dueno = await duenoDe(organizationId)
  let despues = { whatsapp: false }
  try {
    despues = await despuesDeCargar({ sol, dueno, ...cierre, ahora, porElDueno: true })
  } catch (e) {
    console.error('[carga-asesor] después de cargar:', id, e?.message)
  }
  return { ok: true, ...cierre, whatsapp: despues.whatsapp }
}

/**
 * El dueño pide ayuda: `en_revision` → `ayuda`. SOLO ahora le llega a Carlos
 * (Telegram de escalamiento). Con un segundo toque no se avisa dos veces.
 */
export async function pedirAyuda({ id, organizationId, nota = '', ahora = new Date() }) {
  const texto = String(nota ?? '').trim().slice(0, 1000)
  let falla = null
  let yaEstaba = false
  const sol = await conCandado(id, (fila) => {
    if (!fila || fila.organizationId !== organizationId) { falla = { error: 'No existe', status: 404 }; return null }
    const resumen = resumenDeSolicitud(fila) ?? {}
    // `resumen.ayuda` también dice que ya la pidió mientras se relee por un archivo nuevo.
    if (fila.estado === 'ayuda' || (resumen.ayuda && ESTADOS_ABIERTOS.includes(fila.estado))) { yaEstaba = true; return null }
    if (fila.estado !== 'en_revision') { falla = { error: `Está ${fila.estado}: todavía no se puede pedir ayuda`, status: 409 }; return null }
    // `ayuda.at` es desde cuándo cuenta el recordatorio; se vuelve a empezar.
    return {
      estado: 'ayuda', recordatorioAt: null,
      resumen: JSON.stringify({ ...resumen, ayuda: { at: ahora.toISOString(), nota: texto || null } }),
      ...(texto ? { nota: [fila.nota, `Pide ayuda: ${texto}`].filter(Boolean).join('\n') } : {}),
    }
  })
  if (falla) return falla
  if (yaEstaba) return { ok: true, yaEstaba: true }

  const [org, dueno] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { nombre: true } }).catch(() => null),
    duenoDe(organizationId).catch(() => null),
  ])
  await sendMessage([
    `<b>Pide ayuda con su carga: ${escapeHtml(org?.nombre ?? '')}</b>`,
    `Dueño: ${escapeHtml(dueno?.nombre ?? '')} · ${escapeHtml(dueno?.telefono || 'sin teléfono')}`,
    `Filas por cargar: ${filasPendientes(sol).length}`,
    ...(texto ? [`Nota: ${escapeHtml(texto)}`] : []),
    `${URL_APP}/admin/cargas/${id}`,
  ].join('\n'), null, 'escalamiento').catch(() => null)
  return { ok: true }
}

/**
 * Carlos termina de mirarla y se la devuelve al dueño: `ayuda` → `en_revision`, y
 * se borra `resumen.ayuda`. Si justo se estaba releyendo por un archivo nuevo
 * (con la ayuda pedida), solo se borra la marca y termina en `en_revision`.
 */
export async function devolverAlDueno({ id, adminId }) {
  let falla = null
  await conCandado(id, (fila) => {
    const resumen = resumenDeSolicitud(fila) ?? {}
    if (!fila || !ESTADOS_ABIERTOS.includes(fila.estado) || (fila.estado !== 'ayuda' && !resumen.ayuda)) { falla = { error: 'No está pidiendo ayuda', status: 409 }; return null }
    const { ayuda, ...resto } = resumen
    return {
      ...(fila.estado === 'ayuda' ? { estado: 'en_revision' } : {}),
      revisadaPorId: adminId ?? null, recordatorioAt: null, resumen: JSON.stringify(resto),
    }
  })
  return falla ?? { ok: true }
}

/**
 * Aprueba e importa (Carlos). Valida otra vez (la cuenta pudo cambiar desde la
 * lectura) y no carga NADA si alguna fila tiene error o si excede el plan: el
 * asesor la corrige o la quita antes. Una sola vez: «en_revision» o «ayuda» →
 * «importando».
 * ⚠ Importa SOLO las filas que el dueño no creó ya (`filasPendientes`), y lo
 * que el dueño creó se suma a lo importado.
 */
export async function aprobarSolicitud({ id, adminId, ruta = '', noCobrarDomingos = false, ahora = new Date() }) {
  const previa = await prisma.solicitudCarga.findUnique({ where: { id } })
  if (!previa) return { error: 'No existe', status: 404 }
  if (!ESTADOS_EDITABLES.includes(previa.estado)) return { error: `Está ${previa.estado}: no se puede aprobar`, status: 409 }

  /* Primero se toma la solicitud y DESPUÉS se leen las filas: así lo que el
     dueño alcanzó a apuntar antes no se importa otra vez. */
  const tomada = await prisma.solicitudCarga.updateMany({ where: { id, estado: previa.estado }, data: { estado: 'importando' } })
  if (tomada.count === 0) return { error: `Está ${previa.estado}: no se puede aprobar`, status: 409 }
  // Si algo falla vuelve a donde estaba: si venía de «ayuda», sigue en «ayuda».
  const soltar = () => prisma.solicitudCarga.update({ where: { id }, data: { estado: previa.estado } }).catch(() => {})
  // Lo que devolvió `importarCartera`, en cuanto devuelve bien. Desde ahí NUNCA se suelta (ver abajo).
  let importada = null

  try {
    const sol = await prisma.solicitudCarga.findUnique({ where: { id } })
    const filas = filasPendientes(sol)
    if (!filas.length) { await soltar(); return { error: 'No hay filas para importar', status: 400 } }

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
    /* ⚠ DESDE AQUÍ LA CARTERA YA ESTÁ DENTRO. Pase lo que pase después, la solicitud
       NO se suelta: volvería a «en_revision»/«ayuda» sin `importado`, Carlos podría
       aprobarla otra vez y las cartulinas sin cédula (que el importador no reconoce
       como repetidas) se crearían dos veces. Si algo falla, se cierra igual. */
    importada = { x, calle }
    /* Lo que el dueño creó cuenta: es su cartera cargada. Se lee con la solicitud
       BLOQUEADA y la fila fresca: un apunte que llegó mientras se importaba (el
       dueño sigue cargando) no se pisa con el resumen viejo. */
    let total = null
    let cerrada = null
    try {
      cerrada = await conCandado(id, async (fila, tx) => {
        const del = await cifrasDeCreadas(creadasDe(fila), sol.organizationId, tx)
        total = {
          clientesCreados: x.clientesCreados + del.clientes, prestamosCreados: x.prestamosCreados + del.prestamos,
          enLaCalle: calle + del.enLaCalle,
        }
        const resumen = { ...(resumenDeSolicitud(fila) ?? {}), importado: { ...x, ...total, ruta: nombreRuta || null } }
        return { estado: 'aprobada', aprobadaAt: ahora, revisadaPorId: adminId ?? null, resumen: JSON.stringify(resumen) }
      })
    } catch (e) {
      console.error('[carga-asesor] cierre tras importar, va el respaldo:', id, e)
      // Respaldo: un update simple, sobre el resumen que tenemos. Si ni eso, queda «importando»,
      // que tampoco se puede aprobar otra vez.
      total = total ?? { clientesCreados: x.clientesCreados, prestamosCreados: x.prestamosCreados, enLaCalle: calle }
      cerrada = await prisma.solicitudCarga.update({
        where: { id },
        data: {
          estado: 'aprobada', aprobadaAt: ahora, revisadaPorId: adminId ?? null,
          resumen: JSON.stringify({ ...(resumenDeSolicitud(sol) ?? {}), importado: { ...x, ...total, ruta: nombreRuta || null } }),
        },
      }).catch((e2) => { console.error('[carga-asesor] el respaldo del cierre tampoco pudo:', id, e2); return null })
    }
    const despues = await despuesDeCargar({
      sol: cerrada ?? sol, dueno, clientes: total.clientesCreados, prestamos: total.prestamosCreados, enLaCalle: total.enLaCalle, ahora,
    })

    return { resultado: x, enLaCalle: calle, finPrueba: despues.finPrueba, whatsapp: despues.whatsapp }
  } catch (e) {
    console.error('[carga-asesor] aprobar:', id, e)
    // Ya importó: se dice que se importó. Soltarla dejaría aprobarla de nuevo.
    if (importada) return { resultado: importada.x, enLaCalle: importada.calle, finPrueba: null, whatsapp: false }
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
 * las iba a leer murió con un despliegue) y recuerda a Carlos las que llevan 20 h
 * en «ayuda» sin que nadie las mire. Solo cuentan las que el dueño le pasó (lo
 * que el dueño todavía revisa no es de Carlos) y las horas corren desde que
 * pidió ayuda. El recordatorio sale una vez por pedida.
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

  const pedidas = await prisma.solicitudCarga.findMany({
    where: { estado: { in: ESTADOS_POR_ATENDER }, recordatorioAt: null },
    select: { id: true, resumen: true, createdAt: true, updatedAt: true, organization: { select: { nombre: true } } },
  })
  for (const s of pedidas) {
    const desde = new Date(resumenDeSolicitud(s)?.ayuda?.at ?? s.updatedAt ?? s.createdAt)
    if (ahora - desde < HORAS_RECORDATORIO * 3600000) continue
    const marcada = await prisma.solicitudCarga.updateMany({ where: { id: s.id, recordatorioAt: null }, data: { recordatorioAt: ahora } })
    if (!marcada.count) continue
    const horas = Math.round((ahora - desde) / 3600000)
    const ok = await sendMessage([
      `<b>Pidió ayuda con su carga hace ${horas} h: ${escapeHtml(s.organization?.nombre ?? '')}</b>`,
      `Nadie la ha mirado ni se la ha devuelto.`,
      `${URL_APP}/admin/cargas/${s.id}`,
    ].join('\n'), null, 'escalamiento').catch(() => null)
    if (ok?.ok) r.recordadas++
    else await prisma.solicitudCarga.update({ where: { id: s.id }, data: { recordatorioAt: null } }).catch(() => {})
  }
  return r
}
