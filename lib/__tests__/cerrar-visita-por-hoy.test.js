import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { filaDeCobro } from '../adaptadores/cobros'

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const sinComentarios = (s) => s
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const tarjeta = leer('components/cf/ParadaDeCobro.jsx')
const rutaApi = leer('app/api/rutas/[id]/route.js')
const cobrosApi = leer('app/api/cobros-hoy/route.js')
const visitasApi = leer('app/api/visitas/route.js')
const pagina = sinComentarios(leer('app/(dashboard)/rutas/[id]/page.jsx'))

const base = { id: 'c1', nombre: 'Elieser Ramos', cuota: 10000, saldoTotal: 100000, diasMora: 14 }

/* Reportado: «si debe 100 mil y la cuota es de 10 mil, ya pago 20 mil, pues ya
   pago dos cuotas... pero si el cobrador quiere que no siga saliendo ahi de
   primero, que tenga un boton de cerrar hasta ahi». */
describe('cerrar la visita por hoy', () => {
  it('la fila cerrada deja de contar como parada por hacer', () => {
    const f = filaDeCobro({ ...base, pagoHoy: true, cobroPendienteHoy: true,
      montoCobradoHoy: 20000, visitaCerradaHoy: true })
    expect(f.cobrada).toBe(true)
    expect(f.cerradaPorHoy).toBe(true)
  })

  it('dice que se CERRO, no que se cobro', () => {
    // «Cobrado» a secas sobre alguien que todavia debe es mentira: lo que paso
    // es que el cobrador siguio camino.
    const f = filaDeCobro({ ...base, pagoHoy: true, cobroPendienteHoy: true,
      montoCobradoHoy: 20000, visitaCerradaHoy: true })
    expect(f.abonadoAntesDeCerrar).toBeTruthy()
    expect(tarjeta).toMatch(/cerrado por hoy/)
  })

  it('sin cerrar, sigue viva y con su linea de abono', () => {
    const f = filaDeCobro({ ...base, pagoHoy: true, cobroPendienteHoy: true, montoCobradoHoy: 20000 })
    expect(f.cobrada).toBe(false)
    expect(f.cerradaPorHoy).toBe(false)
    expect(f.abonoHoy).toBeTruthy()
  })

  it('cerrada, la linea de abono se calla: ya lo dice el cierre', () => {
    const f = filaDeCobro({ ...base, pagoHoy: true, cobroPendienteHoy: true,
      montoCobradoHoy: 20000, visitaCerradaHoy: true })
    expect(f.abonoHoy).toBeNull()
  })

  it('se puede deshacer', () => {
    // «Con la opcion de si el quiere realizar otro abono, poderle abonar». Sin
    // salida, seria irreversible por una decision tomada de pie en una puerta.
    expect(tarjeta).toMatch(/Volver a abrir/)
    expect(visitasApi).toMatch(/export async function DELETE/)
    expect(pagina).toMatch(/reabrirVisita/)
  })

  it('el boton de cerrar solo sale cuando YA entro plata', () => {
    // Como boton suelto invitaria a saltarse clientes sin cobrarles.
    const bloque = tarjeta.slice(tarjeta.indexOf('{abonoHoy && !cobrada &&'))
    expect(bloque.slice(0, 2400)).toMatch(/onCerrarVisita/)
  })
})

/* ⚠ LO QUE ESTO NO PUEDE TOCAR. */
describe('cerrar una visita NO mueve el dinero', () => {
  it('no cambia cobroPendienteHoy en ninguno de los dos APIs', () => {
    // Ese campo alimenta esperadoHoy, el cuadre y los reportes. La deuda del
    // cliente no se encoge porque el cobrador decida seguir camino, y bajar el
    // esperado inflaria el porcentaje cumplido del dia.
    for (const api of [rutaApi, cobrosApi]) {
      expect(api).toMatch(/visitaCerradaHoy: cierreDeHoy\.has\(c\.id\)/)
      expect(api).not.toMatch(/cobroPendienteHoy: pendienteHoyCliente && !cierreDeHoy/)
      expect(api).not.toMatch(/pendienteHoyCliente = .*cierreDeHoy/)
    }
  })

  it('el contador del boton SI las descuenta: cuenta puertas, no deudas', () => {
    // «Un contador que incluye paradas que no se hacen es peor que no tener
    // contador» — la regla de E09, aplicada al mismo numero.
    expect(pagina).toMatch(/const paradasPorHacer = /)
    expect(pagina).toMatch(/pendiente && !c\.visitaCerradaHoy/)
  })

  it('LOS CUATRO contadores, no uno', () => {
    // ⚠ Son dos botones distintos --uno en la barra de acciones y otro
    // flotante-- mas la pastilla «Hoy» y el subtitulo. Arregle solo el de la
    // barra, que en el telefono casi no sale, y la captura seguia diciendo 134
    // con 133 puertas por tocar. Es el fallo del comprobante otra vez: cuando
    // algo se ve por varios caminos hay que buscarlos TODOS.
    expect(pagina).not.toMatch(/Empezar recorrido · \{ruta\.pendientesHoy\}/)
    expect(pagina).not.toMatch(/texto: 'Hoy', conteo: ruta\.pendientesHoy/)
    const usos = (pagina.match(/paradasPorHacer/g) ?? []).length
    expect(usos).toBeGreaterThanOrEqual(6)
  })

  it('la lista deja hueco para la barra flotante', () => {
    // Va `fixed` sobre la pastilla: sin hueco tapa la ULTIMA ficha para
    // siempre, y ahora tapa justo su boton de cobrar.
    expect(pagina).toMatch(/paddingBottom: paradasPorHacer > 0/)
  })

  it('solo se pueden deshacer las de HOY', () => {
    // Una anotacion de ayer es historial del negocio y no se toca desde un
    // boton de la ruta.
    expect(visitasApi).toMatch(/Solo se pueden deshacer las visitas de hoy/)
    expect(visitasApi).toMatch(/fechaOriginal: \{ gte: inicio, lt: fin \}/)
  })

  it('el motivo nuevo existe y es distinto de los de «no pago»', () => {
    expect(visitasApi).toMatch(/'pago_parcial'/)
    expect(visitasApi).toMatch(/MOTIVOS_VALIDOS = \[[^\]]*'no_estaba'/)
  })
})

/* Reportado: «el boton de cobrar quedo justificadamente pequeño». */
describe('el boton de cobrar', () => {
  it('se lleva un renglon entero', () => {
    // Estaban los cinco controles en una fila con Cobrar a `flex: 1`. Con el de
    // llamar dentro se quedo en ~90px: el principal era el mas pequeño.
    const b = tarjeta.match(/onClick=\{onClick\}\s*style=\{\{[\s\S]{0,320}?\}\}\s*>Cobrar<\/button>/)
    expect(b, 'no encuentro el boton de cobrar').toBeTruthy()
    expect(b[0]).toMatch(/width: '100%'/)
    expect(b[0]).not.toMatch(/flex: 1/)
  })

  it('y es mas alto que las secundarias', () => {
    const b = tarjeta.match(/onClick=\{onClick\}\s*style=\{\{[\s\S]{0,320}?\}\}\s*>Cobrar<\/button>/)[0]
    const alto = Number(b.match(/height: (\d+)/)[1])
    const secundaria = Number(tarjeta.match(/height: 42, flex: 1/) ? 42 : 0)
    expect(alto).toBeGreaterThan(secundaria)
  })
})
