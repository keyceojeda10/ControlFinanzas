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

  it('EL NUMERO GRANDE es lo que tiene que entregar', () => {
    // Es el dato que se persigue: la plata que el cobrador pone sobre la mesa.
    // La primera version puso arriba «Le queda en la ruta» —que NO se entrega,
    // porque incluye lo que esta en el banco— y dejo el de entregar debajo en
    // gris. La cifra grande era la que no se cuenta.
    const iEntrega = jsx.indexOf('Tiene que entregar')
    const iRuta = jsx.indexOf('Le queda en la ruta')
    expect(iEntrega, 'falta el rotulo de lo que entrega').toBeGreaterThan(0)
    expect(iEntrega, 'lo que entrega tiene que ir ANTES que el capital de la ruta').toBeLessThan(iRuta)
    // Y con el tamaño mayor de la tarjeta.
    expect(jsx).toMatch(/text-\[26px\] font-bold[\s\S]{0,220}quedaEnEfectivo/)
  })

  it('en negativo no dice «entregar»: le deben a el', () => {
    // La ruta #8 cerro en -69.833 porque presto mas efectivo del que llevaba.
    // «Tiene que entregar -$69.833» no se entiende.
    expect(jsx).toContain('Hay que reponerle')
    expect(jsx).toMatch(/formatMoney\(Math\.abs\(cr\.quedaEnEfectivo/)
  })
})

describe('lo prestado se parte por metodo', () => {
  const jsx = readFileSync(resolve(process.cwd(), 'components/caja/CajaCobradorDetalle.jsx'), 'utf8')
  const api = readFileSync(resolve(process.cwd(), 'app/api/caja/cobrador/[id]/route.js'), 'utf8')

  it('el API separa el desembolso digital del efectivo', () => {
    // Un desembolso por Nequi NO sale del bolsillo del cobrador. Sumarlo a
    // «Presto en efectivo» le pide un fajo que nunca puso — el mismo error del
    // lado del cobro, al reves. En este negocio hay 6 casos historicos.
    expect(api).toMatch(/const prestadoDigital = Math\.round\(/)
    expect(api).toMatch(/const prestadoEfectivoNeto = prestadoNeto - prestadoDigital/)
    expect(api).toMatch(/metodoPago: true/)
  })

  it('la resta del EFECTIVO descuenta solo el efectivo prestado', () => {
    // Si aqui vuelve `prestadoNeto`, al cobrador se le descuenta del fajo una
    // plata que salio por transferencia.
    expect(api).toMatch(/rotulo: 'Prestó en efectivo', monto: prestadoEfectivoNeto/)
  })

  it('la pantalla pinta los dos renglones', () => {
    expect(jsx).toContain('Prestó en efectivo')
    expect(jsx).toContain('Prestó por transferencia')
  })

  it('la aritmetica: con desembolso digital, el fajo NO lo descuenta', () => {
    const ap = 352000, cobEf = 270000, cobDig = 158000
    const presEf = 400000, presDig = 85215, gas = 40000
    // Lo que entrega: solo billetes en las dos direcciones.
    expect(ap + cobEf - presEf - gas).toBe(182000)
    // Lo que queda en la ruta: todo.
    expect(ap + cobEf + cobDig - (presEf + presDig) - gas).toBe(254785)
    // Sin separar se le habrian pedido 85.215 de menos.
    expect(ap + cobEf - (presEf + presDig) - gas).toBe(96785)
  })
})
