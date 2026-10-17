/* Préstamos, tanda 3 de lo que encontró el agente de los videos
 * (DETALLES-PRESTAMOS.md, 17 oct 2026): la hoja de cobro, crear préstamo, la
 * lista y el cliente en perdidos. Con las decisiones del dueño: no se cobra más
 * de lo que debe (#29), el cobrador no ve «Interés» si sube la deuda (#38), el
 * seguro se descuenta al prestar (#51), «Clásico» en todas las pantallas (#49)
 * y al cliente en perdidos el cobrador no le presta y el dueño lo confirma (#17).
 * Ancladas en el código, no en los comentarios. */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { ETIQUETA_MODO, sufijoTasa } from '@/lib/dinero/modos'
import { efectivoDeLaRenovacion } from '@/lib/dinero/efectivo-renovacion'
import { interesQueAhorraUnAbono } from '@/lib/dinero/abono-capital'
import { perdidosDelCliente, textoClienteEnPerdidos } from '@/lib/dinero/cliente-en-perdidos'
import { enviarConfirmandoPerdidos } from '@/lib/confirmar-perdidos'
import { aFilasBusqueda } from '@/lib/adaptadores/busqueda'

const leer = (f) => readFileSync(f, 'utf8')
const hoja = leer('components/prestamos/RegistrarPago.jsx')
const crear = leer('app/(dashboard)/prestamos/nuevo/page.jsx')
const apiCrear = leer('app/api/prestamos/route.js')
const apiRenovar = leer('app/api/prestamos/[id]/renovar/route.js')
const ficha = leer('app/(dashboard)/clientes/[id]/page.jsx')

describe('#29 · no se cobra más de lo que debe', () => {
  it('la hoja lo bloquea con el saldo a la vista', () => {
    expect(hoja).toMatch(/const pasaDelSaldo = !\['recargo', 'descuento'\]\.includes\(tipo\) && montoNum > Math\.round\(saldoPendiente \?\? 0\)/)
    expect(hoja).toMatch(/deshabilitado=\{!\(montoNum > 0\) \|\| pasaDelSaldo\}/)
  })
})

describe('#31 · «Entra a caja como» usa la regla del fajo', () => {
  it('la cuenta del cobrador entra al fajo', () => {
    expect(hoja).toMatch(/enFajo: entraAlFajo\(metodoPago, metodoPagoId,/)
  })
})

describe('#38 · el cobrador no cobra «Interés» cuando sube la deuda', () => {
  it('las dos listas de tipos lo filtran', () => {
    expect(hoja).toMatch(/const puedeCobrarSoloInteres = !subeLaDeuda \|\| puedeGestionarPrestamos/)
    expect((hoja.match(/\.\.\.\(puedeCobrarSoloInteres \? \[/g) || []).length).toBe(2)
  })
})

describe('#49 #50 · un nombre por modo y el interés dice de qué', () => {
  it('«Clásico» y «Dinámico» salen del diccionario', () => {
    expect(ETIQUETA_MODO.fijo).toBe('Clásico')
    expect(ETIQUETA_MODO.lineal_dinamico).toBe('Dinámico')
  })
  it('el sufijo de la tasa depende del modo', () => {
    expect(sufijoTasa('fijo')).toBe('mensual')
    expect(sufijoTasa('unico')).toBe('de todo el préstamo')
    expect(sufijoTasa('lineal')).toBe('por cada cobro')
    expect(sufijoTasa('manual')).toBeNull()
  })
})

describe('#51 · el seguro se descuenta al prestar', () => {
  it('al crear, el desembolso es el monto menos el seguro', () => {
    expect(apiCrear).toMatch(/monto: Number\(montoPrestado\) - seguroDescontado,/)
    expect(apiCrear).toMatch(/if \(seguroDescontado > 0 && seguroDescontado >= Number\(montoPrestado\)\) \{/)
  })
  it('al renovar, sale de los billetes que se entregan', () => {
    expect(efectivoDeLaRenovacion({ monto: 500000, deuda: 380645, seguro: 10000 }))
      .toMatchObject({ exacta: 119355, bruto: 119400, entrega: 109400, redondeado: true, seguroExcede: false })
    expect(efectivoDeLaRenovacion({ monto: 400000, deuda: 395000, seguro: 10000 }).seguroExcede).toBe(true)
    expect(efectivoDeLaRenovacion({ monto: 300000, deuda: 300000 })).toMatchObject({ bruto: 0, entrega: 0 })
  })
})

describe('#32 · lo que ahorra un abono a capital', () => {
  it('interés de los días que faltan, en hora de Bogotá', () => {
    const fechaInicio = '2026-10-01T00:00:00.000Z'
    const ahora = new Date('2026-10-11T12:00:00.000Z') // 10 días después, 30 de plazo
    expect(interesQueAhorraUnAbono({ monto: 100000, tasaInteres: 20, diasPlazo: 30, fechaInicio, ahora })).toBe(13333)
    expect(interesQueAhorraUnAbono({ monto: 100000, tasaInteres: 20, diasPlazo: 30, fechaInicio, ahora: new Date('2026-12-01') })).toBe(0)
    expect(interesQueAhorraUnAbono({ monto: 0, tasaInteres: 20, diasPlazo: 30, fechaInicio, ahora })).toBe(0)
  })
})

describe('#56 · salir de crear pregunta', () => {
  it('la ✕ y Cancelar pasan por la confirmación', () => {
    expect(crear).toMatch(/onCerrar: salirDeCrear/)
    expect(crear).toMatch(/¿Salir sin crear el préstamo\?/)
  })
})

describe('#17 · el cliente en perdidos', () => {
  const db = (prestamos) => ({ prestamo: { findMany: vi.fn().mockResolvedValue(prestamos) } })

  it('suma lo que deben sus préstamos en perdidos vivos', async () => {
    const info = await perdidosDelCliente(db([
      { id: 'a', totalAPagar: 300000, totalPagado: 100000, clavoAt: '2026-09-01', pagos: [] },
      { id: 'b', totalAPagar: 120000, totalPagado: 0, clavoAt: '2026-08-01', pagos: [] },
    ]), { organizationId: 'o', clienteId: 'c' })
    expect(info.cantidad).toBe(2)
    expect(info.saldo).toBeGreaterThan(0)
    expect(info.desde).toBe('2026-08-01')
    expect(textoClienteEnPerdidos(info)).toMatch(/^Este cliente tiene 2 préstamos en perdidos: debe /)
  })

  it('sin préstamos en perdidos no hay aviso', async () => {
    expect(await perdidosDelCliente(db([]), { organizationId: 'o', clienteId: 'c' })).toBeNull()
    expect(await perdidosDelCliente(db([]), { organizationId: 'o', clienteId: null })).toBeNull()
  })

  it('al cobrador 403; al dueño 409 hasta que confirma, al crear y al renovar', () => {
    for (const api of [apiCrear, apiRenovar]) {
      expect(api).toMatch(/perdidosDelCliente\(prisma, \{/)
      expect(api).toMatch(/status: 403 \}\)/)
      expect(api).toMatch(/requiereConfirmar: true \}, \{ status: 409 \}\)/)
      expect(api).toMatch(/confirmarClienteEnPerdidos !== true/)
    }
  })

  it('la pantalla reenvía con la marca solo si el dueño confirma', async () => {
    const r409 = new Response(JSON.stringify({ error: 'En perdidos', requiereConfirmar: true }), { status: 409 })
    const ok = new Response('{}', { status: 201 })
    const enviar = vi.fn().mockResolvedValueOnce(r409).mockResolvedValueOnce(ok)
    expect((await enviarConfirmandoPerdidos(enviar, () => true)).status).toBe(201)
    expect(enviar).toHaveBeenNthCalledWith(2, true)

    const r409b = new Response(JSON.stringify({ error: 'En perdidos', requiereConfirmar: true }), { status: 409 })
    const enviar2 = vi.fn().mockResolvedValueOnce(r409b)
    expect((await enviarConfirmandoPerdidos(enviar2, () => false)).status).toBe(409)
    expect(enviar2).toHaveBeenCalledTimes(1)

    // Otro 409 (no es de perdidos) no pregunta nada.
    const pregunta = vi.fn()
    const otro = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Duplicado' }), { status: 409 }))
    await enviarConfirmandoPerdidos(otro, pregunta)
    expect(pregunta).not.toHaveBeenCalled()
  })

  it('crear: rojo al elegirlo y el cobrador no avanza', () => {
    expect(crear).toMatch(/const perdidosDelElegido = perdidosDe\(clientes\.find\(\(c\) => c\.id === clienteId\)\)/)
    expect(crear).toMatch(/if \(!esOwner && perdidosDelElegido\) return false/)
    expect(crear).toMatch(/<strong>Cliente en perdidos:<\/strong>/)
    expect(crear).toMatch(/\{c\.tieneClavo && <EtiquetaClavo style=\{\{ flex: 'none' \}\} \/>\}/)
  })

  it('la ficha lo dice arriba con la cifra', () => {
    expect(ficha).toMatch(/const enPerdidos = prestamosActivos\.filter\(\(p\) => p\.esClavo\)/)
    expect(ficha).toMatch(/<strong>En perdidos · debe \{formatMoney\(saldoEnPerdidos\)\}<\/strong>/)
  })

  it('el buscador lo marca en rojo con lo que debe', () => {
    const filas = aFilasBusqueda({
      clientes: [{ id: 'c1', nombre: 'Ana', cedula: '123' }],
      prestamos: [
        { id: 'p1', clienteId: 'c1', clienteNombre: 'Ana', saldoPendiente: 80000, estado: 'activo', enPerdidos: true },
        { id: 'p2', clienteId: 'c1', clienteNombre: 'Ana', saldoPendiente: 20000, estado: 'activo', enPerdidos: false },
      ],
    })
    expect(filas).toHaveLength(1)
    expect(filas[0].detalle).toBe('En perdidos · debe $80.000')
    expect(filas[0].estado).toBe('rojo')
  })
})
