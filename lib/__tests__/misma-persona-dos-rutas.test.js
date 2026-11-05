import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { casoDeLaCedula, fichasDeLaPersona, chocanEnLaRuta, textoDelChoque } from '@/lib/clientes/misma-persona'
import { perdidosDelCliente } from '@/lib/dinero/cliente-en-perdidos'
import { reporteDe } from '@/lib/reporte-cliente'

const leer = (f) => readFileSync(f, 'utf8')

// PRESTA MIL, 5 nov 2026: un buen cliente de la ruta 1 pide más; se lo presta
// un compañero de la ruta 8, con la MISMA cédula, y los clavos se siguen viendo.

describe('¿qué pasa al registrar una cédula que ya está en el negocio?', () => {
  const fichas = [{ clienteId: 'r1', rutaId: 'ruta1', eliminado: false }]
  it('en otra ruta y paga bien: se registra también en la suya', () => {
    expect(casoDeLaCedula({ fichas, rutaPedida: 'ruta8', rutasDelUsuario: ['ruta8'], pagaMal: false }).caso).toBe('otra')
  })
  it('en otra ruta y paga mal: el cobrador no puede; el dueño sí', () => {
    expect(casoDeLaCedula({ fichas, rutaPedida: 'ruta8', rutasDelUsuario: ['ruta8'], pagaMal: true }).caso).toBe('bloqueada')
    expect(casoDeLaCedula({ fichas, rutaPedida: 'ruta8', esDueno: true, pagaMal: true }).caso).toBe('otra')
  })
  it('ya tiene ficha en esa ruta (o en otra de las del cobrador): no se crea otra', () => {
    expect(casoDeLaCedula({ fichas, rutaPedida: 'ruta1' }).caso).toBe('misma')
    expect(casoDeLaCedula({ fichas, rutaPedida: 'ruta8', rutasDelUsuario: ['ruta8', 'ruta1'] })).toMatchObject({ caso: 'misma', ficha: { clienteId: 'r1' } })
  })
  it('no está en el negocio: nada que decir', () => {
    expect(casoDeLaCedula({ fichas: [], rutaPedida: 'ruta8' }).caso).toBeNull()
  })
})

// Una base falsa: dos fichas de la misma cédula, una por ruta.
function base({ clavoEn = null } = {}) {
  const clientes = [
    { id: 'r1', cedula: '1023456789', rutaId: 'ruta1', nombre: 'Ana Pérez' },
    { id: 'r8', cedula: '1023456789', rutaId: 'ruta8', nombre: 'Ana Pérez' },
    { id: 'otro', cedula: '9998887776', rutaId: 'ruta8', nombre: 'Luis' },
  ]
  const prestamos = clavoEn ? [{ id: 'p', clienteId: clavoEn, esClavo: true, estado: 'activo', totalAPagar: 500000, totalPagado: 100000, clavoAt: '2026-10-01', pagos: [] }] : []
  return {
    cliente: {
      findFirst: async ({ where }) => clientes.find((c) => c.id === where.id) ?? null,
      findMany: async ({ where }) => clientes.filter((c) =>
        (where.cedula == null || (typeof where.cedula === 'string' ? c.cedula === where.cedula : where.cedula.in.includes(c.cedula)))
        && (where.rutaId == null || c.rutaId === where.rutaId)
        && (where.id?.in == null || where.id.in.includes(c.id))
        && (where.id?.notIn == null || !where.id.notIn.includes(c.id))),
    },
    prestamo: { findMany: async ({ where }) => prestamos.filter((p) => where.clienteId.in.includes(p.clienteId)) },
  }
}

describe('los controles miran a la PERSONA, no la ficha', () => {
  it('las fichas de la persona: las dos rutas', async () => {
    expect((await fichasDeLaPersona(base(), { organizationId: 'o', clienteId: 'r8' })).sort()).toEqual(['r1', 'r8'])
  })
  it('⚠ un clavo en la ruta 1 frena el préstamo en la ruta 8', async () => {
    const info = await perdidosDelCliente(base({ clavoEn: 'r1' }), { organizationId: 'o', clienteId: 'r8' })
    expect(info).toMatchObject({ cantidad: 1, saldo: 400000 })
  })
  it('el reporte dice dónde tiene ficha', () => {
    const r = reporteDe({ propio: { calificacion: null, clavosAbiertos: 0, activos: 2, peorAtrasoHoy: 0,
      fichas: [{ ruta: 'RUTA # 1', eliminado: false }, { ruta: 'RUTA # 8', eliminado: false }] } })
    expect(r.propio.map((l) => l.texto)).toContain('Tiene ficha en RUTA # 1 y RUTA # 8')
  })
})

describe('una persona no puede tener dos fichas en la misma ruta', () => {
  it('llevar la ficha de la ruta 8 a la ruta 1 choca, y lo dice con el nombre', async () => {
    const choque = await chocanEnLaRuta(base(), { organizationId: 'o', clienteIds: ['r8'], rutaId: 'ruta1' })
    expect(choque).toEqual(['Ana Pérez'])
    expect(textoDelChoque(choque)).toBe('Ana Pérez ya tiene ficha en esa ruta: una persona no puede tener dos fichas en la misma ruta.')
    expect(await chocanEnLaRuta(base(), { organizationId: 'o', clienteIds: ['otro'], rutaId: 'ruta1' })).toEqual([])
  })
  it('lo preguntan todas las vías que mueven clientes de ruta', () => {
    expect(leer('lib/rutas/fusionar.js')).toMatch(/const chocan = await chocanEnLaRuta\(tx, \{ organizationId, clienteIds: deLaOrigen/)
    expect(leer('app/api/rutas/[id]/clientes/route.js')).toMatch(/const chocan = await chocanEnLaRuta\(prisma, \{ organizationId, clienteIds, rutaId: id \}\)/)
    expect(leer('app/api/prestamos/route.js')).toMatch(/chocanEnLaRuta\(prisma, \{ organizationId, clienteIds: \[clienteId\], rutaId: rutaIdsAsignadas\[0\] \}\)/)
    expect(leer('app/api/clientes/[id]/route.js')).toMatch(/where: \{ organizationId: session\.user\.organizationId, cedula: cedulaFinal, rutaId: rutaFinal, id: \{ not: id \} \}/)
  })
  it('⚠ unir rutas pregunta ANTES de escribir nada', () => {
    const src = leer('lib/rutas/fusionar.js')
    expect(src.indexOf('const chocan = await chocanEnLaRuta(tx')).toBeLessThan(src.indexOf('// 0. Los días sin cobro de cada cliente'))
  })
})

describe('el servidor y la tarjeta deciden con la misma función', () => {
  it('crear cliente y el reporte usan `casoDeLaCedula`', () => {
    expect(leer('app/api/clientes/route.js')).toMatch(/const \{ caso, ficha \} = casoDeLaCedula\(\{/)
    expect(leer('app/api/clientes/reporte/route.js')).toMatch(/const \{ caso, ficha \} = casoDeLaCedula\(\{/)
  })
  it('la cédula es única por ruta en la base', () => {
    const esquema = leer('prisma/schema.prisma')
    const cliente = esquema.slice(esquema.indexOf('model Cliente {'), esquema.indexOf('\n}', esquema.indexOf('model Cliente {')))
    expect(cliente).toMatch(/@@unique\(\[organizationId, cedula, rutaId\]\)/)
    expect(cliente).not.toMatch(/@@unique\(\[organizationId, cedula\]\)/)
  })
  it('al dueño le llega el aviso cuando un cobrador registra a alguien de otra ruta', () => {
    expect(leer('app/api/clientes/route.js')).toMatch(/tipo: 'cliente_en_otra_ruta'/)
  })
})

describe('la tarjeta dice cómo paga con la palabra de su nivel', () => {
  it('ámbar no es «paga mal»', () => {
    const src = leer('components/clientes/ReporteCliente.jsx')
    expect(src).toMatch(/ambar: 'Se atrasa a veces, pero puedes registrarlo también en esta ruta, con la misma cédula\.'/)
    expect(src).toMatch(/rojo: 'Paga mal, pero como administrador puedes registrarlo/)
  })
})
