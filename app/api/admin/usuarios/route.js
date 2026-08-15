/* app/api/admin/usuarios/route.js — LA lista de usuarios del panel.
 *
 * ══ POR QUÉ ESTA REEMPLAZA A CINCO ══════════════════════════════════════════
 *
 * «Todavía todo el panel de superadministrador está muy mal distribuido […]
 *  flujos malos, muy poca capacidad de personalización o de ajuste a los
 *  usuarios. O sea, es un panel de superadministrador que no superadministra
 *  nada en absoluto.» — el dueño, 16 ago 2026.
 *
 * Medido antes de tocar nada: SEIS secciones distintas consultaban la misma
 * tabla `Organization` para contestar variantes de la misma pregunta —
 * `negocio`, `organizaciones`, `suscripciones`, `activacion`, `retencion` y
 * `crm`— sumando unas 2.500 líneas de pantalla. Y cada una segmentaba a su
 * manera, así que la misma organización salía «activa» en una y «muerta» en
 * otra.
 *
 * Aquí hay UNA consulta y UNA segmentación (`lib/admin/segmentos.js`). Lo que
 * cambia entre vistas es el filtro, no la definición.
 *
 * ⚠ El buscador mira CUATRO campos —negocio, dueño, correo y teléfono— porque
 *   el superadministrador busca por lo que tiene a mano cuando alguien le
 *   escribe, y lo que tiene a mano suele ser un número de WhatsApp.
 */
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { segmentarOrganizaciones, SELECT_ORG_SEGMENTO, SEGMENTOS } from '@/lib/admin/segmentos'

/** Los internos no son clientes: falsean todos los conteos. */
const EMAILS_INTERNOS = ['keycejob@gmail.com', 'ccaojd@gmail.com', 'owner@test.com', 'controlfinanzasgmail@gmail.com']

const ORDENES = {
  // Por defecto: los que más plata mueven arriba. Es a quien no puedes perder.
  valor:      (a, b) => b.precio - a.precio || b.clientes - a.clientes,
  recientes:  (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  vence:      (a, b) => (a.diasRestantes ?? 9e9) - (b.diasRestantes ?? 9e9),
  actividad:  (a, b) => a.diasSinActividad - b.diasSinActividad,
  clientes:   (a, b) => b.clientes - a.clientes,
  nombre:     (a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'),
}

/** Sin tildes y en minúsculas: nadie escribe «Peñaloza» con la eñe al buscar. */
const plano = (s) => String(s ?? '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const url       = new URL(req.url)
  const busqueda  = plano(url.searchParams.get('q') || '').trim()
  const segmento  = url.searchParams.get('segmento') || null
  const orden     = ORDENES[url.searchParams.get('orden')] ? url.searchParams.get('orden') : 'valor'
  const limite    = Math.min(Number(url.searchParams.get('limite')) || 60, 500)

  const orgs = await prisma.organization.findMany({
    where: { users: { none: { email: { in: EMAILS_INTERNOS } } } },
    select: SELECT_ORG_SEGMENTO,
  })

  const { fichas, mrr, porSegmento, totalReal } = segmentarOrganizaciones(orgs)

  /* El buscador va sobre las fichas ya armadas y no sobre Prisma a propósito:
     el teléfono puede venir del dueño O de la organización, y esa decisión ya
     está tomada en `segmentarOrganizacion`. Buscar en la base obligaría a
     escribirla dos veces. */
  let lista = fichas
  if (busqueda) {
    // El teléfono se compara solo con dígitos, y solo si escribió al menos
    // cuatro: con dos, «31» le sale media agenda.
    const digitos = busqueda.replace(/\D/g, '')
    lista = lista.filter((f) =>
      plano(f.nombre).includes(busqueda) ||
      plano(f.ownerNombre).includes(busqueda) ||
      plano(f.ownerEmail).includes(busqueda) ||
      (digitos.length >= 4 && String(f.ownerTelefono).replace(/\D/g, '').includes(digitos)),
    )
  }
  if (segmento && segmento !== 'todos') lista = lista.filter((f) => f.segmento === segmento)

  const total = lista.length
  lista = [...lista].sort(ORDENES[orden]).slice(0, limite)

  return NextResponse.json({
    usuarios: lista,
    total,
    mostrados: lista.length,
    // Los conteos son SIEMPRE del total, no de lo filtrado: son las pastillas
    // por las que se filtra, y unas pastillas que cambian al pulsarlas marean.
    porSegmento,
    segmentos: SEGMENTOS,
    resumen: { mrr, totalReal, organizaciones: fichas.length },
  })
}
