// ── DE LAS TRES APIs DE REPORTES A LO QUE PINTA T33-01 ──
//
// `ingresos`, `seguros` y `cobros-mes` devuelven filas de base de datos. Las
// tres secciones que las enseñaban eran del diseño anterior: una gráfica de
// Recharts con dos verdes, dos desplegables nativos y una tabla sin totales.
//
// Aquí se convierten en lo que la lámina pide, y sobre todo se calculan LAS
// FRASES que la pantalla tenía que decir y no decía: cuál fue el día grande,
// cuánto se promedia, y cuánto falta para cerrar el mes.
import { formatMoney } from '@/lib/i18n'

/** «2026-07-03» → «3 jul». Sin `new Date`, que en UTC se corre un día. */
export function diaCorto(iso) {
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  if (!m) return String(iso ?? '')
  return `${Number(m[3])} ${MES[Number(m[2]) - 1] ?? ''}`.trim()
}

/** «2026-07-03» → «3 de julio», para la frase del día grande. */
export function diaLargo(iso) {
  const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  if (!m) return String(iso ?? '')
  return `${Number(m[3])} de ${MES[Number(m[2]) - 1] ?? ''}`.trim()
}

/**
 * La gráfica de «cómo va entrando», con su frase.
 *
 * LA FRASE ES EL PUNTO. Veinte barras sin números no dicen cuánto entra al día
 * ni qué día fue el bueno: hay que mirarlas y estimar. La media y el pico se
 * calculan aquí y se escriben debajo.
 *
 * La media es sobre los días CON pagos, no sobre el rango entero: incluir los
 * domingos y los días sin cobro la hunde y hace pensar que se recauda menos de
 * lo que se recauda.
 */
export function aGrafica(datos = []) {
  const filas = (datos ?? []).filter((d) => d && d.fecha != null)
  if (filas.length === 0) return { barras: [], desde: null, hasta: null, nota: null }

  const barras = filas.map((d) => ({
    id: d.fecha,
    valor: Number(d.total) || 0,
    titulo: `${diaCorto(d.fecha)} · ${formatMoney(Number(d.total) || 0)}`,
  }))

  const conPagos = barras.filter((b) => b.valor > 0)
  const pico = barras.reduce((may, b) => (b.valor > (may?.valor ?? -1) ? b : may), null)
  const media = conPagos.length
    ? Math.round(conPagos.reduce((a, b) => a + b.valor, 0) / conPagos.length)
    : 0

  let nota = null
  if (conPagos.length === 0) {
    nota = 'No entró nada en este período.'
  } else if (conPagos.length === 1) {
    // Con un solo día, «promedias» no significa nada: es ese día.
    nota = `Todo entró el ${diaLargo(pico.id)}: ${formatMoney(pico.valor)}.`
  } else {
    nota = `El día grande fue el ${diaLargo(pico.id)}. Promedias ${formatMoney(media)} por día con cobro.`
  }

  return {
    barras,
    desde: diaCorto(filas[0].fecha),
    hasta: diaCorto(filas[filas.length - 1].fecha),
    nota,
  }
}

/** Los seguros por ruta. */
export function aSeguros(seguros) {
  const items = seguros?.items ?? []
  return {
    filas: items.map((r) => {
      const cuantos = r.cantPrestamosConSeguro ?? 0
      // Una ruta que cobra seguros y no tiene quién los cobre es un problema,
      // no un detalle: se marca para que se vea.
      const huerfana = !r.cobrador || /sin cobrador/i.test(String(r.cobrador))
      return {
        id: r.rutaId ?? 'sin-ruta',
        nombre: r.ruta,
        huerfana,
        detalle: `${huerfana ? 'sin cobrador' : r.cobrador} · ${cuantos} ${cuantos === 1 ? 'préstamo' : 'préstamos'}`,
        monto: formatMoney(r.totalSeguro ?? 0),
      }
    }),
    total: items.length > 0 ? formatMoney(seguros?.totalGeneral ?? 0) : null,
  }
}

/**
 * Los cobros del mes.
 *
 * `entrado` es lo que de verdad se recaudó en el mismo mes. Si no se sabe, NO
 * se enseña: un «ya entró» en blanco es mejor que uno inventado, y esta
 * pantalla es de plata.
 */
export function aCobrosMes(datos, entrado = null) {
  const rutas = datos?.rutas ?? []
  if (rutas.length === 0) {
    return { titulo: null, resumenLinea: null, total: null, yaEntro: null, falta: null, rutas: [] }
  }

  const esperado = Number(datos.granTotal) || 0
  const clientes = Number(datos.totalClientes) || 0

  let yaEntro = null
  let falta = null
  if (entrado != null && Number.isFinite(Number(entrado))) {
    const entro = Number(entrado)
    yaEntro = formatMoney(entro)
    const resto = esperado - entro
    // Cobrar de más es normal —abonos extra, préstamos que se saldan antes— y
    // decir «falta -$300.000» sería un error de lectura.
    falta = resto > 0 ? `falta ${formatMoney(resto)}` : `entró ${formatMoney(-resto)} de más`
  }

  return {
    titulo: datos.monthLabel ? `Lo que debería entrar en ${String(datos.monthLabel).toLowerCase()}` : null,
    resumenLinea: `${clientes} ${clientes === 1 ? 'cliente' : 'clientes'} con cuota este mes · ${rutas.length === 1 ? '1 ruta' : `${rutas.length} rutas`}`,
    total: formatMoney(esperado),
    yaEntro,
    falta,
    rutas: rutas.map((r) => {
      const cuantos = r.clientes?.length ?? 0
      return {
        id: r.rutaId ?? r.ruta,
        nombre: r.ruta,
        detalle: `${r.cobrador} · ${cuantos} ${cuantos === 1 ? 'cliente' : 'clientes'}`,
        total: formatMoney(r.totalRuta ?? 0),
        clientes: (r.clientes ?? []).map((c) => ({
          id: c.id,
          nombre: c.nombre,
          detalle: `${c.cuotasMes} ${c.cuotasMes === 1 ? 'cuota' : 'cuotas'} · saldo ${formatMoney(c.saldoPendiente ?? 0)}`,
          monto: formatMoney(c.totalMes ?? 0),
        })),
      }
    }),
  }
}
