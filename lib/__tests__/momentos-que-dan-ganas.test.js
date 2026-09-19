// Prestar, renovar, cargar un cliente y cerrar la caja (19 sep 2026), con el
// lenguaje del cobro aprobado. Aquí se anclan en CÓDIGO las reglas de plata que,
// rotas, harían que la animación mintiera. El gesto y la pantalla se miran con
// playwright en el espejo (`.auditoria/_celebrar-prestamo.mjs`).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
// La fecha la formatea `formatFechaCobroRelativa` (el calendario único); aquí se
// prueba la FRASE del plan, así que la fecha se fija.
vi.mock('@/lib/calculos', () => ({ formatFechaCobroRelativa: () => 'lun 22 sep' }))
import { planDelPrestamo, totalTraeGanancia, cargarCarteraActiva } from '@/lib/prestamo-entregado'

const leer = (f) => readFileSync(path.join(process.cwd(), f), 'utf8')
const sinComentarios = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const NUEVO = sinComentarios(leer('app/(dashboard)/prestamos/nuevo/page.jsx'))
const RENOVAR = sinComentarios(leer('components/prestamos/RenovarPrestamo.jsx'))
const RENOVAR_API = sinComentarios(leer('app/api/prestamos/[id]/renovar/route.js'))
const ENTREGADO = sinComentarios(leer('components/cf/PrestamoEntregado.jsx'))
const CAJA = sinComentarios(leer('app/(dashboard)/caja/page.jsx'))
const CAJA_ENTREGADA = sinComentarios(leer('components/cf/CajaEntregada.jsx'))
const CLIENTES_API = sinComentarios(leer('app/api/clientes/route.js'))

const pesos = (n) => '$' + Math.round(n).toLocaleString('es-CO')

describe('prestar', () => {
  it('los DOS caminos que crean un préstamo pasan por la misma pantalla', () => {
    // El normal y el que primero inyecta capital. Uno solo con pantalla es como
    // se acaba con dos experiencias distintas para lo mismo.
    expect(NUEVO.match(/await alCrear\(data\)/g)).toHaveLength(2)
    expect(NUEVO).not.toMatch(/router\.push\(`\/prestamos\/\$\{data\.id\}\$\{data\.pendienteAprobacion/)
  })

  it('pendiente de aprobación no celebra: aún no se entregó nada', () => {
    expect(NUEVO).toMatch(/if \(data\.pendienteAprobacion\) \{ router\.push\(`\/prestamos\/\$\{data\.id\}`\); return \}/)
  })

  it('un préstamo «en curso» traído del cuaderno no se desliza ni tira billetes', () => {
    expect(NUEVO).toMatch(/paso === PASOS\.length - 1 && tactil && !esEnCurso \?/)
    expect(NUEVO).toMatch(/billetes=\{modo === 'prestamo' && !esEnCurso && cuentaDesembolso\.metodoPago !== 'transferencia'\}/)
  })

  it('la ganancia no se inventa donde el total no la trae', () => {
    // Globo y préstamo abierto: el interés se devenga período a período.
    expect(totalTraeGanancia('solo_interes')).toBe(false)
    expect(totalTraeGanancia('fijo')).toBe(true)
    expect(ENTREGADO).toMatch(/chip=\{conGanancia && ganancia > 0 \?/)
  })

  it('el plan no promete cuotas iguales donde la cuota cambia', () => {
    const lejos = '2026-09-22T05:00:00Z'
    const fijo = planDelPrestamo({ frecuencia: 'diario', modoInteres: 'fijo', cuotasPendientes: 24, cuotaDiaria: 25000, proximoCobro: lejos }, pesos)
    expect(fijo).toBe('24 cuotas diarias de $25.000 · la primera el lun 22 sep.')
    const decreciente = planDelPrestamo({ frecuencia: 'mensual', modoInteres: 'lineal', cuotasPendientes: 6, cuotaDiaria: 120000, proximoCobro: lejos }, pesos)
    expect(decreciente).toBe('La primera cuota se cobra el lun 22 sep: $120.000.')
    expect(decreciente).not.toMatch(/6 cuotas/)
  })
})

describe('la cartera activa', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('es la misma cifra del inicio y se descarta si es más vieja que el préstamo', async () => {
    const creado = Date.parse('2026-09-19T15:00:00Z')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ generatedAt: '2026-09-19T14:00:00Z', prestamos: { saldoPorCobrar: 999 } }) })))
    expect(await cargarCarteraActiva(creado)).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ generatedAt: '2026-09-19T15:00:05Z', prestamos: { saldoPorCobrar: 905538400 } }) })))
    expect(await cargarCarteraActiva(creado)).toBe(905538400)
  })
})

describe('renovar', () => {
  it('el servidor dice qué deuda liquidó y si redondeó el efectivo', () => {
    expect(RENOVAR_API).toMatch(/deudaLiquidada: minimoRenovacion/)
    expect(RENOVAR_API).toMatch(/efectivoRedondeado: diferencia !== diferenciaExacta/)
    expect(RENOVAR_API).toMatch(/renovacionNumero,/)
  })

  it('«debía» es la deuda liquidada, no el saldo; y la cartera sube solo lo nuevo', () => {
    expect(RENOVAR).toMatch(/debia: Math\.round\(renovado\.r\.deudaLiquidada \?\? renovado\.r\.saldoLiquidado \?\? 0\)/)
    expect(RENOVAR).toMatch(/subeCartera=\{Math\.round\(\(renovado\.p\.saldoPendiente \?\? renovado\.p\.totalAPagar\) - \(renovado\.r\.saldoLiquidado \?\? 0\)\)\}/)
  })

  it('solo se desliza si sale efectivo; cambiar el modo no celebra', () => {
    expect(RENOVAR).toMatch(/\(tactil && !soloModo && enMano > 0\) \?/)
    expect(RENOVAR).toMatch(/if \(!soloModo\) \{/)
  })

  it('la suma no se promete exacta: el efectivo va redondeado', () => {
    // «Debía $X + $Y en mano» con un «+» diría que suman el crédito, y con el
    // redondeo al centenar pueden no sumarlo.
    expect(ENTREGADO).not.toMatch(/`Debía \$\{[^`]*\} \+ /)
    expect(ENTREGADO).toMatch(/redondeado a favor del cliente/)
  })
})

describe('cerrar la caja', () => {
  it('se compara con «Te queda en la mano», la foto de antes de guardar', () => {
    expect(CAJA).toMatch(/entregado: totalRecogidoFinal, enLaMano, cobrado: cobradoEfectivoHoy/)
    // Corregir un cierre no es entregar: sin pantalla.
    expect(CAJA).toMatch(/const foto = modoAjusteCierre \? null : \{/)
  })

  it('el sello solo cae si cuadra al peso', () => {
    expect(CAJA_ENTREGADA).toMatch(/const cuadra = !nadaQueEntregar && Math\.round\(entregado\) === Math\.round\(enLaMano\)/)
    expect(CAJA_ENTREGADA).toMatch(/\{cuadra && \(/)
  })

  it('nunca dice que el negocio le debe', () => {
    // La caja no cuenta la base con la que salió el cobrador, y esa base
    // también es del negocio: «el negocio te debe» podría ser mentira.
    expect(CAJA_ENTREGADA).not.toMatch(/te debe/i)
  })
})

describe('cargar clientes', () => {
  it('la API da los recientes sin bajar la cartera entera', () => {
    expect(CLIENTES_API).toMatch(/searchParams\.get\('orden'\) === 'recientes'\s*\?\s*\[\{ createdAt: 'desc' \}\]/)
  })
})
