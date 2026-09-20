// Cuatro reportes del dueño, 20 sep 2026, probando en su teléfono.
import { describe, it, expect } from 'vitest'
import fs from 'fs'
const lee = (p) => fs.readFileSync(p, 'utf8')

describe('«el botoncito que dice atrás da hasta pena»', () => {
  const hoja = lee('components/pantallas/AtajosCobro.jsx')
  it('ya no hay subpantallas con «Atrás» en la hoja de cobro', () => {
    // Medía 20px de alto: `flex: 1` dentro de una columna lo aplastaba.
    expect(hoja).not.toMatch(/>Atrás</)
  })
  it('la única vuelta que queda —«No pagó»— es un botón de su tamaño', () => {
    const i = hoja.indexOf('>Volver a cobrar</button>')
    expect(i).toBeGreaterThan(-1)
    expect(hoja.slice(i - 400, i)).toMatch(/height: 46/)
  })
  it('la cifra que se va a cobrar va en bloque carbón, y es la única dorada', () => {
    expect(hoja).toContain('background: BLOQUE.fondo')
    expect(hoja.match(/BLOQUE\.oro/g)).toHaveLength(1)
  })
  it('el nombre del cliente no se recorta', () => {
    expect(hoja).toMatch(/overflowWrap: 'anywhere',\s*\}\}>\{nombre\}<\/span>/)
  })
})

describe('«el bucket que dice efectivo está pegado a Ver préstamo»', () => {
  const src = lee('components/pagos/ListadoPagos.jsx')
  it('el medio y el enlace van en una fila con hueco entre los dos', () => {
    // Anclado en el JSX del enlace: el comentario de encima CITA «Ver préstamo».
    const i = src.indexOf('href={`/prestamos/${prestamoId}`}')
    expect(i).toBeGreaterThan(-1)
    const fila = src.slice(src.lastIndexOf('<div className="flex flex-wrap', i), i)
    expect(fila).toMatch(/gap-x-3/)
    expect(fila).toContain('metodo.label')
  })
  it('y el nombre baja de renglón en vez de recortarse', () => {
    expect(src).not.toMatch(/text-\[var\(--cf-ink\)\] truncate">\{cliente\}/)
  })
})

describe('«cerrar el día… no hay confirmación y se va derecho, ni opción de revocar»', () => {
  const caja = lee('app/(dashboard)/caja/page.jsx')
  const api = lee('app/api/caja/route.js')

  it('en el teléfono el día se cierra deslizando, también en la caja del dueño', () => {
    expect(caja).toMatch(/texto="Desliza para cerrar el día"/)
    // Y el «Ir» del teclado no puede cerrarlo por su cuenta.
    expect(caja).toMatch(/if \(tactil && !cierreOwner\) \{ e\.preventDefault\(\); return \}/)
  })

  it('cerrar pasa por la pantalla de proceso', () => {
    expect(caja).toMatch(/conPantalla\(modoAjusteCierre \? 'guardando' : 'cierre'/)
  })

  it('«Deshacer el cierre» es a dos toques y solo HOY', () => {
    expect(caja).toMatch(/if \(!deshacerArmado\) \{ setDeshacerArmado\(true\); return \}/)
    expect(caja).toMatch(/\{diasAtrasSeleccion === 0 && \(\s*<button[\s\S]{0,200}onClick=\{deshacerCierreDeHoy\}/)
    expect(caja).toContain("'Toca otra vez para deshacer' : 'Deshacer el cierre'")
    // «Reabrir y ajustar» se queda: corrige la cifra, no es lo mismo.
    expect(caja).toMatch(/>\s*Reabrir y ajustar\s*</)
  })

  it('el servidor: solo el dueño, solo hoy, y deja rastro con la cifra', () => {
    const del = api.slice(api.indexOf('export async function DELETE'))
    expect(del).toMatch(/if \(rol !== 'owner'\) return Response\.json\([^)]*\{ status: 403 \}\)/)
    expect(del).toContain('getDayRange(getHoyLocal())')
    expect(del).not.toMatch(/searchParams\.get\('fecha'\)/)      // no se puede pedir otro día
    expect(del).toMatch(/where: \{ id: cierre\.id, organizationId \}/)
    expect(del).toContain("accion: 'deshacer_cierre_caja'")
    expect(lee('lib/activity-log-types.js')).toContain('deshacer_cierre_caja:')
  })

  it('también el cierre de un COBRADOR, desde «Corregir cierre», y se le avisa', () => {
    // Mismo gesto a dos toques y solo hoy; el servidor ya aceptaba `cobradorId`.
    expect(caja).toMatch(/fetch\(`\/api\/caja\?cobradorId=\$\{encodeURIComponent\(editCobrador\.id\)\}`, \{ method: 'DELETE' \}\)/)
    expect(caja).toMatch(/if \(!deshacerCobArmado\) \{ setDeshacerCobArmado\(true\); return \}/)
    expect(caja).toMatch(/\{diasAtrasSeleccion === 0 && \(\s*<div className="pt-3[\s\S]{0,900}onClick=\{deshacerCierreCobrador\}/)
    // Al cerrar el modal se desarma: no se queda esperando el segundo toque.
    expect(caja).toMatch(/if \(!editCobrador\) setDeshacerCobArmado\(false\)/)
    const del = api.slice(api.indexOf('export async function DELETE'))
    expect(del).toMatch(/if \(cobradorId !== userId\) \{\s*notificar\(\{[\s\S]{0,120}para: cobradorId, tipo: 'caja_reabierta'/)
  })

  it('el fichero de ruta solo exporta verbos HTTP', () => {
    const exportados = [...api.matchAll(/^export\s+(?:async\s+)?(?:function|const)\s+(\w+)/gm)].map((m) => m[1])
    for (const e of exportados) expect(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).toContain(e)
  })
})

describe('«ubicación registrada», fuera del papel del cliente', () => {
  const recibo = lee('components/pantallas/Recibo.jsx')
  it('solo se pinta con un sí, y va después del troquelado', () => {
    expect(recibo).toMatch(/\{ubicacion && \(\s*<span data-recibo-ubicacion/)
    expect(recibo.indexOf('data-recibo-ubicacion')).toBeGreaterThan(recibo.indexOf('Recibido por ${recibidoPor}'))
  })
  it('los caminos de cobro dicen si el pago llevó ubicación, también si llegó tarde', () => {
    for (const f of ['components/prestamos/RegistrarPago.jsx', 'app/(dashboard)/rutas/[id]/page.jsx', 'app/(dashboard)/prestamos/[id]/page.jsx']) {
      const s = lee(f)
      expect(s, f).toMatch(/conUbicacion: Boolean\(coords\)/)
      expect(s, f).toMatch(/completarUbicacionDelPago\([^)]*\)\s*\.then\(\(ok\) =>/)
    }
  })
})
