// app/api/carga-masiva/validar/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { validarFila, agruparPorCliente, huellaPrestamo } from '@/lib/carga-masiva'
import { LIMITES_PLAN }     from '@/lib/planes'

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
    const { filas } = await request.json()

    if (!Array.isArray(filas) || filas.length === 0) {
      return Response.json({ error: 'No hay datos para validar' }, { status: 400 })
    }
    if (filas.length > 500) {
      return Response.json({ error: 'Máximo 500 filas por importación' }, { status: 400 })
    }

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

    return Response.json({
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
    })
  } catch (err) {
    console.error('[POST /api/carga-masiva/validar]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
