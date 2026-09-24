// lib/__tests__/importar-no-duplica.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// 23 sep 2026. Un prestamista importó el export de su sistema anterior: 85
// préstamos, 83 entraron y 2 se quedaron fuera con «La cuota x cuotas del archivo
// es menor que el capital: cobraría menos de lo prestado. Revisa esta fila». No
// había forma de revisarla desde la pantalla, así que volvió a subir EL MISMO
// archivo. La revisión le decía «Cliente X ya existe. Se agregarán los préstamos
// al cliente existente» en las 83 y le ofrecía «Importar 83 clientes»: habría
// creado los 83 préstamos otra vez, con sus desembolsos y sus abonos previos.
//
// Dos arreglos, y esta prueba fija los dos:
//   1. El mismo préstamo (mismo cliente, monto, fecha y frecuencia) no se crea
//      dos veces — ni en la revisión ni en el servidor.
//   2. La fila que no cuadra trae su arreglo de un toque cuando el propio archivo
//      lo dice (la tasa), con las cifras a la vista para compararlas.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { validarFila, agruparPorCliente, huellaPrestamo } from '@/lib/carga-masiva'

const src = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')

/* Las dos filas reales, con sus cifras tal cual y sin nombres. El sistema viejo
   traía mal la «cantidad de cuotas»: con su propia tasa del 20 % salen exactas
   con 40 y con 6, y su saldo deja pagado lo mismo que decían sus «cuotas
   pagadas» (29,25 de 30 = 97,5 %; 3,33 de 4 = 83 %). */
const DIARIA = {
  nombre: 'Cliente uno', cedula: '168', montoPrestado: '400.000', tasaInteres: 20,
  valorCuota: 12000, frecuencia: 'diario', numeroCuotas: 30, fechaInicio: '2026-08-01', saldoActual: '12.000',
}
const SEMANAL = {
  nombre: 'Cliente dos', cedula: '197', montoPrestado: '300.000', tasaInteres: 20,
  valorCuota: 60000, frecuencia: 'semanal', numeroCuotas: 4, fechaInicio: '2026-08-28', saldoActual: '60.000',
}
const nadie = new Map()

describe('la fila que cobraría menos de lo prestado trae su arreglo', () => {
  it('diaria: 30 cuotas de $12.000 no cubren $400.000; con el 20 % son 40', () => {
    const r = validarFila(DIARIA, 0, nadie)
    expect(r.estado).toBe('error')
    expect(r.correccion).toMatchObject({ numeroCuotas: 40, valorCuota: 12000, total: 480000, tasa: 20 })
  })

  it('semanal: 4 cuotas de $60.000 no cubren $300.000; con el 20 % son 6', () => {
    const r = validarFila(SEMANAL, 1, nadie)
    expect(r.estado).toBe('error')
    expect(r.correccion).toMatchObject({ numeroCuotas: 6, total: 360000 })
  })

  it('aplicada, la fila queda buena, con el total de la tasa y el abono que cuadra con el saldo', () => {
    const r = validarFila({ ...DIARIA, numeroCuotas: 40, diasPlazo: '' }, 0, nadie)
    expect(r.estado).not.toBe('error')
    expect(r.calculado.totalAPagar).toBe(480000)
    // Le faltaban $12.000 según el archivo: ya había pagado $468.000.
    expect(r.datos.abonadoHasta).toBe(468000)

    const s = validarFila({ ...SEMANAL, numeroCuotas: 6, diasPlazo: '' }, 1, nadie)
    expect(s.calculado.totalAPagar).toBe(360000)
    expect(s.datos.abonadoHasta).toBe(300000)
  })

  it('sin tasa en el archivo no se inventa nada: queda el error, sin arreglo', () => {
    const r = validarFila({ ...DIARIA, tasaInteres: '' }, 0, nadie)
    expect(r.estado).toBe('error')
    expect(r.correccion).toBeNull()
  })
})

describe('el mismo archivo subido dos veces no crea nada', () => {
  // Así queda en la base un préstamo importado: medianoche de Bogotá.
  const enLaBase = { montoPrestado: 1070000, fechaInicio: new Date('2026-02-13T05:00:00.000Z'), frecuencia: 'diario' }
  const FILA = {
    nombre: 'Cliente tres', cedula: '50', montoPrestado: '1.070.000', tasaInteres: 20,
    valorCuota: 42800, frecuencia: 'diario', numeroCuotas: 30, fechaInicio: '2026-02-13',
  }
  const existe = new Map([['50', { id: 'c1', nombre: 'Cliente tres', estado: 'activo' }]])

  it('la huella de la base y la de la fila son la misma', () => {
    expect(huellaPrestamo(enLaBase)).toBe(huellaPrestamo({ montoPrestado: 1070000, fechaInicio: '2026-02-13', frecuencia: 'diario' }))
  })

  it('con el préstamo ya en la base, la fila sale «repetido» y lo dice', () => {
    const r = validarFila(FILA, 0, existe, new Map([['50', new Set([huellaPrestamo(enLaBase)])]]))
    expect(r.estado).toBe('repetido')
    expect(r.advertencias.join(' ')).toMatch(/ya está en el sistema/)
    // Y el aviso de «se agregarán los préstamos» ya no sale: sería mentira.
    expect(r.advertencias.join(' ')).not.toMatch(/Se agregaran/)
  })

  it('un préstamo NUEVO para un cliente que ya existe sí se agrega, como siempre', () => {
    const r = validarFila({ ...FILA, montoPrestado: '500.000', valorCuota: 20000 }, 0, existe,
      new Map([['50', new Set([huellaPrestamo(enLaBase)])]]))
    expect(r.estado).toBe('advertencia')
    expect(r.advertencias.join(' ')).toMatch(/Se agregaran los prestamos al cliente existente/)
  })

  it('las repetidas no entran al grupo que se importa', () => {
    const repetida = validarFila(FILA, 0, existe, new Map([['50', new Set([huellaPrestamo(enLaBase)])]]))
    expect(agruparPorCliente([repetida]).size).toBe(0)
  })

  it('el servidor tiene la misma guarda, contra una foto tomada ANTES de crear nada', () => {
    const ruta = src('app/api/carga-masiva/importar/route.js')
    expect(ruta).toMatch(/const yaLoTiene = \(clienteId, p\) => !!clienteId && !!huellasPrevias\.get\(clienteId\)\?\.has\(huellaPrestamo\(p\)\)/)
    expect(ruta).toMatch(/if \(yaLoTiene\(cedulaToId\.get\(cedula\), p\)\) \{ prestamosRepetidos\+\+; continue \}/)
    // La foto va antes del bucle que crea: si no, el segundo préstamo igual
    // del MISMO archivo se tomaría por repetido del primero.
    expect(ruta.indexOf('const huellasPrevias = new Map()')).toBeLessThan(ruta.indexOf('for (const [cedula, grupo] of grupos)'))
  })

  it('la revisión solo importa lo que va a crear, y lo dice en el botón', () => {
    const pantalla = src('components/carga-masiva/PasoRevisar.jsx')
    expect(pantalla).toMatch(/const aCrear = filas\.filter\(f => f\.estado !== 'error' && f\.estado !== 'repetido'\)/)
    expect(pantalla).toMatch(/const validas = aCrear/)
    expect(pantalla).toMatch(/'Nada nuevo que importar'/)
  })
})

describe('la tabla de la revisión dice CUOTAS, no días', () => {
  it('4 cuotas semanales salen como 4, no como 28', () => {
    expect(src('components/carga-masiva/PasoRevisar.jsx'))
      .toMatch(/cuotas: fila\.calculado\?\.numPeriodos\n\s+\?\? Math\.ceil\(\(fila\.datos\.diasPlazo \|\| 0\) \/ \(DIAS_POR_PERIODO\[fila\.datos\.frecuencia\] \|\| 1\)\),/)
  })
})
