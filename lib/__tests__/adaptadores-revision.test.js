import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'
import { leerExcel } from '@/lib/importar/excel'
import { repartirReparos, titular, adaptarFila, adaptarRevision, UMBRAL_COLUMNA } from '@/lib/adaptadores/revision'

// El mockup enseña 7 clientes y «revisa los 2 en ámbar». Con el export real de
// 68 créditos, a los 68 les falta la cédula —el sistema de origen no tiene esa
// columna— y «revisa los 68» pinta la lista entera. Una pantalla donde todo
// está marcado es una pantalla donde nada está marcado. Eso es lo que se prueba.

const ARCHIVO = path.join(process.cwd(), 'CF Diseño 2026', 'Docuemntos para prueba',
  'cred-activos-general-7c08518ae74-2026-07-15-16_15_33.328.xlsx')
const hayArchivo = fs.existsSync(ARCHIVO)

const lecturaReal = () => {
  const wb = XLSX.read(fs.readFileSync(ARCHIVO), { type: 'buffer' })
  return leerExcel(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }))
}

const fila = (reparos) => ({ nombre: 'X', reparos: reparos.map((campo) => ({ campo, texto: campo })) })

describe('repartirReparos', () => {
  it('lo que le falta a TODAS las filas es una columna, no 68 errores', () => {
    const filas = Array.from({ length: 10 }, () => fila(['cedula']))
    const { deColumna, porFila } = repartirReparos(filas)
    expect(deColumna).toHaveLength(1)
    expect(deColumna[0].campo).toBe('cedula')
    expect(deColumna[0].texto).toBe('El archivo no trae la cédula')
    expect(porFila).toHaveLength(0)
  })

  it('lo que le falta a algunas sigue siendo problema de esas filas', () => {
    const filas = [...Array.from({ length: 6 }, () => fila(['telefono'])),
                   ...Array.from({ length: 4 }, () => fila([]))]
    const { deColumna, porFila } = repartirReparos(filas)
    expect(deColumna).toHaveLength(0)
    expect(porFila[0]).toMatchObject({ campo: 'telefono', n: 6 })
  })

  it('el umbral está donde dice la constante, no en un número suelto', () => {
    const n = 100
    const justoDebajo = Math.floor(n * UMBRAL_COLUMNA) - 1
    const filas = [...Array.from({ length: justoDebajo }, () => fila(['cedula'])),
                   ...Array.from({ length: n - justoDebajo }, () => fila([]))]
    expect(repartirReparos(filas).deColumna).toHaveLength(0)
  })

  it('sin filas no revienta', () => {
    expect(repartirReparos([])).toEqual({ deColumna: [], porFila: [] })
  })
})

describe('titular', () => {
  it('NO cuenta como «a revisar» lo que le pasa a todo el archivo', () => {
    const filas = Array.from({ length: 68 }, () => fila(['cedula']))
    const t = titular(filas, [{ campo: 'cedula', n: 68 }])
    expect(t.titulo).toBe('Encontré 68 clientes')
    expect(t.aRevisar).toBe(0)
    expect(t.detalle).toBe('No se crea nada hasta que confirmes.')
  })

  it('con dos marcados dice exactamente lo del diseño', () => {
    const filas = [fila(['telefono']), fila(['cuota']), ...Array.from({ length: 5 }, () => fila([]))]
    const t = titular(filas, [])
    expect(t.titulo).toBe('Encontré 7 clientes')
    expect(t.detalle).toBe('Revisa los 2 marcados en ámbar. No se crea nada hasta que confirmes.')
  })

  it('en singular no dice «los 1 marcados»', () => {
    expect(titular([fila(['telefono']), fila([])], []).detalle)
      .toBe('Revisa el marcado en ámbar. No se crea nada hasta que confirmes.')
  })
})

describe('adaptarFila', () => {
  const f = { nombre: 'Carlos Chaparro', cedula: '81283812', frecuencia: 'quincenal', interes: 20, capital: 1_200_000, reparos: [] }

  it('sin reparos, la línea gris son los datos', () => {
    const r = adaptarFila(f, new Set(), (n) => `$${n}`)
    expect(r.contexto).toBe('CC 81283812 · quincenal · 20%')
    expect(r.revisar).toBe(false)
  })

  it('con reparo propio, el problema desplaza al dato', () => {
    const r = adaptarFila({ ...f, reparos: [{ campo: 'telefono', texto: 'Teléfono incompleto' }] }, new Set(), String)
    expect(r.contexto).toBe('Teléfono incompleto')
    expect(r.revisar).toBe(true)
  })

  it('cuando hay varios, manda el de PLATA: un teléfono se pregunta, una cuota mal se cobra mal meses', () => {
    const r = adaptarFila({ ...f, reparos: [
      { campo: 'telefono', texto: 'Teléfono incompleto' },
      { campo: 'cuota', texto: 'Las cuotas no suman el total' },
    ] }, new Set(), String)
    expect(r.contexto).toBe('Las cuotas no suman el total')
  })

  it('un reparo que es de columna NO pinta la fila de ámbar', () => {
    const r = adaptarFila({ ...f, reparos: [{ campo: 'cedula', texto: 'Falta la cédula' }] }, new Set(['cedula']), String)
    expect(r.revisar).toBe(false)
  })
})

describe.skipIf(!hayArchivo)('contra el archivo real de 68 créditos', () => {
  const vista = () => adaptarRevision(lecturaReal(), (n) => `$${Math.round(n).toLocaleString('es-CO')}`)

  it('la cédula se dice UNA vez arriba, no 68 hacia abajo', () => {
    const v = vista()
    expect(v.deColumna.map((c) => c.campo)).toContain('cedula')
    expect(v.filas.filter((f) => f.reparos.some((r) => r.campo === 'cedula'))).toHaveLength(0)
  })

  it('los 44 teléfonos rotos SÍ son problema de sus filas', () => {
    const v = vista()
    expect(v.porFila.find((r) => r.campo === 'telefono')?.n).toBe(44)
  })

  it('quedan 44 para revisar de 68, no 68 de 68', () => {
    const v = vista()
    expect(v.total).toBe(68)
    // 44 teléfonos + 2 descuadres, pero los 2 descuadrados también tienen el
    // teléfono roto, así que no se suman dos veces.
    expect(v.aRevisar).toBeLessThan(68)
    expect(v.aRevisar).toBeGreaterThanOrEqual(44)
  })

  it('Robinson y Omar enseñan el descuadre, no el teléfono', () => {
    const v = vista()
    const malos = v.filas.filter((x) => /Robinson|Omar/.test(x.nombre))
    expect(malos.length).toBeGreaterThanOrEqual(2)
    // Los dos que el lector marca por cuota tienen que decirlo en la tarjeta.
    const conCuota = malos.filter((x) => x.reparos.some((r) => r.campo === 'cuota'))
    expect(conCuota).toHaveLength(2)
    for (const m of conCuota) expect(m.contexto).toBe('Las cuotas no suman el total')
  })

  it('la cartera del pie sale en millones, no en miles', () => {
    expect(vista().cartera).toMatch(/\d{3}\.\d{3}\.\d{3}/)
  })
})
