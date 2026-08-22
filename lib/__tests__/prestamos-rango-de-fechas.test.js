import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { filtrarPrestamosGuardados } from '@/lib/adaptadores/filtro-prestamos'

/* «Poderle colocar el rango de fecha»: las ventanas fijas cubren lo de todos
 * los días, esto cubre «del 3 al 17».
 *
 * Se prueba por los dos caminos, porque el cobrador sin señal usa el otro:
 *  · el resolutor sin conexión, ejecutado de verdad;
 *  · la lectura de la fecha del endpoint, sacada de su propio fichero. */

const HOY = new Date('2026-08-22T05:00:00.000Z')   // arranque del día en Bogotá
const dia = (n) => new Date(HOY.getTime() + n * 86400000).toISOString()

const CARTERA = [
  { id: 'hoy',      estado: 'activo', diasMora: 0, proximoCobro: dia(0) },
  { id: 'manana',   estado: 'activo', diasMora: 0, proximoCobro: dia(1) },
  { id: 'en5',      estado: 'activo', diasMora: 0, proximoCobro: dia(5) },
  { id: 'en12',     estado: 'activo', diasMora: 0, proximoCobro: dia(12) },
  { id: 'en40',     estado: 'activo', diasMora: 0, proximoCobro: dia(40) },
  { id: 'moroso',   estado: 'activo', diasMora: 9, proximoCobro: dia(2) },
  { id: 'saldado',  estado: 'pagado', diasMora: 0, proximoCobro: dia(3) },
]
const ids = (r) => r.map((p) => p.id)
const correr = (opts) => ids(filtrarPrestamosGuardados(CARTERA, { inicioHoy: HOY, ...opts }))

describe('el rango de fechas a mano', () => {
  it('trae solo lo que cae entre las dos fechas', () => {
    expect(correr({ desde: '2026-08-23', hasta: '2026-08-29' })).toEqual(['manana', 'en5'])
  })

  it('los dos extremos ENTRAN en el rango', () => {
    // Del 23 de agosto al 3 de septiembre son los días 1 y 12, y los dos
    // clientes de esas fechas tienen que salir. Un rango que se come su propio
    // último día es de los que hacen recontar la lista a mano.
    expect(correr({ desde: '2026-08-23', hasta: '2026-09-03' })).toEqual(['manana', 'en5', 'en12'])
  })

  it('solo «desde» = de esa fecha en adelante', () => {
    expect(correr({ desde: '2026-09-03' })).toEqual(['en12', 'en40'])
  })

  it('solo «hasta» = de hoy a esa fecha', () => {
    expect(correr({ hasta: '2026-08-27' })).toEqual(['hoy', 'manana', 'en5'])
  })

  it('deja fuera lo saldado y lo que ya está en mora, como el servidor', () => {
    const r = correr({ desde: '2026-08-22', hasta: '2026-09-30' })
    expect(r).not.toContain('moroso')
    expect(r).not.toContain('saldado')
  })

  it('devuelve el más cercano primero', () => {
    expect(correr({ hasta: '2026-10-30' })).toEqual(['hoy', 'manana', 'en5', 'en12', 'en40'])
  })

  it('el rango manda sobre la ventana fija: no se contradicen', () => {
    // En la pantalla se apagan la una a la otra; aquí se comprueba que aunque
    // llegaran las dos, el resultado es UNO solo y es el del rango.
    expect(correr({ est: 'venceHoy', desde: '2026-09-03' })).toEqual(['en12', 'en40'])
  })

  it('sin fechas se comporta igual que antes', () => {
    expect(correr({ est: 'venceHoy' })).toEqual(['hoy'])
    expect(correr({ desde: '', hasta: '' }).length).toBe(CARTERA.length)
  })
})

describe('el endpoint no se traga una fecha inventada', () => {
  // ⚠ `new Date('cualquier cosa')` no revienta: da `Invalid Date`, y toda
  // comparación con él es `false`. O sea, lista vacía y ni un error. Por eso el
  // formato se valida ANTES de convertir; es el mismo cuidado que `leerDia`.
  const FUENTE = readFileSync(join(process.cwd(), 'app/api/prestamos/route.js'), 'utf8')

  function leerFechaReal() {
    const m = FUENTE.match(/const leerFecha = \(nombre\) => \{[\s\S]*?\n  \}/)
    expect(m, 'el endpoint ya no declara `leerFecha`').toBeTruthy()
    const cuerpo = m[0].replace('const leerFecha = (nombre) =>', 'return ((nombre) =>') + ')'
    return new Function('searchParams', cuerpo)
  }

  const CASOS = [
    ['2026-08-22', '2026-08-22'],
    ['  2026-08-22  ', '2026-08-22'],
    ['22/08/2026', null],
    ['ayer', null],
    ['2026-8-2', null],
    ['', null],
    [null, null],
  ]
  for (const [entra, sale] of CASOS) {
    it(`«${entra}» → ${sale === null ? 'sin filtro' : sale}`, () => {
      const fn = leerFechaReal()
      expect(fn({ get: () => entra })('cobraDesde')).toBe(sale)
    })
  }
})
