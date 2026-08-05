import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// «No hay ningún valor que sea de ochocientos y pico mil de pesos. Ese valor no
// está por ningún lado. Por eso es que se enreda un montón.»
//
// Comprobado en dos rutas contra produccion:
//   Diego  #8: cobro $824.000 · la pantalla decia $260.000 (faltaban $564.000)
//   Camilo #9: cobro $908.000 · la pantalla decia $282.000 (faltaban $626.000)
//
// Las cuentas estaban BIEN. Lo que faltaba era el total en pantalla.
const api = readFileSync(resolve(process.cwd(), 'app/api/caja/cobrador/[id]/route.js'), 'utf8')
const pantalla = readFileSync(resolve(process.cwd(), 'components/caja/CajaCobradorDetalle.jsx'), 'utf8')
const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8')

describe('el total cobrado se ve', () => {
  it('el API manda total, efectivo y digital', () => {
    // ⚠ ESTA PRUEBA FIJABA `total: cobradoDia`, QUE ERA LA CIFRA EQUIVOCADA.
    // `cobradoDia` lleva dentro el saldo absorbido de las renovaciones, así que
    // «Cobró hoy» enseñaba plata que nadie entregó: $817.785 donde el cobrador
    // había cobrado $428.000. La cifra buena es la NETA — ver
    // `cobrado-sin-absorbido.test.js`, que fija el porqué con el caso real.
    expect(api).toContain('const cobradoTotalHoy = {')
    expect(api).toMatch(/total: cobradoEfectivoNeto \+ cobradoDigital/)
    expect(api).toMatch(/efectivo: cobradoEfectivoNeto/)
    expect(api).toMatch(/digital: cobradoDigital/)
    expect(api, 'no viaja en la respuesta').toMatch(/^\s*cobradoTotalHoy,$/m)
  })

  it('las tres cifras son coherentes: total = efectivo + digital', () => {
    // Asi las define el API: cobradoEfectivo = cobradoDia - cobradoDigital.
    expect(api).toMatch(/const cobradoEfectivo = cobradoDia - cobradoDigital/)
  })

  it('la pantalla enseña el cobro DENTRO del grupo «Entra», partido por método', () => {
    // ⚠ ESTAS DOS PRUEBAS FIJABAN LA TARJETA SUELTA, que era el diseño de la
    // primera versión: el total cobrado arriba y la resta debajo, sin relación
    // visible. El dueño lo señaló como la causa del enredo —«quedó en tres
    // cuadros diferentes»— y ahora la cifra vive DENTRO de la cuenta, como una
    // línea del grupo «Entra». Ver `caja-agrupada.test.js`.
    // Ya no es «Cobró hoy» con el desglose en letra chica: son DOS renglones,
    // que es como lo pidio el dueño —«diferenciar cobros en efectivo, cobros en
    // transferencia»— y como se puede seguir con el dedo.
    expect(pantalla).toContain('Cobró en efectivo')
    expect(pantalla).toContain('Cobró por transferencia')
    // ⚠ AQUÍ DECÍA «el digital NO puede ser una línea de la cuenta», y el
    // motivo era bueno: si entra por un lado y nadie lo saca, se le pide al
    // cobrador un fajo que nunca tuvo.
    //
    // Pero dejarlo FUERA tenía su propio precio, y es el que el dueño reportó:
    // el bloque «ENTRA» lo enseñaba —lo pidió él como renglón— así que su resta
    // con el dedo daba $179.000 de más que la cifra de abajo. Las dos cifras
    // bien, y ninguna era la que se ve.
    //
    // Lo que hay que exigir no es que no entre: es que si entra, SALGA. Eso lo
    // comprueba `caja-transferencia-cuadra`, con las cifras de su ruta #5.
    expect(api, 'el digital entra en la cuenta pero nadie lo saca: la resta no cuadra')
      .toMatch(/id: 'aLaCuenta'/)
    // Y el fajo sigue sin llevarlo, porque la salida cancela a la entrada: las
    // dos con la MISMA variable. Con cifras distintas volvería el fallo viejo.
    const i = api.indexOf('const { lineas: cuenta, suma: cuentaSuma')
    const bloque = api.slice(i, api.indexOf('})', api.indexOf('aLaCuenta', i)))
    expect(bloque.match(/cobradoDigitalNeto/g)?.length,
      'entrada y salida usan cifras distintas: dejan de cancelarse').toBe(2)
  })

  it('en una ruta 100% efectivo no se repite el desglose', () => {
    // Sin transferencias, el total y el efectivo son el mismo numero: enseñar
    // «de eso, en billetes» seria decirlo dos veces.
    expect(pantalla).toMatch(/\(cr\.cobradoDigital \?\? 0\) > 0 &&/)
  })
})

describe('la barra de metodos agrupa por la cuenta real', () => {
  it('usa la FK, no el texto libre', () => {
    // `plataforma` es texto libre y a veces viene vacio: un pago a Nequi caia
    // en una barra aparte llamada «Transferencia». En la ruta #9 salia
    // «Nequi $596.000» + «Transferencia $30.000» siendo los dos Nequi.
    //
    // ⚠ Esta prueba exigia la LINEA LITERAL `const pl = …`, y el desglose se
    // reescribio para contar tambien lo que SALE de cada cuenta. Lo que
    // defiende no ha cambiado —la FK manda sobre el texto libre— y por eso la
    // prueba se queda; lo que se comprueba ahora es el orden de precedencia,
    // no como se llama la variable.
    expect(api).toMatch(/p\.metodoPagoRef\?\.nombre \|\| p\.plataforma/)
  })

  it('y los DESEMBOLSOS por cuenta se nombran igual que los cobros', () => {
    // Los cobros traen el nombre por la relacion; los desembolsos salen de
    // `MovimientoCapital`, que solo guarda el id. Sin resolverlo, prestar por
    // Nequi caia en un cajon «Transferencia» separado del renglon «Nequi» de
    // los cobros: la misma cuenta en dos filas, que es justo el fallo de arriba
    // pero por el otro lado.
    expect(api).toMatch(/const metodosPorId = new Map\(cuentasOrg\.map/)
    expect(api).toMatch(/metodosPorId\.get\(d\.metodoPagoId\)/)
  })

  it('lo que no se puede clasificar se ENSEÑA, no desaparece', () => {
    // Antes un metodo que no fuera efectivo ni transferencia caia en
    // `mp = 'otro'` y ninguna rama lo recogia: el cobro se esfumaba del
    // desglose. Un desglose que se come plata en silencio es peor que ninguno.
    expect(api).toContain("return ['Sin registrar', 'otro']")
  })

  it('y pide esa relacion en el select', () => {
    // Sin pedirla llega `undefined` y el fallback la deja como estaba.
    expect(api).toMatch(/metodoPagoRef: \{ select: \{ nombre: true \} \}/)
  })

  it('la relacion existe en el esquema', () => {
    // Un campo inventado en un `select` es un 500 en runtime que el build no ve.
    expect(schema).toMatch(/metodoPagoRef\s+MetodoPago\?/)
  })
})
