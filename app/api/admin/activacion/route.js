import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.rol !== 'superadmin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const orgs = await prisma.organization.findMany({
      where: { users: { some: { rol: 'owner' } } },
      include: {
        users: {
          where: { rol: 'owner' },
          select: { nombre: true, email: true, telefono: true, lastLogin: true },
          take: 1,
        },
        _count: {
          select: { clientes: true, prestamos: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const now = new Date()
    const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const ayer = new Date(hoy.getTime() - 86400000)
    const inicioSemana = new Date(hoy.getTime() - hoy.getDay() * 86400000)
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1)

    let registrosHoy = 0, registrosAyer = 0, registrosSemana = 0, registrosMes = 0
    let totalActivos = 0, totalInactivos = 0, trialPorVencer = 0

    const datos = orgs.map(org => {
      const owner = org.users[0] || {}
      const clientes = org._count.clientes
      const prestamos = org._count.prestamos
      const diasDesdeRegistro = Math.floor((now.getTime() - org.createdAt.getTime()) / 86400000)
      const diasTrial = Math.max(0, 14 - diasDesdeRegistro)
      const createdDate = new Date(org.createdAt)

      if (createdDate >= hoy) registrosHoy++
      if (createdDate >= ayer && createdDate < hoy) registrosAyer++
      if (createdDate >= inicioSemana) registrosSemana++
      if (createdDate >= inicioMes) registrosMes++

      let estado = 'inactivo'
      if (clientes >= 4) { estado = 'activo'; totalActivos++ }
      else if (clientes > 0) { estado = 'probando'; totalActivos++ }
      else { totalInactivos++ }

      if (diasTrial > 0 && diasTrial <= 3) trialPorVencer++

      return {
        id: org.id,
        orgNombre: org.nombre,
        plan: org.plan,
        ownerNombre: owner.nombre || '',
        ownerEmail: owner.email || '',
        ownerTelefono: owner.telefono || '',
        lastLogin: owner.lastLogin,
        createdAt: org.createdAt,
        clientes,
        prestamos,
        estado,
        diasTrial,
        diasDesdeRegistro,
      }
    })

    return NextResponse.json({
      datos,
      resumen: {
        registrosHoy,
        registrosAyer,
        registrosSemana,
        registrosMes,
        totalActivos,
        totalInactivos,
        trialPorVencer,
        total: orgs.length,
        tasaActivacion: orgs.length > 0 ? Math.round((totalActivos / orgs.length) * 100) : 0,
      },
    })
  } catch (error) {
    console.error('[GET /api/admin/activacion]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
