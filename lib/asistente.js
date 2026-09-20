// lib/asistente.js — Constructor de contexto y helpers para el asistente Lucas
import { prisma } from '@/lib/prisma'
import { getCachedContexto, setCachedContexto } from '@/lib/asistente-cache'
import { getUtcOffset, formatMoney, getCountryConfig } from '@/lib/i18n'
import { interesCobradoDeLosPrestamos, SELECT_PARA_INTERES } from '@/lib/dinero/interes-cobrado'
import { cifrasDeLaCartera, rotulosDeLosSieteDias, SELECT_PRESTAMO_DE_LUCAS } from '@/lib/asistente-cifras'
import { REGLAS_DE_VOZ } from '@/lib/asistente-voz'

// ─── HELPERS ────────────────────────────────────────────────

function getLocalDate(country = 'co') {
  return new Date(Date.now() - Math.abs(getUtcOffset(country)) * 60 * 60 * 1000)
}

/* Los límites del día y del mes, IGUAL que `app/api/dashboard/resumen`: si Lucas
   cortara el día en otra hora, «cobrado hoy» dejaría de coincidir con el Inicio
   a partir de las siete de la noche. */
function ventanas(country) {
  const hoy = getLocalDate(country)
  const y = hoy.getUTCFullYear()
  const m = hoy.getUTCMonth()
  const d = hoy.getUTCDate()
  return {
    hoy,
    inicioDiaUTC: new Date(Date.UTC(y, m, d, 5, 0, 0)),
    finDiaUTC: new Date(Date.UTC(y, m, d + 1, 4, 59, 59)),
    inicioMes: new Date(Date.UTC(y, m, 1, 5, 0, 0)),
    finMes: new Date(Date.UTC(y, m + 1, 1, 4, 59, 59)),
    inicio7DiasUTC: new Date(Date.UTC(y, m, d - 6, 5, 0, 0)),
  }
}

const FILTRO_PAGO_REAL = { tipo: { notIn: ['recargo', 'descuento'] }, prestamo: { estado: { not: 'cancelado' } } }

// ─── BUILD CONTEXTO ─────────────────────────────────────────

export async function buildContexto(orgId, country = 'co') {
  const cached = getCachedContexto(orgId)
  if (cached) return cached

  const { hoy, inicioDiaUTC, finDiaUTC, inicioMes, finMes, inicio7DiasUTC } = ventanas(country)

  const [
    org,
    festivos,
    prestamosActivos,
    pagosDeHoy,
    pagosMes,
    cobradores,
    capitalRow,
    gastosMesAgg,
    pagos7d,
    clientesSinRuta,
    prestamosSinPagos,
    cierresCaja,
    gastosDetalle,
    suscripcion,
    pagosCompletadosAgg,
    prestamosCompletadosAgg,
    prestamosQueCobraronEsteMes,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { nombre: true, plan: true, ciudad: true, diasSinCobro: true, country: true },
    }),

    prisma.festivo.findMany({
      where: { organizationId: orgId },
      select: { fecha: true },
    }),

    /* UNA consulta de préstamos, con TODO lo que leen las funciones de cálculo.
       Eran dos —una para las cifras y otra para «mora urgente»— y a las dos les
       faltaban los mismos campos. Y SIN CLAVOS, como el Inicio. */
    prisma.prestamo.findMany({
      where: {
        organizationId: orgId,
        estado: 'activo',
        esClavo: false,
        cliente: { estado: { notIn: ['eliminado', 'inactivo'] } },
      },
      select: {
        ...SELECT_PRESTAMO_DE_LUCAS,
        cliente: {
          select: {
            id: true,
            nombre: true,
            notas: true,
            diasSinCobro: true,
            ruta: { select: { nombre: true, diasSinCobro: true, cobrador: { select: { nombre: true } } } },
          },
        },
      },
    }),

    // Los cobros de hoy, uno a uno: de aquí sale quién pagó y quién lo cobró.
    prisma.pago.findMany({
      where: { organizationId: orgId, fechaPago: { gte: inicioDiaUTC, lte: finDiaUTC }, ...FILTRO_PAGO_REAL },
      select: {
        montoPagado: true,
        cobradorId: true,
        cobrador: { select: { nombre: true } },
        prestamo: { select: { clienteId: true } },
      },
    }),

    prisma.pago.aggregate({
      where: { organizationId: orgId, fechaPago: { gte: inicioMes, lte: finMes }, ...FILTRO_PAGO_REAL },
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

    // Solo los APROBADOS, como el Inicio: un gasto pendiente todavía no salió.
    prisma.gastoMenor.aggregate({
      where: { organizationId: orgId, estado: 'aprobado', fecha: { gte: inicioMes, lte: finMes } },
      _sum: { monto: true },
    }),

    // Pagos 7 dias para tendencia
    prisma.pago.findMany({
      where: { organizationId: orgId, fechaPago: { gte: inicio7DiasUTC, lte: finDiaUTC }, ...FILTRO_PAGO_REAL },
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
        esClavo: false,
        cliente: { estado: { notIn: ['eliminado', 'inactivo'] } },
        OR: [
          { pagos: { none: {} } },
          { pagos: { every: { fechaPago: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } } },
        ],
      },
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

    /* LO GANADO ESTE MES, de la misma consulta y la misma función que el Inicio.
       Lucas solo sabía «recaudado» y «gastos», y con eso un modelo hace la resta
       prohibida: recaudado − gastos. Ganancia es INTERÉS cobrado − gastos. */
    prisma.prestamo.findMany({
      where: {
        organizationId: orgId,
        estado: { not: 'cancelado' },
        pagos: { some: { fechaPago: { gte: inicioMes, lte: finMes }, tipo: { notIn: ['recargo', 'descuento'] } } },
      },
      select: SELECT_PARA_INTERES,
    }).catch(() => []),
  ])

  // ─── CALCULOS ────────────────────────────────────────────

  const pais = org?.country || country
  const cifras = cifrasDeLaCartera({ prestamos: prestamosActivos, org, festivos, pagosDeHoy })

  // Sparkline 7 dias
  const offsetMs = Math.abs(getUtcOffset(pais)) * 60 * 60 * 1000
  const hoyLocal = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate())
  const sparkline7d = Array(7).fill(0)
  for (const p of pagos7d) {
    const f = new Date(new Date(p.fechaPago).getTime() - offsetMs)
    const dia = Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate())
    const diasAtras = Math.floor((hoyLocal - dia) / (24 * 60 * 60 * 1000))
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

  const gastosMes = gastosMesAgg?._sum?.monto ?? 0
  const interesGanadoMes = interesCobradoDeLosPrestamos(prestamosQueCobraronEsteMes || [], { desde: inicioMes, hasta: finMes })

  const ctx = {
    org: { nombre: org?.nombre ?? 'Tu negocio', plan: org?.plan, ciudad: org?.ciudad, country: pais },
    fechaHoy: hoy.toISOString().split('T')[0],
    suscripcion: { diasRestantes: diasRestantesSus, estado: suscripcion?.estado ?? null },
    kpis: {
      clientesActivos: cifras.clientesActivos,
      clientesMora: cifras.clientesMora,
      pctMora: cifras.pctMora,
      carteraActiva: cifras.carteraActiva,
      saldoPorCobrar: cifras.saldoPorCobrar,
      capitalEnCalle: cifras.capitalEnCalle,
      capitalDisponible: capitalRow?.saldo ?? 0,
      cobroHoy: cifras.cobroHoy,
      cobrosHoyCount: cifras.cobrosHoyCount,
      cobroMes: pagosMes._sum?.montoPagado ?? 0,
      // Lo que TOCA cobrar hoy, con la regla del Inicio. Se llamaba
      // `cuotaDiariaEsperada` y era la suma de todas las cuotas de la cartera.
      esperadoHoy: cifras.esperadoHoy,
      clientesConCobroHoy: cifras.clientesConCobroHoy,
      clientesCobradosHoy: cifras.clientesCobradosHoy,
      gastosMes,
      interesGanadoMes,
      gananciaMes: interesGanadoMes - gastosMes,
    },
    hoy: { faltan: cifras.faltanHoy, porCobrador: cifras.cobradoPorCobrador },
    cobradores: cobradorData,
    moraUrgente: cifras.moraUrgente,
    alertas: { clientesSinRuta, prestamosSinPagos },
    tendencia7d: sparkline7d,
    rotulos7d: rotulosDeLosSieteDias(hoy),
    ganancias: {
      interesesYaCobrados: cifras.interesesYaCobrados,
      interesesPorCobrar: cifras.interesesPorCobrar,
      gananciaTotal: cifras.interesesYaCobrados + cifras.interesesPorCobrar,
      interesesHistoricosRealizados: interesesHistoricos,
      gananciaTotalAcumulada: cifras.interesesYaCobrados + cifras.interesesPorCobrar + interesesHistoricos,
    },
    cierresCaja: cierresCaja ?? [],
    gastosDetalle: gastosDetalle ?? [],
  }

  setCachedContexto(orgId, ctx)
  return ctx
}

// ─── SYSTEM PROMPT ──────────────────────────────────────────

/* EL BLOQUE «HOY», igual para el dueño y para el cobrador.
 *
 * El cero es un dato: «hoy no toca cobrarle a nadie» (domingo, festivo) se dice
 * con esas palabras. Con un «$0 de meta» el modelo contestaba «vas en 0 %». */
function textoDeHoy({ kpis, hoy, fmt }) {
  const faltan = hoy?.faltan ?? { cuantos: 0, monto: 0, lista: [] }
  const lineas = ['HOY:']
  if (kpis.clientesConCobroHoy > 0) {
    lineas.push(`- HOY TOCA COBRAR: ${fmt(kpis.esperadoHoy)} a ${kpis.clientesConCobroHoy} clientes (es la misma cifra del Inicio)`)
    lineas.push(`- Ya pagaron ${kpis.clientesCobradosHoy} de esos ${kpis.clientesConCobroHoy}`)
  } else {
    lineas.push('- Hoy no toca cobrarle a nadie (día sin cobro, festivo o sin cuotas para hoy)')
  }
  lineas.push(`- Cobrado hoy: ${fmt(kpis.cobroHoy)} en ${kpis.cobrosHoyCount} cobros`)
  if (faltan.cuantos > 0) {
    const nombres = faltan.lista.map(f => `${f.nombre} ${fmt(f.cuota)}`).join('; ')
    const resto = faltan.cuantos - faltan.lista.length
    lineas.push(`- Faltan por pagar hoy: ${faltan.cuantos} clientes, ${fmt(faltan.monto)} → ${nombres}${resto > 0 ? `; y ${resto} más` : ''}`)
  } else if (kpis.clientesConCobroHoy > 0) {
    lineas.push('- Faltan por pagar hoy: nadie, ya pagaron todos los de hoy')
  }
  if ((hoy?.porCobrador ?? []).length > 0) {
    lineas.push(`- Cobrado hoy por cobrador: ${hoy.porCobrador.map(c => `${c.nombre} ${fmt(c.monto)} (${c.cobros})`).join('; ')}`)
  }
  return lineas.join('\n')
}

export function buildSystemPrompt(ctx) {
  const { org, kpis, hoy, cobradores, moraUrgente, alertas, tendencia7d, rotulos7d, ganancias, cierresCaja, gastosDetalle, suscripcion, memorias } = ctx
  const country = org.country || 'co'
  const pais = getCountryConfig(country)?.name || 'Colombia'
  const fmt = (n) => formatMoney(n || 0, country)

  const tendenciaTexto = tendencia7d
    .map((v, i) => `${rotulos7d?.[i] ?? `día ${i + 1}`}: ${fmt(v)}`)
    .join(', ')

  const mora = moraUrgente.length > 0
    ? moraUrgente.map(m => {
        let linea = `  - ${m.nombre}: ${m.diasMora} días mora, debe ${fmt(m.saldo)}${m.prestamosEnMora > 1 ? ` en ${m.prestamosEnMora} préstamos` : ''}`
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
  if (alertas.prestamosSinPagos > 0) alertasTexto.push(`${alertas.prestamosSinPagos} préstamos sin pagos hace +7 días`)

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
Eres un asesor de negocios de confianza para prestamistas en ${pais}.

DATOS DE HOY:
Fecha actual: ${ctx.fechaHoy} (YYYY-MM-DD) — usa ESTA fecha cuando necesites fechaInicio en préstamos
Ciudad: ${org.ciudad || pais} | Plan: ${org.plan}
Suscripción: ${suscripcion?.diasRestantes !== null && suscripcion?.diasRestantes !== undefined ? `${suscripcion.diasRestantes} días restantes` : 'sin datos'}

CARTERA:
- Clientes activos: ${kpis.clientesActivos} | En mora: ${kpis.clientesMora} (${kpis.pctMora}%)
- Cartera total: ${fmt(kpis.carteraActiva)} | Saldo por cobrar: ${fmt(kpis.saldoPorCobrar)}
- Capital en la calle (tu plata que sigue prestada): ${fmt(kpis.capitalEnCalle)}
- Capital en caja: ${fmt(kpis.capitalDisponible)}

${textoDeHoy({ kpis, hoy, fmt })}

ESTE MES:
- Recaudado: ${fmt(kpis.cobroMes)} (es capital que vuelve MÁS interés: NO es ganancia)
- Interés cobrado: ${fmt(kpis.interesGanadoMes)} | Gastos aprobados: ${fmt(kpis.gastosMes)}
- Ganancia del mes (interés cobrado − gastos): ${fmt(kpis.gananciaMes)}
- Últimos 7 días, recaudado: ${tendenciaTexto}

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

MORA URGENTE (los 5 clientes más atrasados):
${mora}

${alertasTexto.length > 0 ? `ALERTAS:\n${alertasTexto.map(a => `  - ${a}`).join('\n')}` : ''}${cierresTexto}${gastosTexto}

${memorias?.length > 0 ? `MEMORIA DE SESIONES ANTERIORES:\n${memorias.map(m => `  - ${m.contenido}`).join('\n')}\nUsa esta información para personalizar tus respuestas sin mencionarla explícitamente a menos que sea relevante.\n\n` : ''}DÓNDE ESTÁ CADA COSA EN LA APP (para cuando pregunten «¿dónde veo…?» o «¿cómo hago…?»):
- Abajo: Inicio, Clientes, Rutas y Más. El botón + crea: cobro, cliente, préstamo.
- En Más: Capital, Caja, «¿Cómo va el negocio?», Simulador, Reportes, Gastos, Cobradores, Perdidos, Socios, Historial y Configuración.
- «Tu resumen del día» (quién pagó, quién no, mañana) y a qué hora sale: Más → Configuración → Notificaciones.
- El comprobante de un pago se manda por WhatsApp desde el mismo pago. El cierre del día se hace en Caja.
- Si no sabes cómo se hace algo, NO lo inventes: dilo y ofrece conectar con soporte.

REGLAS:
- Responde SIEMPRE en español cercano y directo, como un asesor de confianza de ${pais}
- Se directo y practico. Usa cifras reales del contexto cuando respondas
- Maximo 3 parrafos por respuesta (usuarios en celular)
- No inventes datos que no esten en este contexto
- Si te preguntan algo fuera del negocio, redirige amablemente
- Los datos tienen hasta 5 minutos de retraso vs la BD en vivo
- «Meta de hoy» o «cuánto me toca cobrar hoy» es lo de HOY TOCA COBRAR. Nunca la suma de todas las cuotas de la cartera.
- GANANCIA es interés cobrado menos gastos. Nunca recaudado menos gastos: lo recaudado trae de vuelta capital que ya era del prestamista.
- Cuando pregunten "cuanto estoy ganando?" o "cuanto gano?" empieza por la ganancia de ESTE MES y luego da el acumulado: histórico realizado, activo cobrado, activo por cobrar, total real y total proyectado si todos pagan
- De un cliente concreto solo sabes lo que devuelve lookup_client. De la lista «Faltan por pagar hoy» solo ves los primeros: si piden la lista completa, mándalos a Inicio o a su Ruta.
${REGLAS_DE_VOZ}

CAPACIDADES DE ACCIÓN (solo para owners):
Puedes realizar estas acciones con confirmación del usuario:
registrar pagos · crear clientes · crear préstamos · crear rutas · asignar clientes a rutas · ajustar capital · editar préstamos · conectar con soporte

LO QUE NO PUEDES HACER (no tienes herramienta; dilo claro y di dónde se hace, NUNCA digas que lo hiciste):
- Mandar recordatorios o mensajes de WhatsApp → se mandan desde la ficha del cliente o desde su préstamo, con el botón de WhatsApp.
- Armar reportes, PDF o Excel → Más → Reportes, o «¿Cómo va el negocio?».
- Borrar, anular o reversar pagos, préstamos o clientes → desde la ficha de cada uno.
- Cerrar la caja o corregir un cierre → Más → Caja.
- Cambiar la configuración, el plan o los permisos de un cobrador → Más → Configuración / Cobradores.

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
2. CASO A — Cliente con UN solo préstamo activo:
   - Muestra: "Encontré a [Nombre] (cédula: [X]), cuota de $[Y], saldo $[Z]. ¿Es este?"
   - Si confirma, continúa con el paso 3
3. CASO B — Cliente con MÚLTIPLES préstamos activos (lookup_client retorna "tiene N préstamos activos: (1) ..., (2) ..."):
   - NUNCA asumas cuál préstamo es. NO uses ningún [pid:XXX] hasta que el usuario te lo indique.
   - Lista los préstamos al usuario en lenguaje natural y pregunta cuál:
     "[Nombre] tiene N préstamos activos: 1) cuota $X, saldo $Y; 2) cuota $A, saldo $B; ... ¿Cuál quieres registrar el pago?"
   - Espera la respuesta del usuario ("el primero", "el de $30.000", "la cuota de 5 mil", etc.) y usa el [pid:XXX] correspondiente.
4. DECIDE EL MONTO:
   - Sin monto especificado → cuota exacta del préstamo elegido
   - "Pagó $X" → usa ese monto
   - Si el cliente está en mora → "Tiene [N] días en mora. ¿Registro la cuota normal ($[cuota]) o el saldo completo ($[saldo])?"
5. Método: si no lo dijo → usa efectivo por defecto (no preguntes si hay mora u otra pregunta pendiente)
6. Ejecuta register_payment con el prestamoId correcto
7. Después: "¡Listo! En la tarjeta hay botón para enviarle el comprobante por WhatsApp. ¿Otro cobro?"

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

export async function buildContextoCobrador(orgId, rutaIds, userId, country = 'co') {
  if (!rutaIds || rutaIds.length === 0) {
    return { rutas: [], country, kpis: { clientesActivos: 0, clientesMora: 0, esperadoHoy: 0, clientesConCobroHoy: 0, clientesCobradosHoy: 0, cobroHoy: 0, cobrosHoyCount: 0 }, hoy: { faltan: { cuantos: 0, monto: 0, lista: [] }, porCobrador: [] }, moraUrgente: [] }
  }

  const { inicioDiaUTC, finDiaUTC } = ventanas(country)

  const [org, festivos, rutas, prestamos, pagosDeHoy] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { diasSinCobro: true, country: true },
    }),

    prisma.festivo.findMany({
      where: { organizationId: orgId },
      select: { fecha: true },
    }),

    prisma.ruta.findMany({
      where: { id: { in: rutaIds }, organizationId: orgId },
      select: { id: true, nombre: true },
    }),

    // Los préstamos de SUS rutas, con lo mismo que lee el dueño. Sin clavos.
    prisma.prestamo.findMany({
      where: {
        organizationId: orgId,
        estado: 'activo',
        esClavo: false,
        cliente: { rutaId: { in: rutaIds }, estado: { notIn: ['eliminado', 'inactivo'] } },
      },
      select: {
        ...SELECT_PRESTAMO_DE_LUCAS,
        cliente: {
          select: { id: true, nombre: true, diasSinCobro: true, ruta: { select: { nombre: true, diasSinCobro: true } } },
        },
      },
    }),

    /* Lo que él cobró Y lo que cualquiera le cobró a un cliente de sus rutas: si
       el dueño registró el pago desde la oficina, ese cliente ya no «falta». */
    prisma.pago.findMany({
      where: {
        organizationId: orgId,
        fechaPago: { gte: inicioDiaUTC, lte: finDiaUTC },
        ...FILTRO_PAGO_REAL,
        OR: [{ cobradorId: userId }, { prestamo: { estado: { not: 'cancelado' }, cliente: { rutaId: { in: rutaIds } } } }],
      },
      select: { montoPagado: true, cobradorId: true, prestamo: { select: { clienteId: true } } },
    }),
  ])

  const cifras = cifrasDeLaCartera({ prestamos, org, festivos, pagosDeHoy, topeMora: 3 })
  const losMios = pagosDeHoy.filter((g) => g.cobradorId === userId)

  return {
    rutas: rutas.map(r => r.nombre),
    country: org?.country || country,
    kpis: {
      clientesActivos: cifras.clientesActivos,
      clientesMora: cifras.clientesMora,
      esperadoHoy: cifras.esperadoHoy,
      clientesConCobroHoy: cifras.clientesConCobroHoy,
      clientesCobradosHoy: cifras.clientesCobradosHoy,
      // «Cobrado hoy» es lo que cobró ÉL, como en su caja.
      cobroHoy: losMios.reduce((n, g) => n + (g.montoPagado ?? 0), 0),
      cobrosHoyCount: losMios.length,
    },
    hoy: { faltan: cifras.faltanHoy, porCobrador: [] },
    moraUrgente: cifras.moraUrgente,
  }
}

export function buildSystemPromptCobrador(ctx) {
  const country = ctx.country || 'co'
  const fmt = (n) => formatMoney(n || 0, country)
  const rutasTexto = ctx.rutas.length > 0 ? ctx.rutas.join(', ') : 'Sin rutas asignadas'
  const moraTexto = ctx.moraUrgente.length > 0
    ? ctx.moraUrgente.map(m => `  - ${m.nombre}: ${m.diasMora} días mora, debe ${fmt(m.saldo)}${m.prestamosEnMora > 1 ? ` en ${m.prestamosEnMora} préstamos` : ''}`).join('\n')
    : '  (Ninguno urgente)'

  return `Eres Lucas, el asistente de cobro en Control Finanzas.

TUS RUTAS: ${rutasTexto}
- Clientes activos en tus rutas: ${ctx.kpis.clientesActivos} | En mora: ${ctx.kpis.clientesMora}

${textoDeHoy({ kpis: ctx.kpis, hoy: ctx.hoy, fmt })}

MORA URGENTE:
${moraTexto}

REGLAS:
- Solo puedes ver información de tus rutas asignadas
- Puedes registrar pagos de clientes usando register_payment (usa lookup_client primero para encontrar el cliente)
- Puedes registrar gastos del negocio usando register_expense
- Para crear clientes, préstamos o rutas — eso lo hace el administrador
- Responde en español cercano, directo y útil
- Máximo 3 párrafos por respuesta
- «Mi meta de hoy» o «cuánto me falta» es lo de HOY TOCA COBRAR y FALTAN POR PAGAR HOY. Nunca la suma de todas las cuotas de la ruta.
- De la lista «Faltan por pagar hoy» solo ves los primeros: la lista completa está en su Ruta.
${REGLAS_DE_VOZ}

CAPACIDADES:
- Registrar pagos: "Lucas, Pedro García me pagó $50.000" — usa lookup_client para encontrar el cliente, luego register_payment con el prestamoId
  IMPORTANTE: Si lookup_client retorna que el cliente tiene MÁS DE UN préstamo activo ("tiene N préstamos activos: (1) ..., (2) ..."), NUNCA asumas cuál. Lista los préstamos al usuario y pregunta cuál usar antes de registrar el pago.
- Registrar gastos: "Lucas, gasté $15.000 en gasolina" — usa register_expense directamente
- Para cualquier otra acción habla con el administrador`
}
