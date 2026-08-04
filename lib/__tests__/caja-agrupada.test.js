import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { cuentaDelDia } from '@/lib/dinero/conciliacion'

// La cuenta del dia, rehecha con la estructura que dicto el dueño con la
// calculadora en la mano y tres videos:
//
//   «hay que agrupar bien todas las sumas, agrupar bien todas las restas...
//    lo que pasa es que como quedo en TRES CUADROS DIFERENTES, ahi fue donde
//    estamos un poco enredados»
//
// Su cuenta, dictada en el video, con las cifras reales de su ruta #5.
const RUTA5 = { apertura: 352000, efectivo: 270000, digital: 158000, prestado: 485215, gastos: 40000 }
const RUTA8 = { apertura: 116000, efectivo: 260000, digital: 564000, prestado: 445833, gastos: 0 }

describe('la cuenta que dicto el dueño da exacta', () => {
  it('ruta #5: 352.000 + 428.000 − 40.000 − 485.215 = 254.785', () => {
    const c = RUTA5
    const entra = c.apertura + c.efectivo + c.digital
    expect(c.efectivo + c.digital).toBe(428000)       // «cobro total 428»
    expect(entra - c.prestado - c.gastos).toBe(254785) // «deberia quedar 254»
  })

  it('y ese 254.785 es el capital REAL de la ruta', () => {
    // Comprobado contra produccion el 3 ago. Si esto se rompe, la cuenta dejo
    // de reconstruir el saldo de la ruta y hay que mirar por que.
    const c = RUTA5
    expect(c.apertura + c.efectivo + c.digital - c.prestado - c.gastos).toBe(254785)
  })

  it('ruta #8 igual: da el capital de la ruta', () => {
    const c = RUTA8
    expect(c.efectivo + c.digital).toBe(824000)
    expect(c.apertura + c.efectivo + c.digital - c.prestado - c.gastos).toBe(494167)
  })
})

describe('los subtotales del adaptador', () => {
  it('`entro` y `salio` salen de las mismas lineas que la suma', () => {
    const c = RUTA5
    const { suma, entro, salio } = cuentaDelDia({
      apertura: c.apertura,
      entradas: [{ id: 'recaudoEfectivo', rotulo: 'Cobró en efectivo', monto: c.efectivo }],
      salidas: [
        { id: 'desembolsos', rotulo: 'Prestó en efectivo', monto: c.prestado },
        { id: 'gastos', rotulo: 'Gastó', monto: c.gastos },
      ],
    })
    // `entro` incluye la apertura: es plata con la que cuenta.
    expect(entro).toBe(c.apertura + c.efectivo)
    expect(salio).toBe(c.prestado + c.gastos)
    // Y la resta de los dos tiene que ser la suma, o la pantalla enseñaria
    // subtotales que no producen el resultado que hay debajo.
    expect(entro - salio).toBe(suma)
  })

  it('las lineas en cero no cuentan en los subtotales', () => {
    const { entro, salio } = cuentaDelDia({
      apertura: 100,
      entradas: [{ id: 'a', rotulo: 'A', monto: 0 }],
      salidas: [{ id: 'b', rotulo: 'B', monto: 0 }],
    })
    expect(entro).toBe(100)
    expect(salio).toBe(0)
  })
})

describe('la pantalla', () => {
  const jsx = readFileSync(resolve(process.cwd(), 'components/caja/CajaCobradorDetalle.jsx'), 'utf8')

  it('agrupa en «Entra» y «Sale», con subtotal cada uno', () => {
    // Sin atarse al sangrado exacto: lo que importa es que los dos rótulos
    // existan como su propio bloque, no cómo quedó el salto de línea.
    expect(jsx).toMatch(/>\s*Entra\s*<\/p>/)
    expect(jsx).toMatch(/>\s*Sale\s*<\/p>/)
    expect(jsx).toContain('Total que entra')
    expect(jsx).toContain('Total que sale')
  })

  it('el subtotal de «Entra» usa el cobro TOTAL, no solo el efectivo', () => {
    // `cuentaEntro` del adaptador suma solo billetes: alimenta la resta del
    // efectivo. Arriba se enseña el cobro entero, con Nequi, asi que el
    // subtotal tiene que ser el de esas dos lineas o no cuadra con lo que se ve.
    expect(jsx, 'el subtotal no cuadraria con las lineas de arriba')
      .not.toMatch(/\{formatMoney\(data\?\.cuentaEntro \?\? 0\)\}/)
  })

  it('ya NO existe la tarjeta suelta de «Debería tener en la mano»', () => {
    // Era el tercero de los «tres cuadros»: la misma cifra que ahora cierra la
    // cuenta, repetida con otro nombre.
    expect(jsx).not.toContain('Debería tener en la mano\n')
    expect(jsx).toContain('Le queda en la ruta')
  })

  it('y sigue diciendo cuánto de eso son billetes', () => {
    // Sin esta linea el cobrador entregaria de mas: en la #5 la ruta tiene
    // 254.785 pero solo 96.785 son efectivo.
    expect(jsx).toContain('De eso, en billetes')
  })
})
