// Las tres secciones que quedaban del diseño anterior en `/reportes` (T33-01).
// Como siempre: la prueba comprueba el contrato con el componente que pinta, no
// el adaptador contra su propia aritmética.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { aGrafica, aSeguros, aCobrosMes, diaCorto, diaLargo } from '@/lib/adaptadores/reportes-detalle'

const fuente = readFileSync(
  join(process.cwd(), 'components', 'pantallas', 'ReportesDetalle.jsx'), 'utf8')

describe('la gráfica dice lo que antes había que adivinar', () => {
  const dias = [
    { fecha: '2026-07-01', total: 100000 },
    { fecha: '2026-07-02', total: 0 },
    { fecha: '2026-07-03', total: 300000 },
    { fecha: '2026-07-04', total: 200000 },
  ]

  it('nombra el día grande y el promedio', () => {
    const { nota } = aGrafica(dias)
    expect(nota).toContain('3 de julio')
    // La media es sobre los días CON cobro: 600.000 / 3 = 200.000. Meter el
    // domingo de cero la bajaría a 150.000 y haría creer que se recauda menos.
    expect(nota).toContain('$200.000')
  })

  it('el rango se lee en los extremos', () => {
    const { desde, hasta } = aGrafica(dias)
    expect(desde).toBe('1 jul')
    expect(hasta).toBe('4 jul')
  })

  it('un día de cero es una barra mínima, no una barra ausente', () => {
    // Si la barra midiera 0px, un día sin cobro se vería igual que un día que
    // todavía no existe. El componente le da un mínimo.
    expect(fuente).toMatch(/Math\.max\(2,/)
    const { barras } = aGrafica(dias)
    expect(barras).toHaveLength(4)
    expect(barras[1].valor).toBe(0)
  })

  it('con un solo día no habla de promedios', () => {
    const { nota } = aGrafica([{ fecha: '2026-07-09', total: 50000 }])
    expect(nota).toContain('9 de julio')
    expect(nota).not.toContain('Promedias')
  })

  it('sin nada que enseñar no inventa una frase', () => {
    expect(aGrafica([]).nota).toBeNull()
    expect(aGrafica([]).barras).toEqual([])
    expect(aGrafica([{ fecha: '2026-07-01', total: 0 }]).nota).toBe('No entró nada en este período.')
  })

  it('un solo dorado: la gráfica no pinta la última barra de otro color', () => {
    // Era verde fuerte la última y verde claro las demás, lo que sugiere que
    // hoy es especial. No lo es: es la barra que aún no ha terminado.
    const grafica = fuente.slice(fuente.indexOf('export function ComoVaEntrando'),
      fuente.indexOf('export function SegurosCobrados'))
    const colores = [...grafica.matchAll(/background: '([^']+)'/g)].map((m) => m[1])
    expect(colores.filter((c) => c.includes('gold') || c.includes('green'))).toEqual(['var(--cf-gold)'])
  })
})

describe('las fechas no se corren un día', () => {
  it('las convierte sin depender de la zona de la máquina', () => {
    expect(diaCorto('2026-07-01')).toBe('1 jul')
    expect(diaLargo('2026-07-01')).toBe('1 de julio')
    expect(diaCorto('2026-12-31')).toBe('31 dic')
  })

  it('la API de ingresos agrupa en UTC, no en la hora del servidor', () => {
    // Restaba la zona horaria DOS VECES —`toLocalDate` la corre y después se
    // leía con los métodos locales—, así que en una máquina en Bogotá un pago
    // del 1 de julio salía como 30 de junio. En producción, que va en UTC, no
    // se veía. Los métodos UTC dan lo mismo en las dos.
    const api = readFileSync(
      join(process.cwd(), 'app', 'api', 'reportes', 'ingresos', 'route.js'), 'utf8')
    const fn = api.slice(api.indexOf('const formatLocalDate'), api.indexOf('export async function GET'))
    expect(fn).toContain('getUTCFullYear')
    expect(fn).toContain('getUTCMonth')
    expect(fn).toContain('getUTCDate')
    expect(fn).not.toMatch(/d\.getFullYear\(\)/)
  })
})

describe('seguros por ruta', () => {
  it('marca la ruta que cobra seguros y no tiene quién los cobre', () => {
    const { filas } = aSeguros({ items: [
      { rutaId: 1, ruta: 'Ruta sur', cobrador: 'Sin cobrador', cantPrestamosConSeguro: 1, totalSeguro: 10000 },
      { rutaId: 2, ruta: 'Ruta norte', cobrador: 'Ana', cantPrestamosConSeguro: 3, totalSeguro: 30000 },
    ], totalGeneral: 40000 })
    expect(filas[0].huerfana).toBe(true)
    expect(filas[0].detalle).toBe('sin cobrador · 1 préstamo')
    expect(filas[1].huerfana).toBe(false)
    expect(filas[1].detalle).toBe('Ana · 3 préstamos')
  })

  it('sin seguros no enseña un total de cero', () => {
    expect(aSeguros({ items: [], totalGeneral: 0 }).total).toBeNull()
    expect(aSeguros(null).filas).toEqual([])
  })
})

describe('cobros del mes', () => {
  const datos = {
    monthLabel: 'Julio 2026',
    totalClientes: 4,
    granTotal: 3478018,
    rutas: [{
      rutaId: 1, ruta: 'Bolivariana', cobrador: 'Carlos', totalRuta: 1212018,
      clientes: [{ id: 9, nombre: 'Carlitos', cuotasMes: 27, totalMes: 468018, saldoPendiente: 553658 }],
    }],
  }

  it('dice cuánto falta para cerrar el mes', () => {
    const r = aCobrosMes(datos, 990008)
    expect(r.total).toBe('$3.478.018')
    expect(r.yaEntro).toBe('$990.008')
    expect(r.falta).toBe('falta $2.488.010')
  })

  it('cobrar de más no es «falta» en negativo', () => {
    // Pasa con los abonos extra y con los préstamos que se saldan antes.
    // «falta -$300.000» se lee como un error de la app.
    const r = aCobrosMes(datos, 3778018)
    expect(r.falta).toBe('entró $300.000 de más')
  })

  it('sin saber lo que entró NO enseña un «ya entró» inventado', () => {
    // Es una pantalla de plata: un hueco es mejor que un número que no sale de
    // ningún sitio.
    const r = aCobrosMes(datos, null)
    expect(r.yaEntro).toBeNull()
    expect(r.falta).toBeNull()
    expect(r.total).toBe('$3.478.018')
  })

  it('singular y plural en clientes, rutas y cuotas', () => {
    const uno = aCobrosMes({
      ...datos, totalClientes: 1,
      rutas: [{ ...datos.rutas[0], clientes: [{ id: 1, nombre: 'A', cuotasMes: 1, totalMes: 1, saldoPendiente: 2 }] }],
    })
    expect(uno.resumenLinea).toBe('1 cliente con cuota este mes · 1 ruta')
    expect(uno.rutas[0].detalle).toBe('Carlos · 1 cliente')
    expect(uno.rutas[0].clientes[0].detalle).toBe('1 cuota · saldo $2')
  })

  it('sin rutas devuelve todo vacío en vez de reventar', () => {
    expect(aCobrosMes(null).rutas).toEqual([])
    expect(aCobrosMes({ rutas: [] }).total).toBeNull()
  })

  it('las filas salen con los campos que el componente pinta', () => {
    const r = aCobrosMes(datos, 990008)
    const cuerpo = fuente.slice(fuente.indexOf('export function CobrosDelMes'))
    for (const campo of ['nombre', 'detalle', 'total']) {
      expect(cuerpo, `el componente no lee r.${campo}`).toContain(`r.${campo}`)
      expect(r.rutas[0]).toHaveProperty(campo)
    }
    for (const campo of ['nombre', 'detalle', 'monto']) {
      expect(cuerpo, `el componente no lee c.${campo}`).toContain(`c.${campo}`)
      expect(r.rutas[0].clientes[0]).toHaveProperty(campo)
    }
  })
})

describe('reglas globales', () => {
  it('no hay emojis', () => {
    expect(fuente).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u)
  })

  it('fuera del bloque carbón todo va por token', () => {
    const sinCarbon = fuente.replace(/const CARBON[^\n]*\n/g, '')
    expect(sinCarbon.match(/#[0-9A-Fa-f]{6}/g) ?? []).toEqual([])
  })

  it('no quedan desplegables nativos sin vestir en la página', () => {
    // Eran tres `<select>` del sistema, distintos en cada teléfono. El único
    // que queda es el de los meses, y lleva su flecha y su caja de la app.
    // Sin comentarios: el que explica por que se fueron los CITA.
    const pagina = readFileSync(
      join(process.cwd(), 'app', '(dashboard)', 'reportes', 'page.jsx'), 'utf8')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    expect((pagina.match(/<select/g) ?? []).length).toBe(0)
  })
})
