// app/api/carga-masiva/importar/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { esId }             from '@/lib/ids'
import { calcularPrestamo, calcularEstadoCliente } from '@/lib/calculos'
import { agruparPorCliente } from '@/lib/carga-masiva'
import { registrarMovimientoCapital } from '@/lib/capital'

/* La cuenta por la que se da por movida la plata de una importación. El mismo
   defecto que `app/api/prestamos/route.js` aplica cuando nadie elige. */
const CUENTA_CARGA_MASIVA = 'efectivo'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { logActividad }     from '@/lib/activity-log'
import { trackEvent }       from '@/lib/analytics'
import { LIMITES_PLAN, LIMITES_RUTAS } from '@/lib/planes'
import { rutaPermitida } from '@/lib/limites-plan'
import { refrescarTotalesPrestamo } from '@/lib/prisma-pago-helpers'
import { dispararTrasCrear } from '@/lib/capi-activacion'

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (session.user.rol !== 'owner') {
      return Response.json({ error: 'Solo el administrador puede importar datos' }, { status: 403 })
    }

    const { organizationId, plan } = session.user
    const { filas, rutaId, crearRuta } = await request.json()

    if (!Array.isArray(filas) || filas.length === 0) {
      return Response.json({ error: 'No hay datos para importar' }, { status: 400 })
    }
    if (filas.length > 500) {
      return Response.json({ error: 'Máximo 500 filas por importación' }, { status: 400 })
    }

    // Validar que la ruta pertenezca a la organización del usuario. El `esId`
    // es porque un número casaría con una ruta cualquiera: ver lib/ids.js.
    if (rutaId != null && rutaId !== '') {
      if (!esId(rutaId)) return Response.json({ error: 'Ruta no válida' }, { status: 400 })
      const rutaValida = await prisma.ruta.findFirst({ where: { id: rutaId, organizationId }, select: { id: true } })
      if (!rutaValida) return Response.json({ error: 'Ruta no válida' }, { status: 400 })
      if (!await rutaPermitida(organizationId, rutaId)) {
        return Response.json({ error: 'Esta ruta excede el limite de tu plan. Mejora tu plan o desactiva rutas que no uses.' }, { status: 403 })
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
      return Response.json({
        error: `Excede el límite de tu plan (${limiteClientes} clientes). Tienes ${clientesActuales}, intentas agregar ${clientesNuevos} nuevos.`,
      }, { status: 403 })
    }

    // Resolver ruta
    let rutaFinal = rutaId || null
    if (crearRuta && typeof crearRuta === 'string' && crearRuta.trim()) {
      const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { rutasExtra: true } })
      const limiteRutas = (LIMITES_RUTAS[plan] ?? 1) + (org?.rutasExtra ?? 0)
      const totalRutas = await prisma.ruta.count({ where: { organizationId, activo: true } })
      if (totalRutas >= limiteRutas) {
        return Response.json({ error: `Tu plan permite máximo ${limiteRutas} rutas. No se puede crear una nueva ruta desde la importación.` }, { status: 403 })
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
            if (!p.montoPrestado || p.montoPrestado <= 0 || !p.diasPlazo || p.diasPlazo <= 0) {
              errores.push(`${grupo.cliente.nombre}: monto o plazo inválido`)
              continue
            }
            const { totalAPagar, cuotaDiaria, fechaFin, numPeriodos, diasPeriodo } = calcularPrestamo({
              montoPrestado: p.montoPrestado,
              tasaInteres: p.tasaInteres ?? 0,
              diasPlazo: p.diasPlazo,
              fechaInicio: p.fechaInicio,
              frecuencia: p.frecuencia || 'diario',
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
                modoInteres: 'fijo',
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
              creadoPorId: session.user.id,
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
                  cobradorId: session.user.id,
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
                creadoPorId: session.user.id,
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

    logActividad({
      session,
      accion: 'carga_masiva',
      entidadTipo: 'cliente',
      detalle: `Carga masiva: ${clientesCreados} clientes, ${prestamosCreados} préstamos${rutaFinal ? ', ruta asignada' : ''}`,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })
    trackEvent({
      organizationId,
      userId: session.user.id,
      evento: 'carga_masiva',
      metadata: { clientesCreados, prestamosCreados, filas: filas.length },
    })
    // Una carga masiva puede cruzar los dos umbrales de golpe (6 y 21): el
    // helper evalua ambos por separado y emite un evento por cada uno cruzado.
    dispararTrasCrear({ organizationId, creados: clientesCreados })

    return Response.json({
      resultado: {
        clientesCreados,
        prestamosCreados,
        pagosRegistrados,
        montoDesembolsado,
        errores,
        totalClientes: grupos.size,
        exitosos: grupos.size - errores.length,
        fallidos: errores.length,
        rutaAsignada: rutaFinal,
      },
    })
  } catch (err) {
    console.error('[POST /api/carga-masiva/importar]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
