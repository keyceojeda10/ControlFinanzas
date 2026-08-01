// lib/__tests__/actividad.test.js — el contrato de T32-03 con su pantalla.

import { describe, it, expect } from 'vitest'
import {
  agruparRepetidos, textoDeFila, paraRevisar, resumenDelDia, quienTrabajo,
} from '../adaptadores/actividad'

// La lista llega DESCENDENTE, como la manda la API: lo más nuevo primero.
const suceso = (min, accion, nombre = 'Carlos Andres', extra = {}) => ({
  id: `${accion}-${min}`,
  accion,
  createdAt: new Date(Date.UTC(2026, 6, 31, 22, 60 - min)).toISOString(),
  user: { nombre, rol: 'owner' },
  ...extra,
})

describe('agruparRepetidos', () => {
  it('junta los pagos seguidos del mismo cobrador', () => {
    const filas = agruparRepetidos([
      suceso(0, 'registrar_pago'),
      suceso(1, 'registrar_pago'),
      suceso(2, 'registrar_pago'),
      suceso(3, 'registrar_pago'),
    ])
    expect(filas).toHaveLength(1)
    expect(filas[0].cuantos).toBe(4)
  })

  it('no junta a dos personas distintas', () => {
    const filas = agruparRepetidos([
      suceso(0, 'registrar_pago', 'Ana'),
      suceso(1, 'registrar_pago', 'Beto'),
    ])
    expect(filas).toHaveLength(2)
  })

  it('no junta acciones distintas', () => {
    const filas = agruparRepetidos([
      suceso(0, 'registrar_pago'),
      suceso(1, 'crear_prestamo'),
    ])
    expect(filas).toHaveLength(2)
  })

  it('no junta lo que pasó con media hora de diferencia', () => {
    // Dos visitas distintas, no una tanda.
    const filas = agruparRepetidos([suceso(0, 'registrar_pago'), suceso(30, 'registrar_pago')])
    expect(filas).toHaveLength(2)
  })

  it('una fila suelta se queda con su hora, sin rango', () => {
    const [fila] = agruparRepetidos([suceso(0, 'registrar_pago')])
    expect(fila.cuantos).toBe(1)
    expect(fila.horaTexto).not.toContain('–')
    expect(fila.duracionTexto).toBe(null)
  })

  it('una tanda enseña el rango de horas', () => {
    const [fila] = agruparRepetidos([suceso(0, 'registrar_pago'), suceso(3, 'registrar_pago')])
    expect(fila.horaTexto).toContain('–')
  })

  it('suma los montos de la tanda, sacandolos del detalle', () => {
    // El monto NO es una columna del modelo: viaja dentro del texto que la
    // propia app escribio. Ver la nota en el adaptador.
    const filas = agruparRepetidos([
      suceso(0, 'registrar_pago', 'Ana', { detalle: 'Pago completo $20.000' }),
      suceso(1, 'registrar_pago', 'Ana', { detalle: 'Pago completo $30.000' }),
    ])
    expect(filas[0].monto).toBe(50000)
  })

  it('con DOS importes en el texto no adivina: devuelve cero', () => {
    // «de $20.000 a $30.000» no dice cual es el movimiento, y una cifra
    // equivocada en una pantalla de auditoria es peor que ninguna.
    const [fila] = agruparRepetidos([
      suceso(0, 'editar_prestamo', 'Ana', { detalle: 'Cuota de $20.000 a $30.000' }),
    ])
    expect(fila.monto).toBe(0)
  })

  it('con la lista vacía no revienta', () => {
    expect(agruparRepetidos([])).toEqual([])
    expect(agruparRepetidos(undefined)).toEqual([])
  })
})

describe('textoDeFila', () => {
  it('una sola vez se lee como siempre', () => {
    const [fila] = agruparRepetidos([suceso(0, 'registrar_pago')])
    expect(textoDeFila(fila, 'Registró pago')).toBe('registró pago')
  })

  it('la tanda dice cuántos y en cuánto tiempo', () => {
    const [fila] = agruparRepetidos([
      suceso(0, 'registrar_pago'), suceso(1, 'registrar_pago'),
      suceso(2, 'registrar_pago'), suceso(3, 'registrar_pago'),
    ])
    const texto = textoDeFila(fila, 'Registró pago')
    expect(texto).toContain('4 pagos')
    expect(texto).toMatch(/minuto/)
  })
})

describe('paraRevisar', () => {
  it('no dice nada cuando no hay nada raro', () => {
    expect(paraRevisar(agruparRepetidos([suceso(0, 'crear_cliente')]))).toBe(null)
  })

  it('NO avisa de una tanda de pagos: eso es una ruta normal', () => {
    const filas = agruparRepetidos([
      suceso(0, 'registrar_pago'), suceso(1, 'registrar_pago'),
      suceso(2, 'registrar_pago'), suceso(3, 'registrar_pago'),
    ])
    expect(paraRevisar(filas)).toBe(null)
  })

  it('avisa del mismo cambio repetido', () => {
    const filas = agruparRepetidos([
      suceso(0, 'cambiar_dia_cobro', 'Ana', { detalle: 'Día de cobro a mensual' }),
      suceso(1, 'cambiar_dia_cobro', 'Ana', { detalle: 'Día de cobro a mensual' }),
      suceso(2, 'cambiar_dia_cobro', 'Ana', { detalle: 'Día de cobro a mensual' }),
    ])
    const aviso = paraRevisar(filas)
    expect(aviso).toBeTruthy()
    expect(aviso.texto).toContain('3 veces')
  })
})

describe('resumenDelDia y quienTrabajo', () => {
  it('separa lo que entró de lo que salió', () => {
    const r = resumenDelDia([
      { accion: 'registrar_pago', detalle: 'Pago completo $79.000' },
      { accion: 'crear_prestamo', detalle: 'Prestamo por $1.000.000' },
      { accion: 'crear_cliente',  detalle: 'Cliente nuevo' },
    ])
    expect(r.entro).toBe(79000)
    expect(r.salio).toBe(-1000000)
    expect(r.movimientos).toBe(3)
  })

  it('cuenta por persona, de más a menos', () => {
    const q = quienTrabajo([
      suceso(0, 'registrar_pago', 'Ana'),
      suceso(1, 'registrar_pago', 'Beto'),
      suceso(2, 'registrar_pago', 'Ana'),
    ])
    expect(q[0]).toMatchObject({ nombre: 'Ana', cuantos: 2 })
    expect(q[1]).toMatchObject({ nombre: 'Beto', cuantos: 1 })
  })
})
