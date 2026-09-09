import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'
import {
  aNumero, encontrarEncabezado, detectarEscala, aFrecuencia,
  telefonoValido, leerFila, leerExcel,
} from '@/lib/importar/excel'

// Se prueba contra el EXPORT REAL de otro sistema que nos pasó el usuario, no
// contra un archivo de ejemplo inventado. Los archivos inventados están limpios
// y por eso no enseñan nada: este trae 44 teléfonos rotos, ninguna cédula, dos
// préstamos cuya cuota no suma, y los montos en miles.

const ARCHIVO = path.join(process.cwd(), 'CF Diseño 2026', 'Docuemntos para prueba',
  'cred-activos-general-7c08518ae74-2026-07-15-16_15_33.328.xlsx')

const hayArchivo = fs.existsSync(ARCHIVO)

function filasReales() {
  const wb = XLSX.read(fs.readFileSync(ARCHIVO), { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' })
}

describe('aNumero — el punto colombiano separa miles, no decimales', () => {
  it('"1.200.000" es un millón doscientos mil, no 1,2', () => {
    expect(aNumero('1.200.000')).toBe(1200000)
    expect(aNumero('3.600')).toBe(3600)
    expect(aNumero('4000')).toBe(4000)
  })

  it('pero "3.50" cuotas pagadas sí es decimal', () => {
    expect(aNumero('3.50')).toBe(3.5)
    expect(aNumero('0.33')).toBe(0.33)
    expect(aNumero('125.00')).toBe(125)
  })

  it('lo que no es número devuelve null, no NaN ni 0', () => {
    expect(aNumero('')).toBeNull()
    expect(aNumero(null)).toBeNull()
    expect(aNumero('al dia')).toBeNull()
  })
})

describe('detectarEscala — el error de 1000x', () => {
  it('una cartera cuya mediana es 1.000 viene en miles', () => {
    const e = detectarEscala(['1.000', '3.000', '5.000', '1.500', '800'])
    expect(e.sospecha).toBe(true)
    expect(e.factor).toBe(1000)
  })

  it('una cartera en pesos de verdad se deja como está', () => {
    const e = detectarEscala(['1.200.000', '800.000', '3.000.000'])
    expect(e.sospecha).toBe(false)
    expect(e.factor).toBe(1)
  })

  it('mira la MEDIANA: un solo préstamo enorme no decide la escala', () => {
    // Cinco préstamos en miles y uno tecleado ya en pesos.
    const e = detectarEscala(['1.000', '2.000', '900', '1.500', '90.000.000'])
    expect(e.factor).toBe(1000)
  })

  it('sin datos no inventa un factor', () => {
    expect(detectarEscala([]).factor).toBe(1)
    expect(detectarEscala(['', null, 'x']).factor).toBe(1)
  })
})

describe('telefonoValido', () => {
  it('los del archivo real —"312", "222", "3"— no son teléfonos', () => {
    expect(telefonoValido('312')).toBe(false)
    expect(telefonoValido('3')).toBe(false)
    expect(telefonoValido('')).toBe(false)
    expect(telefonoValido('3155616715')).toBe(true)
  })
})

describe('aFrecuencia', () => {
  it('traduce las tres del archivo real', () => {
    expect(aFrecuencia('semanal')).toBe('semanal')
    expect(aFrecuencia('mensual')).toBe('mensual')
    expect(aFrecuencia('quincenal')).toBe('quincenal')
    expect(aFrecuencia('Semanal ')).toBe('semanal')
  })

  it('lo que no reconoce se marca, no se adivina', () => {
    expect(aFrecuencia('cada luna llena')).toBeNull()
    expect(aFrecuencia('')).toBeNull()
  })
})

describe('encontrarEncabezado', () => {
  it('NO da por hecho que los títulos están en la fila 1', () => {
    const filas = [
      ['Reporte general de créditos activos - idApp: 7c08518ae74', '', ''],
      ['ID crédito', 'Nombre', 'Telefono', 'Capital', 'Valor cuota', 'Plazo'],
      ['306', 'Carlos goyo', '312', '1.000', '200', 'semanal'],
    ]
    const cab = encontrarEncabezado(filas)
    expect(cab.indice).toBe(1)
    expect(cab.mapa.nombre).toBe(1)
    expect(cab.mapa.capital).toBe(3)
  })

  it('«Valor cuota» no se confunde con «Cantidad cuotas»', () => {
    const cab = encontrarEncabezado([['Nombre', 'Valor cuota', 'Cantidad cuotas', 'Capital']])
    expect(cab.mapa.cuota).toBe(1)
    expect(cab.mapa.nCuotas).toBe(2)
  })
})

describe('leerFila — anota los reparos, no descarta al cliente', () => {
  const mapa = { nombre: 0, telefono: 1, capital: 2, cuota: 3, nCuotas: 4, interes: 5, plazo: 6 }

  it('un cliente sin teléfono ni cédula SE IMPORTA igual: debe plata', () => {
    const f = leerFila(['Carlos goyo', '312', '1.000', '200', '6', '20', 'semanal'], mapa, 1000)
    expect(f.nombre).toBe('Carlos goyo')
    expect(f.capital).toBe(1_000_000)
    expect(f.reparos.map((r) => r.campo)).toContain('telefono')
    expect(f.reparos.map((r) => r.campo)).toContain('cedula')
  })

  it('detecta el préstamo cuyas cuotas no suman el total', () => {
    // Robinson payares, del archivo real: 5.000 al 20% deberían ser 6.000,
    // pero la única cuota es de 4.000.
    const f = leerFila(['Robinson payares', '222', '5.000', '4000', '1', '20', 'semanal'], mapa, 1000)
    expect(f.reparos.map((r) => r.campo)).toContain('cuota')
  })

  it('y no molesta con los 66 que sí cuadran', () => {
    const f = leerFila(['Carlos goyo', '3155616715', '1.000', '200', '6', '20', 'semanal'], mapa, 1000)
    expect(f.reparos.map((r) => r.campo)).not.toContain('cuota')
  })

  it('no inventa una cédula: un documento falso rompe el pagaré', () => {
    const f = leerFila(['Ana', '3155616715', '1.000', '200', '6', '20', 'semanal'], mapa, 1000)
    expect(f.cedula).toBeNull()
  })

  it('«3.50 cuotas pagadas» se redondea: medio pago no existe', () => {
    const f = leerFila(['Ana', '3155616715', '1.000', '3.50'], { nombre: 0, telefono: 1, capital: 2, pagadas: 3 }, 1)
    expect(f.pagadas).toBe(4)
  })
})

describe.skipIf(!hayArchivo)('contra el archivo real de 68 créditos', () => {
  it('lo lee entero, sin perder ni inventar filas', () => {
    const r = leerExcel(filasReales())
    expect(r.error).toBeUndefined()
    expect(r.filas).toHaveLength(68)
  })

  it('detecta que viene en miles', () => {
    const r = leerExcel(filasReales())
    expect(r.escala.sospecha).toBe(true)
    expect(r.escala.factor).toBe(1000)
  })

  it('la cartera queda en 128 millones, no en 128 mil', () => {
    const r = leerExcel(filasReales())
    // Sin la corrección de escala serían $128.000: un negocio que no existe.
    expect(r.resumen.cartera).toBeGreaterThan(50_000_000)
  })

  it('marca los 45 teléfonos rotos y las 68 cédulas que faltan', () => {
    const r = leerExcel(filasReales())
    const con = (campo) => r.filas.filter((f) => f.reparos.some((x) => x.campo === campo)).length
    /* ⚠ ERAN 44 HASTA EL 9 SEP 2026, y el que se sumó es una mejora: la fila 14
       trae «30279922583052853224», veinte dígitos —dos números pegados—, y el
       filtro viejo lo daba por bueno solo porque pasaba de diez. Ahora el rango
       es 8-15, que es el de los doce países más el máximo de E.164. */
    expect(con('telefono')).toBe(45)
    expect(con('cedula')).toBe(68)
  })

  it('marca exactamente los 2 préstamos que no cuadran, ni uno más', () => {
    const r = leerExcel(filasReales())
    const malos = r.filas.filter((f) => f.reparos.some((x) => x.campo === 'cuota'))
    expect(malos).toHaveLength(2)
    expect(malos.map((f) => f.nombre.trim())).toEqual(['Robinson payares', 'Omar payares'])
  })

  it('reconoce las tres frecuencias y no deja ninguna sin traducir', () => {
    const r = leerExcel(filasReales())
    expect(r.filas.filter((f) => f.frecuencia == null)).toHaveLength(0)
  })
})

/* ══ 9 SEP 2026 · EL EXPORT QUE SE LEÍA ENTERO DEL REVÉS ═════════════════════
 *
 * Un prestamista subió el export de su sistema anterior —124 clientes— y la
 * pantalla dijo «No hay ninguna fila que se pueda importar», con los clientes
 * llamados como su número de cédula y «CC null» debajo.
 *
 * Aquí van SOLO LAS CABECERAS de ese archivo, que no son datos de nadie. Las
 * filas son inventadas y con teléfonos falsos a propósito.
 */
const CABECERAS_DEL_EXPORT = [
  'Documento cliente', 'Nombre cliente', 'Apellido cliente', 'Sucursal',
  'Direccion cliente', 'Telefono cliente', 'Celular cliente',
  'Valor credito', 'Interes credito', 'Saldo credito', 'Fecha credito',
  'Dias credito', 'Tiempo pago', 'Fecha proximo pago', 'Dia pago', 'Abono',
  'Documento codeudor', 'Nombre codeudor', 'Apellido codeudor',
  'Direccion codeudor', 'Telefono codeudor', 'Celular codeudor',
]

const FILA_INVENTADA = [
  '11111111', 'Ana', 'Ruiz', 'PRINCIPAL', 'Calle 1', '000', '966589669',
  '600000', '20.0', '720000', '2026-09-04', '30', '3', '2026-09-19', '4', '0',
  'null', 'null', 'null', 'null', 'null', 'null',
]

describe('el export con codeudor: cada columna en su sitio', () => {
  const cab = () => encontrarEncabezado([CABECERAS_DEL_EXPORT])

  it('⚠ el nombre NO es «Documento cliente», por mucho que contenga «cliente»', () => {
    /* Era el fallo: la búsqueda laxa cogía la primera columna que contuviera la
       palabra, y «Documento cliente» se llevaba el campo `nombre`. Los 124
       clientes se llamaban como su cédula. */
    expect(cab().mapa.nombre).toBe(1)      // «Nombre cliente»
    expect(cab().mapa.apellido).toBe(2)    // «Apellido cliente»
  })

  it('⚠ la cédula del cliente NO es la del codeudor', () => {
    // Iba a la columna 16, «Documento codeudor», vacía en las 124 filas: «CC null».
    expect(cab().mapa.cedula).toBe(0)
  })

  it('⚠ ninguna columna de otra persona se usa para el cliente', () => {
    const mapa = cab().mapa
    for (const [campo, col] of Object.entries(mapa)) {
      expect(/codeudor|fiador|aval|garante|referencia/i.test(CABECERAS_DEL_EXPORT[col]),
        `${campo} apunta a «${CABECERAS_DEL_EXPORT[col]}»`).toBe(false)
    }
  })

  it('«Valor credito» es el monto prestado', () => {
    // Sin esto el archivo decía «no trae el monto prestado» teniéndolo.
    expect(cab().mapa.capital).toBe(7)
  })

  it('«Dias credito» es el plazo, que evita tener que deducirlo de las cuotas', () => {
    expect(cab().mapa.diasPlazo).toBe(11)
  })

  it('y el archivo de julio se sigue leyendo igual que siempre', () => {
    // La regla nueva no puede romper el export que ya funcionaba.
    const viejo = encontrarEncabezado([
      ['ID crédito', 'ID cliente', 'Nombre', 'Telefono', 'Dirección', 'Fecha',
        'Capital', 'Interés', 'Valor cuota', 'Plazo', 'Cantidad cuotas'],
    ])
    expect(viejo.mapa.nombre).toBe(2)
    expect(viejo.mapa.telefono).toBe(3)
    expect(viejo.mapa.capital).toBe(6)
    expect(viejo.mapa.cuota).toBe(8)
    expect(viejo.mapa.plazo).toBe(9)
    expect(viejo.mapa.nCuotas).toBe(10)
  })
})

describe('con dos columnas de teléfono gana la que trae teléfonos', () => {
  it('el fijo a ceros pierde contra el celular con números', () => {
    /* En el export, «Telefono cliente» valía `0` o `000` en las 124 filas y el
       número bueno estaba en «Celular cliente». Por el título las dos son igual
       de plausibles, así que se cuentan los válidos. */
    const filas = [CABECERAS_DEL_EXPORT, FILA_INVENTADA, FILA_INVENTADA]
    const r = leerExcel(filas, { pais: 'cl' })
    expect(r.mapa.telefono).toBe(6)
    expect(r.filas[0].telefono).toBe('966589669')
  })

  it('nombre y apellido se juntan, que si no las fichas entran a medias', () => {
    const r = leerExcel([CABECERAS_DEL_EXPORT, FILA_INVENTADA], { pais: 'cl' })
    expect(r.filas[0].nombre).toBe('Ana Ruiz')
    expect(r.filas[0].cedula).toBe('11111111')
    expect(r.filas[0].capital).toBe(600000)
    expect(r.filas[0].diasPlazo).toBe(30)
  })
})

describe('telefonoValido — doce países, no solo Colombia', () => {
  it('⚠ nueve dígitos son un teléfono en Chile y en Ecuador', () => {
    // Pedía diez —los de Colombia— y tiraba 108 teléfonos buenos de 124.
    expect(telefonoValido('966589669')).toBe(true)
    expect(telefonoValido('966589669', 'cl')).toBe(true)
  })
  it('y ocho lo son en Centroamérica', () => {
    expect(telefonoValido('88887777')).toBe(true)
  })
  it('pero «312», «222» y «3» siguen sin serlo', () => {
    for (const t of ['312', '222', '3', '']) expect(telefonoValido(t), t).toBe(false)
  })
  it('⚠ ni los ceros de relleno, por muchos que sean', () => {
    // El archivo traía «0», «000» y «0000000000000000».
    for (const t of ['0', '000', '0000000000', '0000000000000000']) {
      expect(telefonoValido(t), t).toBe(false)
    }
  })
  it('ni veinte dígitos, que son dos números pegados', () => {
    expect(telefonoValido('30279922583052853224')).toBe(false)
  })
})
