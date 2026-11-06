// app/t/[token]/page.jsx — LA TARJETA DEL CLIENTE. Pública: el enlace es la llave.
//
// Se pinta en el servidor y siempre al momento (el cliente entra a comprobar que
// su pago quedó). Lo que protege la página está en middleware.js, app/layout.js y
// lib/tarjeta/datos.js. Ver docs/superpowers/specs/2026-11-05-tarjeta-del-cliente-design.md

import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { tarjetaPorToken, tarjetaDeEjemplo, apuntarVista } from '@/lib/tarjeta/datos'
import TarjetaCliente from '@/components/tarjeta/TarjetaCliente'

export const dynamic = 'force-dynamic'

const ROBOTS = { index: false, follow: false, nocache: true }
const ES_EJEMPLO = (token) => token === 'ejemplo'

/* ⚠ SOLO EL NOMBRE DEL NEGOCIO. Esto es lo que se ve en el chat sin abrir nada, y
   un chat se reenvía y se mira por encima del hombro: ni la deuda ni el nombre del
   cliente. `openGraph` y `twitter` se pisan para no heredar la imagen de la marca:
   el software no aparece como si fuera quien presta. */
export async function generateMetadata({ params }) {
  const { token } = await params
  const t = ES_EJEMPLO(token) ? null : await prisma.cliente.findUnique({
    where: { tarjetaToken: token },
    select: { organization: { select: { nombre: true, reciboCliente: true, activo: true } } },
  }).catch(() => null)
  const org = t?.organization
  const negocio = org?.activo && org.reciboCliente === 'tarjeta' ? org.nombre : null
  const titulo = negocio ?? 'Tu tarjeta de pagos'
  const descripcion = 'Tu tarjeta de pagos'
  return {
    title: titulo,
    description: descripcion,
    robots: ROBOTS,
    referrer: 'no-referrer',
    manifest: null,
    openGraph: { title: titulo, description: descripcion, images: [], type: 'website' },
    twitter: { card: 'summary', title: titulo, description: descripcion, images: [] },
  }
}

export default async function PaginaTarjeta({ params }) {
  const { token } = await params
  if (ES_EJEMPLO(token)) return <TarjetaCliente tarjeta={tarjetaDeEjemplo()} token={null} />

  const tarjeta = await tarjetaPorToken(token)
  if (!tarjeta) notFound()

  apuntarVista(tarjeta.clienteId, (await headers()).get('user-agent'))

  return <TarjetaCliente tarjeta={tarjeta} token={token} />
}
