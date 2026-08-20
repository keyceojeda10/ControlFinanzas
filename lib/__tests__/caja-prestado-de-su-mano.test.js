import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── «LO QUE PRESTÓ HOY» CONTABA LO QUE NO SALIÓ DE SU MANO ──────────────────
//
// La tarjeta de la ficha del cobrador rotula su cifra como «lo que de verdad
// salió de su mano», pero sumaba TAMBIÉN los desembolsos hechos por
// transferencia — que salen del negocio, no de su fajo.
//
// Cazado con la prueba de flujo (`scripts/prueba-dinero`), que monta un negocio
// de mentira y compara contra la cuenta a mano:
//
//     «Lo que prestó hoy» · efectivo   debería 347.000   decía 560.000
//
// Los 213.000 de diferencia eran un préstamo desembolsado por transferencia.
// Y tres renglones más abajo, en la misma pantalla, la línea «Prestó en
// efectivo» decía 347.000 — la correcta. La pantalla se contradecía a sí misma,
// que es justo lo que hace que un cobrador deje de creerle al sistema.
//
// En producción: 78 desembolsos por transferencia, $64.010.000 mal atribuidos
// al fajo de algún cobrador.

const src = readFileSync(resolve(process.cwd(), 'app/api/caja/cobrador/[id]/route.js'), 'utf8')

describe('la tarjeta cuenta solo lo que salió del fajo', () => {
  it('hay un criterio único de «en efectivo»', () => {
    expect(src).toMatch(/const enEfectivo = \(d\) => d\.metodoPago !== 'transferencia'/)
  })

  it('el total en efectivo FILTRA lo digital', () => {
    // Era: sum(desembolsos, 'monto') — todos, sin mirar el método.
    expect(src).toMatch(/const efectivoTotal = sum\(desembolsos\.filter\(enEfectivo\), 'monto'\)/)
  })

  it('nuevos y renovaciones filtran igual', () => {
    const bloque = src.slice(src.indexOf('const prestadoDetalle = {'), src.indexOf('tarjetaMuestra'))
    expect((bloque.match(/\.filter\(enEfectivo\)/g) ?? []).length).toBe(2)
  })

  it('lo que salió por transferencia se enseña APARTE, no se esconde', () => {
    // Si solo se restara, el prestamista echaría en falta la diferencia y
    // pensaría que el sistema perdió plata.
    expect(src).toMatch(/transferenciaTotal: sum\(desembolsos\.filter\(\(d\) => !enEfectivo\(d\)\), 'monto'\)/)
    const bloque = src.slice(src.indexOf('const prestadoDetalle = {'), src.indexOf('tarjetaMuestra'))
    expect((bloque.match(/transferencia: sum\(/g) ?? []).length).toBe(2)
  })
})

describe('la línea de la cuenta y la tarjeta usan el MISMO criterio', () => {
  it('la línea «Prestó en efectivo» ya descontaba lo digital', () => {
    /* La resta se conserva; lo que cambió es la PREGUNTA. Ya no es «¿fue por
       transferencia?» sino «¿entró al fajo?», porque desde el selector de
       cuenta una transferencia a la cuenta DEL COBRADOR sí es plata suya.
       Ver `lib/__tests__/de-quien-es-la-cuenta.test.js`. */
    expect(src).toMatch(/!entraAlFajo\(d\.metodoPago, d\.metodoPagoId, cuentasCobrador\)/)
    expect(src).toMatch(/const prestadoEfectivoNeto = prestadoNeto - prestadoDigital/)
  })

  it('y la tarjeta ahora también', () => {
    // El fallo no era que faltara el dato —`metodoPago` ya venía en el select—
    // sino que dos cifras de la misma pantalla lo usaban de forma distinta.
    //
    // ⚠ Esto exigía el `select` ENTERO y literal, y luego hubo que añadirle
    // `metodoPagoId` para poder decir «Nequi» en vez de «Transferencia». Lo que
    // importa es que el método viaje, no el orden de los campos.
    // Se ancla al `select` de la consulta de desembolsos, no a una ventana de
    // N caracteres: los comentarios de ese bloque crecen y la ventana se queda
    // corta sin que nada esté roto.
    expect(src, 'el desembolso dejó de traer su método de pago')
      .toMatch(/select: \{ referenciaId: true,[^}]*metodoPago: true/)
    expect(src, 'y dejó de traer a QUÉ cuenta')
      .toMatch(/select: \{ referenciaId: true,[^}]*metodoPagoId: true/)
  })
})

describe('la renovación dice POR DÓNDE entregó', () => {
  // Ni siquiera leía el campo del cuerpo, así que su desembolso quedaba con
  // método `null` y la caja lo contaba como efectivo SIEMPRE. Renovar pagando
  // por Nequi le pedía al cobrador un fajo que nunca tuvo — el mismo fallo que
  // la tarjeta, pero en el otro extremo.
  const renovar = readFileSync(resolve(process.cwd(), 'app/api/prestamos/[id]/renovar/route.js'), 'utf8')
  const pantalla = readFileSync(resolve(process.cwd(), 'components/prestamos/RenovarPrestamo.jsx'), 'utf8')

  it('el API lo lee del cuerpo', () => {
    expect(renovar).toMatch(/metodoPago: metodoPagoDesembolso, metodoPagoId: metodoPagoIdDesembolso/)
  })

  it('sin método se asume efectivo, como al crear un préstamo', () => {
    expect(renovar).toMatch(/const cuentaDesembolso = metodoPagoDesembolso === 'transferencia' \? 'transferencia' : 'efectivo'/)
  })

  it('y lo escribe en el movimiento de capital', () => {
    const bloque = renovar.slice(renovar.indexOf("tipo: 'desembolso'"))
    expect(bloque.slice(0, 900)).toMatch(/metodoPago: cuentaDesembolso/)
    expect(bloque.slice(0, 900)).toMatch(/metodoPagoId: cuentaDesembolsoId/)
  })

  it('la pantalla deja elegir la cuenta y lo manda', () => {
    // Sin esto el API nuevo no sirve de nada: nadie le mandaría el campo.
    expect(pantalla).toMatch(/import MetodoPagoSelector/)
    expect(pantalla).toMatch(/metodoPago: 'transferencia', metodoPagoId: cuentaEntrega\.metodoPagoId/)
  })

  it('el rótulo sigue a la cuenta elegida', () => {
    // Decir «Le entregas en efectivo» cuando se pagó por Nequi es exactamente
    // lo que descuadraba el fajo.
    expect(pantalla).toMatch(/Le entregas por \$\{cuentaEntrega\.plataforma/)
  })

  it('solo se pregunta si hay algo que entregar', () => {
    // Renovar por lo justo del saldo no mueve un peso: un selector ahí sería
    // ruido en la pantalla más usada del día.
    expect(pantalla).toMatch(/metodosPago\.length > 0 && enMano > 0/)
  })

  it('⚠ Y LAS CUENTAS SE CARGAN AL ABRIR LA RENOVACIÓN', () => {
    /* Esto es lo que faltaba y no cazó ninguna prueba: el API aceptaba el
       método, el componente tenía su selector… y la lista llegaba VACÍA, así
       que `metodosPago.length > 0` lo escondía. Desplegado y sin nada que
       elegir en pantalla.

       Reportado por el dueño: «aún las renovaciones no dejan escoger de qué
       medio salen». Las cuentas solo se pedían al abrir la hoja de intereses.

       La lección: comprobar el componente no basta si nadie le pasa los datos.
       Por eso esta prueba mira la PÁGINA, no el componente. */
    const pagina = readFileSync(resolve(process.cwd(), 'app/(dashboard)/prestamos/[id]/page.jsx'), 'utf8')
    expect(pagina, 'las cuentas no se cargan al renovar: el selector saldrá vacío')
      .toMatch(/if \(\(!modalIntereses && !modalRenovar\) \|\| metodosPagoOrg\.length\) return/)
    expect(pagina, 'el efecto no se vuelve a disparar al abrir la renovación')
      .toMatch(/\}, \[modalIntereses, modalRenovar, metodosPagoOrg\.length\]\)/)
    expect(pagina, 'y la lista tiene que llegar al componente')
      .toMatch(/metodosPago=\{metodosPagoOrg\}/)
  })
})

describe('la prueba de flujo que lo cazó sigue en pie', () => {
  it('comprueba el fajo contra la cuenta a mano', () => {
    const guion = readFileSync(resolve(process.cwd(), 'scripts/prueba-dinero/prueba-dinero.mjs'), 'utf8')
    expect(guion).toMatch(/function comprobarElFajo/)
    // Las cinco líneas de su pantalla, una por una. Comprobar solo la suma no
    // sirve: el 27 de julio dos errores que se anulaban la dejaron correcta.
    for (const id of ['recaudoEfectivo', 'recaudoDigital', 'desembolsos', 'gastos', 'aLaCuenta']) {
      expect(guion, `dejó de comprobar la línea ${id}`).toContain(`revisar('${id}'`)
    }
  })

  it('el libro separa lo que salió del fajo de lo que salió del negocio', () => {
    const libro = readFileSync(resolve(process.cwd(), 'scripts/prueba-dinero/libro.mjs'), 'utf8')
    expect(libro).toMatch(/desembolsadoEfectivo/)
    expect(libro).toMatch(/return libro\.recogidaEfectivo - libro\.desembolsadoEfectivo - libro\.gastos/)
  })
})
