import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { adaptarPrestamos, fichaDe, desgloseDe } from '@/lib/adaptadores/prestamos'
import { filaDeCobro } from '@/lib/adaptadores/cobros'

// ── DOS COSAS QUE DESTAPÓ EL REDISEÑO DE LA RUTA ────────────────────────────
//
//   «me dice que ese cliente tiene un préstamo perdido como clavo. Eso está
//    excelente, pero no me dice CUÁL, ni en el desglose, ni al darle al botón
//    de cobrar […] solamente entrando dentro del préstamo, sin saber cuál»
//
//   «cuando un cliente paga sale como un check verde y tachado […] no sale qué
//    número de lista es en ruta, y eso es importantísimo, así haya pagado. Y
//    tampoco le sale la tarjeta completa de la información de sus préstamos»

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const tarjetaRuta   = leer('components/cf/ParadaDeCobro.jsx')
const tarjetaLista  = leer('components/cf/TarjetaCliente.jsx')
const desplegable   = leer('components/cf/DesglosePrestamos.jsx')
const hojaCobro     = leer('components/pantallas/AtajosCobro.jsx')
const primitivos    = leer('components/cf/primitivos.jsx')
const paginaRuta    = leer('app/(dashboard)/rutas/[id]/page.jsx')

const prestamo = (extra = {}) => ({
  id: 'p1', estado: 'activo', frecuencia: 'quincenal', modoInteres: 'fijo', tasaInteres: 20,
  cuotaDiaria: 225000, montoPrestado: 600000, totalAPagar: 750000, saldoPendiente: 325000,
  porcentajePagado: 57, diasMora: 3, totalCuotas: 4, cuotasPendientes: 2,
  fechaInicio: '2026-07-03T05:00:00.000Z', fechaFin: '2026-08-31T05:00:00.000Z',
  ...extra,
})

describe('CUÁL de los préstamos es el clavo', () => {
  it('la pastilla es UNA sola pieza para las cinco pantallas', () => {
    /* Cinco pastillas escritas a mano acaban siendo cinco textos distintos, y
       este proyecto ya tiene el precedente del comprobante: lo mismo visto por
       dos caminos, arreglado en uno solo. */
    expect(primitivos).toMatch(/export function EtiquetaClavo/)
    for (const [donde, src] of [
      ['la ruta', tarjetaRuta], ['la lista', tarjetaLista],
      ['el desplegable', desplegable], ['la hoja de cobro', hojaCobro],
    ]) {
      expect(src, `${donde} no usa la pieza compartida`).toMatch(/EtiquetaClavo/)
    }
  })

  it('roja, porque un clavo no es un aviso: es una pérdida', () => {
    const i = primitivos.indexOf('export function EtiquetaClavo')
    expect(primitivos.slice(i, i + 300)).toMatch(/tono="mora"/)
  })

  it('en la lista de préstamos y en la ficha del cliente', () => {
    // Las dos pintan `TarjetaCliente` con `adaptarPrestamos`.
    const [normal, clavo] = adaptarPrestamos([prestamo(), prestamo({ id: 'p2', esClavo: true })], 'CO')
    expect(normal.clavo).toBe(false)
    expect(clavo.clavo).toBe(true)
    expect(tarjetaLista).toMatch(/\{clavo && <EtiquetaClavo \/>\}/)
  })

  it('en el desplegable de la tarjeta de cliente', () => {
    const d = desgloseDe([prestamo(), prestamo({ id: 'p2', esClavo: true })], 'CO')
    expect(d.prestamos.map((f) => f.clavo)).toEqual([false, true])
    expect(desplegable).toMatch(/\{ficha\.clavo && <EtiquetaClavo \/>\}/)
  })

  it('y en el desglose largo de la tarjeta de préstamo', () => {
    expect(fichaDe(prestamo({ esClavo: true }), 'CO', { largo: true }).clavo).toBe(true)
  })

  it('en el desplegable de la parada de ruta', () => {
    const f = filaDeCobro({
      id: 'c1', nombre: 'Gorras yt', cuota: 225000, saldoTotal: 1675000,
      prestamosActivos: [
        { id: 'a', fechaInicio: '2026-07-03T05:00:00Z', saldoPendiente: 325000, totalAPagar: 750000, totalPagado: 425000 },
        { id: 'b', fechaInicio: '2026-07-14T05:00:00Z', saldoPendiente: 1350000, totalAPagar: 1350000, totalPagado: 0, esClavo: true },
      ],
    }, { pais: 'co' })
    expect(f.prestamos.map((p) => p.esClavo)).toEqual([false, true])
    expect(tarjetaRuta).toMatch(/\{p\.esClavo && <EtiquetaClavo \/>\}/)
  })

  it('⚠ y en la HOJA DE COBRO, que es donde peor se notaba', () => {
    /* Es la pantalla en la que se decide sobre cuál entra la plata. Las dos
       filas se leían igual: «Préstamo 1 · Quincenal» y «Préstamo 2 · Mensual». */
    expect(hojaCobro).toMatch(/\{esClavo && <EtiquetaClavo \/>\}/)
    expect(paginaRuta).toMatch(/esClavo: !!pr\.esClavo/)
  })

  it('el aviso de arriba SE QUEDA: es lo que hace abrir el desplegable', () => {
    // Cerrado por defecto, sin el aviso rojo nadie lo abriría. Lo compone
    // `filaDeCobro` desde `tieneClavo`, que es del cliente y no del préstamo.
    const f = filaDeCobro({ id: 'c1', nombre: 'X', cuota: 0, tieneClavo: true }, { pais: 'co' })
    expect(f.avisos.some((a) => /dado por perdido/.test(a.texto))).toBe(true)
  })
})

describe('la parada cobrada no se queda en un renglón', () => {
  it('⚠ conserva su NÚMERO de lista', () => {
    /* Llevaba un check en vez de la cifra. «No sale qué número de lista es en
       ruta, y eso es importantísimo, así haya pagado»: el número es por dónde va
       caminando, y una parada hecha sigue ocupando su sitio en el recorrido. */
    expect(tarjetaRuta).not.toMatch(/\{cobrada \? \(\s*<svg[^]{0,200}M5 13l4 4L19 7[^]{0,80}\) : orden\}/)
    const i = tarjetaRuta.indexOf('fontSize: actual ? 16 : tenue ? 12.5 : 14')
    expect(tarjetaRuta.slice(i, i + 200)).toMatch(/\{orden\}/)
  })

  it('y el círculo sigue en verde, que es lo que dice «hecha»', () => {
    expect(tarjetaRuta).toMatch(/cobrada\s*\?\s*\{ w: 30, bg: 'var\(--cf-green\)'/)
  })

  it('lleva su tira de cifras', () => {
    const cobrada = filaDeCobro({
      id: 'c1', nombre: 'Carlos', cuota: 0, pagoHoy: true, cobroPendienteHoy: false,
      montoCobradoHoy: 105000, montoParaPonerseAlDia: 0, cumplimiento: 100,
      prestamosActivos: [],
    }, { pais: 'co' })
    expect(cobrada.cobrada).toBe(true)
    expect(cobrada.cifras).toBeTruthy()
  })

  it('y el desplegable de sus préstamos', () => {
    /* El caso que lo justifica: quien tiene DOS préstamos y salda el de hoy
       sigue debiendo el otro, y la fila reducida no lo decía. */
    expect(tarjetaRuta).toMatch(/\{prestamos\.length > 1 && \(/)
    expect(tarjetaRuta).not.toMatch(/\{!cobrada && prestamos\.length > 1/)
  })

  it('conserva los iconos, pero NO el botón de cobrar', () => {
    /* El recibo por WhatsApp se manda DESPUÉS de cobrar, así que quitarle los
       iconos obligaba a buscar al cliente por otro camino. El botón dorado sí
       se va: sobre una fila tachada invita a cobrar dos veces. */
    // Sin fijar la lista entera: ver la nota en `abono-sigue-pendiente`.
    expect(tarjetaRuta).toMatch(/\{\(onLlamar \|\| onWhatsApp \|\| onMapa \|\| onMas/)
    expect(tarjetaRuta).toMatch(/\{!cobrada && \(\s*<button/)
  })
})
