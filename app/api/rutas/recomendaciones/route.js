// app/api/rutas/recomendaciones/route.js
// Agrupa clientes sin ruta por similitud de direccion para sugerir crear rutas
// nuevas o agregarlos a rutas existentes.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

const STOPWORDS = new Set([
  'calle', 'cll', 'cl', 'carrera', 'cra', 'kr', 'avenida', 'av', 'avda',
  'transversal', 'tv', 'trans', 'diagonal', 'dg', 'diag',
  'numero', 'num', 'no', 'nro', 'nº',
  'sur', 'norte', 'este', 'oeste', 'occidental', 'oriental',
  'barrio', 'br', 'bo', 'sector', 'urbanizacion', 'urb',
  'manzana', 'mz', 'mza', 'lote', 'lt', 'casa', 'cs',
  'apto', 'apartamento', 'apt', 'piso', 'int', 'interior',
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'con', 'en', 'a',
  'edificio', 'edif', 'torre', 'tr',
])

function normalizarTexto(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function tokenizarDireccion(direccion) {
  if (!direccion) return []
  const limpio = normalizarTexto(direccion).replace(/[^a-z0-9\s]/g, ' ')
  return limpio
    .split(/\s+/)
    .filter(Boolean)
    .filter((tok) => tok.length >= 3 && !STOPWORDS.has(tok) && !/^\d+$/.test(tok))
}

function capitalizar(s) {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export async function GET(_request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  const puedeGestionar = session.user.rol === 'owner' || session.user.permisos?.gestionarRutas
  if (!puedeGestionar) {
    return Response.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { organizationId } = session.user

  // 1) Clientes sin ruta con al menos un prestamo activo (los que realmente
  //    necesitan ruta para que se cobren).
  const clientesSinRuta = await prisma.cliente.findMany({
    where: {
      organizationId,
      rutaId: null,
      estado: { notIn: ['eliminado'] },
      prestamos: { some: { estado: 'activo' } },
    },
    select: {
      id: true, nombre: true, cedula: true, telefono: true,
      direccion: true, fotoUrl: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  const totalSinRuta = clientesSinRuta.length

  // Early-return si no hay nada que sugerir.
  if (totalSinRuta === 0) {
    return Response.json({
      totalSinRuta: 0,
      gruposSugeridos: [],
      sugerenciasRutaExistente: [],
      sueltos: 0,
    })
  }

  // 2) Tokenizar la direccion de cada cliente.
  const clientesConTokens = clientesSinRuta.map((c) => ({
    ...c,
    tokens: tokenizarDireccion(c.direccion),
  }))

  // 3) Para cada cliente, contar cuantos otros clientes (sin ruta) comparten
  //    cada token. Asignar cada cliente al grupo del token mas frecuente que
  //    comparte con >=1 otro cliente sin ruta.
  const conteoTokens = new Map() // token -> Set<clienteId>
  for (const c of clientesConTokens) {
    for (const t of c.tokens) {
      if (!conteoTokens.has(t)) conteoTokens.set(t, new Set())
      conteoTokens.get(t).add(c.id)
    }
  }

  // Asignar cada cliente al grupo del token compartido mas grande.
  const grupos = new Map() // token -> { clienteIds: Set, conteo: number }
  const asignacion = new Map() // clienteId -> token elegido o null
  for (const c of clientesConTokens) {
    let mejorToken = null
    let mejorConteo = 1 // necesita compartir con al menos 1 mas
    for (const t of c.tokens) {
      const conteo = conteoTokens.get(t)?.size ?? 0
      if (conteo > mejorConteo) {
        mejorConteo = conteo
        mejorToken = t
      }
    }
    asignacion.set(c.id, mejorToken)
    if (mejorToken) {
      if (!grupos.has(mejorToken)) grupos.set(mejorToken, new Set())
      grupos.get(mejorToken).add(c.id)
    }
  }

  // 4) Construir gruposSugeridos (>=2 clientes).
  const clienteById = new Map(clientesConTokens.map((c) => [c.id, c]))
  const gruposSugeridos = []
  let sueltos = 0
  for (const [token, ids] of grupos.entries()) {
    if (ids.size < 2) continue
    const clientes = [...ids].map((id) => {
      const c = clienteById.get(id)
      return {
        id: c.id,
        nombre: c.nombre,
        cedula: c.cedula,
        telefono: c.telefono,
        direccion: c.direccion,
        fotoUrl: c.fotoUrl,
      }
    })
    gruposSugeridos.push({
      id: `grupo-${token}`,
      nombreSugerido: capitalizar(token),
      token,
      clientes,
    })
  }
  // Cliente sin asignacion o cuyo grupo quedo <2 = suelto
  for (const c of clientesConTokens) {
    const tok = asignacion.get(c.id)
    if (!tok || (grupos.get(tok)?.size ?? 0) < 2) sueltos++
  }
  // Ordenar grupos por tamano desc.
  gruposSugeridos.sort((a, b) => b.clientes.length - a.clientes.length)

  // 5) Sugerir agregar a ruta existente: para clientes sueltos, buscar si su
  //    token comparte con >=2 clientes de alguna ruta existente.
  const clientesEnrutados = await prisma.cliente.findMany({
    where: {
      organizationId,
      rutaId: { not: null },
      estado: { notIn: ['eliminado'] },
    },
    select: { id: true, direccion: true, rutaId: true, ruta: { select: { id: true, nombre: true } } },
    take: 2000,
  })

  // Para cada ruta, contar tokens.
  const tokensPorRuta = new Map() // rutaId -> Map<token, count>
  const rutaNombres = new Map() // rutaId -> nombre
  for (const c of clientesEnrutados) {
    if (!c.rutaId) continue
    rutaNombres.set(c.rutaId, c.ruta?.nombre ?? 'Ruta')
    const tokens = tokenizarDireccion(c.direccion)
    if (!tokensPorRuta.has(c.rutaId)) tokensPorRuta.set(c.rutaId, new Map())
    const conteo = tokensPorRuta.get(c.rutaId)
    for (const t of tokens) {
      conteo.set(t, (conteo.get(t) ?? 0) + 1)
    }
  }

  const sugerenciasRutaExistente = []
  for (const c of clientesConTokens) {
    const tok = asignacion.get(c.id)
    const enGrupo = tok && (grupos.get(tok)?.size ?? 0) >= 2
    if (enGrupo) continue // este ya esta en un grupo sugerido, no duplicar

    let mejorRuta = null
    let mejorScore = 0
    let mejorToken = null
    for (const [rutaId, conteoMap] of tokensPorRuta.entries()) {
      for (const t of c.tokens) {
        const conteo = conteoMap.get(t) ?? 0
        if (conteo >= 2 && conteo > mejorScore) {
          mejorScore = conteo
          mejorRuta = rutaId
          mejorToken = t
        }
      }
    }
    if (mejorRuta) {
      sugerenciasRutaExistente.push({
        clienteId: c.id,
        clienteNombre: c.nombre,
        clienteDireccion: c.direccion,
        rutaId: mejorRuta,
        rutaNombre: rutaNombres.get(mejorRuta) ?? 'Ruta',
        motivo: `comparte "${mejorToken}" con ${mejorScore} clientes de esta ruta`,
      })
    }
  }

  return Response.json({
    totalSinRuta,
    gruposSugeridos,
    sugerenciasRutaExistente,
    sueltos,
  })
}
