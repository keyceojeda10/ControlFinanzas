// app/api/buscar/voz/route.js — Buscar a un cliente por lo que se DIJO.
//
// La búsqueda normal (`/api/buscar`) es `contains` sobre lo tecleado, y el
// dictado no escribe como la base («Yeison» por «Jeison», la frase entera
// «buscar el crédito de…»). Aquí se traen los nombres que esta persona puede
// ver y se comparan por cómo suenan (lib/busqueda-voz.js).
//
// ⚠ EL MISMO ALCANCE QUE LA LUPA: el cobrador solo ve a los de SUS rutas. Sin
// ese filtro, decir un nombre le enseñaría clientes de otra ruta.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buscarLimiter, getClientIp } from '@/lib/rate-limit'
import { buscarPorVoz, limpiarDictado, alcanceDeVoz } from '@/lib/busqueda-voz'

export async function GET(request) {
  const rl = buscarLimiter(getClientIp(request))
  if (!rl.ok) return Response.json({ error: 'Demasiados intentos' }, { status: 429 })
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const dicho = new URL(request.url).searchParams.get('q')?.slice(0, 200) ?? ''
  const texto = limpiarDictado(dicho)
  if (texto.length < 2) return Response.json({ texto, resultados: [], unico: false })

  const clientes = await prisma.cliente.findMany({
    where: alcanceDeVoz(session.user, new URL(request.url).searchParams.get('rutaId') || null),
    select: { id: true, nombre: true, cedula: true, telefono: true, direccion: true },
  })
  const { resultados, unico } = buscarPorVoz(texto, clientes)
  return Response.json({
    texto,
    resultados: resultados.map(({ puntaje, ...c }) => c),
    unico,
  })
}
