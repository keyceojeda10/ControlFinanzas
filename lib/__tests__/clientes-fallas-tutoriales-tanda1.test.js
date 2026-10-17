/* Fallas que encontró el agente de los tutoriales al grabar Clientes (17 oct
 * 2026, `DETALLES-CLIENTES.md`), las que pierden datos o plata. Ancladas en el
 * código, no en los comentarios (que citan los mismos textos). */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const ficha = readFileSync('app/(dashboard)/clientes/[id]/page.jsx', 'utf8')
const form = readFileSync('components/clientes/ClienteForm.jsx', 'utf8')
const api = readFileSync('app/api/clientes/route.js', 'utf8')
const nuevo = readFileSync('app/(dashboard)/clientes/nuevo/page.jsx', 'utf8')

describe('1 · «Inactivar» ya no termina eliminando', () => {
  it('el cuadro de «tiene préstamos» sabe qué se pidió y repite eso', () => {
    expect(ficha).toMatch(/setMotivoBloqueo\('inactivar'\)/)
    expect(ficha).toMatch(/setMotivoBloqueo\('eliminar'\)/)
    expect(ficha).toMatch(/onRetryDelete=\{motivoBloqueo === 'inactivar' \? handleToggleInactivo : handleDelete\}/)
    expect(ficha).toMatch(/\{motivo === 'inactivar' \? 'Inactivar cliente' : 'Eliminar cliente'\}<\/h3>/)
  })
})

describe('4 · WhatsApp, Reagendar y Lucas usan el préstamo que se ve arriba (el más antiguo)', () => {
  it('sale del mismo orden que la lista', () => {
    expect(ficha).toMatch(/const prestamoPrincipal = prestamosEnOrden\[0\] \|\| null/)
    expect(ficha).toMatch(/prestamo=\{prestamoPrincipal\}/)
    expect(ficha).toMatch(/prestamoId=\{prestamoPrincipal\?\.id \|\| null\}/)
    expect(ficha).toMatch(/generarTipCliente\(cliente, prestamosEnOrden,/)
    expect(ficha).not.toMatch(/prestamosActivos\[0\]\?\.id/)
  })
})

describe('3 · Lucas no ofrece prestar sin permiso', () => {
  it('sin permiso no hay botón', () => {
    expect(ficha).toMatch(/onPrestar=\{puedeCrearPrestamos \? /)
    expect(ficha).toMatch(/onOtroMonto=\{puedeCrearPrestamos \? /)
  })
})

describe('5 · «No pagó · Siguiente» deja la visita anotada', () => {
  it('abre Reagendar y pasa al siguiente al guardarlo', () => {
    expect(ficha).toMatch(/const noPagoSiguiente = \(\) => \{ setNoPagoEnRuta\(true\); setModalReagendar\(true\) \}/)
    expect(ficha).toMatch(/if \(noPagoEnRuta\) \{ setNoPagoEnRuta\(false\); navegarEnRuta\(1\); return \}/)
  })
  it('6 · y Reagendar confirma que quedó', () => {
    expect(ficha).toMatch(/setAvisoVisita\('Visita anotada\./)
  })
})

describe('9 · «Festivo hoy» pregunta: es para todo el negocio', () => {
  it('el botón abre la confirmación y la confirmación marca', () => {
    expect(ficha).toMatch(/onClick=\{festivoHoy \? quitarFestivoHoy : \(\) => setConfirmarFestivo\(true\)\}/)
    expect(ficha).toMatch(/onConfirm=\{async \(\) => \{ await marcarFestivoHoy\(\); setConfirmarFestivo\(false\) \}\}/)
  })
})

describe('22 · «Cargar otro cliente» no arrastra lo del anterior', () => {
  it('suelta la foto, los días sin cobro y la posición, y vuelve a pedir la ruta', () => {
    const otro = form.slice(form.indexOf('onOtro={() => {'), form.indexOf('onOtro={() => {') + 1200)
    for (const x of ['setFotoFile(null)', 'setFotoPreview(null)', 'setDiasSinCobro([])', "setPosicionEnRuta('final')", 'setVueltaOrden((n) => n + 1)']) {
      expect(otro).toContain(x)
    }
    expect(form).toMatch(/\}, \[form\.rutaId, vueltaOrden\]\)/)
  })
})

describe('21 · lo que la foto leyó del préstamo llega a «Nuevo préstamo»', () => {
  it('con el cliente y la señal de la foto; sin datos de préstamo, a la tarjeta de «Cliente creado»', () => {
    expect(form).toMatch(/router\.push\(`\/prestamos\/nuevo\?clienteId=\$\{data\.id\}&fromCartulina=1`\)/)
    expect(form).not.toMatch(/router\.push\(`\/prestamos\/nuevo`\)/)
  })
})

describe('26 · los avisos de la foto se ven encima de lo leído', () => {
  it('en la pantalla del formulario, no solo en el selector', () => {
    expect(nuevo).toMatch(/\{metodo === 'foto' && ocrAdvertencias\.length > 0 && \(/)
  })
})

describe('27 · el tope de préstamo se guarda al crear, y reactivar no pierde nada', () => {
  it('se lee, se valida y se guarda (solo del dueño)', () => {
    expect(api).toMatch(/const topeVal = session\.user\.rol === 'owner' &&/)
    expect(api).toMatch(/\.\.\.\(topeVal !== undefined && \{ montoMaximoPrestamo: topeVal > 0 \? topeVal : null \}\)/)
  })
  it('reactivar va DESPUÉS de validar la ruta y con los mismos datos que crear', () => {
    const iReact = api.indexOf('if (reactivar) {')
    expect(iReact).toBeGreaterThan(api.indexOf("Solo puedes crear clientes en tus rutas asignadas"))
    expect(api.slice(iReact, iReact + 400)).toMatch(/\.\.\.datosCliente,/)
    expect(api.slice(iReact, iReact + 400)).toMatch(/\.\.\.\(fotoValida && \{ fotoUrl: fotoValida \}\)/)
  })
})

describe('12 · los textos', () => {
  it('«sincronizarán» con tilde', () => {
    expect(form).not.toMatch(/sincronizaran/)
  })
})
