// Lo cazado en el barrido de PC del 19-20 sep 2026. Cada prueba ancla en CÓDIGO,
// no en prosa: los comentarios de este repo citan los textos que se arreglan.
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import { agruparRepetidos, sentidoDe, resumenDelDia } from '@/lib/adaptadores/actividad'
import { subtituloRuta } from '@/lib/adaptadores/rutas'
import { adaptarPanel } from '@/lib/adaptadores/panel'

const lee = (p) => fs.readFileSync(p, 'utf8')
const suceso = (accion, detalle, min = 0, nombre = 'Ana') => ({
  id: `${accion}-${min}`, accion, detalle, user: { nombre },
  createdAt: new Date(Date.UTC(2026, 8, 19, 15, min)).toISOString(),
})

describe('Historial: el signo lo dice la acción, no el número', () => {
  it('un gasto y un préstamo SALEN; un pago y un aporte ENTRAN', () => {
    expect(sentidoDe('registrar_gasto', 'Gasto $31.220')).toBe('sale')
    expect(sentidoDe('crear_prestamo', 'Prestamo por $1.000.000')).toBe('sale')
    expect(sentidoDe('registrar_pago', 'Pago completo $20.000')).toBe('entra')
    expect(sentidoDe('registrar_aporte', 'Aporte de $500.000')).toBe('entra')
  })

  it('el capital y la caja manual lo dicen en el texto', () => {
    expect(sentidoDe('movimiento_capital', 'retiro salida $200.000')).toBe('sale')
    expect(sentidoDe('movimiento_capital', 'inyeccion entrada $200.000')).toBe('entra')
    expect(sentidoDe('movimiento_caja_manual', 'ajuste salida $5.000')).toBe('sale')
    expect(sentidoDe('movimiento_capital', 'algo raro $5.000')).toBe('neutro')
  })

  it('un cierre, un borrado o una edición llevan importe pero no entran ni salen', () => {
    for (const a of ['cierre_caja', 'eliminar_prestamo', 'editar_prestamo', 'confirmar_cuadre', 'renovar_prestamo']) {
      expect(sentidoDe(a, 'algo $50.000')).toBe('neutro')
    }
  })

  it('la fila trae su sentido, y una tanda mezclada se queda sin cifra', () => {
    const [gastos] = agruparRepetidos([suceso('registrar_gasto', 'Gasto $10.000', 1), suceso('registrar_gasto', 'Gasto $21.220', 0)])
    expect(gastos).toMatchObject({ cuantos: 2, monto: 31220, sentido: 'sale' })
    const [mezcla] = agruparRepetidos([
      suceso('movimiento_capital', 'retiro salida $100.000', 1),
      suceso('movimiento_capital', 'inyeccion entrada $300.000', 0),
    ])
    expect(mezcla).toMatchObject({ cuantos: 2, monto: 0, sentido: 'neutro' })
    expect(mezcla.mezcla).toBeUndefined()
  })

  it('el resumen usa la misma regla: el cierre no se suma encima de los pagos', () => {
    const r = resumenDelDia([
      suceso('registrar_pago', 'Pago completo $50.000'),
      suceso('cierre_caja', 'Cierre de caja - recogido $50.000'),
      suceso('movimiento_capital', 'retiro salida $20.000'),
    ])
    expect(r).toMatchObject({ entro: 50000, salio: -20000 })
  })

  it('la pantalla pinta el signo por `sentido`', () => {
    const src = lee('app/(dashboard)/actividad/page.jsx')
    expect(src).toContain("fila.sentido === 'entra' ? 'var(--cf-green-dark)'")
    expect(src).not.toContain("{fila.monto > 0 ? '+' : '−'}")
  })
})

describe('«N de M cobrados» del inicio cuenta CLIENTES, como Rutas', () => {
  it('el adaptador usa clientesCobradosHoy y no el número de pagos', () => {
    const v = adaptarPanel({
      prestamos: { esperadoHoy: 1000, clientesCobradosHoy: 2 },
      cobros: { hoy: 500, cantidadHoy: 3 },
    }, { clientesHoy: 15 })
    expect(v.hero.cobrados).toBe(2)
    expect(v.hero.pendientes).toBe(13)
  })

  it('el API lo calcula con los que tocaban hoy Y pagaron', () => {
    const src = lee('app/api/dashboard/resumen/route.js')
    expect(src).toContain('for (const id of clientesConCobroHoy) if (pagaronHoy.has(id)) clientesCobradosHoy += 1')
    expect(src).toMatch(/select: \{ montoPagado: true, fechaPago: true, prestamo: \{ select: \{ clienteId: true \} \} \}/)
  })
})

describe('La ruta en PC', () => {
  const src = lee('components/pantallas/RutaEscritorio.jsx')
  it('no recorta el nombre ni la dirección', () => {
    expect(src).not.toMatch(/textOverflow: 'ellipsis'[^\n]*\}\}>\{f\.nombre\}/)
    expect(src).toContain("<span style={{ overflowWrap: 'break-word', minWidth: 0 }}>{f.nombre}</span>")
    const donde = src.slice(src.indexOf('{f.donde && ('), src.indexOf('}}>{f.donde}</span>'))
    expect(donde).not.toContain('ellipsis')
  })
  it('lo de hoy va en bloque carbón, no en fondo dorado', () => {
    const i = src.indexOf('>Por cobrar hoy</span>')
    const bloque = src.slice(i - 700, i)
    expect(bloque).toContain("background: '#15161A'")
    expect(bloque).not.toContain("background: 'var(--cf-gold)'")
  })
})

describe('Textos', () => {
  it('«0 de 1 cobro», en singular', () => {
    expect(subtituloRuta({ cobrosHoy: 1, cobradosHoy: 0 })).toBe('0 de 1 cobro')
    expect(subtituloRuta({ cobrosHoy: 3, cobradosHoy: 1 })).toBe('1 de 3 cobros')
  })
  it('la dirección del cliente baja de renglón', () => {
    const src = lee('components/clientes/ClienteHeroCard.jsx')
    const fila = src.slice(src.indexOf('function FilaContacto('), src.indexOf('function BotonFila('))
    expect(fila).not.toContain('ellipsis')
  })
})

describe('El verde de WhatsApp sobrevive al parche de tema claro', () => {
  // `[class*="bg-[#2"]` casaba `bg-[#25d366]` y lo pintaba lavanda con
  // !important. Medido con getComputedStyle en el espejo, no leído del JSX.
  const CSS = lee('app/globals.css')
  const MARCA = ['#25d366', '#25D366', '#1da855', '#1ebe5b', '#1eb855', '#16a34a', '#22c55e']

  it('el parche por subcadena sigue ahí (es lo que obliga a la exención)', () => {
    expect(CSS).toMatch(/\[class\*="bg-\[#2"\]/)
  })

  it('cada color de marca se repone con su propio valor', () => {
    for (const hex of MARCA) {
      const esc = hex.replace('#', '\\\\#')
      const re = new RegExp(`html\\[data-theme="light"\\] \\.bg-\\\\\\[${esc}\\\\\\]\\s*\\{\\s*background-color:\\s*${hex}\\s*!important`)
      expect(CSS, `falta la exención de ${hex}`).toMatch(re)
    }
  })

  it('y el texto blanco de esos botones no se vuelve negro', () => {
    const bloque = CSS.slice(CSS.indexOf('ESTE PARCHE CASA POR SUBCADENA'))
    for (const hex of MARCA) {
      expect(bloque).toContain(`.bg-\\[\\${hex}\\].text-white`)
    }
    expect(bloque.slice(0, 2600)).toMatch(/color:\s*#ffffff\s*!important/)
  })

  it('los botones de WhatsApp siguen usando esas clases', () => {
    const wa = lee('components/ui/BotonWhatsApp.jsx')
    expect(wa).toContain('bg-[#25d366]')
    expect(wa).toContain('text-white')
  })
})
