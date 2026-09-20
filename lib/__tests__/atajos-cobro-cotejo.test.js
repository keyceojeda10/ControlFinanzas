// lib/__tests__/atajos-cobro-cotejo.test.js — cotejo de T15-02.
//
// Fija lo que hace distinta a esta pantalla del modal de «Cobro rápido» que
// sustituye, porque son decisiones de producto y no de estilo: si alguien las
// deshace sin querer, la pantalla vuelve a ser la de dos pasos.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import { opcionesDeMonto } from '@/lib/adaptadores/atajos-cobro'
const leer = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
// Sin comentarios: tres pruebas mías ya han saltado por encontrar el nombre que
// buscaban DENTRO del comentario que lo explicaba.
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const atajos = sinComentarios(leer('components/pantallas/AtajosCobro.jsx'))
const pagina = sinComentarios(leer('app/(dashboard)/rutas/[id]/page.jsx'))

describe('T15-02 · tres salidas por préstamo', () => {
  it('las tres salidas siguen ahí: la cuota, otro monto y «No pagó»', () => {
    // La hoja se rehízo el 20 sep 2026 (el dueño: «no se ven los datos claros…
    // el botoncito de atrás da hasta pena»). Las tres salidas de la lámina se
    // quedan; cambia cómo se eligen: pastillas de monto y la pista a la vista.
    expect(opcionesDeMonto({ cuota: 20000, saldoPendiente: 520000 })[0]).toMatchObject({ id: 'cuota', monto: 20000 })
    expect(atajos).toMatch(/>Otro monto<\/Pastilla>/)
    expect(atajos).toMatch(/>No pagó hoy<\/button>/)
  })

  it('el prestamo YA COBRADO hoy no se vuelve a cobrar de un gesto', () => {
    // Estaba solo atenuado y «Cuota» seguia pulsable: se cobra dos veces el
    // mismo prestamo sin que nada avise. Salio cobrando de verdad en pruebas —
    // recaudado $32.000 sobre una cuota de $16.000.
    // Ahora la hoja abre con la cuota PUESTA y la pista lista, así que el ya
    // cobrado no puede traer cuota: abre sin monto y hay que elegirlo.
    const ya = opcionesDeMonto({ cuota: 16000, saldoPendiente: 400000, pagadoHoy: true })
    expect(ya.some((o) => o.id === 'cuota')).toBe(false)
    expect(atajos).toMatch(/const primera = opciones\[0\]\?\.id === 'cuota' \? 'cuota' : null/)
    // «Otro monto» SIGUE vivo: un segundo abono el mismo dia es legitimo.
    expect(atajos).toMatch(/<Pastilla activa=\{opcion === 'otro'\}/)
  })

  it('las pastillas solo ofrecen cifras que el servidor ya dio, y sin repetirse', () => {
    // «Si quiere saldar el saldo completo tocaría colocarlo a mano, ya el
    // sistema diciendo cuánto es» — el dueño.
    const enMora = opcionesDeMonto({ cuota: 20000, saldoPendiente: 520000, alDia: 175000 })
    expect(enMora.map((o) => [o.id, o.monto])).toEqual([['cuota', 20000], ['alDia', 175000], ['todo', 520000]])
    // Al día: «ponerse al día» sería la misma cuota; no se pinta dos veces.
    expect(opcionesDeMonto({ cuota: 20000, saldoPendiente: 520000, alDia: 20000 }).map((o) => o.id)).toEqual(['cuota', 'todo'])
    // La última cuota: la cuota YA es todo. Una pastilla, y dice lo que pasa.
    const ultima = opcionesDeMonto({ cuota: 20000, saldoPendiente: 20000 })
    expect(ultima).toHaveLength(1)
    expect(ultima[0].significa).toBe('salda el préstamo')
    // Una cuota mayor que lo que debe no cobra de más.
    expect(opcionesDeMonto({ cuota: 20000, saldoPendiente: 12000 })[0].monto).toBe(12000)
  })

  it('no deja cobrar más de lo que debe, ni adivina en cuánto queda', () => {
    expect(atajos).toMatch(/const pasaDelSaldo = saldo > 0 && cuanto > saldo/)
    expect(atajos).toMatch(/const listo = cuanto > 0 && !pasaDelSaldo && !ocupado/)
    // «Queda en…» NO se deriva restando aquí: eso lo dice el servidor en el recibo.
    expect(atajos).not.toMatch(/saldo - cuanto|saldoPendiente - /)
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
