/* QUÉ DATO DE LA FOTO NO HAY QUE CREERSE.
 *
 * Los casos son los REALES de las dos capturas que mandó un cliente el 31 ago
 * 2026: una tabla de 40 préstamos con una columna por mes. El lector devolvía
 * 21 filas con un semáforo por fila y ninguna pista de qué celda mirar. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dudasDe, cuadreDelTotal, esSoloDia } from '@/lib/cartulina-dudas'

const campos = (ds) => ds.map((d) => d.campo)

describe('la fecha que no era una fecha', () => {
  it('reconoce el día suelto en todas las formas del papel', () => {
    /* La columna «Fecha» de esa tabla trae el día en que cobra, escrito de
       cinco maneras distintas en la misma hoja. */
    expect(esSoloDia('26/')).toBe(26)
    expect(esSoloDia('16/')).toBe(16)
    expect(esSoloDia('5/')).toBe(5)
    expect(esSoloDia('26')).toBe(26)
    expect(esSoloDia('30')).toBe(30)
  })

  it('⚠ y NO confunde una fecha de verdad con un día', () => {
    /* En la misma hoja conviven las dos: «09-04» sí es una fecha. Si esto
       fallara, marcaríamos como dudosas las que están bien. */
    expect(esSoloDia('09-04')).toBeNull()
    expect(esSoloDia('22-07-2026')).toBeNull()
    expect(esSoloDia('13/06')).toBeNull()
    expect(esSoloDia('')).toBeNull()
    expect(esSoloDia(null)).toBeNull()
    expect(esSoloDia('99')).toBeNull()     // no hay día 99
  })

  it('avisa cuando se construyó una fecha a partir de un día suelto', () => {
    /* El caso de Velez: el papel dice «16/» y el lector devolvió 2026-03-16,
       inventándose marzo. */
    const d = dudasDe({ nombre: 'Velez', montoPrestado: 14500000, fechaInicio: '2026-03-16' },
      { textoFecha: '16/' })
    expect(campos(d)).toContain('fechaInicio')
    expect(d[0].texto).toMatch(/solo está el día 16/)
    expect(d[0].dato).toBe('16/')          // se enseña lo que dice el papel
  })

  it('no molesta cuando la fecha del papel estaba completa', () => {
    const d = dudasDe({ nombre: 'Angelica', montoPrestado: 3000000, fechaInicio: '2026-04-09' },
      { textoFecha: '09-04' })
    expect(campos(d)).not.toContain('fechaInicio')
  })
})

describe('la escala, que es el fallo de dinero más caro', () => {
  it('⚠ avisa cuando no se puede saber si son miles', () => {
    /* «14500» sin puntos puede ser catorce mil quinientos o catorce millones y
       medio. El umbral de la app deja pasar todo lo que supere 10.000, así que
       un préstamo de 14 millones se guardaba como 14 mil sin que nadie lo
       viera. Aquí no se adivina: se pregunta. */
    const d = dudasDe({ nombre: 'Velez', montoPrestado: 14500 }, { textoMonto: '14500' })
    const m = d.find((x) => x.campo === 'monto')
    expect(m.texto).toContain('$14.500')
    expect(m.texto).toContain('$14.500.000')
  })

  it('y NO avisa cuando el papel trae los puntos de miles', () => {
    const d = dudasDe({ nombre: 'Velez', montoPrestado: 14500000 }, { textoMonto: '14.500.000' })
    expect(campos(d)).not.toContain('monto')
  })
})

describe('dos préstamos metidos en una celda', () => {
  it('avisa con el «+» y con las dos cifras seguidas', () => {
    /* Los dos casos reales: «500.000 + 1.500.000» (Amigo flor) y
       «1.500.000 1.500.000» (Plazas). El lector se quedaba con uno. */
    for (const texto of ['500.000 + 1.500.000', '1.500.000 1.500.000']) {
      const d = dudasDe({ nombre: 'x', montoPrestado: 500000 }, { textoMonto: texto })
      expect(d.some((x) => /más de una cifra/.test(x.texto)), texto).toBe(true)
    }
  })

  it('una cifra sola no dispara nada', () => {
    const d = dudasDe({ nombre: 'x', montoPrestado: 5000000 }, { textoMonto: '5.000.000' })
    expect(d).toHaveLength(0)
  })
})

describe('cifras que nadie escribió', () => {
  it('⚠ marca lo que el lector DEDUJO como si lo hubiera leído', () => {
    /* El caso más peligroso de todos: el lector devolvía «saldo 8.410.000» y
       «pagado 6.090.000» calculándolos él (cuota × meses). Números inventados
       con pinta de leídos. */
    const d = dudasDe(
      { nombre: 'Velez', montoPrestado: 14500000, saldoPendiente: 8410000, montoPagadoHasta: 6090000 },
      { calculados: ['saldoPendiente', 'montoPagadoHasta'] })
    expect(campos(d)).toContain('saldoPendiente')
    expect(campos(d)).toContain('montoPagadoHasta')
    expect(d.find((x) => x.campo === 'saldoPendiente').texto).toMatch(/no está escrito/)
  })

  it('si el papel SÍ lo traía, no se marca', () => {
    const d = dudasDe({ nombre: 'x', montoPrestado: 1000000, saldoPendiente: 300000 },
      { saldoPendienteTexto: '300.000' })
    expect(campos(d)).not.toContain('saldoPendiente')
  })
})

describe('lo que falta, dicho por su nombre', () => {
  it('sin cifra y sin nombre se dice cuál falta, no «revisa la fila»', () => {
    const d = dudasDe({}, {})
    expect(campos(d)).toContain('monto')
    expect(campos(d)).toContain('nombre')
  })
})

describe('⚠ el cuadre contra el total del papel', () => {
  /* La comprobación que vale más que todas las demás: estas tablas traen su
     propio total escrito abajo. */
  it('detecta AL PESO lo que se quedó sin leer', () => {
    /* El caso real, con los 21 montos que sacó el lector de la captura. El
       papel decía 86.814.000 y faltaban 7.000.000 exactos: dos clientes
       enteros (3.000.000 y 2.500.000) y el segundo préstamo de un tercero
       (1.500.000). Ninguna heurística de confianza encuentra eso; una resta sí. */
    const leidos = [14500000, 15000000, 7330000, 5000000, 5500000, 2700000, 500000,
      2000000, 1200000, 1000000, 1500000, 5000000, 600000, 700000, 1984000,
      2000000, 5000000, 2800000, 3000000, 2000000, 500000].map((m) => ({ montoPrestado: m }))

    const r = cuadreDelTotal(86814000, leidos)
    expect(r.cuadra).toBe(false)
    expect(r.suma).toBe(79814000)
    expect(r.falta).toBe(7000000)
    expect(r.texto).toContain('faltan $7.000.000')
  })

  it('cuando está todo, dice que cuadra', () => {
    const r = cuadreDelTotal(3000000, [{ montoPrestado: 1000000 }, { montoPrestado: 2000000 }])
    expect(r.cuadra).toBe(true)
    expect(r.falta).toBe(0)
  })

  it('un redondeo no es un cliente perdido', () => {
    /* Con el corte al 0,5 % del total, la diferencia de unos pesos no dispara
       una alarma que haría revisar cuarenta filas para nada. */
    const r = cuadreDelTotal(10000000, [{ montoPrestado: 9995000 }])
    expect(r.cuadra).toBe(true)
  })

  it('también avisa si SOBRA plata', () => {
    /* Una cifra leída de más es tan malo como una de menos: infla la cartera. */
    const r = cuadreDelTotal(1000000, [{ montoPrestado: 1000000 }, { montoPrestado: 500000 }])
    expect(r.cuadra).toBe(false)
    expect(r.texto).toMatch(/sobran \$500\.000/)
  })

  it('sin total en el papel no se inventa un cuadre', () => {
    /* La mayoría de las cartulinas no traen total. Callar es lo correcto: un
       cuadre falso es peor que ninguno. */
    expect(cuadreDelTotal(0, [{ montoPrestado: 100 }])).toBeNull()
    expect(cuadreDelTotal(null, [])).toBeNull()
    expect(cuadreDelTotal(1000, [])).toBeNull()
  })

  it('usa el total a pagar cuando no hay capital', () => {
    const r = cuadreDelTotal(3000000, [{ totalAPagar: 3000000 }])
    expect(r.cuadra).toBe(true)
  })
})

describe('el modelo no sabe qué día es hoy', () => {
  it('⚠ la fecha se sustituye AL LLAMAR, no en la constante', async () => {
    /* Medido contra la tabla real: «09-04» salía como 2024-04-09 porque el
       prompt decía «del año en curso» sin decir cuál es. Con la fecha puesta,
       sale 2026.

       Y va en la llamada y no en la constante a propósito: una constante de
       módulo se congela con la fecha del ARRANQUE del servidor, y este proceso
       lleva semanas en pie — a la semana estaría mintiendo otra vez. */
    const { conFechaDeHoy, PROMPT_LOTE } = await import('@/lib/cartulina')
    const hoy = new Date().toISOString().slice(0, 10)
    expect(PROMPT_LOTE).toContain('{HOY}')            // la constante lleva el hueco
    expect(conFechaDeHoy(PROMPT_LOTE)).toContain(hoy) // y se rellena al usarla
    expect(conFechaDeHoy(PROMPT_LOTE)).not.toContain('{HOY}')
  })

  it('no revienta con un prompt que no lo lleva', () => {
    return import('@/lib/cartulina').then(({ conFechaDeHoy }) => {
      expect(conFechaDeHoy('texto sin marcador')).toBe('texto sin marcador')
    })
  })
})

describe('⚠ una foto con varios clientes no se lee a medias', () => {
  /* Reportado el 31 ago 2026: un cliente subía la tabla de sus cuarenta
     préstamos y «el sistema no reconoce nada». Era literal — el lector de UN
     cliente devolvía `{}`— y lo usan TRES de las cuatro pantallas de fotos. */
  const raiz = join(import.meta.dirname, '..', '..')
  const leer = (p) => readFileSync(join(raiz, p), 'utf8')

  it('el lector de uno PREGUNTA qué está viendo', async () => {
    const { PROMPT_UNO } = await import('@/lib/cartulina')
    expect(PROMPT_UNO).toMatch(/"tipo"/)
    expect(PROMPT_UNO).toMatch(/lista/)
    /* Y sigue sin pedir un array: el que devuelve varios es el del lote. Esta
       línea la protegía ya una prueba anterior; se repite aquí porque el
       cambio de arriba es justo el que podría llevárselo por delante. */
    expect(PROMPT_UNO).not.toMatch(/"clientes"/)
  })

  it('⚠ el endpoint SE PARA en vez de devolver el primero de cuarenta', () => {
    /* Devolver uno solo sería peor que no devolver nada: el prestamista
       guardaría ese creyendo que están todos. */
    const src = leer('app/api/herramientas/leer-cartulina/route.js')
    expect(src).toContain("crudo?.tipo === 'lista'")
    expect(src).toContain("codigo: 'ES_LISTA'")
    expect(src).toContain("irA: '/migrador'")
    // Se para ANTES de construir la respuesta buena.
    expect(src.indexOf('if (esLista)')).toBeLessThan(src.indexOf('const datos = resultados.length === 1'))
  })

  it('el mensaje dice a dónde ir, no solo que no se puede', () => {
    /* «No pudimos leer la foto» manda a repetirla con más luz una y otra vez, y
       la foto estaba perfecta: era el lector equivocado. */
    const src = leer('app/api/herramientas/leer-cartulina/route.js')
    expect(src).toMatch(/Pasar mi cartera/)
  })

  it('las tres pantallas que usan ese lector recogen el aviso', () => {
    const nuevo = leer('app/(dashboard)/clientes/nuevo/page.jsx')
    const migrador = leer('app/(dashboard)/migrador/page.jsx')
    const importar = leer('components/clientes/ImportarCartulina.jsx')

    // Las dos que saben navegar, llevan.
    expect(nuevo).toContain("json.codigo === 'ES_LISTA'")
    expect(migrador).toContain("json.codigo === 'ES_LISTA'")
    // El migrador tiene el lector bueno en otra vista de la MISMA pantalla.
    expect(migrador).toMatch(/ES_LISTA[\s\S]{0,120}irA\('lote'\)/)
    // La tercera no navega, pero al menos ya no dice «prueba con más luz».
    expect(importar).toContain('json.error')
  })
})
