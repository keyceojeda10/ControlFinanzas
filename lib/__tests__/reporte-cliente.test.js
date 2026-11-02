import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { reporteDe, CABECERA } from '@/lib/reporte-cliente'
import { calificacionDe } from '@/lib/calificacion'

const leer = (f) => readFileSync(f, 'utf8')
const propio = (o = {}) => ({ calificacion: null, clavosAbiertos: 0, activos: 0, peorAtrasoHoy: 0, ...o })
const otros = (o = {}) => ({ negocios: 1, pagados: 0, alDia: 0, atrasados: 0, peorAtrasoHoy: 0, clavos: 0, ...o })

describe('el reporte de una cédula: gana lo peor de las dos preguntas', () => {
  it('⚠ sin historial es «nuevo», nunca «verde»: no saber nada no es pagar bien', () => {
    expect(reporteDe({}).nivel).toBe('nuevo')
    expect(reporteDe({ propio: propio(), otros: otros({ negocios: 0 }) }).nivel).toBe('nuevo')
    expect(reporteDe({}).pastilla).toBe('Sin historial')
  })

  it('en tu negocio: un clavo abierto es alto riesgo aunque la estrella diga verde', () => {
    const verde = calificacionDe({ terminados: 4, clavos: 0, peorRetraso: 2 })
    const r = reporteDe({ propio: propio({ calificacion: verde, clavosAbiertos: 1 }) })
    expect(r.nivel).toBe('rojo')
    expect(r.titulo).toBe(CABECERA.rojo.titulo)
    expect(r.propio[0]).toEqual({ tono: 'rojo', texto: 'Tiene 1 préstamo marcado como clavo' })
  })

  it('el atraso de hoy usa los umbrales de la estrella: 7 y 30 días', () => {
    expect(reporteDe({ propio: propio({ activos: 1, peorAtrasoHoy: 3 }) }).nivel).toBe('nuevo')
    expect(reporteDe({ propio: propio({ activos: 1, peorAtrasoHoy: 12 }) }).nivel).toBe('ambar')
    expect(reporteDe({ propio: propio({ activos: 1, peorAtrasoHoy: 45 }) }).propio[0]).toEqual({ tono: 'rojo', texto: 'Hoy va 45 días atrasado' })
  })

  it('corregida a mano: dice quién y qué decía el sistema, de corrido', () => {
    const c = calificacionDe({ terminados: 3, clavos: 1, peorRetraso: 0, manual: 'ambar' })
    expect(reporteDe({ propio: propio({ calificacion: c, calificacionPor: 'Carlos' }) }).propio[0].texto)
      .toBe('Se atrasa: según Carlos (el sistema decía «Mal cliente») · 3 préstamos terminados')
  })

  it('la estrella entra con su propio texto, y si se puso a mano lo dice', () => {
    const mano = calificacionDe({ terminados: 0, manual: 'rojo' })
    const r = reporteDe({ propio: propio({ calificacion: mano, calificacionPor: 'Carlos' }) })
    expect(r.nivel).toBe('rojo')
    expect(r.propio[0].texto).toBe('Mal cliente: según Carlos')
  })

  it('buen cliente en tu negocio y nada en otros: verde', () => {
    const verde = calificacionDe({ terminados: 3, clavos: 0, peorRetraso: 0 })
    const r = reporteDe({ propio: propio({ calificacion: verde }), otros: otros({ negocios: 0 }) })
    expect(r.nivel).toBe('verde')
    expect(r.propio[0].texto).toBe('Buen cliente: terminó lo que debía sin atrasarse · 3 préstamos terminados')
  })

  it('en otros negocios: el clavo pesa; un día de atraso, no (antes bastaba para «Alto riesgo»)', () => {
    expect(reporteDe({ otros: otros({ clavos: 2 }) }).nivel).toBe('rojo')
    expect(reporteDe({ otros: otros({ alDia: 1 }) }).nivel).toBe('nuevo')
    expect(reporteDe({ otros: otros({ atrasados: 1, peorAtrasoHoy: 40 }) }).otros[0].texto).toBe('1 préstamo atrasado, el peor con 40 días')
    expect(reporteDe({ otros: otros({ pagados: 2 }) }).nivel).toBe('verde')
  })

  it('el plan sin otros negocios no inventa nada de ellos', () => {
    expect(reporteDe({ propio: propio(), otros: null }).otros).toEqual([])
  })
})

describe('el reporte está donde se decide prestar', () => {
  it('la ficha, «nuevo cliente» y «nuevo préstamo» pintan la misma pieza', () => {
    expect(leer('app/(dashboard)/clientes/[id]/page.jsx')).toMatch(/<ReporteCliente clienteId=\{cliente\.id\} contexto="ficha"/)
    expect(leer('components/clientes/ClienteForm.jsx')).toMatch(/<ReporteCliente cedula=\{form\.cedula\} contexto="nuevo-cliente"/)
    expect(leer('app/(dashboard)/prestamos/nuevo/page.jsx')).toMatch(/<ReporteCliente clienteId=\{clienteSeleccionado\.id\} contexto="prestamo"/)
  })
  it('en la ficha va antes de Lucas: si Lucas ofrece «Prestarle $X», el riesgo se lee primero', () => {
    const src = leer('app/(dashboard)/clientes/[id]/page.jsx')
    expect(src.indexOf('<ReporteCliente clienteId={cliente.id}')).toBeGreaterThan(-1)
    expect(src.indexOf('<ReporteCliente clienteId={cliente.id}')).toBeLessThan(src.indexOf('<LucasSugiere'))
  })
  it('el tope va por usuario y no por IP: 10 por hora lo dejaba mudo', () => {
    const src = leer('app/api/clientes/reporte/route.js')
    expect(src).toMatch(/reporteLimiter\(session\.user\.id\)/)
  })
  it('«¿nos va a notificar?»: el cobrador que se topa con una cédula de otra ruta le avisa al dueño', () => {
    const api = leer('app/api/clientes/reporte/route.js')
    expect(api).toMatch(/export async function POST\(req\)/)
    expect(api).toMatch(/tipo: 'cliente_ya_registrado'/)
    // una vez al día por cobrador y cliente
    expect(api).toMatch(/accion: 'aviso_cliente_ya_registrado', entidadId: clienteId, createdAt: \{ gte: inicio \}/)
    const tarjeta = leer('components/clientes/ReporteCliente.jsx')
    expect(tarjeta).toMatch(/>\s*\{aviso === 'enviando' \? 'Avisando…' : 'Avisarle al administrador'\}/)
    expect(tarjeta).toMatch(/href=\{`\/prestamos\/nuevo\?clienteId=\$\{existente\.id\}`\}/)
  })
  it('de otros negocios no sale ni el nombre ni la plata', () => {
    const src = leer('app/api/clientes/reporte/route.js')
    expect(src).not.toMatch(/organizationId: datos\.otros/)
    const consulta = leer('lib/reporte-cedula.js')
    const otros = consulta.slice(consulta.indexOf('async function lodeOtros'), consulta.indexOf('export async function datosDelReporte'))
    expect(otros).not.toMatch(/nombre: true/)
  })
})
