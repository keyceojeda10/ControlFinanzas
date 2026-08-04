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

  it('la pantalla lo pinta, y FUERA de la resta', () => {
    expect(pantalla).toContain('data?.cobradoTotalHoy?.digital')
    expect(pantalla).toContain('Cobró hoy')
    // Si entrara en `cuenta`, la resta del efectivo pediria un fajo que el
    // cobrador nunca tuvo. Tiene que quedarse como contexto.
    expect(api, 'el digital NO puede ser una linea de la cuenta')
      .not.toMatch(/entradas: \[[^\]]*cobradoDigital/s)
  })

  it('en una ruta 100% efectivo la linea no sale', () => {
    // total y efectivo serian el mismo numero: repetirlo es ruido.
    expect(pantalla).toMatch(/\(data\?\.cobradoTotalHoy\?\.digital \?\? 0\) > 0 &&/)
  })
})

describe('la barra de metodos agrupa por la cuenta real', () => {
  it('usa la FK, no el texto libre', () => {
    // `plataforma` es texto libre y a veces viene vacio: un pago a Nequi caia
    // en una barra aparte llamada «Transferencia». En la ruta #9 salia
    // «Nequi $596.000» + «Transferencia $30.000» siendo los dos Nequi.
    expect(api).toMatch(/const pl = p\.metodoPagoRef\?\.nombre \|\| p\.plataforma \|\| 'Transferencia'/)
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
