// lib/__tests__/tarjeta-cliente.test.js — la tarjeta del cliente.
// Spec: docs/superpowers/specs/2026-11-05-tarjeta-del-cliente-design.md

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { generarToken, tokenValido, urlDeTarjeta, OPCIONES_RECIBO } from '@/lib/tarjeta/enlace'
import { primerNombre, armarPrestamo, esRobotDeVistaPrevia, tarjetaDeEjemplo } from '@/lib/tarjeta/datos'
import { validarReclamo, hoyEnElPais, tramoDelDia } from '@/lib/tarjeta/reclamo'
import { pagoLlevaEnlace } from '@/lib/tarjeta/pedir-enlace'
import { generarTextoPlantilla } from '@/lib/whatsapp-plantillas'
import { generarTextoComprobante } from '@/lib/whatsapp'
import { contextoMotor } from '@/lib/adaptadores/plantillas-wa'
import { calcularSaldoPendiente, calcularPorcentajePagado } from '@/lib/calculos'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const sinNotas = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split(/\r?\n/).filter((l) => !l.trim().startsWith('//')).join('\n')

const prestamo = (extra = {}) => ({
  id: 'p1', estado: 'activo', modoInteres: 'fijo', frecuencia: 'diario',
  fechaInicio: new Date('2026-10-01T05:00:00.000Z'), diasPlazo: 30,
  montoPrestado: 100000, totalAPagar: 120000, totalPagado: 24000, cuotaDiaria: 4000,
  cuotasAmortizacion: [], devengos: [],
  pagos: [
    { id: 'a', tipo: 'completo', montoPagado: 20000, fechaPago: new Date('2026-10-10T15:00:00Z'), metodoPago: 'efectivo',
      cobrador: { nombre: 'DIEGO Ríos', rol: 'cobrador' } },
    { id: 'b', tipo: 'parcial', montoPagado: 4000, fechaPago: new Date('2026-10-11T15:00:00Z'), metodoPago: 'transferencia',
      metodoPagoRef: { nombre: 'Nequi' }, cobrador: { nombre: 'Carlos Dueño', rol: 'owner' } },
    { id: 'c', tipo: 'recargo', montoPagado: 1000, fechaPago: new Date('2026-10-12T15:00:00Z') },
  ],
  ...extra,
})

describe('el enlace', () => {
  it('no se adivina: 144 bits y sin datos del cliente', () => {
    const t = generarToken()
    expect(t).toHaveLength(24)
    expect(tokenValido(t)).toBe(true)
    expect(generarToken()).not.toBe(t)
  })
  it('lo que no tiene su forma ni se busca en la base', () => {
    for (const malo of ['', null, undefined, 'ejemplo', 'a'.repeat(23), 'a'.repeat(25), `${'a'.repeat(23)}'`]) {
      expect(tokenValido(malo)).toBe(false)
    }
  })
  it('arma la dirección sin doble barra', () => {
    expect(urlDeTarjeta('abc', 'https://app.ejemplo.com/')).toBe('https://app.ejemplo.com/t/abc')
  })
  it('un pago sin señal no lleva enlace', () => {
    expect(pagoLlevaEnlace({ offline: true })).toBe(false)
    expect(pagoLlevaEnlace(null)).toBe(false)
    expect(pagoLlevaEnlace({ id: 'x' })).toBe(true)
  })
  it('el ajuste solo acepta las tres opciones', () => {
    expect(OPCIONES_RECIBO).toEqual(['tarjeta', 'comprobante', 'nada'])
    expect(sinNotas(leer('app/api/configuracion/organizacion/route.js'))).toContain('OPCIONES_RECIBO.includes(reciboCliente)')
  })
})

describe('pedir el enlace desde la pantalla', () => {
  it('⚠ el enlace pedido de antemano no se vuelve a pedir al confirmar', async () => {
    const { pedirEnlaceTarjeta } = await import('@/lib/tarjeta/pedir-enlace')
    const real = globalThis.fetch
    const llamadas = []
    globalThis.fetch = vi.fn(async (u) => { llamadas.push(u); return { ok: true, json: async () => ({ url: 'https://x/t/abc' }) } })
    try {
      expect(await pedirEnlaceTarjeta('cli-recuerda')).toBe('https://x/t/abc')
      expect(await pedirEnlaceTarjeta('cli-recuerda')).toBe('https://x/t/abc')
      expect(llamadas).toHaveLength(1)
    } finally { globalThis.fetch = real }
  })
  it('⚠ el recibo no espera a una red lenta, y el enlace queda para el siguiente', async () => {
    const { pedirEnlaceTarjeta } = await import('@/lib/tarjeta/pedir-enlace')
    const real = globalThis.fetch
    let soltar
    globalThis.fetch = vi.fn(() => new Promise((r) => { soltar = r }))
    try {
      expect(await pedirEnlaceTarjeta('cli-lento', { espera: 5 })).toBeNull()
      soltar({ ok: true, json: async () => ({ url: 'https://x/t/lento' }) })
      await new Promise((r) => setTimeout(r, 5))
      expect(await pedirEnlaceTarjeta('cli-lento', { espera: 5 })).toBe('https://x/t/lento')
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    } finally { globalThis.fetch = real }
  })
  it('un fallo no se recuerda y no detiene el recibo', async () => {
    const { pedirEnlaceTarjeta } = await import('@/lib/tarjeta/pedir-enlace')
    const real = globalThis.fetch
    let n = 0
    globalThis.fetch = vi.fn(async () => { n++; if (n === 1) throw new Error('sin red'); return { ok: true, json: async () => ({ url: 'https://x/t/def' }) } })
    try {
      expect(await pedirEnlaceTarjeta('cli-falla')).toBeNull()
      expect(await pedirEnlaceTarjeta('cli-falla')).toBe('https://x/t/def')
    } finally { globalThis.fetch = real }
  })
  it('sin red, ni lo intenta', async () => {
    const { pedirEnlaceTarjeta } = await import('@/lib/tarjeta/pedir-enlace')
    const real = globalThis.fetch
    const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true })
    globalThis.fetch = vi.fn()
    try {
      expect(await pedirEnlaceTarjeta('cli-sin-red')).toBeNull()
      expect(globalThis.fetch).not.toHaveBeenCalled()
    } finally {
      globalThis.fetch = real
      if (nav) Object.defineProperty(globalThis, 'navigator', nav); else delete globalThis.navigator
    }
  })
})

describe('lo que muestra', () => {
  it('el saldo y el progreso son los de la ficha, no una resta propia', () => {
    const p = prestamo()
    const t = armarPrestamo(p)
    expect(t.saldo).toBe(calcularSaldoPendiente(p))
    expect(t.porcentaje).toBe(calcularPorcentajePagado(p))
    expect(t.yaPagado).toBe(24000) // sin el recargo, como la ficha
  })
  it('con «Ocultar saldo» no sale ni saldo ni barra, sí los pagos', () => {
    const t = armarPrestamo(prestamo(), { ocultarSaldo: true })
    expect(t.saldo).toBeNull()
    expect(t.porcentaje).toBeNull()
    expect(t.pagos).toHaveLength(3)
    expect(t.yaPagado).toBe(24000)
  })
  it('el recargo sale con su nombre y su signo', () => {
    const r = armarPrestamo(prestamo()).pagos.find((x) => x.id === 'c')
    expect(r.signo).toBe('+')
    expect(r.titulo).toBe('Recargo por mora')
  })
  it('dice quién recibió solo si es cobrador; el dueño va como el negocio', () => {
    const pagos = armarPrestamo(prestamo()).pagos
    expect(pagos.find((x) => x.id === 'a').recibio).toBe('Diego')
    expect(pagos.find((x) => x.id === 'b').recibio).toBeNull()
    expect(pagos.find((x) => x.id === 'b').medio).toBe('Nequi')
  })
  it('un crédito terminado dice pagado, sin próxima cuota ni atraso', () => {
    const t = armarPrestamo(prestamo({ estado: 'completado' }))
    expect(t.pagado).toBe(true)
    expect(t.proxima).toBeNull()
    expect(t.diasMora).toBe(0)
  })
  it('⚠ no lleva tasa, monto prestado, cédula ni teléfono', () => {
    const texto = JSON.stringify(armarPrestamo(prestamo({ tasaInteres: 20, cedula: '123', telefono: '300' })))
    for (const campo of ['tasaInteres', 'montoPrestado', 'totalAPagar', 'cedula', 'telefono', 'direccion']) {
      expect(texto).not.toContain(campo)
    }
    const src = sinNotas(leer('lib/tarjeta/datos.js'))
    const seleccion = src.slice(src.indexOf('prisma.cliente.findUnique'), src.indexOf('const org = cliente'))
    for (const campo of ['cedula', 'telefono', 'direccion']) expect(seleccion).not.toContain(campo)
  })
  it('el primer nombre, sin el número de la ruta', () => {
    expect(primerNombre('01 ROSWYN SÁNCHEZ')).toBe('Roswyn')
    expect(primerNombre('  maría  josé')).toBe('María')
    expect(primerNombre(null)).toBe('')
  })
  it('el robot de la vista previa no cuenta como apertura', () => {
    expect(esRobotDeVistaPrevia('WhatsApp/2.23')).toBe(true)
    expect(esRobotDeVistaPrevia('facebookexternalhit/1.1')).toBe(true)
    expect(esRobotDeVistaPrevia('Mozilla/5.0 (Linux; Android 13)')).toBe(false)
  })
  it('el ejemplo no tiene de dónde mandar un aviso', () => {
    expect(tarjetaDeEjemplo().ejemplo).toBe(true)
    expect(sinNotas(leer('app/t/[token]/page.jsx'))).toContain('tarjeta={tarjetaDeEjemplo()} token={null}')
  })
})

describe('el mensaje', () => {
  const URL_T = 'https://app.ejemplo.com/t/abc'
  const ctx = (extra = {}) => contextoMotor({
    cliente: { nombre: 'Ana' }, prestamo: { saldoPendiente: 100, totalPagado: 50, totalAPagar: 150 },
    pago: { montoPagado: 50, fechaPago: '2026-11-05T15:00:00Z' }, orgNombre: 'Negocio', ocultarSaldo: false, ...extra,
  })
  it('sin enlace, el recibo es el de siempre', () => {
    expect(generarTextoPlantilla('pago_confirmacion', ctx(), 'org-sin-config')).not.toContain('/t/')
  })
  it('con enlace, lo lleva antes de la firma', () => {
    const t = generarTextoPlantilla('pago_confirmacion', ctx({ tarjetaUrl: URL_T }), 'org-sin-config')
    expect(t).toContain(URL_T)
    expect(t.indexOf(URL_T)).toBeLessThan(t.indexOf('Negocio'))
  })
  it('con «Ocultar saldo» no promete lo que falta', () => {
    const t = generarTextoPlantilla('pago_confirmacion', ctx({ tarjetaUrl: URL_T, ocultarSaldo: true }), 'org-sin-config')
    expect(t).toContain('Mira tus pagos aquí')
    expect(t).not.toContain('lo que te falta')
  })
  it('la vía vieja también lo lleva', () => {
    const t = generarTextoComprobante({ nombre: 'Ana' }, { totalPagado: 1, saldoPendiente: 1 }, { montoPagado: 1, fechaPago: new Date() }, { orgNombre: 'N', tarjetaUrl: URL_T })
    expect(t).toContain(URL_T)
  })
  it('⚠ la sección va bloqueada: las secciones guardadas de antes no la apagan', () => {
    const src = sinNotas(leer('lib/whatsapp-plantillas.js'))
    expect(src).toMatch(/key: 'tarjeta'[^\n]*locked: true/)
  })
  it('las vías del recibo la usan', () => {
    for (const f of ['components/whatsapp/HojaWhatsApp.jsx', 'components/ui/BotonWhatsApp.jsx', 'components/prestamos/RegistrarPago.jsx']) {
      expect(sinNotas(leer(f)), f).toMatch(/useEnlaceTarjeta\(/)
    }
    expect(sinNotas(leer('components/ui/BotonCompartir.jsx'))).toMatch(/pedirEnlaceTarjeta\(/)
    expect(sinNotas(leer('app/api/asistente/accion/route.js'))).toMatch(/tarjetaUrl/)
  })
})

describe('«nada» esconde todas las vías', () => {
  it.each([
    ['components/ui/BotonWhatsApp.jsx', "reciboCliente === 'nada') return null"],
    ['components/ui/BotonCompartir.jsx', "reciboCliente === 'nada') return null"],
    ['components/ui/BotonCompartirRecibo.jsx', "reciboCliente === 'nada') return null"],
    ['components/prestamos/RegistrarPago.jsx', "onRecibo={reciboCliente === 'nada' ? null : cambiarRecibo}"],
    ['components/prestamos/RegistrarPago.jsx', "onWhatsApp={reciboCliente === 'nada' ? null :"],
    ['components/prestamos/RegistrarPago.jsx', "sinCompartir={reciboCliente === 'nada'}"],
    ['app/(dashboard)/rutas/[id]/page.jsx', "onWhatsApp={reciboCliente === 'nada' ? null :"],
    ['app/(dashboard)/rutas/[id]/page.jsx', "sinCompartir={reciboCliente === 'nada'}"],
    ['app/(dashboard)/prestamos/[id]/page.jsx', "cliente?.telefono && reciboCliente !== 'nada'"],
    ['components/pantallas/Recibo.jsx', '{onWhatsApp && <button'],
  ])('%s', (f, anclaje) => {
    expect(sinNotas(leer(f))).toContain(anclaje)
  })
})

describe('«pagué y no aparece»', () => {
  const ahora = Date.parse('2026-11-05T20:00:00Z')
  const ok = (b) => validarReclamo(b, { offsetHoras: -5, ahora })
  it('acepta sin valor y guarda el día a mediodía', () => {
    const r = ok({ monto: null, fecha: '2026-11-04', nota: '  hola ' })
    expect(r.monto).toBeNull()
    expect(r.fecha.toISOString()).toBe('2026-11-04T12:00:00.000Z')
    expect(r.nota).toBe('hola')
  })
  it('rechaza lo que no cuadra', () => {
    for (const b of [null, 'x', { fecha: '' }, { fecha: '2026-13-40' }, { fecha: '2026-02-31' }, { fecha: '2026-11-06' },
      { fecha: '2026-01-01' }, { fecha: '2026-11-05', monto: -5 }, { fecha: '2026-11-05', monto: 'abc' }, { fecha: '2026-11-05', monto: 1e13 }]) {
      expect(ok(b).error, JSON.stringify(b)).toBeTruthy()
    }
  })
  it('recorta la nota y le quita los saltos', () => {
    expect(ok({ fecha: '2026-11-05', nota: `a\nb${'x'.repeat(300)}` }).nota).toHaveLength(200)
  })
  it('«hoy» es el del país, no el de UTC', () => {
    expect(hoyEnElPais(-5, Date.parse('2026-11-06T03:00:00Z'))).toBe('2026-11-05')
  })
  it('el día se mide en la hora del país', () => {
    const { desde, hasta } = tramoDelDia(new Date('2026-11-04T12:00:00Z'), -5)
    expect(desde.toISOString()).toBe('2026-11-04T05:00:00.000Z')
    expect(hasta.toISOString()).toBe('2026-11-05T05:00:00.000Z')
  })
  it('⚠ el aviso va a los dueños y la fila solo se le arma al dueño', () => {
    expect(sinNotas(leer('app/api/tarjeta/reclamo/[token]/route.js'))).toContain("para: 'owners'")
    expect(sinNotas(leer('app/api/notificaciones/pendientes/route.js'))).toMatch(/rol !== 'owner'\) return Response\.json\(\{ pendientes: \[\] \}\)/)
    expect(sinNotas(leer('app/api/tarjeta/reclamo-revisado/[id]/route.js'))).toMatch(/rol !== 'owner'/)
  })
})

describe('la página no le entrega el enlace a nadie', () => {
  it('⚠ en /t/* el layout no carga Google ni Meta', () => {
    const src = sinNotas(leer('app/layout.js'))
    const rama = src.slice(src.indexOf("get('x-cf-publica')"), src.indexOf('const session = await getServerSession'))
    expect(rama).toContain('{children}')
    for (const prohibido of ['googletagmanager', 'fbq', 'SessionProvider', 'OfflineProvider', 'SCRIPT_CAPTURA_INSTALAR']) {
      expect(rama).not.toContain(prohibido)
    }
    expect(src.indexOf("get('x-cf-publica')")).toBeLessThan(src.indexOf('googletagmanager'))
  })
  it('el middleware la marca y pone las cabeceras', () => {
    // Sin `sinNotas`: el `/t/*` de un comentario de línea se le lee como apertura de bloque.
    const src = leer('middleware.js')
    expect(src).toMatch(/^\s+'\/t\/:path\*',$/m)
    expect(src).toMatch(/cabeceras\.set\('x-cf-publica', '1'\)/)
    for (const c of ["'x-cf-publica'", "'Referrer-Policy', 'no-referrer'", "'X-Robots-Tag', 'noindex, nofollow'", "'Cache-Control', 'no-store'"]) {
      expect(src).toContain(c)
    }
  })
  it('el service worker no se mete', () => {
    const src = leer('public/sw.js')
    expect(src.slice(src.indexOf('const AUTH_SKIP'), src.indexOf(']', src.indexOf('const AUTH_SKIP')))).toContain("'/t/'")
  })
  it('la vista previa no lleva ni la deuda ni el nombre del cliente', () => {
    const src = sinNotas(leer('app/t/[token]/page.jsx'))
    const meta = src.slice(src.indexOf('generateMetadata'), src.indexOf('export default'))
    expect(meta).toContain('images: []')
    expect(meta).toContain('robots: ROBOTS')
    for (const p of ['saldo', 'tarjetaPorToken', 'cliente.nombre']) expect(meta).not.toContain(p)
  })
  it('el pie dice lo que es el software', () => {
    expect(sinNotas(leer('components/tarjeta/TarjetaCliente.jsx'))).toContain('Software de gestión: Control Finanzas · no presta dinero ni realiza cobros')
  })
  it('un negocio nuevo arranca con la tarjeta; la columna no enciende a nadie', () => {
    expect(sinNotas(leer('app/api/auth/registro/route.js'))).toContain("reciboCliente: 'tarjeta'")
    expect(leer('prisma/schema.prisma')).toMatch(/reciboCliente\s+String\s+@default\("comprobante"\)/)
  })
  it('a quien oculta el saldo no se le ofrece', () => {
    expect(sinNotas(leer('app/api/tarjeta/aviso/route.js'))).toContain('!org.ocultarSaldoWA')
  })
})
