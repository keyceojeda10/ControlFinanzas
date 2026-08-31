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

describe('⚠ más claves NO arreglan un 503', () => {
  const raiz2 = join(import.meta.dirname, '..', '..')
  const src = readFileSync(join(raiz2, 'lib/cartulina.js'), 'utf8')

  it('hay un modelo de respaldo, no solo más claves', () => {
    /* El 503 dice «este modelo tiene mucha demanda»: es capacidad del MODELO,
       no cuota de la clave. Diez claves de la misma cuenta pegan diez veces
       contra la misma puerta. Medido el 31 ago 2026: `gemini-3.5-flash` daba
       503 en el mismo minuto en que `gemini-2.5-flash` respondía 12 de 12. */
    expect(src).toMatch(/const MODELOS = \[/)
    const lista = /const MODELOS = \[([^\]]+)\]/.exec(src)[1]
    expect(lista.split(',').length).toBeGreaterThanOrEqual(2)
  })

  it('el principal sigue siendo el de siempre', () => {
    /* `flash-lite` salió 40 % más rápido con la misma calidad, pero eso se midió
       con UNA tabla y este lector también lee cartulinas manuscritas. Se queda
       de respaldo: disponibilidad sin apostar lo que ya funciona. */
    const lista = /const MODELOS = \[([^\]]+)\]/.exec(src)[1]
    expect(lista.trim().startsWith("'gemini-2.5-flash'")).toBe(true)
  })

  it('⚠ un 503 se reintenta ANTES de cambiar de modelo', () => {
    /* Se rendía al primer intento y el prestamista leía «el lector está
       saturado» por un pico de dos segundos, con la foto en la mano. */
    const fn = src.slice(src.indexOf('export async function llamarGemini'))
    expect(fn).toMatch(/503[\s\S]{0,200}dormir\(ESPERA_REINTENTO_MS\)[\s\S]{0,80}pega\(\)/)
  })

  it('el cuerpo se arma una sola vez, no dos', () => {
    /* Dos copias del cuerpo divergen el día que alguien toque un parámetro en
       una sola: el reintento pediría otra cosa que el intento. */
    const fn = src.slice(src.indexOf('export async function llamarGemini'))
    expect((fn.match(/body: cuerpo/g) ?? []).length).toBe(1)
    expect(fn).not.toMatch(/body: JSON\.stringify/)
  })

  it('las claves siguen sirviendo para lo suyo: el 429', () => {
    const fn = src.slice(src.indexOf('export async function llamarGemini'))
    expect(fn).toMatch(/res\.status === 429[\s\S]{0,60}continue/)
    expect(fn).toMatch(/for \(const key of GEMINI_KEYS\)/)
  })
})

describe('⚠ un total que no es de estos clientes', () => {
  it('no inventa que faltan dos tercios de la hoja', () => {
    /* Salió verificando de punta a punta: la segunda captura del cliente trae
       el FINAL de una tabla —con su total de 86.814.000— y debajo una tabla
       nueva con sus propios veinte préstamos. El cuadre comparó el total de la
       primera con los clientes de la segunda: «faltan $56.864.000». Cierto en
       la resta y falso en la conclusión.

       Una alarma que se equivoca enseña a ignorar todas las demás. */
    const leidos = [2000000, 3000000, 2500000, 500000, 200000, 800000, 500000,
      300000, 400000, 10000000, 1700000, 1000000, 1500000, 2000000, 1000000,
      500000, 300000, 700000, 650000, 400000].map((m) => ({ montoPrestado: m }))
    expect(cuadreDelTotal(86814000, leidos)).toBeNull()
  })

  it('pero una falta de verdad sigue saltando', () => {
    /* El caso real que hay que conservar: 79,8 de 86,8 millones son el 92 %, muy
       por encima del corte, y ahí sí faltaban tres préstamos. */
    const r = cuadreDelTotal(86814000, [{ montoPrestado: 79814000 }])
    expect(r.cuadra).toBe(false)
    expect(r.falta).toBe(7000000)
  })

  it('y el prompt le pide al lector que no dé un total ajeno', async () => {
    const { PROMPT_LOTE } = await import('@/lib/cartulina')
    expect(PROMPT_LOTE).toMatch(/SOLO si ese total es de LOS CLIENTES QUE ESTÁS DEVOLVIENDO/)
  })
})

describe('⚠ cuando Google entero está fuera, se prueba otra casa', () => {
  const raiz3 = join(import.meta.dirname, '..', '..')
  const src = readFileSync(join(raiz3, 'lib/cartulina.js'), 'utf8')

  it('el respaldo es de OTRO proveedor, no otro modelo del mismo', () => {
    /* Otro modelo de Google no sirve cuando Google no está. Medido el 31 ago
       2026, tres vueltas cada uno y en el mismo momento: Gemini 8,9 s de media
       pero UNA de las tres falló; DeepSeek sin razonar 22,2 s y ninguna falló. */
    expect(src).toContain('deepseek-v4-flash-vision-exp')
    expect(src).toContain('api.deepseek.com')
  })

  it('⚠ va SIN razonamiento, que es toda la diferencia', () => {
    /* Por defecto razona: la primera prueba se gastó los 12.288 tokens
       pensando, devolvió el contenido VACÍO y tardó 233 segundos. Con el
       razonamiento apagado baja a 22 s y acierta igual. Es el mismo fallo que
       tenía Gemini y que se arregló con `thinkingBudget: 0`. */
    const fn = src.slice(src.indexOf('async function llamarDeepSeekVision'))
    expect(fn).toMatch(/thinking: \{ type: 'disabled' \}/)
  })

  it('y es el ÚLTIMO recurso, no el primero', () => {
    /* Es dos veces y media más lento: solo entra cuando no queda otra. */
    expect(src.indexOf('for (const MODELO of MODELOS)'))
      .toBeLessThan(src.indexOf('const otra = await llamarDeepSeekVision'))
  })

  it('una respuesta cortada no se devuelve como buena', () => {
    /* Una hoja de cuaderno a medias parece una hoja entera, y se guardarían
       veinte clientes de treinta sin que nadie se entere. */
    const fn = src.slice(src.indexOf('async function llamarDeepSeekVision'))
    expect(fn).toMatch(/finish_reason === 'length'[\s\S]{0,30}return null/)
  })

  it('sin clave de DeepSeek no revienta: simplemente no hay respaldo', () => {
    const fn = src.slice(src.indexOf('async function llamarDeepSeekVision'))
    expect(fn).toMatch(/if \(!clave\) return null/)
  })
})
