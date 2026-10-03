import { describe, it, expect } from 'vitest'
import { anotarLlegadas, vieneDePorCliente, compararProcedencias } from '@/lib/rutas/procedencia'

/* «Saber que este cliente era de la ruta 10, y si la ruta 9 no está rindiendo
 *  lo suficientemente bien a partir de que le unieron la ruta 10, entonces no
 *  era la ruta o el cobrador como tal, sino eran las personas.» — el dueño,
 *  3 oct 2026. */

describe('anotar de dónde llega cada cliente', () => {
  it('solo los que vienen DE otra ruta, en un solo INSERT', async () => {
    const llamadas = []
    const tx = { cambioRuta: { createMany: async ({ data }) => { llamadas.push(data); return { count: data.length } } } }
    const n = await anotarLlegadas(tx, {
      organizationId: 'org', aRutaId: 'r9', motivo: 'lote', usuarioId: 'u',
      clientes: [
        { id: 'a', rutaId: 'r10', rutaNombre: 'Ruta 10' },
        { id: 'b', rutaId: null },            // sin ruta: no viene de ninguna
        { id: 'c', rutaId: 'r9' },            // ya estaba: no es un cambio
      ],
    })
    expect(n).toBe(1)
    expect(llamadas).toHaveLength(1)
    expect(llamadas[0]).toEqual([{ organizationId: 'org', clienteId: 'a', deRutaId: 'r10', deRutaNombre: 'Ruta 10', aRutaId: 'r9', motivo: 'lote', usuarioId: 'u' }])
  })

  it('sin nadie que anotar no escribe nada', async () => {
    const tx = { cambioRuta: { createMany: async () => { throw new Error('no debía escribir') } } }
    expect(await anotarLlegadas(tx, { organizationId: 'org', aRutaId: 'r9', motivo: 'manual', clientes: [{ id: 'a', rutaId: null }] })).toBe(0)
  })
})

describe('de dónde llegó cada uno', () => {
  it('manda la última vez que entró a esta ruta', () => {
    const m = vieneDePorCliente([
      { clienteId: 'a', deRutaId: 'r3', deRutaNombre: 'Ruta 3', createdAt: '2026-09-01T10:00:00Z' },
      { clienteId: 'a', deRutaId: 'r10', deRutaNombre: 'Ruta 10', createdAt: '2026-10-05T10:00:00Z' },
    ])
    expect(m.get('a')).toEqual({ rutaId: 'r10', nombre: 'Ruta 10', desde: '2026-10-05T10:00:00.000Z' })
  })
})

describe('la comparación de la ruta', () => {
  const cli = (id, x = {}) => ({ id, conDeuda: true, diasMora: 0, atraso: 0, cartera: 100000, cuotasPagadas: 10, cuotasVencidas: 10, ...x })

  it('sin nadie que haya llegado de otra ruta no hay nada que comparar', () => {
    expect(compararProcedencias([cli('a'), cli('b')], new Map())).toBeNull()
  })

  it('los que llegaron contra los propios, con las mismas cuentas de la ruta', () => {
    const vieneDe = new Map([
      ['x', { rutaId: 'r10', nombre: 'Ruta 10', desde: '2026-10-05T10:00:00.000Z' }],
      ['y', { rutaId: 'r10', nombre: 'Ruta 10', desde: '2026-10-05T10:00:00.000Z' }],
    ])
    const [diez, propios] = compararProcedencias([
      cli('a'), cli('b', { diasMora: 3, atraso: 20000 }), cli('c', { conDeuda: false, cartera: 0 }),
      // Los de la 10: uno muy atrasado. El cumplimiento suma CUOTAS, no
      // promedia porcentajes: 2 de 4 y 30 de 40 dan 32/44 = 73 %, no 62 %.
      cli('x', { diasMora: 12, atraso: 90000, cuotasPagadas: 2, cuotasVencidas: 4 }),
      cli('y', { cuotasPagadas: 30, cuotasVencidas: 40 }),
    ], vieneDe)
    expect(diez).toMatchObject({ clave: 'r10', nombre: 'Ruta 10', clientes: 2, conDeuda: 2, alDia: 1, atrasados: 1, pctAtrasados: 50, cumplimiento: 73, atraso: 90000, cartera: 200000 })
    // El que no debe nada cuenta como cliente, pero no como al día ni atrasado.
    expect(propios).toMatchObject({ clave: 'propios', nombre: null, clientes: 3, conDeuda: 2, alDia: 1, atrasados: 1, pctAtrasados: 50, cumplimiento: 100, atraso: 20000, cartera: 200000 })
  })

  it('sin cuotas vencidas el cumplimiento es null, no 0 % ni 100 %', () => {
    const vieneDe = new Map([['x', { rutaId: 'r10', nombre: 'Ruta 10', desde: '2026-10-05T10:00:00.000Z' }]])
    const [diez] = compararProcedencias([cli('x', { cuotasPagadas: 0, cuotasVencidas: 0 })], vieneDe)
    expect(diez.cumplimiento).toBeNull()
  })
})

import { readFileSync } from 'fs'
import { resolve } from 'path'
const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('las tres vías que mueven a un cliente de ruta lo anotan', () => {
  it('unir rutas, antes de moverlos', () => {
    const src = leer('lib/rutas/fusionar.js')
    expect(src).toMatch(/await anotarLlegadas\(tx, \{\s*organizationId, aRutaId: destinoId, motivo: 'union'/)
    expect(src.indexOf("motivo: 'union'")).toBeLessThan(src.indexOf('UPDATE Cliente c'))
  })
  it('«Agregar clientes», en la misma transacción', () => {
    expect(leer('app/api/rutas/[id]/clientes/route.js')).toMatch(/await anotarLlegadas\(tx, \{\s*organizationId, aRutaId: id, motivo: 'lote'/)
  })
  it('el cambio de ruta en la ficha, en la misma transacción que el cambio', () => {
    const src = leer('app/api/clientes/[id]/route.js')
    expect(src).toMatch(/prisma\.\$transaction\(async \(tx\) => \{\s*const fila = await tx\.cliente\.update/)
    expect(src).toMatch(/await anotarLlegadas\(tx, \{[\s\S]{0,120}motivo: 'manual'/)
  })
})

describe('se ve donde hace falta', () => {
  it('la ficha de la ruta manda la procedencia y la comparación, esta solo a quien ve capital', () => {
    const src = leer('app/api/rutas/[id]/route.js')
    expect(src).toMatch(/vieneDe: vieneDe\.get\(c\.id\) \?\? null,/)
    expect(src).toMatch(/procedencias: puedeVerCapital \? compararProcedencias\(cifrasProcedencia, vieneDe\) : null,/)
  })
  it('la ficha del cliente dice de dónde viene', () => {
    expect(leer('app/api/clientes/[id]/route.js')).toMatch(/vieneDe: vieneDePorCliente\(llegadas\)\.get\(id\) \?\? null,/)
    expect(leer('components/clientes/ClienteHeroCard.jsx')).toMatch(/\{cliente\?\.vieneDe && \(/)
  })
  it('la ruta pinta el bloque en el teléfono y en el PC, y el filtro vale para las dos listas', () => {
    const pagina = leer('app/(dashboard)/rutas/[id]/page.jsx')
    expect(pagina.match(/<ProcedenciaRuta grupos=\{ruta\.procedencias\}/g)).toHaveLength(2)
    expect(pagina).toMatch(/let list = \(ruta\?\.clientes \?\? \[\]\)\.filter\(enProcedencia\)/)
    expect(pagina).toMatch(/\)\.filter\(enProcedencia\)\.map\(\(c, i\) => \(\{/)
    // `enProcedencia` se declara ANTES de usarse (un const leído antes tumba la pantalla).
    expect(pagina.indexOf('const enProcedencia')).toBeLessThan(pagina.indexOf('.filter(enProcedencia)'))
    expect(leer('components/pantallas/RutaEscritorio.jsx')).toMatch(/<Bloque rotulo="De dónde vienen sus clientes">\{procedencia\}<\/Bloque>/)
  })
})
