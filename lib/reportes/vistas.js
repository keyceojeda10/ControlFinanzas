/* ══ UNA SOLA FORMA PARA LOS DOCE INFORMES ═══════════════════════════════════
 *
 * Pedido por el dueño el 16 ago 2026:
 *
 *   «Que cada reporte tenga su página específica, y en esa página puede haber
 *    filtros específicos. La gente selecciona su filtro, crea el reporte como
 *    quiere, lo descarga, lo puede descargar tanto en PDF como Excel. Que la
 *    gente sepa qué es lo que va a descargar.»
 *
 * ── POR QUÉ ESTE ARCHIVO EXISTE ─────────────────────────────────────────────
 *
 * «Que sepa qué va a descargar» solo se cumple si lo que baja es EXACTAMENTE lo
 * que está viendo. La forma de conseguirlo no es cuidado al escribirlo tres
 * veces: es que haya una sola descripción del informe y que las tres salidas
 * —pantalla, PDF y Excel— se pinten desde ella.
 *
 * Cada `vistaDe` traduce la respuesta cruda de su API a esto:
 *
 *     { cifras: [{etiqueta, valor, tono}],        ← los números de arriba
 *       tabla:  { columnas: [...], filas: [...] }, ← el detalle
 *       nota }                                     ← la advertencia, si aplica
 *
 * Y `tipo` en cada columna —dinero, numero, texto, fecha, pct— decide el
 * formato en las tres a la vez. Sin eso, la pantalla escribe «$1.500.000», el
 * Excel escribe 1500000 y el PDF escribe «1.500.000»: tres papeles que no se
 * pueden cotejar entre sí.
 *
 * ⚠ ESTE ARCHIVO NO CONSULTA NADA. Recibe lo que ya devolvió el API de cada
 *   informe y solo lo acomoda. Si aquí se calculara un total, sería el segundo
 *   sitio donde vive esa cifra — que es de donde salen las contradicciones que
 *   llevo toda la semana persiguiendo (la ganancia, el desembolsado, el próximo
 *   cobro). Todo lo que se enseña tiene que venir ya calculado de su API.
 */

/** Formatea un valor según el tipo de su columna. `dinero` lo pone quien pinta. */
export const TIPOS = ['texto', 'dinero', 'numero', 'pct', 'fecha']

const col = (clave, rotulo, tipo = 'texto', ancho = 1, alinear = null) => ({
  clave, rotulo, tipo, ancho,
  // El dinero y los números van a la derecha SIEMPRE: es lo que deja las
  // unidades alineadas y permite leer una columna de un vistazo.
  alinear: alinear ?? (tipo === 'texto' ? 'izq' : 'der'),
})

const vacia = { cifras: [], tabla: { columnas: [], filas: [] } }

/* ── 1 · LO QUE ENTRÓ ────────────────────────────────────────────────────── */
function vistaEntro(d) {
  if (!d?.totales) return vacia
  return {
    cifras: [
      { etiqueta: 'Recaudado', valor: d.totales.recaudado, tipo: 'dinero' },
      { etiqueta: 'De eso, ganancia', valor: d.totales.interes, tipo: 'dinero', tono: 'bueno' },
      { etiqueta: 'Capital recuperado', valor: d.totales.capital, tipo: 'dinero' },
    ],
    tabla: {
      columnas: [
        col('fecha', 'Día', 'fecha', 1.2),
        col('total', 'Recaudado', 'dinero'),
        col('interes', 'Ganancia', 'dinero'),
        col('capital', 'Capital', 'dinero'),
      ],
      filas: d.data ?? [],
    },
  }
}

/* ── 2 · LO QUE ESTÁ EN LA CALLE ─────────────────────────────────────────── */
function vistaCalle(d) {
  const filas = Array.isArray(d) ? d : []
  const suma = (k) => filas.reduce((a, f) => a + (Number(f[k]) || 0), 0)
  return {
    cifras: [
      { etiqueta: 'Te deben', valor: suma('saldoPendiente'), tipo: 'dinero' },
      { etiqueta: 'Capital en la calle', valor: suma('capitalActivo'), tipo: 'dinero' },
      { etiqueta: 'Clientes', valor: suma('clientes'), tipo: 'numero' },
    ],
    tabla: {
      columnas: [
        col('ruta', 'Ruta', 'texto', 1.6),
        col('cobrador', 'Cobrador', 'texto', 1.6),
        col('clientes', 'Clientes', 'numero', 0.8),
        col('capitalActivo', 'Capital', 'dinero', 1.3),
        col('saldoPendiente', 'Te deben', 'dinero', 1.3),
        col('cuotaDiariaTotal', 'Cuota/día', 'dinero', 1.2),
      ],
      filas,
    },
  }
}

/* ── 3 · LOS COBROS DEL MES ──────────────────────────────────────────────── */
function vistaCobrosMes(d) {
  if (!d?.rutas) return vacia
  /* Se aplana ruta → clientes. El agrupado se pierde en el Excel de todos
     modos, y con la ruta en su columna se puede filtrar allí. */
  const filas = []
  for (const r of d.rutas) {
    for (const c of r.clientes ?? []) {
      filas.push({ ruta: r.ruta, cobrador: r.cobrador, ...c })
    }
  }
  return {
    cifras: [
      { etiqueta: d.monthLabel ?? 'El mes', valor: d.granTotal, tipo: 'dinero' },
      { etiqueta: 'Clientes que pagaron', valor: d.totalClientes, tipo: 'numero' },
    ],
    tabla: {
      columnas: [
        col('nombre', 'Cliente', 'texto', 2),
        col('ruta', 'Ruta', 'texto', 1.3),
        col('totalMes', 'Cobrado', 'dinero', 1.2),
        col('saldoPendiente', 'Le falta', 'dinero', 1.2),
      ],
      filas,
    },
  }
}

/* ── 4 · EL DÍA ──────────────────────────────────────────────────────────── */
function vistaDia(d) {
  if (!d?.resumen) return vacia
  const r = d.resumen
  return {
    cifras: [
      { etiqueta: 'Cobrado', valor: r.totalRecaudado, tipo: 'dinero', tono: 'bueno' },
      { etiqueta: 'Se esperaba', valor: r.totalEsperado, tipo: 'dinero' },
      { etiqueta: 'Gastos', valor: r.totalGastos, tipo: 'dinero', tono: 'malo' },
      { etiqueta: 'Quedó', valor: r.disponible, tipo: 'dinero' },
    ],
    tabla: {
      columnas: [
        col('cliente', 'Cliente', 'texto', 2),
        col('ruta', 'Ruta', 'texto', 1.3),
        col('monto', 'Pagó', 'dinero', 1.2),
        col('hora', 'Hora', 'texto', 1),
      ],
      filas: (d.pagos ?? []).map((p) => ({
        cliente: p.cliente ?? p.clienteNombre ?? '',
        ruta: p.ruta ?? p.rutaNombre ?? '',
        monto: p.monto ?? p.montoPagado ?? 0,
        hora: p.hora ?? '',
      })),
    },
    nota: r.pendientesCount > 0
      ? `Quedaron ${r.pendientesCount} clientes sin cobrar.`
      : null,
  }
}

/* ── 5 · CÓMO RINDIÓ EL NEGOCIO ──────────────────────────────────────────── */
function vistaRendimiento(d) {
  if (!d) return vacia
  const k = d.kpis ?? d.resumen ?? {}
  const filas = d.rentabilidadPorRuta ?? d.porRuta ?? []
  return {
    cifras: [
      { etiqueta: 'Recaudado del mes', valor: k.recaudadoMes ?? 0, tipo: 'dinero' },
      { etiqueta: 'Ganancia neta', valor: k.gananciaNetaMes ?? 0, tipo: 'dinero', tono: 'bueno' },
      { etiqueta: 'Capital en la calle', valor: k.capitalEnCalle ?? 0, tipo: 'dinero' },
    ],
    tabla: {
      columnas: [
        col('rutaNombre', 'Ruta', 'texto', 2),
        col('capitalDesplegado', 'Capital', 'dinero'),
        col('interesGanado', 'Ganancia', 'dinero'),
        col('prestamos', 'Préstamos', 'numero', 0.9),
      ],
      filas: filas.map((f) => ({ ...f, rutaNombre: f.rutaNombre ?? f.ruta ?? 'Sin ruta' })),
    },
  }
}

/* ── 6 · PARA EL CONTADOR ────────────────────────────────────────────────── */
function vistaContador(d) {
  if (!d) return vacia
  return {
    cifras: [
      { etiqueta: 'Recaudado', valor: d.recaudado, tipo: 'dinero' },
      { etiqueta: 'Interés (ingreso)', valor: d.interes, tipo: 'dinero', tono: 'bueno' },
      { etiqueta: 'Capital recuperado', valor: d.capitalRecuperado, tipo: 'dinero' },
      { etiqueta: 'Gastos', valor: d.gastos, tipo: 'dinero', tono: 'malo' },
      { etiqueta: 'Utilidad', valor: d.utilidad, tipo: 'dinero', tono: d.utilidad >= 0 ? 'bueno' : 'malo' },
    ],
    tabla: {
      columnas: [
        col('mes', 'Mes', 'texto', 1.2),
        col('interes', 'Interés', 'dinero'),
        col('capital', 'Capital', 'dinero'),
        col('gastos', 'Gastos', 'dinero'),
        col('utilidad', 'Utilidad', 'dinero'),
      ],
      filas: (d.meses ?? []).map((m) => ({ ...m, utilidad: (m.interes ?? 0) - (m.gastos ?? 0) })),
    },
    /* Los dos porcentajes vienen en `null` cuando no se pueden calcular, y así
       se dicen: escribir 0% en una hoja que va al contador es peor que el hueco. */
    nota: [
      d.porcentajeGastos != null ? `Los gastos fueron el ${d.porcentajeGastos}% del interés cobrado.` : null,
      d.utilidadSobreCapital != null ? `La utilidad fue el ${d.utilidadSobreCapital}% del capital recuperado.` : null,
    ].filter(Boolean).join(' ') || null,
  }
}

/* ── 7 · MOVIMIENTOS POR CUENTA ──────────────────────────────────────────── */
function vistaCuentas(d) {
  if (!d?.totales) return vacia
  return {
    cifras: [
      { etiqueta: 'Entró', valor: d.totales.entradas, tipo: 'dinero', tono: 'bueno' },
      { etiqueta: 'Salió', valor: d.totales.salidas, tipo: 'dinero', tono: 'malo' },
      { etiqueta: 'Quedó', valor: d.totales.neto, tipo: 'dinero', tono: d.totales.neto >= 0 ? 'bueno' : 'malo' },
    ],
    tabla: {
      columnas: [
        col('nombre', 'Cuenta', 'texto', 2),
        col('entradas', 'Entró', 'dinero'),
        col('salidas', 'Salió', 'dinero'),
        col('neto', 'Quedó', 'dinero'),
      ],
      // Solo las que se movieron; las quietas se nombran en la nota.
      filas: (d.cuentas ?? []).filter((c) => c.entradas !== 0 || c.salidas !== 0),
    },
    nota: d.sinMovimiento?.length
      ? `Sin movimiento en este periodo: ${d.sinMovimiento.join(', ')}.`
      : null,
  }
}

/* ── 8 · RESUMEN DEL NEGOCIO ─────────────────────────────────────────────── */
function vistaResumen(d) {
  if (!d?.prestamos) return vacia
  return {
    cifras: [
      { etiqueta: 'Clientes', valor: d.clientes?.total ?? 0, tipo: 'numero' },
      { etiqueta: 'En mora', valor: d.clientes?.enMora ?? 0, tipo: 'numero', tono: 'malo' },
      { etiqueta: 'Préstamos activos', valor: d.prestamos.activos, tipo: 'numero' },
      { etiqueta: 'Te deben', valor: d.prestamos.saldoPorCobrar, tipo: 'dinero' },
      { etiqueta: 'Capital en la calle', valor: d.prestamos.capitalEnCalle, tipo: 'dinero' },
    ],
    tabla: {
      columnas: [col('concepto', 'Concepto', 'texto', 2.4), col('valor', 'Valor', 'dinero')],
      filas: [
        { concepto: 'Recaudado en el periodo', valor: d.pagos?.totalPeriodo ?? 0 },
        { concepto: 'De eso, interés ganado', valor: d.pagos?.interesGanado ?? 0 },
        { concepto: 'De eso, capital recuperado', valor: d.pagos?.capitalRecuperado ?? 0 },
        { concepto: 'Cartera activa', valor: d.prestamos.carteraActiva },
        { concepto: 'Saldo por cobrar', valor: d.prestamos.saldoPorCobrar },
      ],
    },
    nota: `${d.pagos?.cantidad ?? 0} pagos en el periodo · ${d.prestamos.completados} préstamos terminados.`,
  }
}

/* ── 9 · TUS COBRADORES ──────────────────────────────────────────────────── */
function vistaCobradores(d) {
  const filas = Array.isArray(d) ? d : []
  const suma = (k) => filas.reduce((a, f) => a + (Number(f[k]) || 0), 0)
  return {
    cifras: [
      { etiqueta: 'Recogido', valor: suma('totalRecogido'), tipo: 'dinero', tono: 'bueno' },
      { etiqueta: 'Se esperaba', valor: suma('totalEsperado'), tipo: 'dinero' },
      { etiqueta: 'Prestaron', valor: suma('totalDesembolsado'), tipo: 'dinero' },
      { etiqueta: 'Gastos', valor: suma('totalGastos'), tipo: 'dinero', tono: 'malo' },
    ],
    tabla: {
      columnas: [
        col('nombre', 'Cobrador', 'texto', 1.8),
        col('ruta', 'Ruta', 'texto', 1.4),
        col('clientes', 'Clientes', 'numero', 0.9),
        col('totalRecogido', 'Recogió', 'dinero', 1.2),
        col('totalEsperado', 'Se esperaba', 'dinero', 1.2),
        col('eficiencia', 'Cumple', 'pct', 0.9),
      ],
      filas,
    },
  }
}

/* ── 10 · SEGUROS COBRADOS ───────────────────────────────────────────────── */
function vistaSeguros(d) {
  if (!d) return vacia
  return {
    cifras: [
      { etiqueta: 'Cobrado en seguros', valor: d.totalGeneral ?? 0, tipo: 'dinero', tono: 'bueno' },
      { etiqueta: 'Préstamos con seguro', valor: d.cantGeneral ?? 0, tipo: 'numero' },
    ],
    tabla: {
      columnas: [
        col('ruta', 'Ruta', 'texto', 2),
        col('cantidad', 'Préstamos', 'numero', 1),
        col('total', 'Cobrado', 'dinero', 1.3),
      ],
      filas: (d.items ?? []).map((i) => ({
        ruta: i.ruta ?? i.nombre ?? 'Sin ruta',
        cantidad: i.cantidad ?? i.cant ?? 0,
        total: i.total ?? 0,
      })),
    },
  }
}

/* ── 11 y 12 · LOS QUE NO SE VEN, SOLO SE BAJAN ──────────────────────────── */
/* «Listado de cobros» es la hoja que se imprime y se le da al cobrador, y «Todo
   en bruto» es el volcado para el contador. Ninguno tiene una vista en pantalla
   que valga la pena: son papeles. Se declaran para que el índice los liste con
   su explicación, y su pantalla enseña qué va a bajar y el botón. */
const SIN_VISTA = () => ({ ...vacia, soloDescarga: true })

const VISTAS = {
  entro: vistaEntro,
  calle: vistaCalle,
  'cobros-mes': vistaCobrosMes,
  dia: vistaDia,
  rendimiento: vistaRendimiento,
  contador: vistaContador,
  cuentas: vistaCuentas,
  resumen: vistaResumen,
  cobradores: vistaCobradores,
  seguros: vistaSeguros,
  'listado-cobros': SIN_VISTA,
  crudo: SIN_VISTA,
}

/**
 * Traduce la respuesta cruda de un informe a la forma común.
 * @returns {{cifras:Array, tabla:{columnas:Array,filas:Array}, nota?:string, soloDescarga?:boolean}}
 */
export function vistaDe(informeId, crudo) {
  const fn = VISTAS[informeId]
  if (!fn) return vacia
  try {
    return fn(crudo)
  } catch {
    /* Un informe que revienta no puede tumbar la pantalla entera: se enseña
       vacío y el resto sigue. El aviso lo da la pantalla, no una excepción. */
    return vacia
  }
}

export function tieneVista(informeId) {
  return !!VISTAS[informeId] && VISTAS[informeId] !== SIN_VISTA
}
