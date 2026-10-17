/* Fallas de Clientes que bloqueaban tareas o confundían (agente de los
 * tutoriales, 17 oct 2026, `DETALLES-CLIENTES.md`). Ancladas en el código. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const lista = readFileSync('app/(dashboard)/clientes/page.jsx', 'utf8')
const apiLista = readFileSync('app/api/clientes/route.js', 'utf8')
const buscar = readFileSync('app/api/buscar/route.js', 'utf8')
const ficha = readFileSync('app/(dashboard)/clientes/[id]/page.jsx', 'utf8')
const form = readFileSync('components/clientes/ClienteForm.jsx', 'utf8')
const nuevo = readFileSync('app/(dashboard)/clientes/nuevo/page.jsx', 'utf8')

describe('lista de clientes', () => {
  it('13 · «Inactivos» en vez de «Cancelados», y el inactivo no sale «al día»', () => {
    expect(lista).toMatch(/\{ value: 'inactivo', label: 'Inactivos' \}/)
    expect(lista).not.toMatch(/value: 'cancelado', label: 'Cancelados'/)
    expect(apiLista).toMatch(/estado:\s+c\.estado === 'inactivo' \? 'inactivo' : calcularEstadoCliente\(/)
    expect(apiLista).toMatch(/if \(c\.estado === 'inactivo'\) conteos\.inactivo \+= 1/)
  })
  it('14 · el paginador sale también con una pestaña puesta', () => {
    expect(lista).toMatch(/\{!loading && totalPages > 1 && \(/)
    expect(lista).not.toMatch(/!loading && !estado && totalPages > 1/)
  })
  it('15 · «cartera vacía» es la cartera entera en cero, no un filtro sin resultados', () => {
    expect(lista).toMatch(/\(conteos \? conteos\.total === 0 : !hayFiltros\)/)
    expect(lista).toMatch(/clientes\.length === 0 && hayFiltros && !carteraVacia && \(/)
    // `conteos` se declara antes de leerse: si no, pantalla en blanco.
    expect(lista.indexOf('const [conteos, setConteos] = useState(null)')).toBeLessThan(lista.indexOf('const carteraVacia ='))
  })
  it('16 · Rutas lleva a los sin ruta con el filtro que existe', () => {
    const rutas = readFileSync('app/(dashboard)/rutas/page.jsx', 'utf8')
    expect(rutas).not.toMatch(/filtro=sinruta/)
    expect(rutas).toMatch(/\/clientes\?sinRuta=1/)
  })
  it('17 · los textos del buscador dicen la verdad, y el botón quita TODOS los filtros', () => {
    expect(lista).toMatch(/placeholder="Nombre, cédula o teléfono"/)
    expect(lista).not.toMatch(/no mira los cancelados ni los inactivos/)
    expect(lista).toMatch(/onClick=\{quitarFiltros\}/)
  })
  it('A/B · no pierde el filtro al sincronizar y la caché no mezcla pestañas', () => {
    expect(lista).not.toMatch(/fetchClientes\(buscar, page, rutaIdFiltro, \{ soft: true \}\)/)
    expect(lista).toMatch(/const cacheKey = `clientes:\$\{q \|\| ''\}:\$\{p\}:\$\{rutaId \|\| 'all'\}\$\{filtrosClave \? `:\$\{filtrosClave\}` : ''\}`/)
    expect(lista).toMatch(/if \(pedido !== ultimoPedidoRef\.current\) return/)
  })
  it('18 · el cobrador ve en el buscador los clientes sin ruta que él creó, y sin rutas no recibe una lista vacía a la fuerza', () => {
    expect(buscar).toMatch(/\{ rutaId: null, creadoPorId: session\.user\.id \}/)
    expect(apiLista).not.toMatch(/if \(rol === 'cobrador' && rutaIds\.length === 0\) \{\s*return Response\.json/)
  })
})

describe('ficha del cliente', () => {
  it('2 · el PIN del portal son 4 números, igual que el ingreso', () => {
    expect(ficha).not.toMatch(/maxLength=\{6\}/)
    expect(ficha).toMatch(/if \(pinInput\.length !== 4\)/)
    expect(readFileSync('app/api/clientes/[id]/portal/route.js', 'utf8')).toMatch(/if \(pin\.length !== 4\)/)
    expect(readFileSync('app/(portal)/portal/login/page.jsx', 'utf8')).not.toMatch(/router\.push\(`\/portal\/recuperar/)
  })
  it('7 · «Copiar» funciona en las plantillas sin secciones', () => {
    expect(readFileSync('components/whatsapp/HojaWhatsApp.jsx', 'utf8')).toMatch(/const t = textoEditado \?\? textoConSecciones \?\? textoDePlantilla\n\s+if \(!t\) return/)
  })
  it('8 · los préstamos por aprobar se rotulan «Por aprobar»', () => {
    expect(ficha).toMatch(/pendiente_aprobacion: \{ variant: 'gold', label: 'Por aprobar' \}/)
  })
  it('10 · las acciones salen siempre; cada una mira su permiso', () => {
    expect(ficha).not.toMatch(/\{\(puedeCrearPrestamos \|\| puedeEditarClientes \|\| esOwner\) && \(\s*<AccionesClienteChips/)
  })
})

describe('crear cliente', () => {
  it('20 · «no tienes rutas» solo con la respuesta en la mano', () => {
    expect(form).toMatch(/rutasEstado === 'cargando' && rutas\.length === 0 \? \(/)
    expect(form).not.toMatch(/if \(\['starter', 'basic'\]\.includes\(plan\)\) return/)
  })
  it('23 · «Crear «X»» llega con el nombre escrito', () => {
    expect(nuevo).toMatch(/get\('nombre'\)/)
    expect(nuevo).toMatch(/nombreInicial=\{nombreInicial\}/)
    expect(form).toMatch(/datosIniciales\?\.nombre\s+\?\? nombreInicial \?\? ''/)
  })
  it('24/25 · sin permiso se dice; en el tope del plan se avisa ANTES de llenar', () => {
    expect(nuevo).toMatch(/No tienes permiso para crear clientes/)
    expect(nuevo).toMatch(/fetch\('\/api\/plan\/uso'\)/)
    expect(nuevo).toMatch(/if \(enElTope\) \{/)
  })
  it('28 · ya no se cargan los grupos que nadie usa', () => {
    expect(form).not.toMatch(/\/api\/grupos/)
  })
})

describe('la tarjeta del inactivo', () => {
  it('no dice «Al día»: dice «Inactivo», en gris', async () => {
    const { estadoVisual, etiquetaDe } = await import('@/lib/adaptadores/clientes')
    expect(estadoVisual({ estado: 'inactivo', diasMoraMax: 0 })).toBe('inactivo')
    expect(etiquetaDe('inactivo', 0)).toBe('Inactivo')
    expect(readFileSync('components/cf/TarjetaCliente.jsx', 'utf8')).toMatch(/inactivo: 'var\(--cf-ink-4\)'/)
  })
})
