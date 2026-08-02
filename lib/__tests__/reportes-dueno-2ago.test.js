// lib/__tests__/reportes-dueno-2ago.test.js
//
// Los reportes que el dueño mandó el 2 de agosto con tres capturas:
//
//   «las tarjetas no tienen quién creó ese cliente o quién creó ese crédito»
//   «aparte de decir también en qué modo de interés está creado»
//   «dice un millón ochocientos DE un millón ochocientos… se entiende como que
//    ya pagó, y es un préstamo nuevo que no ha pagado nada»
//   «la foto de perfil del cliente creado no está trayendo la foto»
//
// Los cuatro tienen algo en común y por eso van juntos con prueba: el dato YA
// VIAJABA desde la API y el adaptador lo tiraba en silencio. Cuando eso pasa
// nada falla —ni el build, ni las 1.858 pruebas— simplemente no sale en
// pantalla, y solo se descubre cuando alguien mira la app y lo reporta.

import { describe, it, expect } from 'vitest'
import { adaptarPrestamos, contextoDe } from '@/lib/adaptadores/prestamos'
import { adaptarClientes } from '@/lib/adaptadores/clientes'
import { etiquetaModo, ETIQUETA_MODO } from '@/lib/dinero/modos'
import { formatMoney } from '@/lib/i18n'

const base = {
  id: 'p1', frecuencia: 'semanal', tasaInteres: 20,
  montoPrestado: 1500000, totalAPagar: 1800000, saldoPendiente: 1800000,
  cliente: { nombre: 'Judith Vega', ruta: { nombre: 'Ruta #1' } },
}

describe('el modo de interés, en la tarjeta', () => {
  it('va pegado a la tasa — el mismo 20% es otra cosa en cada modo', () => {
    expect(contextoDe({ ...base, modoInteres: 'solo_interes' }, 'co'))
      .toContain('Semanal 20% Globo')
    expect(contextoDe({ ...base, modoInteres: 'saldo' }, 'co'))
      .toContain('Semanal 20% Sobre saldo')
  })

  it('usa el nombre del SELECTOR con el que se creó, no otro', () => {
    // `fijo` se llamaba «Cuota fija» al leerlo y «Clásico» al crearlo, y
    // `solo_interes` tenía TRES nombres. Manda el que el dueño eligió: si no,
    // crea un préstamo y no lo reconoce en ninguna otra pantalla.
    expect(etiquetaModo('fijo')).toBe('Clásico')
    expect(etiquetaModo('solo_interes')).toBe('Globo')
    expect(etiquetaModo('lineal')).toBe('Decreciente')
  })

  it('un modo desconocido cae a Clásico, que es el que de verdad se calcula', () => {
    expect(etiquetaModo(undefined)).toBe('Clásico')
    expect(etiquetaModo('invento')).toBe('Clásico')
  })

  it('los modos legacy siguen siendo legibles', () => {
    // `proporcional` es inalcanzable desde hace tiempo, pero hay filas guardadas
    // así y tienen que poder leerse en vez de salir con el guión bajo crudo.
    expect(ETIQUETA_MODO.proporcional).toBeTruthy()
  })
})

describe('quién creó el préstamo', () => {
  it('sale en la línea, y solo el nombre de pila', () => {
    const c = contextoDe({ ...base, creadoPorNombre: 'María Fernanda Gutiérrez' }, 'co')
    expect(c).toContain('creó María')
    // El nombre entero parte la línea en dos renglones.
    expect(c).not.toContain('Gutiérrez')
  })

  it('sin autor no queda un «creó» suelto', () => {
    expect(contextoDe(base, 'co')).not.toContain('creó')
    expect(contextoDe({ ...base, creadoPorNombre: '   ' }, 'co')).not.toContain('creó')
  })
})

describe('«$1.800.000 de $1.800.000» — la cifra que se leía al revés', () => {
  it('un préstamo NUEVO enseña $0 pagados, no el total', () => {
    const [t] = adaptarPrestamos([base], 'co')
    expect(t.monto).toBe(formatMoney(0, 'co'))
    expect(t.detalle).toBe(`de ${formatMoney(1800000, 'co')}`)
  })

  it('la cifra y la barra cuentan LO MISMO — ése era el fallo de fondo', () => {
    // Antes la cifra medía lo pendiente y la barra lo pagado: en un préstamo
    // nuevo decían «todo» y «nada» a la vez, una encima de la otra.
    const [t] = adaptarPrestamos(
      [{ ...base, saldoPendiente: 900000, porcentajePagado: 50 }], 'co')
    expect(t.monto).toBe(formatMoney(900000, 'co'))
    expect(t.porcentaje).toBe(50)
  })

  it('nunca sale un pagado negativo aunque el saldo venga sucio', () => {
    const [t] = adaptarPrestamos(
      [{ ...base, totalAPagar: 100000, saldoPendiente: 180000 }], 'co')
    expect(t.monto).toBe(formatMoney(0, 'co'))
  })
})

describe('la foto del cliente', () => {
  it('llega a la tarjeta cuando existe', () => {
    const [c] = adaptarClientes(
      [{ id: 'c1', nombre: 'Judith Vega', fotoUrl: 'https://x.test/j.jpg' }], 'co')
    expect(c.foto).toBe('https://x.test/j.jpg')
    // Las iniciales NO desaparecen: son el respaldo si la imagen no carga.
    expect(c.iniciales).toBeTruthy()
  })

  it('sin foto va en null, no en cadena vacía', () => {
    const [c] = adaptarClientes([{ id: 'c1', nombre: 'Judith Vega' }], 'co')
    expect(c.foto).toBeNull()
    const [d] = adaptarClientes([{ id: 'c2', nombre: 'Ana', fotoUrl: '' }], 'co')
    expect(d.foto).toBeNull()
  })
})
