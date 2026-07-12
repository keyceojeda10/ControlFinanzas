// app/api/admin/sesiones/route.js — Reporte de sesiones multi-dispositivo
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const horas = parseInt(searchParams.get('horas') || '24', 10)
  const soloSospechosos = searchParams.get('sospechosos') !== 'false'

  const desde = new Date(Date.now() - horas * 60 * 60 * 1000)

  // Todas las sesiones activas en el período
  const sesiones = await prisma.sesionActiva.findMany({
    where: { lastActivityAt: { gte: desde } },
    include: {
      user: {
        select: {
          id: true,
          nombre: true,
          email: true,
          rol: true,
          organizationId: true,
          organization: { select: { nombre: true, plan: true } },
        },
      },
    },
    orderBy: { lastActivityAt: 'desc' },
  })

  // Agrupar por usuario
  const porUsuario = {}
  for (const s of sesiones) {
    if (!porUsuario[s.userId]) {
      porUsuario[s.userId] = {
        user: s.user,
        sesiones: [],
        ips: new Set(),
        dispositivos: new Set(),
      }
    }
    porUsuario[s.userId].sesiones.push({
      id: s.id,
      ip: s.ip,
      dispositivo: s.dispositivo,
      lastActivityAt: s.lastActivityAt,
      createdAt: s.createdAt,
    })
    porUsuario[s.userId].ips.add(s.ip)
    porUsuario[s.userId].dispositivos.add(s.dispositivo)
  }

  // Convertir sets y filtrar sospechosos
  const resultado = Object.values(porUsuario)
    .map(u => ({
      ...u,
      ips: [...u.ips],
      dispositivos: [...u.dispositivos],
      totalSesiones: u.sesiones.length,
      totalIps: u.ips.size,
      totalDispositivos: u.dispositivos.size,
      sospechoso: u.ips.size >= 2 || u.dispositivos.size >= 3,
    }))
    .filter(u => !soloSospechosos || u.sospechoso)
    .sort((a, b) => b.totalIps - a.totalIps || b.totalDispositivos - a.totalDispositivos)

  // Métricas resumen
  const totalUsuariosActivos = Object.keys(porUsuario).length
  const totalSospechosos = resultado.filter(u => u.sospechoso).length

  return NextResponse.json({
    periodo: `${horas}h`,
    desde: desde.toISOString(),
    totalUsuariosActivos,
    totalSospechosos,
    usuarios: resultado,
  })
}
