/* ══ A QUIÉN LE TOCARÍA MORATORIO ════════════════════════════════════════════
 *
 *   «Aunque tiene intereses Moratorio, no se puede aplicar, y que
 *    automáticamente aplique a los préstamos en mora.»
 *      — Miguel Ángel (Préstamos Rincón), por el banner, 15 ago 2026.
 *
 * Lo de «no se puede aplicar» era un suelo de gracia que le pisaba en silencio
 * su configuración; eso ya está. Esto es la otra mitad: la lista completa, para
 * no tener que entrar préstamo por préstamo.
 *
 * ⚠ ESTO NO COBRA NADA. Solo dice a quién le tocaría y cuánto. Aplicar sigue
 *   siendo un botón que el prestamista pulsa, y va por el MISMO endpoint de
 *   siempre —`POST /api/prestamos/[id]/pagos` con tipo `recargo`—, que es el que
 *   ya mueve la caja y los totales bien. Escribir aquí una segunda vía de cobro
 *   es cómo se acaba con dos cifras distintas para la misma plata.
 *
 * ⚠ Y NO HAY BARRIDO AUTOMÁTICO. Él lo pidió automático; un cron que cobra a
 *   clientes reales sin que nadie mire multiplica cualquier error por toda la
 *   cartera antes de que alguien lo note. Decisión del dueño: propone y él
 *   confirma.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularInteresMoratorio, calcularDiasMora } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  /* Solo el dueño: es una decisión de cobro sobre toda la cartera, no una
     gestión de ruta. El botón de un préstamo suelto ya pide `esOwner`. */
  if (session.user.rol !== 'owner') {
    return NextResponse.json({ error: 'Solo el administrador' }, { status: 403 })
  }

  const orgId = session.user.organizationId
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { tasaMoratorio: true, diasGraciaMoratorio: true, diasSinCobro: true },
  })

  // Sin tasa no hay nada que proponer, y decirlo así evita una lista vacía que
  // parece un fallo del sistema.
  if (!org?.tasaMoratorio || org.tasaMoratorio <= 0) {
    return NextResponse.json({ configurado: false, tasa: 0, prestamos: [], total: 0 })
  }

  const [prestamos, festivos] = await Promise.all([
    prisma.prestamo.findMany({
      where: { organizationId: orgId, estado: 'activo' },
      include: {
        cliente: { select: { id: true, nombre: true, telefono: true, diasSinCobro: true, ruta: { select: { id: true, nombre: true, diasSinCobro: true } } } },
        pagos: { orderBy: { fechaPago: 'asc' } },
        cuotasAmortizacion: { orderBy: { numeroPeriodo: 'asc' } },
      },
    }),
    prisma.festivo.findMany({ where: { organizationId: orgId } }),
  ])

  const filas = []
  for (const p of prestamos) {
    const diasExcluidos = obtenerDiasSinCobro(p.cliente, p.cliente?.ruta, org, p)
    const m = calcularInteresMoratorio(p, diasExcluidos, festivos, org.tasaMoratorio, org.diasGraciaMoratorio ?? 5)
    if (!m.aplicable) continue
    filas.push({
      id: p.id,
      cliente: p.cliente?.nombre ?? 'Sin nombre',
      ruta: p.cliente?.ruta?.nombre ?? null,
      diasMora: calcularDiasMora(p, diasExcluidos, festivos),
      diasEfectivos: m.diasMoraEfectivos,
      montoBase: m.montoBase,
      monto: m.montoMoratorio,
      /* Cuando el cálculo choca con el tope —la mitad del saldo— la cifra deja
         de ser «lo que salió» y pasa a ser «lo máximo que se deja». Sin decirlo,
         el prestamista no entiende por qué dos préstamos parecidos dan lo mismo. */
      topado: m.montoMoratorio >= m.tope && m.tope > 0,
    })
  }

  // Lo más caro arriba: es lo que se mira primero y lo que más pesa si se aplica.
  filas.sort((a, b) => b.monto - a.monto)

  return NextResponse.json({
    configurado: true,
    tasa: org.tasaMoratorio,
    diasGracia: org.diasGraciaMoratorio ?? 5,
    prestamos: filas,
    total: filas.reduce((a, f) => a + f.monto, 0),
    activos: prestamos.length,
  })
}
