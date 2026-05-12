// lib/asistente.js — Constructor de contexto y helpers para el asistente Lucas
import { prisma } from '@/lib/prisma'
import { calcularDiasMora, calcularSaldoPendiente } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { getCachedContexto, setCachedContexto } from '@/lib/asistente-cache'

// ─── HELPERS ────────────────────────────────────────────────

function getColombiaDate() {
  return new Date(Date.now() - 5 * 60 * 60 * 1000)
}

// ─── BUILD CONTEXTO ─────────────────────────────────────────

export async function buildContexto(orgId) {
  const cached = getCachedContexto(orgId)
  if (cached) return cached

  const hoy = getColombiaDate()
  const y = hoy.getUTCFullYear()
  const m = hoy.getUTCMonth()
  const d = hoy.getUTCDate()

  const inicioDiaUTC  = new Date(Date.UTC(y, m, d, 5, 0, 0))
  const finDiaUTC     = new Date(Date.UTC(y, m, d + 1, 4, 59, 59))
  const inicioMes     = new Date(Date.UTC(y, m, 1, 5, 0, 0))
  const finMes        = new Date(Date.UTC(y, m + 1, 1, 4, 59, 59))
  const inicio7DiasUTC = new Date(Date.UTC(y, m, d - 6, 5, 0, 0))

  const [
    org,
    prestamosActivos,
    pagosHoy,
    pagosMes,
    cobradores,
    capitalRow,
    gastosMesAgg,
    pagos7d,
    clientesSinRuta,
    prestamosSinPagos,
    moraUrgente,
    cierresCaja,
    gastosDetalle,
    suscripcion,
    pagosCompletadosAgg,
    prestamosCompletadosAgg,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { nombre: true, plan: true, ciudad: true, diasSinCobro: true },
    }),

    prisma.prestamo.findMany({
      where: {
        organizationId: orgId,
        estado: 'activo',
        cliente: { estado: { notIn: ['eliminado', 'inactivo'] } },
      },
      select: {
        clienteId: true,
        montoPrestado: true,
        totalAPagar: true,
        cuotaDiaria: true,
        fechaInicio: true,
        diasPlazo: true,
        frecuencia: true,
        pagos: { select: { montoPagado: true, tipo: true } },
        cliente: {
          select: {
            id: true,
            diasSinCobro: true,
            ruta: { select: { diasSinCobro: true } },
          },
        },
      },
    }),

    prisma.pago.aggregate({
      where: {
        organizationId: orgId,
        fechaPago: { gte: inicioDiaUTC, lte: finDiaUTC },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      _sum: { montoPagado: true },
      _count: true,
    }),

    prisma.pago.aggregate({
      where: {
        organizationId: orgId,
        fechaPago: { gte: inicioMes, lte: finMes },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      _sum: { montoPagado: true },
      _count: true,
    }),

    prisma.user.findMany({
      where: { organizationId: orgId, rol: 'cobrador' },
      select: {
        id: true,
        nombre: true,
        rutas: { select: { id: true, nombre: true, clientes: { select: { id: true } } } },
      },
    }),

    prisma.capital.findFirst({
      where: { organizationId: orgId },
      select: { saldo: true },
    }),

    prisma.gastoMenor.aggregate({
      where: {
        organizationId: orgId,
        fecha: { gte: inicioMes, lte: finMes },
      },
      _sum: { monto: true },
    }),

    // Pagos 7 dias para tendencia
    prisma.pago.findMany({
      where: {
        organizationId: orgId,
        fechaPago: { gte: inicio7DiasUTC, lte: finDiaUTC },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      select: { montoPagado: true, fechaPago: true },
    }),

    prisma.cliente.count({
      where: {
        organizationId: orgId,
        rutaId: null,
        estado: { notIn: ['eliminado', 'inactivo'] },
        prestamos: { some: { estado: 'activo' } },
      },
    }),

    prisma.prestamo.count({
      where: {
        organizationId: orgId,
        estado: 'activo',
        cliente: { estado: { notIn: ['eliminado', 'inactivo'] } },
        OR: [
          { pagos: { none: {} } },
          { pagos: { every: { fechaPago: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } } },
        ],
      },
    }),

    // Top mora urgente — todos los activos, el filtro real es en memoria con calcularDiasMora
    prisma.prestamo.findMany({
      where: {
        organizationId: orgId,
        estado: 'activo',
        cliente: { estado: { notIn: ['eliminado', 'inactivo'] } },
      },
      select: {
        estado: true,
        totalAPagar: true,
        diasPlazo: true,
        fechaInicio: true,
        frecuencia: true,
        cuotaDiaria: true,
        pagos: { select: { montoPagado: true, tipo: true, fechaPago: true } },
        cliente: {
          select: {
            nombre: true,
            notas: true,
            diasSinCobro: true,
            ruta: {
              select: {
                nombre: true,
                diasSinCobro: true,
                cobrador: { select: { nombre: true } },
              },
            },
          },
        },
      },
      orderBy: { fechaInicio: 'asc' },
    }),

    // Cierres de caja últimos 7 días
    prisma.cierreCaja.findMany({
      where: { organizationId: orgId, fecha: { gte: inicio7DiasUTC } },
      select: {
        fecha: true,
        totalEsperado: true,
        totalRecogido: true,
        diferencia: true,
        cobrador: { select: { nombre: true } },
      },
      orderBy: { fecha: 'desc' },
      take: 14,
    }).catch(() => []),

    // Gastos del mes desglosados
    prisma.gastoMenor.findMany({
      where: {
        organizationId: orgId,
        fecha: { gte: inicioMes, lte: finMes },
        estado: 'aprobado',
      },
      select: { description: true, monto: true },
      orderBy: { monto: 'desc' },
      take: 10,
    }).catch(() => []),

    prisma.suscripcion.findFirst({
      where: {
        organizationId: orgId,
        OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }],
      },
      select: { plan: true, estado: true, fechaVencimiento: true },
      orderBy: { fechaVencimiento: 'desc' },
    }).catch(() => null),

    // Intereses históricos de préstamos ya completados
    prisma.pago.aggregate({
      where: {
        organizationId: orgId,
        tipo: { notIn: ['recargo', 'descuento'] },
        prestamo: { estado: 'completado' },
      },
      _sum: { montoPagado: true },
    }).catch(() => ({ _sum: { montoPagado: 0 } })),

    prisma.prestamo.aggregate({
      where: { organizationId: orgId, estado: 'completado' },
      _sum: { montoPrestado: true },
    }).catch(() => ({ _sum: { montoPrestado: 0 } })),
  ])

  // ─── CALCULOS ────────────────────────────────────────────

  const clientesActivosSet = new Set()
  const clientesMoraSet = new Set()
  let carteraActiva = 0
  let saldoPorCobrar = 0
  let cuotaDiariaTotal = 0

  let interesesYaCobrados = 0
  let interesesPorCobrar = 0

  for (const p of prestamosActivos) {
    clientesActivosSet.add(p.clienteId)
    carteraActiva += p.totalAPagar ?? 0
    saldoPorCobrar += calcularSaldoPendiente(p)
    cuotaDiariaTotal += p.cuotaDiaria ?? 0
    const diasExcluidos = obtenerDiasSinCobro(p.cliente, p.cliente?.ruta, org)
    if (calcularDiasMora(p, diasExcluidos) > 0) clientesMoraSet.add(p.clienteId)

    const totalPagadoReal = (p.pagos ?? [])
      .filter(pago => !['recargo', 'descuento'].includes(pago.tipo))
      .reduce((acc, pago) => acc + (pago.montoPagado ?? 0), 0)

    const interesTotal = Math.max(0, (p.totalAPagar ?? 0) - (p.montoPrestado ?? 0))
    const interesYaCobrado = Math.max(0, totalPagadoReal - (p.montoPrestado ?? 0))
    const interesPendiente = Math.max(0, interesTotal - interesYaCobrado)

    interesesYaCobrados += interesYaCobrado
    interesesPorCobrar += interesPendiente
  }

  // Mora urgente: top 5 con mas dias mora
  const moraUrgenteLista = moraUrgente
    .map(p => {
      const diasExcluidos = obtenerDiasSinCobro(p.cliente, p.cliente?.ruta, org)
      const dias = calcularDiasMora(p, diasExcluidos)
      const saldo = calcularSaldoPendiente(p)
      const cobradorNombre = p.cliente?.ruta?.cobrador?.nombre || null
      const rutaNombre = p.cliente?.ruta?.nombre || null
      const notas = p.cliente?.notas || null
      return { nombre: p.cliente?.nombre ?? 'Cliente', diasMora: dias, saldo, cobradorNombre, rutaNombre, notas }
    })
    .filter(x => x.diasMora > 0)
    .sort((a, b) => b.diasMora - a.diasMora)
    .slice(0, 5)

  // Sparkline 7 dias
  const sparkline7d = Array(7).fill(0)
  for (const p of pagos7d) {
    const fechaCO = new Date(new Date(p.fechaPago).getTime() - 5 * 60 * 60 * 1000)
    const diaCO = Date.UTC(fechaCO.getUTCFullYear(), fechaCO.getUTCMonth(), fechaCO.getUTCDate())
    const hoyCO = Date.UTC(y, m, d)
    const diasAtras = Math.floor((hoyCO - diaCO) / (24 * 60 * 60 * 1000))
    if (diasAtras >= 0 && diasAtras < 7) sparkline7d[6 - diasAtras] += p.montoPagado
  }

  // Cobrador efficiency
  const cobradorData = cobradores.map(c => {
    const clientesCount = c.rutas.reduce((acc, r) => acc + r.clientes.length, 0)
    const rutaNombres = c.rutas.map(r => r.nombre).join(', ') || 'Sin ruta'
    return { nombre: c.nombre, ruta: rutaNombres, clientesCount }
  })

  const interesesHistoricos = Math.max(0,
    (pagosCompletadosAgg._sum?.montoPagado ?? 0) - (prestamosCompletadosAgg._sum?.montoPrestado ?? 0)
  )

  const diasRestantesSus = suscripcion?.fechaVencimiento
    ? Math.max(0, Math.ceil((new Date(suscripcion.fechaVencimiento) - Date.now()) / 86400000))
    : null

  const ctx = {
    org: { nombre: org?.nombre ?? 'Tu negocio', plan: org?.plan, ciudad: org?.ciudad },
    suscripcion: { diasRestantes: diasRestantesSus, estado: suscripcion?.estado ?? null },
    kpis: {
      clientesActivos: clientesActivosSet.size,
      clientesMora: clientesMoraSet.size,
      pctMora: clientesActivosSet.size > 0
        ? Math.round((clientesMoraSet.size / clientesActivosSet.size) * 100)
        : 0,
      carteraActiva,
      saldoPorCobrar,
      capitalDisponible: capitalRow?.saldo ?? 0,
      cobroHoy: pagosHoy._sum?.montoPagado ?? 0,
      cobrosHoyCount: pagosHoy._count ?? 0,
      cobroMes: pagosMes._sum?.montoPagado ?? 0,
      cuotaDiariaEsperada: cuotaDiariaTotal,
      gastosMes: gastosMesAgg?._sum?.monto ?? 0,
    },
    cobradores: cobradorData,
    moraUrgente: moraUrgenteLista,
    alertas: { clientesSinRuta, prestamosSinPagos },
    tendencia7d: sparkline7d,
    ganancias: {
      interesesYaCobrados,
      interesesPorCobrar,
      gananciaTotal: interesesYaCobrados + interesesPorCobrar,
      interesesHistoricosRealizados: interesesHistoricos,
      gananciaTotalAcumulada: interesesYaCobrados + interesesPorCobrar + interesesHistoricos,
    },
    cierresCaja: cierresCaja ?? [],
    gastosDetalle: gastosDetalle ?? [],
  }

  setCachedContexto(orgId, ctx)
  return ctx
}

// ─── SYSTEM PROMPT ──────────────────────────────────────────

export function buildSystemPrompt(ctx) {
  const { org, kpis, cobradores, moraUrgente, alertas, tendencia7d, ganancias, cierresCaja, gastosDetalle, suscripcion, memorias } = ctx
  const fmt = (n) => `$${Math.round(n || 0).toLocaleString('es-CO')}`

  const tendenciaTexto = tendencia7d.map((v, i) => {
    const dias = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Hoy']
    return `${dias[i] || `D${i + 1}`}: ${fmt(v)}`
  }).join(', ')

  const mora = moraUrgente.length > 0
    ? moraUrgente.map(m => {
        let linea = `  - ${m.nombre}: ${m.diasMora} dias mora, debe ${fmt(m.saldo)}`
        if (m.rutaNombre) linea += ` | Ruta: ${m.rutaNombre}`
        if (m.cobradorNombre) linea += ` | Cobrador: ${m.cobradorNombre}`
        if (m.notas) linea += ` | Nota: "${m.notas.slice(0, 80)}"`
        return linea
      }).join('\n')
    : '  (Ninguno urgente)'

  const cobradoresTexto = cobradores.length > 0
    ? cobradores.map(c => `  - ${c.nombre} (${c.ruta}): ${c.clientesCount} clientes`).join('\n')
    : '  (Sin cobradores registrados)'

  const alertasTexto = []
  if (alertas.clientesSinRuta > 0) alertasTexto.push(`${alertas.clientesSinRuta} clientes activos sin ruta asignada`)
  if (alertas.prestamosSinPagos > 0) alertasTexto.push(`${alertas.prestamosSinPagos} prestamos sin pagos hace +7 dias`)

  const cierresConDiscrepancia = (cierresCaja ?? []).filter(c => Math.abs(c.diferencia ?? 0) > 0)
  const cierresTexto = cierresConDiscrepancia.length > 0
    ? `\nCIERRES CON DIFERENCIA (últimos 7 días):\n` +
      cierresConDiscrepancia.slice(0, 5).map(c => {
        const fecha = new Date(c.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' })
        const tipo = (c.diferencia ?? 0) > 0 ? 'sobrante' : 'faltante'
        return `  - ${c.cobrador?.nombre || 'Cobrador'} el ${fecha}: ${tipo} de ${fmt(Math.abs(c.diferencia ?? 0))}`
      }).join('\n')
    : ''

  const gastosTexto = (gastosDetalle ?? []).length > 0
    ? `\nGASTOS DEL MES (top aprobados):\n` +
      gastosDetalle.slice(0, 5).map(g => `  - ${g.description}: ${fmt(g.monto)}`).join('\n')
    : ''

  return `Eres Lucas, el asistente financiero de ${org.nombre} en Control Finanzas.
Eres un asesor de negocios de confianza para prestamistas informales en Colombia.

DATOS DE HOY (hora Colombia):
Fecha actual: ${new Date(Date.now() - 5*60*60*1000).toISOString().split('T')[0]} (YYYY-MM-DD) — usa ESTA fecha cuando necesites fechaInicio en préstamos
Ciudad: ${org.ciudad || 'Colombia'} | Plan: ${org.plan}
Suscripción: ${suscripcion?.diasRestantes !== null && suscripcion?.diasRestantes !== undefined ? `${suscripcion.diasRestantes} días restantes` : 'sin datos'}

CARTERA:
- Clientes activos: ${kpis.clientesActivos} | En mora: ${kpis.clientesMora} (${kpis.pctMora}%)
- Cartera total: ${fmt(kpis.carteraActiva)} | Saldo por cobrar: ${fmt(kpis.saldoPorCobrar)}
- Capital en caja: ${fmt(kpis.capitalDisponible)}

COBROS:
- Hoy: ${fmt(kpis.cobroHoy)} (${kpis.cobrosHoyCount} cobros) | Meta diaria esperada: ${fmt(kpis.cuotaDiariaEsperada)}
- Este mes: ${fmt(kpis.cobroMes)} | Gastos del mes: ${fmt(kpis.gastosMes)}
- Tendencia 7 dias: ${tendenciaTexto}

GANANCIAS (intereses = lo que ganas sobre el capital prestado):
Cartera activa:
  - Intereses ya cobrados: ${fmt(ganancias.interesesYaCobrados)}
  - Intereses por cobrar (si todos pagan): ${fmt(ganancias.interesesPorCobrar)}
  - Total esperado cartera activa: ${fmt(ganancias.gananciaTotal)}
Histórico (préstamos completados/pagados):
  - Intereses realizados en préstamos ya terminados: ${fmt(ganancias.interesesHistoricosRealizados)}
TOTAL ACUMULADO REAL (histórico + activo cobrado): ${fmt(ganancias.interesesHistoricosRealizados + ganancias.interesesYaCobrados)}
TOTAL ACUMULADO PROYECTADO (histórico + todo activo): ${fmt(ganancias.gananciaTotalAcumulada)}

COBRADORES:
${cobradoresTexto}

MORA URGENTE (top 5):
${mora}

${alertasTexto.length > 0 ? `ALERTAS:\n${alertasTexto.map(a => `  - ${a}`).join('\n')}` : ''}${cierresTexto}${gastosTexto}

${memorias?.length > 0 ? `MEMORIA DE SESIONES ANTERIORES:\n${memorias.map(m => `  - ${m.contenido}`).join('\n')}\nUsa esta información para personalizar tus respuestas sin mencionarla explícitamente a menos que sea relevante.\n\n` : ''}REGLAS:
- Responde SIEMPRE en espanol informal colombiano, como un asesor de confianza
- Se directo y practico. Usa cifras reales del contexto cuando respondas
- Maximo 3 parrafos por respuesta (usuarios en celular)
- No inventes datos que no esten en este contexto
- Si te preguntan algo fuera del negocio, redirige amablemente
- Los datos tienen hasta 5 minutos de retraso vs la BD en vivo
- Para recomendaciones, basa tu analisis en los numeros reales mostrados arriba
- Cuando pregunten "cuanto estoy ganando?" o "cuanto gano?" da TODOS los numeros: histórico realizado, activo cobrado, activo por cobrar, total acumulado real, y total proyectado si todos pagan

CAPACIDADES DE ACCIÓN (solo para owners):
Puedes realizar estas acciones con confirmación del usuario:
registrar pagos · crear clientes · crear préstamos · crear rutas · asignar clientes a rutas · ajustar capital · editar préstamos · conectar con soporte

REGLAS GENERALES PARA ACCIONES:
- NUNCA ejecutes una herramienta si te faltan datos obligatorios — pregunta primero, en una sola pregunta con todas las variables pendientes
- Cuando ejecutas una herramienta NO escribas texto adicional — la tarjeta de confirmación lo muestra
- Si el usuario dice "no", "cancelar" o "dejalo así" — responde solo con texto, sin herramientas
- Para soporte, bugs o renovar plan: usa escalate_support de inmediato
- Después de completar una acción, SIEMPRE ofrece el siguiente paso lógico (ver ejemplos abajo)

SOBRE EL RESULTADO DEL LOOKUP:
- El lookup retorna datos internos en formato [id:...|pid:...] — esos IDs son SOLO para tu uso interno al llamar herramientas. NUNCA los menciones al usuario.
- Al mostrar el resultado del lookup, usa SOLO: nombre y cédula. Ejemplo: "Encontré a Steven Olmos (cédula: 1234567). ¿Confirmamos?"
- Si hay varios resultados, preséntaselos numerados por nombre y cédula y pregunta cuál es.

═══════════════════════════════════════════
FLUJO: REGISTRAR PAGO
═══════════════════════════════════════════
1. Usa lookup_client para encontrar al cliente
2. Muestra al usuario: "Encontré a [Nombre] (cédula: [X]), cuota de $[Y], saldo $[Z]. ¿Es este?"
3. Si confirma → DECIDE EL MONTO:
   - Sin monto especificado → cuota exacta del lookup
   - "Pagó $X" → usa ese monto
   - Si el cliente está en mora → "Tiene [N] días en mora. ¿Registro la cuota normal ($[cuota]) o el saldo completo ($[saldo])?"
4. Método: si no lo dijo → usa efectivo por defecto (no preguntes si hay mora u otra pregunta pendiente)
5. Ejecuta register_payment
6. Después: "¡Listo! En la tarjeta hay botón para enviarle el comprobante por WhatsApp. ¿Otro cobro?"

═══════════════════════════════════════════
FLUJO: CREAR CLIENTE
═══════════════════════════════════════════
1. Necesitas: nombre completo, cédula, teléfono. Si falta alguno, pídelos todos en un solo mensaje.
2. Pregunta si tiene dirección (opcional) y si ya tienes rutas disponibles, pregunta si asignarlo a una ruta.
3. Ejecuta create_client
4. Después: "Cliente creado. ¿Le creo un préstamo ahora?" — si dice sí, inicia el flujo de préstamo directamente.

═══════════════════════════════════════════
FLUJO: CREAR PRÉSTAMO
═══════════════════════════════════════════
1. Usa lookup_client para confirmar que el cliente existe y obtener su ID
2. Necesitas: monto, tasa de interés (%), plazo en días, frecuencia (diario/semanal/quincenal/mensual)
   - Si el usuario no sabe la tasa, sugiérele la que más usa en su negocio según el contexto
   - Frecuencia default: diario si no especifica
   - Fecha inicio: hoy si no especifica
3. Ejecuta create_loan
4. Después: "¡Préstamo creado! ¿Quieres asignar a [cliente] a una ruta de cobro ahora?"

═══════════════════════════════════════════
FLUJO: CREAR RUTA
═══════════════════════════════════════════
1. Pide el nombre de la ruta
2. Si hay cobradores disponibles (los ves en COBRADORES arriba), pregunta cuál asignar
3. Ejecuta create_route
4. Después: "Ruta creada. ¿Quieres asignarle clientes ahora?"

═══════════════════════════════════════════
FLUJO: ASIGNAR CLIENTES A RUTA
═══════════════════════════════════════════
1. Pregunta qué clientes y a qué ruta (por nombre)
2. Usa lookup_client para obtener los IDs de cada cliente mencionado
3. Las rutas disponibles las conoces del campo COBRADORES (cada cobrador tiene su ruta)
4. Ejecuta assign_clients_to_route con forzar: true si el cliente ya está en otra ruta
5. Después: "Clientes asignados. ¿Quieres ajustar algo más de la ruta?"

═══════════════════════════════════════════
FLUJO: AJUSTAR CAPITAL
═══════════════════════════════════════════
1. Entiende si es inyección (entra dinero) o retiro (sale dinero)
2. Pide monto y descripción breve
3. Ejecuta adjust_capital
4. Informa el nuevo saldo disponible si lo retorna la API

═══════════════════════════════════════════
FLUJO: EDITAR PRÉSTAMO
═══════════════════════════════════════════
1. Usa lookup_client para encontrar al cliente y su prestamoId
2. Pregunta qué quiere cambiar: plazo (extender), fecha de vencimiento, día de cobro
3. Ejecuta edit_loan con el modo correcto`
}

// ─── DETECCION DE COMPLEJIDAD ────────────────────────────────

export function detectQueryComplexity(message) {
  const simplePattern = /cuánto|cuanto|cuál|cual|quién|quien|hoy|ayer|esta semana|total|saldo|cuántos|cuantos|cuántas|cuantas|recaudé|recaude|debo|debe|clientes/i
  return simplePattern.test(message) ? 'simple' : 'analysis'
}

// ─── Cobrador context ────────────────────────────────────────────────

export async function buildContextoCobrador(orgId, rutaIds, userId) {
  if (!rutaIds || rutaIds.length === 0) {
    return { rutas: [], clientesActivos: 0, clientesMora: 0, cobroHoy: 0, moraUrgente: [] }
  }

  const hoy = new Date(Date.now() - 5 * 60 * 60 * 1000) // Colombia TZ
  const y = hoy.getUTCFullYear(), m = hoy.getUTCMonth(), d = hoy.getUTCDate()
  const inicioDiaUTC = new Date(Date.UTC(y, m, d, 5, 0, 0))
  const finDiaUTC    = new Date(Date.UTC(y, m, d + 1, 4, 59, 59))

  const [rutas, clientes, pagosHoy] = await Promise.all([
    prisma.ruta.findMany({
      where: { id: { in: rutaIds }, organizationId: orgId },
      select: { id: true, nombre: true },
    }),

    prisma.cliente.findMany({
      where: { organizationId: orgId, rutaId: { in: rutaIds }, estado: { notIn: ['eliminado', 'inactivo'] } },
      select: {
        id: true, nombre: true,
        prestamos: {
          where: { estado: 'activo' },
          select: {
            totalAPagar: true, montoPrestado: true, cuotaDiaria: true,
            fechaInicio: true, diasPlazo: true, frecuencia: true,
            pagos: { select: { montoPagado: true, tipo: true, fechaPago: true } },
          },
        },
      },
    }),

    prisma.pago.aggregate({
      where: {
        organizationId: orgId,
        cobradorId: userId,
        fechaPago: { gte: inicioDiaUTC, lte: finDiaUTC },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      _sum: { montoPagado: true },
      _count: true,
    }),
  ])

  let clientesActivos = 0, clientesMora = 0, cuotaDiariaTotal = 0
  const moraUrgente = []

  for (const c of clientes) {
    const tieneActivo = c.prestamos.length > 0
    if (!tieneActivo) continue
    clientesActivos++
    for (const p of c.prestamos) {
      cuotaDiariaTotal += p.cuotaDiaria ?? 0
      const pagado = (p.pagos ?? []).filter(pg => !['recargo', 'descuento'].includes(pg.tipo)).reduce((acc, pg) => acc + pg.montoPagado, 0)
      const saldo = Math.max(0, p.totalAPagar - pagado)
      if (saldo > 0 && p.fechaInicio) {
        const inicio = new Date(p.fechaInicio)
        const diasTranscurridos = Math.floor((Date.now() - inicio.getTime()) / (24 * 60 * 60 * 1000))
        const periodosCubiertos = p.cuotaDiaria > 0 ? Math.floor(pagado / p.cuotaDiaria) : 0
        const diasEsperados = periodosCubiertos * (p.frecuencia === 'semanal' ? 7 : p.frecuencia === 'quincenal' ? 15 : p.frecuencia === 'mensual' ? 30 : 1)
        if (diasTranscurridos > diasEsperados + 1) {
          clientesMora++
          moraUrgente.push({ nombre: c.nombre, saldo, diasMora: diasTranscurridos - diasEsperados })
        }
      }
    }
  }

  moraUrgente.sort((a, b) => b.diasMora - a.diasMora)

  return {
    rutas: rutas.map(r => r.nombre),
    clientesActivos,
    clientesMora,
    cuotaDiariaTotal,
    cobroHoy: pagosHoy._sum?.montoPagado ?? 0,
    cobrosHoyCount: pagosHoy._count ?? 0,
    moraUrgente: moraUrgente.slice(0, 3),
  }
}

export function buildSystemPromptCobrador(ctx) {
  const fmt = (n) => `$${Math.round(n || 0).toLocaleString('es-CO')}`
  const rutasTexto = ctx.rutas.length > 0 ? ctx.rutas.join(', ') : 'Sin rutas asignadas'
  const moraTexto = ctx.moraUrgente.length > 0
    ? ctx.moraUrgente.map(m => `  - ${m.nombre}: ${m.diasMora} días mora, debe ${fmt(m.saldo)}`).join('\n')
    : '  (Ninguno urgente)'

  return `Eres Lucas, el asistente de cobro en Control Finanzas.

TUS RUTAS: ${rutasTexto}

HOY:
- Clientes activos en tus rutas: ${ctx.clientesActivos}
- En mora: ${ctx.clientesMora}
- Cobrado hoy: ${fmt(ctx.cobroHoy)} (${ctx.cobrosHoyCount} cobros)
- Meta diaria esperada: ${fmt(ctx.cuotaDiariaTotal)}

MORA URGENTE:
${moraTexto}

REGLAS:
- Solo puedes ver información de tus rutas asignadas
- Puedes registrar pagos de clientes usando register_payment (usa lookup_client primero para encontrar el cliente)
- Puedes registrar gastos del negocio usando register_expense
- Para crear clientes, préstamos o rutas — eso lo hace el administrador
- Responde en español colombiano informal, directo y útil
- Máximo 3 párrafos por respuesta

CAPACIDADES:
- Registrar pagos: "Lucas, Pedro García me pagó $50.000" — usa lookup_client para encontrar el cliente, luego register_payment con el prestamoId
- Registrar gastos: "Lucas, gasté $15.000 en gasolina" — usa register_expense directamente
- Para cualquier otra acción habla con el administrador`
}
