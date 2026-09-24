// lib/importar-cartera.js
/* VALIDAR E IMPORTAR UNA CARTERA, SIN LA SESIÓN (24 sep 2026).
 *
 * Era el cuerpo de `app/api/carga-masiva/validar` e `importar`, movido tal cual.
 * Las rutas siguen revisando la sesión y llaman aquí; el soporte puede cargarle
 * la cartera a un cliente con el MISMO código que usa su pantalla, sin entrar en
 * su cuenta con una sesión falsa (en producción no se hace). Un solo camino: si
 * se arregla algo del importador, se arregla aquí para los dos.
 */
import { prisma } from '@/lib/prisma'
import { esId } from '@/lib/ids'
import { calcularEstadoCliente } from '@/lib/calculos'
import { validarFila, agruparPorCliente, calcularPrestamoImportado, huellaPrestamo } from '@/lib/carga-masiva'
import { registrarMovimientoCapital } from '@/lib/capital'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { LIMITES_PLAN, LIMITES_RUTAS } from '@/lib/planes'
import { rutaPermitida } from '@/lib/limites-plan'
import { refrescarTotalesPrestamo } from '@/lib/prisma-pago-helpers'

/* La cuenta por la que se da por movida la plata de una importación. El mismo
   defecto que `app/api/prestamos/route.js` aplica cuando nadie elige. */
const CUENTA_CARGA_MASIVA = 'efectivo'

/** Lo que ve el prestamista en «Revisar». Devuelve el cuerpo de la respuesta de /validar. */
export async function validarCartera({ organizationId, plan, filas }) {
  // Contar clientes actuales
  const clientesActuales = await prisma.cliente.count({
    where: { organizationId, estado: { notIn: ['eliminado'] } },
  })
  const limiteClientes = LIMITES_PLAN[plan] ?? 50

  // Obtener cédulas existentes de un golpe
  const cedulasEnArchivo = [...new Set(
    filas.map(f => String(f.cedula ?? '').replace(/\D/g, '')).filter(Boolean)
  )]

  const clientesExistentes = await prisma.cliente.findMany({
    where: { organizationId, cedula: { in: cedulasEnArchivo } },
    select: { cedula: true, estado: true, nombre: true, id: true },
  })
  const cedulasExistentes = new Map(clientesExistentes.map(c => [c.cedula, c]))

  /* Los préstamos que ESOS clientes ya tienen, para reconocer el mismo archivo
     subido dos veces: la fila con la misma huella sale «ya está» y no se crea.
     Ver `huellaPrestamo`. */
  const prestamosExistentes = clientesExistentes.length > 0
    ? await prisma.prestamo.findMany({
      where: { organizationId, clienteId: { in: clientesExistentes.map(c => c.id) }, estado: { not: 'cancelado' } },
      select: { clienteId: true, montoPrestado: true, fechaInicio: true, frecuencia: true },
    })
    : []
  const cedulaDe = new Map(clientesExistentes.map(c => [c.id, c.cedula]))
  const huellasExistentes = new Map()
  for (const p of prestamosExistentes) {
    const ced = cedulaDe.get(p.clienteId)
    if (!huellasExistentes.has(ced)) huellasExistentes.set(ced, new Set())
    huellasExistentes.get(ced).add(huellaPrestamo(p))
  }

  // Obtener rutas de la org
  const rutas = await prisma.ruta.findMany({
    where: { organizationId, activo: true },
    select: { id: true, nombre: true },
  })

  // Validar cada fila (una cédula puede repetirse — múltiples préstamos)
  const filasValidadas = filas.map((fila, i) =>
    validarFila(fila, i, cedulasExistentes, huellasExistentes)
  )

  // Lo que se va a CREAR: ni las filas con error ni las que ya están.
  const validos = filasValidadas.filter(f => f.estado !== 'error' && f.estado !== 'repetido')
  const conError = filasValidadas.filter(f => f.estado === 'error')
  const repetidas = filasValidadas.filter(f => f.estado === 'repetido')
  const conAdvertencia = filasValidadas.filter(f => f.estado === 'advertencia')
  const conPrestamo = validos.filter(f => f.datos.tienePrestamo)

  // Agrupar para contar clientes únicos nuevos
  const grupos = agruparPorCliente(filasValidadas)
  const cedulasUnicasNuevas = [...grupos.keys()].filter(c => !cedulasExistentes.has(c))
  const clientesNuevos = cedulasUnicasNuevas.length

  const espacioDisponible = Math.max(0, limiteClientes - clientesActuales)
  const excedePlan = clientesNuevos > espacioDisponible
  const montoTotalDesembolso = conPrestamo.reduce((a, f) => a + f.datos.montoPrestado, 0)

  // Estadísticas por tipo
  const prestamos = conPrestamo.filter(f => f.datos.tipo === 'prestamo')
  const mercancias = conPrestamo.filter(f => f.datos.tipo === 'mercancia')

  return {
    resumen: {
      totalFilas: filas.length,
      filasValidas: validos.length,
      filasConError: conError.length,
      filasRepetidas: repetidas.length,
      filasConAdvertencia: conAdvertencia.length,
      clientesUnicos: grupos.size,
      clientesNuevos,
      clientesExistentes: grupos.size - clientesNuevos,
      totalPrestamos: conPrestamo.length,
      prestamosDinero: prestamos.length,
      prestamosMercancia: mercancias.length,
      montoTotalDesembolso,
      espacioDisponible,
      excedePlan,
      limiteClientes,
      clientesActuales,
    },
    filas: filasValidadas,
    rutas,
  }
}

/**
 * Crea los clientes, préstamos, desembolsos y abonos previos de las filas ya
 * validadas. `usuarioId` es quien queda como autor (el dueño de la cuenta).
 * Devuelve `{ resultado }`, o `{ error, status }` si algo impide empezar.
 */
export async function importarCartera({ organizationId, plan, usuarioId, filas, rutaId, crearRuta }) {
  // Validar que la ruta pertenezca a la organización del usuario. El `esId`
  // es porque un número casaría con una ruta cualquiera: ver lib/ids.js.
  if (rutaId != null && rutaId !== '') {
    if (!esId(rutaId)) return { error: 'Ruta no válida', status: 400 }
    const rutaValida = await prisma.ruta.findFirst({ where: { id: rutaId, organizationId }, select: { id: true } })
    if (!rutaValida) return { error: 'Ruta no válida', status: 400 }
    if (!await rutaPermitida(organizationId, rutaId)) {
      return { error: 'Esta ruta excede el limite de tu plan. Mejora tu plan o desactiva rutas que no uses.', status: 403 }
    }
  }

  // Agrupar por cédula (múltiples préstamos por cliente)
  // filas ya viene como array de { datos, calculado, ... } del frontend (post-validación)
  // Pero también soportamos filas planas si vienen directas
  const filasNormalizadas = filas.map((f, i) => ({
    indice: i,
    estado: 'valido',
    datos: f.datos || f,
    calculado: f.calculado || null,
  }))
  const grupos = agruparPorCliente(filasNormalizadas)

  // Verificar límite del plan
  const clientesActuales = await prisma.cliente.count({
    where: { organizationId, estado: { notIn: ['eliminado'] } },
  })
  const cedulasExistentesDB = await prisma.cliente.findMany({
    where: { organizationId, cedula: { in: [...grupos.keys()] } },
    select: { cedula: true, id: true },
  })
  const cedulaToId = new Map(cedulasExistentesDB.map(c => [c.cedula, c.id]))

  /* ⚠ LA MISMA GUARDA QUE LA REVISIÓN, AQUÍ TAMBIÉN: el servidor no se fía de lo
     que le manden. Los préstamos que cada cliente YA tenía ANTES de esta
     importación —la foto se toma una vez, al empezar—: un préstamo con la misma
     huella no se vuelve a crear. Con la foto previa, dos préstamos iguales que
     vengan en el MISMO archivo se crean los dos, como antes. Ver `huellaPrestamo`. */
  const idsExistentes = [...cedulaToId.values()]
  const huellasPrevias = new Map()
  if (idsExistentes.length > 0) {
    const previos = await prisma.prestamo.findMany({
      where: { organizationId, clienteId: { in: idsExistentes }, estado: { not: 'cancelado' } },
      select: { clienteId: true, montoPrestado: true, fechaInicio: true, frecuencia: true },
    })
    for (const p of previos) {
      if (!huellasPrevias.has(p.clienteId)) huellasPrevias.set(p.clienteId, new Set())
      huellasPrevias.get(p.clienteId).add(huellaPrestamo(p))
    }
  }
  const yaLoTiene = (clienteId, p) => !!clienteId && !!huellasPrevias.get(clienteId)?.has(huellaPrestamo(p))
  let prestamosRepetidos = 0

  const clientesNuevos = [...grupos.keys()].filter(c => !cedulaToId.has(c)).length
  /* El cupo extra por cuenta cuenta también aquí: si no, quien lo tiene puede
     crear clientes de uno en uno pero la importación se lo niega, y ese es el
     camino por el que entran de verdad los clientes nuevos.
     El plan sale de la BASE por el mismo motivo que en `api/clientes`: el del
     JWT no se refresca sin volver a entrar. */
  const orgCupo = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true, clientesExtra: true },
  })
  const limiteClientes = (LIMITES_PLAN[orgCupo?.plan || plan] ?? 50) + (orgCupo?.clientesExtra ?? 0)
  if (clientesActuales + clientesNuevos > limiteClientes) {
    return {
      error: `Excede el límite de tu plan (${limiteClientes} clientes). Tienes ${clientesActuales}, intentas agregar ${clientesNuevos} nuevos.`,
      status: 403,
    }
  }

  // Resolver ruta
  let rutaFinal = rutaId || null
  if (crearRuta && typeof crearRuta === 'string' && crearRuta.trim()) {
    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { rutasExtra: true } })
    const limiteRutas = (LIMITES_RUTAS[plan] ?? 1) + (org?.rutasExtra ?? 0)
    const totalRutas = await prisma.ruta.count({ where: { organizationId, activo: true } })
    if (totalRutas >= limiteRutas) {
      return { error: `Tu plan permite máximo ${limiteRutas} rutas. No se puede crear una nueva ruta desde la importación.`, status: 403 }
    }
    const nuevaRuta = await prisma.ruta.create({
      data: { organizationId, nombre: crearRuta.trim() },
    })
    rutaFinal = nuevaRuta.id
  }

  // Config para calcular estado correcto (mora vs activo)
  const orgCfg = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { diasSinCobro: true },
  })
  const rutaCfg = rutaFinal
    ? await prisma.ruta.findUnique({ where: { id: rutaFinal }, select: { diasSinCobro: true } })
    : null

  // Importar por cliente (agrupado)
  let clientesCreados = 0
  let prestamosCreados = 0
  let pagosRegistrados = 0
  let montoDesembolsado = 0
  const errores = []

  for (const [cedula, grupo] of grupos) {
    /* Un cliente que ya existe y cuyos préstamos YA estaban todos: no se toca
       nada, ni sus datos. Es el mismo archivo subido otra vez. */
    const idPrevio = cedulaToId.get(cedula)
    if (idPrevio && grupo.prestamos.length > 0 && grupo.prestamos.every((p) => yaLoTiene(idPrevio, p))) {
      prestamosRepetidos += grupo.prestamos.length
      continue
    }
    try {
      await prisma.$transaction(async (tx) => {
        let clienteId = cedulaToId.get(cedula)

        if (clienteId) {
          // Actualizar datos del cliente existente
          await tx.cliente.update({
            where: { id: clienteId },
            data: {
              nombre: grupo.cliente.nombre,
              telefono: grupo.cliente.telefono || undefined,
              direccion: grupo.cliente.direccion || undefined,
              referencia: grupo.cliente.referencia || undefined,
              rutaId: rutaFinal || undefined,
              estado: 'activo',
            },
          })
        } else {
          const nuevoCliente = await tx.cliente.create({
            data: {
              organizationId,
              nombre: grupo.cliente.nombre,
              cedula: grupo.cliente.cedula,
              telefono: grupo.cliente.telefono || null,
              direccion: grupo.cliente.direccion || null,
              referencia: grupo.cliente.referencia || null,
              rutaId: rutaFinal,
              estado: 'activo',
            },
          })
          clienteId = nuevoCliente.id
          clientesCreados++
        }

        // Crear cada préstamo del cliente
        for (const p of grupo.prestamos) {
          if (yaLoTiene(cedulaToId.get(cedula), p)) { prestamosRepetidos++; continue }
          if (!p.montoPrestado || p.montoPrestado <= 0 || !p.diasPlazo || p.diasPlazo <= 0) {
            errores.push(`${grupo.cliente.nombre}: monto o plazo inválido`)
            continue
          }
          // El MISMO calculo que enseño la validacion (si el archivo trae el
          // valor de la cuota, manda la cuota). Antes se recalculaba aqui en
          // 'fijo' por su cuenta.
          const { totalAPagar, cuotaDiaria, fechaFin, numPeriodos, diasPeriodo, modoInteres } = calcularPrestamoImportado({
            montoPrestado: p.montoPrestado,
            tasaInteres: p.tasaInteres ?? 0,
            diasPlazo: p.diasPlazo,
            fechaInicio: p.fechaInicio,
            frecuencia: p.frecuencia || 'diario',
            valorCuota: p.valorCuota,
          })

          const prestamo = await tx.prestamo.create({
            data: {
              clienteId,
              organizationId,
              montoPrestado: p.montoPrestado,
              tasaInteres: p.tasaInteres ?? 0,
              totalAPagar,
              cuotaDiaria,
              frecuencia: p.frecuencia || 'diario',
              modoInteres,   // 'manual' si manda la cuota del archivo; si no, 'fijo'
              // Plazo REAL del calculo (ver renovar/route.js): numPeriodos
              // redondea hacia arriba, asi que 180 dias semanales son 26 cobros
              // = 182 dias. Guardar 180 dejaba el plazo mas corto que el dinero.
              diasPlazo: numPeriodos * diasPeriodo,
              // Mismo convenio que al crear un prestamo desde la app: medianoche
              // de Bogota (T05:00Z). `new Date('2026-07-05')` a secas es medianoche
              // UTC, o sea las 7pm del dia ANTERIOR en Bogota, y todo el sistema
              // (mora, proximo cobro, meta de caja) lee el prestamo como si hubiera
              // arrancado un dia antes del que trae el Excel. normalizarFecha() ya
              // garantiza el formato YYYY-MM-DD, asi que el slice es defensivo.
              fechaInicio: new Date(`${String(p.fechaInicio).slice(0, 10)}T05:00:00.000Z`),
              fechaFin,
            },
          })
          prestamosCreados++
          montoDesembolsado += p.montoPrestado

          await registrarMovimientoCapital(tx, {
            organizationId,
            tipo: 'desembolso',
            monto: p.montoPrestado,
            descripcion: `${p.tipo === 'mercancia' ? 'Mercancía' : 'Desembolso'} (carga masiva) - ${grupo.cliente.nombre}`,
            referenciaId: prestamo.id,
            referenciaTipo: 'prestamo',
            // `rutaFinal` es la ruta a la que se está importando. Sin esto, una
            // importación entera sale del capital global sin descontarse de
            // ninguna ruta, y la sub-bolsa queda desviada desde el primer día.
            rutaId: rutaFinal || null,
            creadoPorId: usuarioId,
            /* ⚠ SIN ESTO LA IMPORTACIÓN ENTERA CAE EN «SIN REGISTRAR».
               `resolverKey` (lib/capital.js) manda ahí todo movimiento con la
               cuenta en NULL. La importación no pregunta por cuenta —y no
               debe: son cientos de filas—, así que va el mismo defecto que
               usa el asistente cuando el prestamista no elige. Medido el 26
               ago 2026: 212 desembolsos sin cuenta en 30 días salían de aquí. */
            metodoPago: CUENTA_CARGA_MASIVA,
          })

          // Abono previo
          const abono = p.abonadoHasta || 0
          if (abono > 0 && abono <= totalAPagar) {
            await tx.pago.create({
              data: {
                prestamoId: prestamo.id,
                organizationId,
                cobradorId: usuarioId,
                montoPagado: abono,
                tipo: 'completo',
                fechaPago: new Date(p.fechaInicio),
                nota: 'Abono previo (carga masiva)',
              },
            })
            pagosRegistrados++

            // Refrescar denormalizados del prestamo recien creado.
            await refrescarTotalesPrestamo(tx, prestamo.id)

            await registrarMovimientoCapital(tx, {
              organizationId,
              tipo: 'recaudo',
              monto: abono,
              descripcion: `Abono previo (carga masiva) - ${grupo.cliente.nombre}`,
              referenciaId: prestamo.id,
              referenciaTipo: 'prestamo',
              rutaId: rutaFinal || null,
              creadoPorId: usuarioId,
              // La misma cuenta que el desembolso de esta misma fila: las dos
              // mitades del mismo acto no pueden ir a cubos distintos.
              metodoPago: CUENTA_CARGA_MASIVA,
            })
          }
        }

        // Recalcular estado del cliente (puede quedar en mora si los prestamos
        // traen fechas viejas con abonos insuficientes)
        const prestamosCliente = await tx.prestamo.findMany({
          where: { clienteId },
          include: { pagos: { select: { montoPagado: true, fechaPago: true, tipo: true } } },
        })
        const clienteCfg = await tx.cliente.findUnique({
          where: { id: clienteId },
          select: { diasSinCobro: true },
        })
        const diasExcluidos = obtenerDiasSinCobro(clienteCfg, rutaCfg, orgCfg)
        const estadoFinal = calcularEstadoCliente(prestamosCliente, diasExcluidos)
        await tx.cliente.update({
          where: { id: clienteId },
          data: { estado: estadoFinal },
        })
      })
    } catch (err) {
      console.error(`[carga-masiva] Error cédula ${cedula}:`, err.message)
      errores.push({
        cedula,
        nombre: grupo.cliente.nombre,
        prestamos: grupo.prestamos.length,
        error: err.message,
      })
    }
  }

  return {
    resultado: {
      clientesCreados,
      prestamosCreados,
      // Los que ya estaban (mismo cliente, monto, fecha y frecuencia) y no se crearon.
      prestamosRepetidos,
      pagosRegistrados,
      montoDesembolsado,
      errores,
      totalClientes: grupos.size,
      exitosos: grupos.size - errores.length,
      fallidos: errores.length,
      rutaAsignada: rutaFinal,
    },
  }
}
