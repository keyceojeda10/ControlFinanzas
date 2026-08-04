// app/api/rutas/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { registrarMovimientoCapital } from '@/lib/capital'
import { LIMITES_RUTAS, PLANES_CONFIG } from '@/lib/planes'
import { getUtcOffset } from '@/lib/i18n'
import { tienePeriodoEsperadoHoy, calcularDiasMora, calcularProximoCobro, calcularMontoParaPonerseAlDia } from '@/lib/calculos'
import { obtenerDiasSinCobro, esHoySinCobro, esHoyFestivo } from '@/lib/dias-sin-cobro'

const hoy = (country = 'co') => {
  const now = new Date()
  const absOffset = Math.abs(getUtcOffset(country))
  const col = new Date(now.getTime() - absOffset * 60 * 60 * 1000)
  const y = col.getUTCFullYear(), m = col.getUTCMonth(), d = col.getUTCDate()
  return new Date(Date.UTC(y, m, d, absOffset, 0, 0, 0))
}
const manana = (country = 'co') => new Date(hoy(country).getTime() + 24 * 60 * 60 * 1000)

// ─── GET /api/rutas ─────────────────────────────────────────────
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id: userId, organizationId, rol } = session.user

  // Cobrador: todas las rutas donde es el cobrador asignado
  const where = rol === 'cobrador'
    ? { organizationId, cobradorId: userId, activo: true }
    : { organizationId, activo: true }

  const rutas = await prisma.ruta.findMany({
    where,
    include: {
      cobrador: { select: { id: true, nombre: true, email: true } },
      // diasSinCobro de la ruta para resolver herencia cliente -> ruta -> org.
      // No es necesario el campo activo aqui porque ya esta en el where.
      clientes: {
        select: {
          id:        true,
          nombre:    true,
          estado:    true,
          diasSinCobro: true,
          prestamos: {
            // Se traen TODOS (incluido clavo): el cobro de hoy de un clavo SÍ suma al
            // recaudado de la ruta (dinero real). Solo el esperado excluye el clavo abajo.
            select:  {
              estado: true,
              esClavo: true,
              montoPrestado: true,
              totalAPagar: true,
              // ── PARA LA CARTERA DE LA TARJETA (T04-01) ──
              // La lámina pone cuatro cifras por ruta: hoy, cobros, CARTERA y
              // ATRASO. La cartera es `totalAPagar − totalPagado`, y `pagos`
              // aquí viene filtrado SOLO A HOY —para el recaudado del día—, así
              // que no sirve para el acumulado. Es una columna de la misma
              // fila, ya calculada por el sistema.
              totalPagado: true,
              cuotaDiaria: true,
              frecuencia: true,
              fechaInicio: true,
              diasPlazo: true,
              diaCobroSemana: true,
              diaCobroMes: true,
              diaCobroMes2: true,
              pagos: {
                where:  { fechaPago: { gte: hoy(), lt: manana() } },
                select: { montoPagado: true, tipo: true },
              },
            },
          },
        },
      },
    },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
  })

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { diasSinCobro: true },
  })

  const festivos = await prisma.festivo.findMany({
    where: { organizationId },
    select: { fecha: true },
  })

  // Mismo permiso que el detalle de ruta: un cobrador no debe ver el capital.
  const puedeVerCapital = rol === 'owner' || session.user.permisos?.verCapitalRuta

  const resultado = rutas.map((r) => {
    let esperadoHoy    = 0
    let recaudadoHoy   = 0
    let capitalTotal   = 0  // prestado SIN intereses
    let totalAPagarRuta = 0 // prestado CON intereses
    // Lo que pide T27-01 y no habia: «Pepito · 1 de 5 cobros», la pastilla de
    // atrasados, y el «proximo jue 30» de una ruta sin cobros hoy.
    //
    // Se cuenta por CLIENTE, no por prestamo: un cliente con tres prestamos que
    // vencen hoy es UNA visita, y «3 de 5 cobros» diciendo tres visitas cuando
    // es una manda al cobrador con la cuenta mal.
    let cobrosHoy    = 0
    let cobradosHoy  = 0
    let atrasados    = 0
    let enMora       = 0
    // ── LAS DOS CIFRAS DE LA TARJETA (T04-01) ──
    // «Cada ruta trae lo que decide a cuál entrar: plata de hoy, cobros hechos,
    // CARTERA y ATRASO acumulado», dice el pie de la lámina.
    let carteraRuta  = 0
    let atrasoRuta   = 0
    let proximoCobro = null

    for (const cliente of r.clientes) {
      const diasExcluidos = obtenerDiasSinCobro(cliente, r, org)
      const hoySinCobro = esHoySinCobro(diasExcluidos) || esHoyFestivo(festivos)

      let tocaHoy = false
      let pagoHoyCliente = false
      let moraCliente = 0

      for (const prestamo of cliente.prestamos) {
        // Meta: solo cuotas que TOCABA cobrar hoy (segun ciclo de frecuencia
        // y dia ancla). Antes sumaba todas las cuotas activas y inflaba la cifra.
        if (prestamo.estado === 'activo' && !prestamo.esClavo && tienePeriodoEsperadoHoy(prestamo, hoySinCobro, diasExcluidos, festivos)) {
          esperadoHoy += prestamo.cuotaDiaria
          tocaHoy = true
        }
        // Recaudado hoy: incluye pagos de prestamos completados hoy (el pago final cierra)
        const cobradoDeEste = prestamo.pagos.filter(p => !['recargo', 'descuento'].includes(p.tipo)).reduce((a, p) => a + p.montoPagado, 0)
        recaudadoHoy += cobradoDeEste
        if (cobradoDeEste > 0) pagoHoyCliente = true

        if (prestamo.estado === 'activo' && !prestamo.esClavo) {
          moraCliente = Math.max(moraCliente, calcularDiasMora(prestamo, diasExcluidos, festivos))
          // El proximo cobro de la RUTA es el mas cercano de sus prestamos: es
          // cuando el cobrador tiene que volver a pasar por aca.
          const prox = calcularProximoCobro(prestamo, diasExcluidos, festivos)
          if (prox && (!proximoCobro || new Date(prox) < new Date(proximoCobro))) proximoCobro = prox
        }

        // Capital en la calle. MISMA regla que el detalle de ruta (solo activos,
        // sin clavos) para que las dos pantallas muestren el mismo numero: en
        // una app de plata, dos cifras distintas para lo mismo rompen la confianza.
        if (prestamo.estado === 'activo' && !prestamo.esClavo) {
          capitalTotal    += prestamo.montoPrestado ?? 0
          totalAPagarRuta += prestamo.totalAPagar ?? prestamo.montoPrestado ?? 0
          // Cartera = lo que falta por cobrar de este préstamo. NO es el
          // capital: incluye el interés que todavía no ha entrado.
          carteraRuta += Math.max(0, (prestamo.totalAPagar ?? 0) - (prestamo.totalPagado ?? 0))
          // Atraso: lo que le falta para ponerse al día. Se reutiliza la función
          // del sistema en vez de escribir la resta aquí — es la misma cifra que
          // enseñan la ficha del cliente y el detalle de la ruta, y dos fórmulas
          // para lo mismo acaban discrepando.
          atrasoRuta += calcularMontoParaPonerseAlDia(prestamo, diasExcluidos, festivos)
        }
      }

      if (tocaHoy) cobrosHoy += 1
      if (tocaHoy && pagoHoyCliente) cobradosHoy += 1
      // Dos umbrales, el mismo del resto del sistema: por encima de 7 dias ya es
      // mora, por debajo es atraso. La pastilla dice uno o el otro, no los dos.
      if (moraCliente > 7) enMora += 1
      else if (moraCliente > 0) atrasados += 1
    }

    return {
      id:              r.id,
      nombre:          r.nombre,
      cobrador:        r.cobrador,
      cantidadClientes: r.clientes.length,
      esperadoHoy:     Math.round(esperadoHoy),
      recaudadoHoy:    Math.round(recaudadoHoy),
      cobrosHoy,
      cobradosHoy,
      atrasados,
      enMora,
      carteraRuta: Math.round(carteraRuta),
      atrasoRuta:  Math.round(atrasoRuta),
      // ISO: la fecha se formatea en el CLIENTE. Hecho aca saldria en la zona del
      // servidor, que en produccion es UTC, y «proximo jue 30» se equivocaria de
      // dia en las cinco primeras horas de cada dia colombiano.
      proximoCobro,
      ...(puedeVerCapital ? {
        capitalTotal:    Math.round(capitalTotal),
        totalAPagarRuta: Math.round(totalAPagarRuta),
      } : {}),
    }
  })

  return Response.json(resultado)
}

// ─── POST /api/rutas ────────────────────────────────────────────
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede crear rutas' }, { status: 403 })
  }

  const { organizationId, plan } = session.user
  const { nombre, cobradorId, capitalInicial, origenCapital } = await request.json()

  if (!nombre?.trim()) return Response.json({ error: 'El nombre es requerido' }, { status: 400 })
  const capitalInicialNum = Number(capitalInicial) || 0
  // Origen del capital de la ruta:
  // - 'existente': se mueve del capital que la org YA tiene (NO sube el total, solo se
  //   asigna a la sub-bolsa de la ruta). Requiere saldo suficiente.
  // - 'nuevo' (default): inyección nueva, sube el capital total de la org y lo asigna a la ruta.
  const mueveDelExistente = origenCapital === 'existente'

  // Verificar límite de rutas del plan
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { rutasExtra: true },
  })
  const limiteBase = LIMITES_RUTAS[plan] ?? 1
  const limite = limiteBase + (org?.rutasExtra ?? 0)
  const totalRutas = await prisma.ruta.count({ where: { organizationId, activo: true } })
  if (totalRutas >= limite) {
    const puedeComprar = PLANES_CONFIG[plan]?.rutaExtra > 0
    return Response.json(
      { error: `Has alcanzado el límite de ${limite} ruta${limite > 1 ? 's' : ''} de tu plan ${PLANES_CONFIG[plan]?.nombre || plan}. ${puedeComprar ? 'Puedes comprar una ruta adicional.' : 'Actualiza tu plan para más rutas.'}`, limitReached: true, plan },
      { status: 403 }
    )
  }

  // Verificar cobrador si se envía
  if (cobradorId) {
    const cobrador = await prisma.user.findFirst({
      where: { id: cobradorId, organizationId, rol: 'cobrador' },
    })
    if (!cobrador) return Response.json({ error: 'Cobrador no válido' }, { status: 400 })
  }

  // Si se mueve del capital existente, validar que la org tenga saldo suficiente.
  if (capitalInicialNum > 0 && mueveDelExistente) {
    const cap = await prisma.capital.findUnique({
      where: { organizationId },
      select: { saldo: true },
    })
    if ((cap?.saldo ?? 0) < capitalInicialNum) {
      return Response.json(
        { error: `El capital disponible de la organización ($${Math.round(cap?.saldo ?? 0).toLocaleString('es-CO')}) no alcanza para asignar $${capitalInicialNum.toLocaleString('es-CO')} a la ruta.` },
        { status: 400 }
      )
    }
  }

  const ruta = await prisma.ruta.create({
    data: {
      organizationId,
      nombre:    nombre.trim(),
      cobradorId: cobradorId || null,
      capitalHabilitado: capitalInicialNum > 0,
    },
  })

  // Capital propio de la ruta al crearla (opcional). Si no se asigna, la ruta
  // queda en modo global (saldoCapital 0, capitalHabilitado false) como hasta ahora.
  if (capitalInicialNum > 0) {
    await prisma.$transaction(async (tx) => {
      await registrarMovimientoCapital(tx, {
        organizationId,
        tipo: 'inyeccion',
        monto: capitalInicialNum,
        descripcion: mueveDelExistente
          ? `Asignación de capital existente a la ruta ${ruta.nombre}`
          : `Capital inicial de la ruta ${ruta.nombre}`,
        rutaId: ruta.id,
        // Si mueve del existente: NO sube el total de la org (solo asigna a la sub-bolsa).
        ajusteArranqueRuta: mueveDelExistente,
        creadoPorId: session.user.id,
      })
    })
  }

  logActividad({ session, accion: 'crear_ruta', entidadTipo: 'ruta', entidadId: ruta.id, detalle: `Ruta "${ruta.nombre}" creada${capitalInicialNum > 0 ? ` con capital $${capitalInicialNum.toLocaleString('es-CO')}` : ''}`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
  return Response.json(ruta, { status: 201 })
}
