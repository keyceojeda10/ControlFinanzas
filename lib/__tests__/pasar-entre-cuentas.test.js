/* Préstamos Quintero Esteves, 21 oct 2026: «va a prestar un millón … tengo 400
   en Nequi y 600 en Bancolombia … solamente me da la opción de escoger uno».
   Se pasa la plata de una cuenta a otra antes de prestar; el capital no cambia. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { adaptarCuentas, cuentasElegibles } from '@/lib/adaptadores/cuentas'
import { filasDeMovimientos } from '@/lib/adaptadores/movimientos-capital'

const plata = (n) => `$${n.toLocaleString('es-CO')}`

describe('pasar plata entre cuentas', () => {
  it('la cuenta dice lo pasado con su nombre y su signo, y Entró − Salió sigue dando el saldo', () => {
    const r = adaptarCuentas([
      { key: 'efectivo', nombre: 'Efectivo', entradas: 0, salidas: 0, neto: 0 },
      { key: 'neq', nombre: 'Nequi', entradas: 400000, salidas: 400000, neto: 0, trasladado: -400000 },
      { key: 'ban', nombre: 'Bancolombia', entradas: 1000000, salidas: 0, neto: 1000000, trasladado: 400000 },
    ], plata)
    const de = (n) => r.cuentas.find((c) => c.nombre === n)
    expect(de('Nequi').detalle).toBe('entró $400.000 · salió $400.000 · entre cuentas −$400.000')
    expect(de('Bancolombia').detalle).toContain('entre cuentas +$400.000')
    expect(r.numeros.total).toBe(1000000)
  })

  it('en Capital → Movimientos los dos asientos son UNA fila, sin signo', () => {
    const comun = { tipo: 'traslado', monto: 400000, referenciaId: 'r1', saldoAnterior: 5, saldoNuevo: 5, descripcion: 'De Nequi a Bancolombia' }
    const filas = filasDeMovimientos([
      { ...comun, id: 'a', referenciaTipo: 'traslado_sale' },
      { ...comun, id: 'b', referenciaTipo: 'traslado_entra' },
      { id: 'c', tipo: 'recaudo', monto: 10000, descripcion: 'Cobro' },
    ])
    expect(filas).toHaveLength(2)
    expect(filas[0]).toMatchObject({ tipo: 'traslado', entreCuentas: true, monto: 400000 })
  })

  it('se elige entre el efectivo y las cuentas con nombre, no entre los cajones de lo viejo', () => {
    const keys = cuentasElegibles([
      { key: 'efectivo', tipoCuenta: 'efectivo' }, { key: 'neq', tipoCuenta: 'transferencia' },
      { key: 'transferencia', tipoCuenta: 'transferencia' }, { key: 'sin_registrar', tipoCuenta: 'sin_registrar' },
      { key: 'sin_cuenta', tipoCuenta: 'ajuste' },
    ]).map((c) => c.key)
    expect(keys).toEqual(['efectivo', 'neq'])
  })

  it('no mueve el capital ni la ruta, y se deshace en pareja', () => {
    const cap = readFileSync('lib/capital.js', 'utf8')
    const i = cap.indexOf('export async function pasarEntreCuentas')
    const cuerpo = cap.slice(i, cap.indexOf('\n}\n', i))
    expect(cuerpo).toContain('saldoAnterior: capital.saldo, saldoNuevo: capital.saldo, noMueveCapital: true')
    expect(cuerpo).not.toContain('rutaId')
    expect(cuerpo).not.toContain('tx.capital.update')
    const del = readFileSync('app/api/capital/movimientos/[id]/route.js', 'utf8')
    expect(del).toContain("where: { organizationId, tipo: 'traslado', referenciaId: movimiento.referenciaId ?? '__sin_pareja__' }")
    expect(readFileSync('prisma/schema.prisma', 'utf8')).toMatch(/enum TipoMovimiento \{[^}]*\n {2}traslado /)
  })

  it('solo el dueño, y las cuentas tienen que ser del negocio', () => {
    const api = readFileSync('app/api/caja/cuentas/traslado/route.js', 'utf8')
    expect(api).toContain("if (session.user.rol !== 'owner')")
    expect(api).toContain('prisma.metodoPago.findMany({ where: { organizationId, id: { in: ids } }')
    expect(api).toContain("if (desde === hacia)")
  })
})

describe('el formulario del préstamo avisa si la cuenta no alcanza', () => {
  const form = readFileSync('app/(dashboard)/prestamos/nuevo/page.jsx', 'utf8')
  it('lee el saldo de la cuenta elegida, el mismo de Caja → Cuentas («Todo»), solo el dueño', () => {
    expect(form).toContain("fetch('/api/caja/cuentas?periodo=todo', { cache: 'no-store' })")
    expect(form).toMatch(/const clave = cuentaDesembolso\.metodoPago === 'efectivo' \? 'efectivo' : cuentaDesembolso\.metodoPagoId/)
    expect(form).toMatch(/\{esOwner && \(\(\) => \{\n\s+const clave/)
  })
  it('dice cuánto falta y ofrece pasarlo ahí mismo, sin bloquear', () => {
    expect(form).toContain('const falta = Math.round(n - Number(cuenta.neto || 0))')
    expect(form).toContain('onClick={() => setPasarAbierto({ hacia: clave, monto: falta })}')
    expect(form).toMatch(/Pasar \{formatMoney\(falta\)\} a \{cuenta\.nombre\}/)
    expect(form).toContain('haciaInicial={pasarAbierto?.hacia ?? \'\'}')
  })
  it('solo ofrece pasar si otra cuenta tiene lo que falta (mover plata no la crea)', () => {
    expect(form).toContain('const sePuedePasar = falta > 0 && enOtras >= falta && !releyendoSaldos')
    // Sin esto, con el saldo viejo en pantalla, dos toques pasaban dos veces.
    expect(form).toContain('cargarSaldosCuentas().finally(() => setReleyendoSaldos(false))')
    expect(form).toContain('{sePuedePasar && (')
    expect(form).toMatch(/no alcanza para pasarle lo que falta/)
  })
  it('la hoja llega con la cuenta y el monto puestos', () => {
    const hoja = readFileSync('components/caja/PasarEntreCuentas.jsx', 'utf8')
    expect(hoja).toContain("setHacia(haciaInicial || ''); setMonto(montoInicial > 0 ? String(Math.round(montoInicial)) : '')")
  })
})
