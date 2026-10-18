/* Rutas, tanda 2 de lo que encontró el agente de los videos (DETALLES-RUTAS.md,
 * 17 oct 2026): la ruta por dentro, la lista, asignar cobrador y los textos.
 * Ancladas en el código, y con datos donde hay cuenta. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { paradasDeRuta } from '@/lib/adaptadores/ruta'
import { porRutaHoy } from '@/lib/adaptadores/panel'
import { DEFINICIONES } from '@/lib/dinero/definiciones'

const leer = (f) => readFileSync(f, 'utf8')
const ruta = leer('app/(dashboard)/rutas/[id]/page.jsx')
const lista = leer('app/(dashboard)/rutas/page.jsx')
const apiRuta = leer('app/api/rutas/[id]/route.js')

describe('#17 · un solo número por cliente: su puesto en la ruta', () => {
  it('con la lista filtrada, el número sigue siendo el de la ruta', () => {
    // La ruta tiene 5; el filtro «Hoy» deja al 2 y al 4.
    const filtrados = [
      { id: 'b', nombre: 'Beto', posicionRuta: 2, cobroPendienteHoy: true, prestamosActivos: [] },
      { id: 'd', nombre: 'Dora', posicionRuta: 4, cobroPendienteHoy: true, prestamosActivos: [] },
    ]
    const { filas } = paradasDeRuta(filtrados)
    expect(filas.map((f) => f.orden)).toEqual([2, 4])
  })
  it('sin el dato, cuenta como antes', () => {
    const { filas } = paradasDeRuta([{ id: 'a', nombre: 'Ana', prestamosActivos: [] }])
    expect(filas[0].orden).toBe(1)
  })
  it('la pantalla, el mapa y la hoja impresa usan el puesto en la ruta', () => {
    expect(ruta).toMatch(/const posicionEnRuta = new Map\(\(ruta\?\.clientes \?\? \[\]\)\.map\(\(c, i\) => \[c\.id, i \+ 1\]\)\)/)
    expect(ruta).toMatch(/posicionRuta: posicionEnRuta\.get\(c\.id\),/)
    expect((ruta.match(/orden: posicionEnRuta\.get\(c\.id\) \?\? i \+ 1,/g) || []).length).toBe(4)
    expect(ruta).not.toMatch(/\n\s+orden: i \+ 1,\n/)
    expect(leer('components/rutas/RouteMap.jsx')).toMatch(/createNumberedIcon\(puesto\)/)
    expect(leer('components/rutas/HojaRutaImprimible.jsx')).toMatch(/\{puestoEnRuta\.get\(c\.id\) \?\? i \+ 1\}/)
  })
})

describe('#21 · al cambiar de ruta desde la ficha, entra al final', () => {
  it('toma el último puesto de la ruta nueva', () => {
    const api = leer('app/api/clientes/[id]/route.js')
    expect(api).toMatch(/const entraARuta = rutaId !== undefined && !!rutaId && rutaId !== clienteBase\.rutaId/)
    expect(api).toMatch(/\.\.\.\(entraARuta && \{ ordenRuta: ultimoPuesto \+ 1 \}\)/)
    expect(api).toMatch(/\.\.\.\(rutaId !== undefined && !rutaId && \{ ordenRuta: null \}\)/)
  })
})

describe('#22 · «Solo lectura» se dice y se cumple', () => {
  it('agregar clientes a una ruta pasada del plan pasa por la barrera', () => {
    expect(leer('app/api/rutas/[id]/clientes/route.js')).toMatch(/if \(!await rutaPermitida\(organizationId, id\)\) \{\n\s+return Response\.json\(\{ error: 'Esta ruta está en «Solo lectura»/)
  })
  it('la ruta lo avisa y la lista dice cuáles son', () => {
    expect(apiRuta).toMatch(/soloLectura: !\(await rutaPermitida\(organizationId, id\)\),/)
    expect(ruta).toMatch(/\{ruta\.soloLectura && \(/)
    expect(lista).toMatch(/En «Solo lectura» por el límite de tu plan: \{rutas\.filter\(r => !rutasPermitidas\.has\(r\.id\)\)\.map\(r => r\.nombre\)\.join\(', '\)\}\./)
  })
})

describe('#24 #25 #27 · ordenar, auditoría y optimizar', () => {
  it('#25 un solo buscador', () => {
    expect(ruta).not.toMatch(/auditoriaBusqueda/)
  })
  it('#27 optimizar dice desde dónde arranca y qué pasa sin ubicación', () => {
    expect(ruta).toMatch(/`Arranca desde \$\{primeroConUbicacion\}, el primero de la ruta con ubicación\.`/)
    expect((ruta.match(/\{notaOptimizar && <p/g) || []).length).toBe(2)
  })
})

describe('#28 · la hoja «Capital de la ruta»', () => {
  const ficha = leer('components/pantallas/FichaRuta.jsx')
  it('«Prestado en total», el capital propio y sin tarjeta vacía', () => {
    expect(ficha).toMatch(/\{ etiqueta: 'Prestado en total', valor: prestado \}/)
    expect(ficha).toMatch(/\{comparacion\.length > 0 && <Tarjeta>/)
    expect(ficha).toMatch(/Capital propio de la ruta/)
    expect(ruta).toMatch(/capitalPropio=\{ruta\?\.capitalHabilitado && ruta\?\.saldoCapital != null \?/)
  })
})

describe('#29 · «mora» quiere decir lo que decidió el dueño', () => {
  it('la cifra desde un día se llama «con atraso»', () => {
    expect(DEFINICIONES.clientesEnMora.rotulo).toBe('Clientes con atraso')
  })
  it('por cliente: vencido hasta 7 días, en mora después', () => {
    expect(ruta).toMatch(/\{c\.diasMora\}d \{c\.diasMora > DIAS_MORA \? 'en mora' : 'vencido'\}/)
    const hoja = leer('components/rutas/HojaRutaImprimible.jsx')
    expect(hoja).toMatch(/\{c\.diasMora\}d \{c\.diasMora > DIAS_MORA \? 'en mora' : 'vencido'\}/)
    expect(hoja).toMatch(/\{enMora\} con atraso<\/p>/)
  })
})

describe('#32 · el historial dice de quién es', () => {
  it('los clientes que hoy están en la ruta', () => {
    expect(ruta).toMatch(/Los cobros de los clientes que hoy están en esta ruta, aunque los hayan pagado estando en otra\./)
  })
})

describe('#33 · el cobrador sin rutas no ve «Crear primera ruta»', () => {
  it('cada uno su vacío', () => {
    expect(lista).toMatch(/\{!loading && !authLoading && rutas\.length === 0 && !error && \(/)
    expect(lista).toMatch(/Todavía no tienes una ruta<\/p>/)
    expect(lista).toMatch(/Crea una ruta y asígnale un cobrador/)
  })
})

describe('#35 #36 #37 · asignar cobrador', () => {
  it('#35 un desactivado no recibe rutas', () => {
    expect(leer('app/api/rutas/route.js')).toMatch(/if \(cobrador\.activo === false\) return Response\.json\(\{ error: 'Ese cobrador está desactivado/)
    expect(apiRuta).toMatch(/if \(cobrador\.activo === false && cobradorId !== ruta\.cobradorId\) \{/)
    expect(lista).toMatch(/\.filter\(\(c\) => c\.activo !== false\)/)
  })
  it('#36 la ficha pregunta antes de mover una ruta', () => {
    const ficha = leer('app/(dashboard)/cobradores/[id]/page.jsx')
    expect(ficha).toMatch(/onClick=\{\(\) => pedirAsignar\(r\.id, null\)\}/)
    expect(ficha).toMatch(/onChange=\{\(e\) => \{ if \(e\.target\.value\) pedirAsignar\(e\.target\.value, id\) \}\}/)
    expect(ficha).toMatch(/`Hoy la lleva \$\{r\.cobrador\.nombre\}: se la quitas a él y pasa a \$\{nombreCobrador\}\.`/)
  })
  it('#37 queda anotado', () => {
    expect(apiRuta).toMatch(/accion: 'asignar_cobrador_ruta'/)
    expect(apiRuta).toMatch(/accion: 'renombrar_ruta'/)
    expect(apiRuta).toMatch(/accion: 'eliminar_ruta'/)
  })
})

describe('#38 · el cobro mira la base, no la sesión', () => {
  it('las rutas del cobrador salen de la base', () => {
    const pagos = leer('app/api/prestamos/[id]/pagos/route.js')
    expect(pagos).toMatch(/if \(rol === 'cobrador' && !\(await rutaIdsDe\(organizationId, userId\)\)\.includes\(prestamo\.cliente\.rutaId\)\)/)
    expect(leer('lib/auth.js')).toMatch(/const REFRESH_MS = \(token\.rol === 'cobrador' \? 5 : 15\) \* 60 \* 1000/)
  })
})

describe('#41 · «Por ruta hoy», la que peor va primero y se puede abrir', () => {
  it('ordena de peor a mejor', () => {
    const r = porRutaHoy([
      { id: 'a', nombre: 'A', esperadoHoy: 100, recaudadoHoy: 90 },
      { id: 'b', nombre: 'B', esperadoHoy: 100, recaudadoHoy: 10 },
      { id: 'c', nombre: 'C', esperadoHoy: 100, recaudadoHoy: 50 },
    ], 'CO')
    expect(r.rutas.map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })
  it('la fila lleva a la ruta', () => {
    expect(leer('components/pantallas/Panel.jsx')).toMatch(/const Contenedor = id \? Link : 'div'/)
  })
})

describe('#44 · «Asignar» abre el lápiz', () => {
  it('la lista llega con ?asignar=1 y la ruta abre el lápiz', () => {
    expect((lista.match(/`\/rutas\/\$\{r\.id\}\?asignar=1`/g) || []).length).toBe(2)
    expect(ruta).toMatch(/new URLSearchParams\(window\.location\.search\)\.get\('asignar'\) !== '1'/)
  })
})

describe('textos (#31 #34 #40 #42 #43 #45 #46)', () => {
  it('tildes y nombres', () => {
    expect(ruta).toMatch(/label="Cuánto traes de verdad"/)
    expect(ruta).toMatch(/'Traes de más: '/)
    expect(ruta).toMatch(/Aún no se ha registrado un cobro hoy\./)
    expect(ruta).toMatch(/>Guardado en el teléfono<\/span>/)
    expect(leer('components/rutas/RouteMap.jsx')).toMatch(/Recorrido del día/)
    expect(leer('components/pantallas/Cobradores.jsx')).toMatch(/Cobrado en efectivo/)
    expect(apiRuta).toMatch(/fragmentaría el cierre/)
    expect(apiRuta).not.toMatch(/forza el cambio/)
  })
})
