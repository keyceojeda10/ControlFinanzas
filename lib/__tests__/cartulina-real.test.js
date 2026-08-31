// lib/__tests__/cartulina-real.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Al tomar una foto a la cartulina, sí está extrayendo, pero está extrayendo
//  pocos datos y datos malos. En la cartulina dice 300 y 500 —prestó 500 y va
//  pagado 300— pero dice literalmente como si fueran 500 pesos, no 500 mil. Y
//  en el otro modo, el que lee una imagen, ni siquiera extrae absolutamente
//  nada. Eso es nuestra premisa principal.»           — el dueño, 17 ago 2026
//
// Las primeras dos cartulinas REALES que llegan de un cliente (CRÉDITOS SALGAR,
// Lorena y Cristian Fernando). Medido contra ellas, el lector tenía cuatro
// fallos, y el peor no era de lectura sino de que NO CONTESTABA:
//
//   fin=MAX_TOKENS · pensó 979 tokens · escribió 39
//   → «```json { "nombre": "Lorena", "telefono": "31607782»   ← cortado
//
// Estas pruebas no llaman a Gemini —eso se mide con
// `.auditoria/_leer-cartulinas-reales.mjs` contra las fotos de verdad—. Aquí se
// fija lo que se puede fijar sin red: las cuentas y la línea que destrabó todo.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { aPesos, normalizarCliente, completar, montoConTasa, semaforo, TECHO_PRESTAMO, escalaDeLaHoja } from '@/lib/cartulina-datos'

describe('⚠ los números están en miles', () => {
  it('«500» en una cartulina son quinientos mil', () => {
    expect(aPesos(500)).toBe(500000)
    expect(aPesos(30)).toBe(30000)
    expect(aPesos(1200)).toBe(1200000)
  })

  it('lo que ya viene con ceros no se toca', () => {
    /* Algunos escriben el monto entero. Multiplicar otra vez daría mil millones
       en una ficha de un millón. */
    expect(aPesos(500000)).toBe(500000)
    expect(aPesos(1200000)).toBe(1200000)
  })

  /* ── LA ETIQUETA DE ESCALA TAMBIÉN ES UN JUICIO DEL MODELO ──
     Salió simulando que Google estaba caído para ver entrar el respaldo: los dos
     lectores sacaron los MISMOS montos exactos y uno etiquetó la hoja «miles».
     Sin techo, el préstamo de catorce millones y medio se guardaba por catorce
     mil quinientos MILLONES. */
  it('una escala «miles» mal declarada no dispara el monto al espacio', () => {
    /* Lo que devolvieron los dos lectores el 31 ago 2026, con `textoMonto`
       "14.500.000": los ceros ya venían puestos. */
    expect(aPesos(14500000, 'miles')).toBe(14500000)
    expect(aPesos(15000000, 'miles')).toBe(15000000)
  })

  it('pero «miles» SÍ manda cuando el resultado sigue siendo un préstamo', () => {
    /* Éste es el caso para el que se puso la etiqueta y no puede romperse: una
       hoja abreviada donde «14.500» son catorce millones y medio. Por encima del
       umbral de los miles, así que solo la etiqueta puede salvarlo. */
    expect(aPesos(14500, 'miles')).toBe(14500000)
    expect(aPesos(500, 'miles')).toBe(500000)
  })

  it('el techo se queda MUY por encima del préstamo más grande que existe', () => {
    /* Medido contra los 11.565 préstamos de producción: el mayor es de 300
       millones. Si algún día alguien presta más que esto, el techo estorba. */
    expect(TECHO_PRESTAMO).toBeGreaterThanOrEqual(300000000 * 3)
    expect(aPesos(300000000, 'miles')).toBe(300000000)
  })

  /* ── LA ETIQUETA DE LA HOJA SE CONTRASTA CONTRA LA HOJA ──
     El techo de arriba tapa el disparate, no el fallo: en la MISMA tabla mal
     etiquetada, los préstamos de medio millón pasaban a 500 millones —que cabe
     bajo el techo— y quedaban 15 de 21 montos buenos sin que nada avisara. */
  it('una tabla que ya trae los ceros se lee en pesos aunque diga «miles»', () => {
    const tabla = [{ montoPrestado: 14500000 }, { montoPrestado: 500000 }, { montoPrestado: 2700000 }]
    expect(escalaDeLaHoja(tabla, 'miles')).toBe('pesos')
    /* El que se colaba por debajo del techo: éste es el que hay que ver salvado. */
    expect(aPesos(500000, escalaDeLaHoja(tabla, 'miles'))).toBe(500000)
  })

  it('pero el cuaderno de verdad abreviado SIGUE escalándose', () => {
    /* Las cartulinas de Cristian y Lorena: «Valor 1200», «abono 30». Si esta
       regla se los comiera, el préstamo de un millón doscientos valdría $1.200. */
    const cuaderno = [{ montoPrestado: 1200 }, { montoPrestado: 500 }, { montoPrestado: 30 }]
    expect(escalaDeLaHoja(cuaderno, 'miles')).toBe('miles')
    expect(aPesos(1200, escalaDeLaHoja(cuaderno, 'miles'))).toBe(1200000)
  })

  it('solo desmiente hacia pesos: nunca convierte una hoja en «miles»', () => {
    /* Desmentir al revés inventaría ceros que nadie escribió, que es peor. */
    expect(escalaDeLaHoja([{ montoPrestado: 500 }], 'pesos')).toBe('pesos')
    expect(escalaDeLaHoja([{ montoPrestado: 500 }], null)).toBe(null)
  })

  it('sin cifras que mirar, se queda con lo que dijo el lector', () => {
    expect(escalaDeLaHoja([], 'miles')).toBe('miles')
    expect(escalaDeLaHoja([{ nombre: 'Ana' }], 'miles')).toBe('miles')
  })

  it('la tasa y el número de cobros NO se multiplican', () => {
    /* Es el error que convertiría un 20 % en 20.000 % y 8 cobros en 8.000. */
    const c = normalizarCliente({ montoPrestado: 500, tasaInteres: 20, numeroCuotas: 8, valorCuota: 75 })
    expect(c.montoPrestado).toBe(500000)
    expect(c.valorCuota).toBe(75000)
    expect(c.tasaInteres).toBe(20)
    expect(c.numeroCuotas).toBe(8)
  })
})

describe('⚠ la cartulina de Cristian: «Valor 1200» y «8 x 150»', () => {
  /* No dice el capital ni la tasa. Dice el total y el plan de cobro, que es
     como están escritas casi todas. */
  const leido = { nombre: 'Cristian Fernando', tipoPrestamo: 'plata', totalAPagar: 1200, valorCuota: 150, numeroCuotas: 8 }

  it('el total y la cuota cuadran entre sí', () => {
    const c = normalizarCliente(leido)
    expect(c.totalAPagar).toBe(1200000)
    expect(c.valorCuota).toBe(150000)
    expect(c.valorCuota * c.numeroCuotas).toBe(c.totalAPagar)
  })

  it('con la tasa del prestamista sale el capital', () => {
    /* La pantalla del lote ya pide el interés una vez arriba («INTERÉS 20»).
       1.200.000 / 1,20 = 1.000.000. */
    const c = normalizarCliente(leido)
    expect(montoConTasa(c, 20)).toBe(1000000)
  })

  it('sin tasa devuelve el total, no vacío', () => {
    /* Antes esto era `montoPrestado` ausente y la ficha llegaba en blanco. Es
       preferible el total —que el prestamista corrige de un toque mirando su
       propia cartulina— a mandarlo a escribirlo todo a mano. */
    const c = normalizarCliente(leido)
    expect(montoConTasa(c, null)).toBe(1200000)
  })

  it('no se pinta en rojo por no traer el capital', () => {
    /* En rojo la ficha se manda a escribir a mano: se descartaba una lectura
       buena por pedirle al papel un dato que el papel no tiene. */
    expect(semaforo(normalizarCliente(leido))).not.toBe('rojo')
  })
})

describe('⚠ la cartulina de Lorena: dos préstamos en el mismo papel', () => {
  /* Arriba, en grande, el préstamo viejo (240, ya saldado). Abajo, en la tabla,
     el que sigue vivo: abonos de 75 y saldo 375. */
  const leido = { nombre: 'Lorena', totalAPagar: 240, montoPagadoHasta: 225, saldoPendiente: 375, frecuencia: 'semanal' }

  it('nadie debe más de lo que vale su préstamo', () => {
    /* La señal es aritmética y no hace falta ver la foto: el saldo salía MAYOR
       que el total. Cuando eso pasa mandan las dos cifras de la tabla, que es
       lo que se ha estado cobrando. */
    const c = normalizarCliente(leido)
    expect(c.saldoPendiente).toBe(375000)
    expect(c.montoPagadoHasta).toBe(225000)
    expect(c.totalAPagar).toBe(600000)   // 375 + 225, el préstamo de verdad
  })

  it('y se dice cuál se tomó, en vez de elegir en silencio', () => {
    const c = normalizarCliente(leido)
    expect(c._avisoTotal).toMatch(/240.000/)
    expect(c._avisoTotal).toMatch(/600.000/)
  })

  it('con el 20% del prestamista, el capital da los $500.000 que prestó', () => {
    const c = normalizarCliente(leido)
    expect(montoConTasa(c, 20)).toBe(500000)
  })

  it('la columna de saldos manda sobre la de abonos', () => {
    /* En el renglón donde el prestamista ENTREGÓ los 500, el número está en la
       columna «abono», así que el modelo lo cuenta como un pago más: decía 300
       abonados donde van 225. El saldo es la cuenta que él lleva a mano cobro a
       cobro, y 600 − 375 = 225 al peso. */
    const c = normalizarCliente({ nombre: 'Lorena', totalAPagar: 600, valorCuota: 75, montoPagadoHasta: 300, saldoPendiente: 375 })
    expect(c.montoPagadoHasta).toBe(225000)
    expect(c.cuotasPagadas).toBe(3)
    expect(c._avisoAbonado).toMatch(/300.000/)
    expect(c._avisoAbonado).toMatch(/225.000/)
  })

  it('⚠ y NO se toca un total que solo está pagado a medias', () => {
    /* Mi primera versión reparaba con `saldo + pagado > total`, que también se
       cumple cuando el modelo cuenta un abono de más: subía el préstamo de
       Lorena de 600.000 a 675.000 y estropeaba una lectura buena. La condición
       es `saldo > total`, que no tiene otra explicación posible. */
    const c = normalizarCliente({ nombre: 'Ana', totalAPagar: 600, montoPagadoHasta: 300, saldoPendiente: 375 })
    expect(c.totalAPagar).toBe(600000)
    expect(c._avisoTotal).toBeUndefined()
  })

  it('un préstamo normal no dispara el aviso', () => {
    /* Si saltara siempre, se aprendería a ignorarlo. */
    const c = normalizarCliente({ nombre: 'Ana', totalAPagar: 600, montoPagadoHasta: 225, saldoPendiente: 375 })
    expect(c.totalAPagar).toBe(600000)
    expect(c._avisoTotal).toBeUndefined()
  })
})

describe('⚠ lo que se puede deducir, se deduce', () => {
  it('«8 x 150» dice el total sin que nadie lo escriba', () => {
    expect(completar({ valorCuota: 150000, numeroCuotas: 8 }).totalAPagar).toBe(1200000)
  })

  it('con total y capital, la tasa sale sola', () => {
    expect(completar({ totalAPagar: 1200000, montoPrestado: 1000000 }).tasaInteres).toBe(20)
  })

  it('el plazo en días sale de los cobros y la frecuencia', () => {
    /* «8 x 150» son 8 COBROS. El lector los metía en `diasPlazo` y un préstamo
       de ocho semanas quedaba a ocho días. */
    expect(completar({ numeroCuotas: 8, frecuencia: 'semanal' }).diasPlazo).toBe(56)
    expect(completar({ numeroCuotas: 8, frecuencia: 'quincenal' }).diasPlazo).toBe(120)
  })

  it('lo abonado sale del total menos el saldo', () => {
    expect(completar({ totalAPagar: 600000, saldoPendiente: 375000 }).montoPagadoHasta).toBe(225000)
  })

  it('sin datos no inventa nada', () => {
    expect(completar({ nombre: 'Ana' })).toEqual({ nombre: 'Ana' })
  })
})

describe('⚠ el lector tiene que llegar a CONTESTAR', () => {
  const src = readFileSync(resolve(process.cwd(), 'lib/cartulina.js'), 'utf8')

  it('el pensamiento va apagado', () => {
    /* ESTA es la línea que destrabó la premisa del producto. `gemini-2.5-flash`
       razona antes de contestar y ese razonamiento sale del MISMO
       `maxOutputTokens`: con 1024 se lo gastaba pensando (979 tokens) y el JSON
       llegaba partido a la mitad. No fallaba la lectura: fallaba la respuesta. */
    expect(src, 'volvió el pensamiento y el JSON se corta otra vez')
      .toMatch(/thinkingConfig: \{ thinkingBudget: 0 \}/)
  })

  it('una clave caída o un tropiezo de Google no tumban la lectura', () => {
    /* Probando estas cartulinas salieron los dos: un 503 «high demand» y una de
       las cinco claves con 403 «denied access». Con el código viejo, cualquiera
       de los dos reventaba en la primera clave teniendo cuatro sanas al lado. */
    const bucle = src.slice(src.indexOf('for (const key of GEMINI_KEYS)'), src.indexOf('throw new Error(ultimo429'))
    for (const codigo of ['429', '503', '500', '403', '401']) {
      expect(bucle, `un ${codigo} no pasa a la siguiente clave`).toContain(codigo)
    }
  })
})

describe('⚠ media hoja de cuaderno no se devuelve como si fuera entera', () => {
  const src = readFileSync(resolve(process.cwd(), 'lib/cartulina.js'), 'utf8')

  it('si el modelo se queda sin sitio, se dice', () => {
    /* Es el fallo del pensamiento por la otra punta. Una lista cortada tiene dos
       finales, los dos malos: no parsea —«no pudimos leer la foto», y la foto
       estaba bien— o parsea de milagro porque el corte cayó equilibrado y se
       guardan VEINTE clientes de treinta sin que nadie se entere. Ese es el
       peligroso: una hoja a medias parece una hoja entera.

       Comprobado con una hoja de 60 renglones: con el presupuesto viejo avisa,
       con el nuevo devuelve los 60. */
    expect(src).toMatch(/finishReason === 'MAX_TOKENS'/)
    expect(src).toMatch(/más renglones de los que caben/)
  })

  it('la lista tiene MUCHO más presupuesto que una cartulina suelta', () => {
    /* Una cartulina gasta ~130 tokens de salida; una hoja de treinta renglones,
       unos 5.400 —y cada cliente engordó cuatro campos el 17 ago—. Con el mismo
       presupuesto para las dos, el cuaderno entero se corta. */
    const lote = readFileSync(resolve(process.cwd(), 'app/api/herramientas/leer-cartulinas-lote/route.js'), 'utf8')
    const suyo = Number((lote.match(/maxTokens: (\d+)/) ?? [])[1])
    const porDefecto = Number((src.match(/maxTokens = (\d+) \} = \{\}\) \{/) ?? [])[1])
    expect(suyo).toBeGreaterThanOrEqual(12288)
    expect(suyo).toBeGreaterThan(porDefecto * 4)
  })
})

describe('⚠ el prompt no adivina la frecuencia', () => {
  const src = readFileSync(resolve(process.cwd(), 'lib/cartulina.js'), 'utf8')

  it('sin tabla de abonos, se omite', () => {
    /* La cartulina de Cristian tiene la tabla vacía y el modelo contestaba
       «diario»: ocho cobros diarios de $150.000 en un préstamo de un millón.
       Una frecuencia inventada cambia el calendario entero, y el prestamista ya
       la pone una vez arriba para toda la tanda. */
    expect(src).toMatch(/LA FRECUENCIA SOLO SALE DE AHÍ/)
    expect(src).toMatch(/OMITE "frecuencia"/)
  })

  it('y el ejemplo de los dos préstamos va con sus números', () => {
    /* Sin el ejemplo, el modelo sumaba los abonos de la hoja entera: 750.000
       donde van 225.000. Con él, tres pasadas seguidas dieron lo mismo. */
    expect(src).toMatch(/el préstamo vivo es de 600/)
    expect(src).toMatch(/3 abonos de 75/)
  })
})

describe('⚠ el prompt sabe cómo son los papeles de verdad', () => {
  const src = readFileSync(resolve(process.cwd(), 'lib/cartulina.js'), 'utf8')

  it('avisa de que los rótulos impresos mienten', () => {
    /* En la cartulina de Lorena el teléfono está en el renglón «VENDEDOR» y la
       dirección en «BARRIO». Leyendo por el rótulo se pierden los dos. */
    expect(src).toMatch(/RÓTULOS IMPRESOS MIENTEN/)
    expect(src).toMatch(/VENDEDOR/)
  })

  it('explica la tabla de abonos, que es media cartulina', () => {
    expect(src).toMatch(/FECHA · ABONO · SALDO/)
    expect(src).toMatch(/ÚLTIMO saldo/)
  })

  it('distingue plata de mercancía', () => {
    expect(src).toMatch(/"plata\|mercancia"/)
  })

  it('las fechas van día-mes-año', () => {
    /* «13-05-26» se leía como 2013. */
    expect(src).toMatch(/13-05-26.*13 de mayo de 2026/)
  })
})
