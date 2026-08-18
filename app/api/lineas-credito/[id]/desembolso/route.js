// app/api/lineas-credito/[id]/desembolso/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { puedeDesembolsar } from '@/lib/linea-credito'
import { registrarMovimientoCapital } from '@/lib/capital'

// ─── DELETE /api/lineas-credito/[id]/desembolso?desembolsoId=xxx ──────────
// Solo admin, solo desembolsos creados hoy.
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol } = session.user
  const { id: lineaId } = await params

  if (rol === 'cobrador') {
    return Response.json({ error: 'Sin permiso para eliminar desembolsos' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const desembolsoId = searchParams.get('desembolsoId')

    if (!desembolsoId) {
      return Response.json({ error: 'desembolsoId es requerido' }, { status: 400 })
    }

    const desembolso = await prisma.desembolsoLinea.findUnique({
      where: { id: desembolsoId },
      select: { id: true, lineaCreditoId: true, organizationId: true, createdAt: true },
    })

    if (!desembolso || desembolso.organizationId !== organizationId || desembolso.lineaCreditoId !== lineaId) {
      return Response.json({ error: 'Desembolso no encontrado' }, { status: 404 })
    }

    const hoy = new Date()
    const creado = new Date(desembolso.createdAt)
    if (creado.toDateString() !== hoy.toDateString()) {
      return Response.json({ error: 'Solo se pueden eliminar desembolsos del dia de hoy' }, { status: 400 })
    }

    await prisma.desembolsoLinea.delete({ where: { id: desembolsoId } })

    return Response.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/lineas-credito/[id]/desembolso]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ─── POST /api/lineas-credito/[id]/desembolso ─────────────────────────────
// Registra un desembolso sobre una linea de credito activa.
// Owner: siempre puede.
// Cobrador: solo si tiene puedeDesembolsarLinea === true en su User record.
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol, id: userId } = session.user
  const { id: lineaId } = await params

  try {
    // ── Validar permiso del cobrador ────────────────────────────────────────
    if (rol === 'cobrador') {
      const cobrador = await prisma.user.findUnique({
        where: { id: userId },
        select: { puedeDesembolsarLinea: true },
      })
      if (!cobrador?.puedeDesembolsarLinea) {
        return Response.json(
          { error: 'No tienes permiso para desembolsar en lineas de credito' },
          { status: 403 }
        )
      }
    }

    // ── Validar input ───────────────────────────────────────────────────────
    // ── EL CUERPO PUEDE LLEGAR VACIO, Y NO PUEDE TUMBAR LA RUTA ──
    // `await request.json()` sin guarda lanza `SyntaxError: Unexpected end of
    // JSON input` con un cuerpo vacio o roto, y eso sale como un 500. En un
    // endpoint que mueve plata eso es lo peor de los dos mundos: el cliente
    // recibe un error sin mensaje y ensena «Error de red» —que es falso, la red
    // funciono— mientras el servidor no dice que le faltaba.
    //
    // Cayendo a `{}` la validacion de campos que ya existe debajo hace su
    // trabajo y devuelve un 400 con el motivo. Medido: paso de verdad al
    // registrar un desembolso.
    const body = await request.json().catch(() => ({}))
    const monto = Number(body?.monto)
    const nota  = body?.nota?.trim() || null

    if (!monto || monto <= 0 || !Number.isFinite(monto)) {
      return Response.json(
        { error: 'El monto debe ser un número positivo' },
        { status: 400 }
      )
    }

    // ── Cargar la linea con relaciones necesarias ───────────────────────────
    const linea = await prisma.lineaCredito.findFirst({
      where: { id: lineaId, organizationId },
      include: {
        desembolsos: { select: { monto: true, createdAt: true } },
        pagosLinea:  { select: { montoACapital: true, montoAInteres: true, createdAt: true } },
        /* El nombre va en el asiento del libro: «Desembolso de línea» a secas
           obliga a abrir la línea para saber a quién se le dio la plata, y el
           libro se lee para cuadrar la caja, no para investigar. */
        /* `rutaId` además del nombre: todo movimiento de capital que pertenece
           a una ruta tiene que bajar a SU sub-bolsa, o el capital por ruta deja
           de cuadrar aunque el global cuadre. Hay una prueba que lo vigila. */
        cliente:     { select: { nombre: true, rutaId: true } },
      },
    })

    if (!linea) {
      return Response.json({ error: 'Linea de credito no encontrada' }, { status: 404 })
    }

    // ── Validar reglas de negocio ───────────────────────────────────────────
    const { puede, razon } = puedeDesembolsar(linea, monto)
    if (!puede) {
      return Response.json({ error: razon }, { status: 400 })
    }

    /* ══ EL DESEMBOLSO SALE DE LA CAJA ═══════════════════════════════════════
     *
     * Y hasta hoy no salía. Medido en producción el 18 ago 2026: seis
     * desembolsos de línea por $1.994.443 y **ni un solo asiento en el libro de
     * capital**. Un negocio —EOFinancial Corp— tenía $1.594.443 prestados por
     * esta vía con la caja diciendo $3.870.043 sin descontarlos: el 41% de lo
     * que creía tener no estaba.
     *
     * Es plata que sale al cliente igual que un desembolso de préstamo, así que
     * se asienta igual: mismo `tipo`, misma transacción. Las dos cosas van
     * juntas o no van — un desembolso guardado sin su asiento es exactamente el
     * descuadre que se viene a arreglar.
     *
     * ⚠ `permitirNegativo: true` a propósito. Aquí NO se frena a nadie: la línea
     * ya tiene su propio freno —`puedeDesembolsar`, que mira el cupo— y quien
     * presta con la caja en rojo tiene un problema de capital que no se arregla
     * bloqueándole el cobro. Ver la guarda de `registrarMovimientoManualCapital`.
     */
    const desembolso = await prisma.$transaction(async (tx) => {
      const creado = await tx.desembolsoLinea.create({
        data: {
          lineaCreditoId:  lineaId,
          organizationId,
          monto,
          nota,
          registradoPorId: userId,
        },
      })

      await registrarMovimientoCapital(tx, {
        organizationId,
        tipo: 'desembolso',
        monto,
        descripcion: `Desembolso de línea de crédito${linea.cliente?.nombre ? ` a ${linea.cliente.nombre}` : ''}`,
        referenciaId: creado.id,
        referenciaTipo: 'linea_desembolso',
        creadoPorId: userId,
        rutaId: linea.cliente?.rutaId ?? null,
        permitirNegativo: true,
      })

      return creado
    })

    return Response.json({ success: true, data: desembolso }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/lineas-credito/[id]/desembolso]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
