import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// T11-03 y T15-01: las dos fichas a 1440 eran UNA COLUMNA de tarjetas moviles
// apiladas —la tabla y el historial a varias pantallas de scroll del saldo, y
// media pantalla en blanco—. Un solo token responsive en cada archivo.
const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const prestamo = leer('app/(dashboard)/prestamos/[id]/page.jsx')
const cliente = leer('app/(dashboard)/clientes/[id]/page.jsx')
const ficha = leer('components/pantallas/FichaPrestamo.jsx')

describe('las dos fichas en escritorio', () => {
  it('la de prestamo reparte en dos columnas', () => {
    expect(prestamo).toMatch(/lg:grid lg:grid-cols-\[1\.6fr_1fr\]/)
    expect(prestamo).toMatch(/max-w-2xl lg:max-w-6xl/)
  })

  it('la de cliente tambien', () => {
    expect(cliente).toMatch(/lg:grid lg:grid-cols-\[1\.55fr_1fr\]/)
    expect(cliente).toMatch(/max-w-2xl lg:max-w-6xl/)
  })

  it('en movil siguen siendo UNA columna', () => {
    // `lg:grid` no aplica por debajo de 1024, y el `space-y` se apaga solo en
    // escritorio: sin eso, en el telefono se perderia el hueco entre tarjetas.
    for (const [nombre, src] of [['prestamo', prestamo], ['cliente', cliente]]) {
      expect(src, `${nombre}: el hueco de movil`).toMatch(/space-y-\d lg:space-y-0/)
    }
  })

  it('los carriles no se estiran', () => {
    // `items-start`: sin el, la columna corta se estira al alto de la larga y
    // deja una tarjeta con metros de blanco debajo.
    expect(prestamo).toMatch(/lg:items-start/)
    expect(cliente).toMatch(/lg:items-start/)
  })
})

describe('la tabla de pagos en 1440', () => {
  it('cabecera y filas tienen LAS MISMAS columnas', () => {
    // Ya paso en la lista de clientes: la cabecera tenia una columna mas que
    // las filas y en el JSX se ve bien — solo aparece midiendo en el navegador.
    const rejillas = [...ficha.matchAll(/gridTemplateColumns: '([^']+)'/g)].map((m) => m[1])
    expect(rejillas.length, 'faltan rejillas').toBeGreaterThanOrEqual(2)
    const cuentas = rejillas.map((r) => r.trim().split(/\s+/).length)
    expect(new Set(cuentas).size, `rejillas distintas: ${rejillas.join(' | ')}`).toBe(1)
    const cabecera = /\['Fecha'[^\]]*\]/.exec(ficha)[0].split(',').length
    expect(cabecera, 'los rotulos no cuadran con la rejilla').toBe(cuentas[0])
  })

  it('lleva la columna del cobrador', () => {
    // El comentario decia que ese dato «no llega hasta aqui» y era FALSO.
    expect(ficha).toContain("'Cobrador'")
    expect(prestamo).toMatch(/cobrador: p\.cobrador\?\.nombre \?\? null/)
  })

  it('el medio de pago dice la cuenta REAL, no «transferencia» a secas', () => {
    // Se degradaba a mano y perdia «Nequi»: para el que revisa un cobro, saber
    // por donde entro la plata no es lo mismo que saber que no fue efectivo.
    expect(prestamo).toMatch(/p\.metodoPago === 'transferencia' \? \(p\.plataforma \|\| 'transferencia'\)/)
  })
})
