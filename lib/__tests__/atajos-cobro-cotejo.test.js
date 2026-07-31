// lib/__tests__/atajos-cobro-cotejo.test.js — cotejo de T15-02.
//
// Fija lo que hace distinta a esta pantalla del modal de «Cobro rápido» que
// sustituye, porque son decisiones de producto y no de estilo: si alguien las
// deshace sin querer, la pantalla vuelve a ser la de dos pasos.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const leer = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
// Sin comentarios: tres pruebas mías ya han saltado por encontrar el nombre que
// buscaban DENTRO del comentario que lo explicaba.
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const atajos = sinComentarios(leer('components/pantallas/AtajosCobro.jsx'))
const pagina = sinComentarios(leer('app/(dashboard)/rutas/[id]/page.jsx'))

describe('T15-02 · tres salidas por préstamo', () => {
  it('cada préstamo lleva Cuota, Otro monto y No pagó', () => {
    expect(atajos).toMatch(/>\s*Cuota\s*</)
    expect(atajos).toMatch(/>Otro monto</)
    expect(atajos).toMatch(/>No pagó</)
  })

  it('«No pagó» pide MOTIVO, y son los que el sistema ya conoce', () => {
    // Un campo libre no se rellena en la calle, y sin motivo la visita no sirve
    // para nada después. Los cuatro son los de `VisitaReagendada`.
    for (const m of ['no_tenia_dinero', 'no_estaba', 'negocio_cerrado', 'pidio_plazo']) {
      expect(atajos).toContain(m)
    }
  })

  it('«Otro monto» se teclea AQUÍ, no abriendo el préstamo', () => {
    // «Cobrar la cuota del día SIN ENTRAR al préstamo» es el pie de la lámina;
    // mandar el abono parcial a otra pantalla lo rompe justo a la mitad.
    expect(atajos).toMatch(/inputMode="decimal"/)
    // Y NO `type="number"`: rechaza el separador decimal que no coincide con el
    // idioma del teléfono, así que en un móvil en inglés no se puede escribir.
    expect(atajos).not.toMatch(/type="number"/)
  })
})

describe('T15-02 · un solo paso, no dos', () => {
  it('el modal recibe TODOS los préstamos activos, siempre', () => {
    expect(pagina).toMatch(/prestamosActivos: activos/)
  })

  it('el préstamo a cobrar viaja EXPLÍCITO, no por el estado', () => {
    // Pasarlo por `setModalPagoRapido` cobraría el préstamo anterior: el estado
    // nuevo no ha llegado cuando `ejecutarPagoRapido` lee.
    expect(pagina).toMatch(/destino: \{/)
    expect(pagina).toMatch(/const objetivo = destino \?\? modalPagoRapido/)
  })

  it('«Otro monto» se registra como PARCIAL, no como cuota saldada', () => {
    // `cuotaOriginal` distinta de `cuota` es lo que hace que el pago entre como
    // parcial. Igualarlas marcaría la cuota del día como pagada entera.
    expect(pagina).toMatch(/cuota: cuanto,[\s\S]{0,400}?cuotaOriginal: pr\.cuota/)
  })
})

describe('T15-02 · lo que NO se toca', () => {
  it('sigue cobrando por `ejecutarPagoRapido`', () => {
    // Ahí viven la cola offline, el deshacer de 10 segundos y la detección de
    // duplicados. Reimplementar el cobro en la hoja los perdería los tres.
    expect(pagina).toMatch(/onCobrarCuota=\{\(pr\) => ejecutarPagoRapido\(/)
  })

  it('el método de pago sigue siendo el selector real de la app', () => {
    // Lleva las cuentas de la organización, que es de donde sale la caja por
    // cuenta. Una lista propia de «efectivo / transferencia» la descuadraría.
    expect(pagina).toMatch(/selectorMetodo=\{[\s\S]{0,200}?<MetodoPagoSelector/)
  })
})
