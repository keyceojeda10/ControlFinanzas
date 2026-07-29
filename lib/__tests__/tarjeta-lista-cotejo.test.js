// lib/__tests__/tarjeta-lista-cotejo.test.js
//
// La pieza más repetida del sistema, cotejada contra T02-05 (clientes) y T02-06
// (préstamos) con `node scripts/medir.mjs`. Las cifras salen de MEDIR.
//
// OJO CON LOS `not.toMatch`: el archivo explica en prosa lo que se corrigió, así
// que hay que atarlos a la forma del código, no a la palabra.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { etiquetaDe, adaptarClientes } from '@/lib/adaptadores/clientes'
import { adaptarPrestamos, detalleDe } from '@/lib/adaptadores/prestamos'

const tarjeta = fs.readFileSync(path.join(process.cwd(), 'components/cf/TarjetaCliente.jsx'), 'utf8')

describe('las dos variantes, con sus seis números', () => {
  it('cliente: relleno 15, hueco 11, riel 14, centrado, hueco 12, monto 23', () => {
    expect(tarjeta).toMatch(
      /cliente:\s*\{ relleno: '15px 16px 15px 19px', hueco: 11, riel: 14, alineado: 'center',\s*huecoFila: 12, monto: 23, huecoSub: 2 \}/)
  })

  it('préstamo: relleno 14, hueco 10, riel 13, arriba, hueco 10, monto 21', () => {
    expect(tarjeta).toMatch(
      /prestamo:\s*\{ relleno: '14px 16px 14px 19px', hueco: 10, riel: 13, alineado: 'flex-start', huecoFila: 10, monto: 21, huecoSub: 3 \}/)
  })

  it('la variante de préstamo no pinta avatar', () => {
    expect(tarjeta).toMatch(/const conAvatar = variante === 'cliente' && !!iniciales/)
  })
})

describe('el estado tiene TRES portadores, no cuatro', () => {
  it('el avatar NO lleva borde de color', () => {
    // La receta §3 lo permite («cuando el estado importa»), pero ninguna de las
    // tres láminas lo usa: los nueve avatares son #F3F3EF pelado. Con riel,
    // pastilla y barra ya hay tres sitios diciendo lo mismo.
    const avatar = tarjeta.slice(tarjeta.indexOf('{conAvatar && ('), tarjeta.indexOf('El nombre SOLO'))
    expect(avatar).not.toMatch(/border: .*solid \$\{color\}/)
    expect(avatar).toMatch(/background: 'var\(--cf-fill\)'/)
  })

  it('el riel, la pastilla y la barra sí lo llevan', () => {
    expect(tarjeta).toMatch(/width: 4, borderRadius: 999, background: color/)
    // La pastilla toma el tono TRADUCIDO: `Pastilla` solo conoce
    // mora/atraso/aldia/neutro, y T02-06 añade `renovar` (verde de «al día») y
    // `pagado` (neutra: no hay color de terminado, hay ausencia de alarma).
    expect(tarjeta).toMatch(/<Pastilla tono=\{TONO_PASTILLA\[estado\] \?\? 'neutro'\}/)
    expect(tarjeta).toMatch(/renovar: 'aldia', pagado: 'neutro'/)
    expect(tarjeta).toMatch(/<BarraProgreso porcentaje=\{porcentaje\} tono=\{TONO_BARRA\[estado\]\} alto=\{5\}/)
  })

  it('el fondo de la tarjeta es SIEMPRE blanco', () => {
    // Era el muro chillón que este rediseño corrige.
    expect(tarjeta).toMatch(/background: 'var\(--cf-card\)'/)
  })
})

describe('UNA sola pastilla, con los días dentro', () => {
  it('la tarjeta no tiene una segunda pastilla de días', () => {
    expect(tarjeta).not.toMatch(/\{diasAtraso > 0 && \(/)
    expect(tarjeta).not.toMatch(/\{diasAtraso\}d/)
  })

  it('la compone el adaptador, porque el texto cambia en cada pantalla', () => {
    // «10d mora» en clientes, «36d mora» en préstamos, «36d de atraso» en
    // cobrar hoy. Meterlo en la tarjeta la obligaría a saber dónde está.
    expect(etiquetaDe('mora', 10)).toBe('10d mora')
    expect(etiquetaDe('atraso', 6)).toBe('6d vencido')
    expect(etiquetaDe('aldia', 0)).toBe('Al día')
  })

  it('con cero días no escribe «0d»', () => {
    expect(etiquetaDe('atraso', 0)).toBe('Atraso leve')
    expect(etiquetaDe('mora', null)).toBe('En mora')
  })
})

describe('la línea de contexto es UNA sola, y no se parte', () => {
  it('lleva nowrap con ellipsis, no clamp de dos líneas', () => {
    // Con `WebkitLineClamp: 2` las tarjetas cambiaban de alto según lo larga que
    // fuera la dirección. Una lista de alturas distintas se recorre peor, y la
    // lámina las dibuja todas iguales.
    // Se comprueba en POSITIVO. El `not.toMatch(/WebkitLineClamp/)` que tenía
    // acá se cazaba contra el comentario de arriba, que nombra la propiedad para
    // explicar por qué se fue. Y sobra: `nowrap` y un clamp de dos líneas no
    // pueden convivir, así que afirmar el primero descarta el segundo.
    const ctx = tarjeta.slice(tarjeta.indexOf('{contexto && ('))
    expect(ctx.slice(0, 400)).toMatch(/whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'/)
    expect(ctx.slice(0, 400)).not.toMatch(/display: '-webkit-box'/)
  })
})

describe('el «% pagado» va abajo, con el monto', () => {
  it('la fila del monto es flex-end + space-between', () => {
    // El porcentaje se lee CONTRA la cifra, no contra la palabra «deuda total».
    expect(tarjeta).toMatch(/alignItems: 'flex-end', justifyContent: 'space-between'/)
  })

  it('el rótulo y el monto van en columna con hueco 2', () => {
    expect(tarjeta).toMatch(/flexDirection: 'column', gap: 2, minWidth: 0/)
  })

  it('el rótulo lleva letter-spacing .1em, no .07em', () => {
    expect(tarjeta).toMatch(/letterSpacing: '\.1em', textTransform: 'uppercase'/)
  })
})

describe('lo que aportan los adaptadores', () => {
  it('clientes trae el rótulo «Deuda total» y préstamos NO trae rótulo', () => {
    const [c] = adaptarClientes([{ id: '1', nombre: 'Ana Milena', saldoPendienteTotal: 670000 }], 'CO')
    expect(c.etiquetaMonto).toBe('Deuda total')

    const [p] = adaptarPrestamos([{ id: '1', cliente: { nombre: 'Carlos' }, saldoPendiente: 160000 }], 'CO')
    expect(p.etiquetaMonto).toBeUndefined()
    expect(p.variante).toBe('prestamo')
  })

  it('préstamos dice el total al lado del porcentaje', () => {
    // «de $1.200.000 · 54% pagado». El saldo solo no dice nada: $160.000
    // pendientes puede ser un préstamo casi saldado o uno pequeño recién dado.
    expect(detalleDe({ totalAPagar: 1200000, porcentajePagado: 54 }, 'CO')).toMatch(/^de \$1\.200\.000 · 54% pagado$/)
  })

  it('sin total no escribe «de $0»', () => {
    expect(detalleDe({ porcentajePagado: 12 }, 'CO')).toBe('12% pagado')
    expect(detalleDe({ totalAPagar: 0, porcentajePagado: 0 }, 'CO')).toBe('0% pagado')
  })
})
