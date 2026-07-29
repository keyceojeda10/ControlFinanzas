import { describe, it, expect } from 'vitest'
import { adaptarMas, textoCobradores, textoPerdidos, textoGastos } from '@/lib/adaptadores/mas'

// Esta pantalla existe para que cada fila lleve su cifra. El riesgo no es que
// falte un número: es que aparezca uno que miente.

describe('textoCobradores', () => {
  it('no dice nada cuando todos registraron', () => {
    // "0 sin registrar nada" en rojo grita un problema que no existe.
    expect(textoCobradores(0)).toBeNull()
    expect(textoCobradores(null)).toBeNull()
  })

  it('avisa cuando de verdad falta alguien', () => {
    expect(textoCobradores(8)).toBe('8 sin registrar nada')
  })
})

describe('textoPerdidos', () => {
  it('no dice nada si no hay clavos', () => {
    expect(textoPerdidos({ cantidad: 0, monto: 0 }, 'CO')).toBeNull()
    expect(textoPerdidos(null, 'CO')).toBeNull()
  })

  it('concuerda el plural sin usar "(s)"', () => {
    expect(textoPerdidos({ cantidad: 1, monto: 0 }, 'CO')).toBe('1 préstamo')
    expect(textoPerdidos({ cantidad: 3, monto: 0 }, 'CO')).toBe('3 préstamos')
  })

  it('añade el monto cuando lo hay', () => {
    expect(textoPerdidos({ cantidad: 1, monto: 1200000 }, 'CO')).toContain('1.200.000')
  })
})

describe('textoGastos', () => {
  it('dice que no hay nada registrado en vez de mostrar $0', () => {
    // Un "$0" se lee como "no gastaste"; lo cierto es "no lo anotaste", y eso
    // hace que la ganancia se vea más alta de lo que es.
    expect(textoGastos(0, 'CO')).toBe('nada registrado este mes')
    expect(textoGastos(null, 'CO')).toBe('nada registrado este mes')
  })

  it('con gastos, los muestra', () => {
    expect(textoGastos(10000, 'CO')).toContain('10.000')
  })
})

describe('adaptarMas', () => {
  it('sobrevive a que la API no conteste', () => {
    // La pantalla tiene que seguir siendo navegable sin cifras.
    expect(adaptarMas(null)).toEqual({})
    expect(adaptarMas(undefined)).toEqual({})
  })

  it('oculta la plata cuando el saldo es cero', () => {
    expect(adaptarMas({ pais: 'CO', plataLista: 0 }).plataLista).toBeNull()
  })

  it('mapea una respuesta completa', () => {
    const r = adaptarMas({
      pais: 'CO', plataLista: 2520280, gastosMes: 10000,
      cobradoresSinRegistrar: 8, perdidos: { cantidad: 1, monto: 1200000 },
      socios: 2, usuarios: 3,
    })
    expect(r.plataLista).toContain('2.520.280')
    expect(r.cobradoresSinRegistrar).toBe('8 sin registrar nada')
    expect(r.socios).toEqual({ cantidad: 2 })
    expect(r.usuarios).toBe(3)
  })
})
