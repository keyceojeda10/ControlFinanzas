/* Caja y Capital, lo que no cambia ninguna cifra de las dos cajas más tres
 * arreglos de plata acotados (DETALLES-CAJA-Y-CAPITAL.md, 17 oct 2026), con las
 * decisiones del dueño: su gasto se aprueba solo y no se cuadra a quien no ha
 * entregado. Ancladas en el código. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { causasDeDescuadre } from '@/lib/adaptadores/cuadre'

const pagina = readFileSync('app/(dashboard)/caja/page.jsx', 'utf8')
const cuadre = readFileSync('app/api/caja/cuadre/route.js', 'utf8')
const cuadreDia = readFileSync('components/caja/CuadreDia.jsx', 'utf8')
const gastos = readFileSync('app/api/gastos/route.js', 'utf8')
const apiCaja = readFileSync('app/api/caja/route.js', 'utf8')
const capital = readFileSync('components/capital/CapitalTab.jsx', 'utf8')

describe('#1 · «Cerrar el día» del dueño lleva a algún sitio', () => {
  it('va a la tarjeta que exista o a Cuadre', () => {
    expect(pagina).toMatch(/document\.getElementById\('cf-cierre-del-dia'\) \|\| document\.getElementById\('cf-cierre-owner'\)/)
    expect(pagina).toMatch(/setCajaTab\('cuadre'\)\s*\}/)
    expect((pagina.match(/onCerrarDia=\{irACerrarElDia\}/g) || []).length).toBe(2)
  })
})

describe('#2 · el gasto del dueño nace aprobado y asentado', () => {
  it('estado aprobado y su movimiento en la misma transacción', () => {
    expect(gastos).toMatch(/\.\.\.\(loAnotaElDueno \? \{ estado: 'aprobado' \} : \{\}\)/)
    expect(gastos).toMatch(/if \(loAnotaElDueno\) \{\s*await registrarMovimientoCapital\(tx, \{/)
    expect(gastos).toMatch(/permitirNegativo: true/)
  })
})

describe('#5 · sin respuesta no se pintan ceros', () => {
  it('solo la copia de ese día, y si no hay, reintentar', () => {
    // `sync:caja` (siempre de hoy, sin apertura) queda solo para SIN RED.
    expect((pagina.match(/leerDeCache\('sync:caja'\)/g) || []).length).toBe(1)
    expect(pagina).toMatch(/if \(cached\) \{ setCajaData\(cached\); setIsOffline\(true\); setLoading\(false\)/)
    expect(pagina).toMatch(/if \(!cajaData && error\) return \(/)
    expect(pagina).toMatch(/<Button onClick=\{\(\) => fetchData\(\)\}>Reintentar<\/Button>/)
  })
})

describe('#7 #8 #9 · Capital', () => {
  it('un solo nombre, el capital inicial sube, y «Ver movimientos» baja hasta ellos', () => {
    expect(capital).toMatch(/inyeccion: 'Metiste plata'/)
    expect(capital).toMatch(/<option value="inyeccion">Metiste plata<\/option>/)
    expect(capital).toMatch(/const sube = esIngreso\(modalTipo\) \|\|/)
    expect(capital).toMatch(/<div id="movimientos"/)
    expect(pagina).toMatch(/href="\/capital#movimientos"/)
  })
})

describe('#11 · las causas del cuadre llevan texto', () => {
  it('devuelven `titulo`, que es lo que se pinta', () => {
    for (const tono of ['falta', 'sobra']) {
      for (const c of causasDeDescuadre(tono)) expect(c.titulo).toMatch(/\w/)
    }
    expect(cuadreDia).toMatch(/onCausa=\{\(c\) => setNota\(c\.titulo\)\}/)
  })
})

describe('#12 · Cobradores dice lo mismo que la caja del cobrador', () => {
  it('«Quedó por cobrar», sin rojo, y sin la «Diferencia» del formulario', () => {
    expect(pagina).toMatch(/const porCobrarCobrador = Math\.max\(0, Math\.round\(\(cierre\?\.totalEsperado \|\| 0\) - recaudadoDiaCobrador\)\)/)
    expect(pagina).not.toMatch(/<span className="text-\[var\(--cf-ink-3\)\]">Diferencia: <\/span>/)
  })
})

describe('#15 · editar un cuadre asienta solo lo que cambió', () => {
  it('resta lo ya asentado para ese cierre, en una transacción', () => {
    expect(cuadre).toMatch(/where: \{ organizationId, referenciaTipo: 'cierre_cuadre', referenciaId: cierre\.id \}/)
    expect(cuadre).toMatch(/const falta = diferenciaRecibido - yaAsentado/)
    expect(cuadreDia).toMatch(/fila\.efectivoRecibido != null \? fila\.efectivoRecibido : \(fila\.recaudadoSistema \|\| 0\)/)
  })
})

describe('#16 · no se cuadra a quien no ha entregado', () => {
  it('el servidor no crea el cierre y la fila lo dice', () => {
    expect(cuadre).toMatch(/if \(!cierreExistente\) \{\s*resultados\.push\(\{ cobradorId, error:/)
    expect(cuadre).not.toMatch(/cierre = await prisma\.cierreCaja\.create\(/)
    expect(cuadreDia).toMatch(/const sinEntregar = !confirmado && f\.entregadoReportado == null/)
  })
})

describe('#17 · con la caja reabierta se vuelve a cerrar', () => {
  it('el 409 deja pasar el reabierto, y el botón de hoy solo sale reabierto', () => {
    expect(apiCaja).toMatch(/if \(diasAtras === 0 && rol !== 'owner' && !existeCierre\.reabiertoEn\) \{/)
    expect(pagina).toMatch(/\{fechaEditableCobrador && !modoAjusteCierre && \(esAyer \|\| !!cierreHoy\?\.reabiertoEn\) && \(/)
  })
})

describe('#14 #18 #19 #20 · los rótulos dicen el día que se mira', () => {
  it('rango, historial, por ruta y cuadre', () => {
    expect(pagina).toMatch(/rotuloSaldo="Neto del período"/)
    expect(pagina).toMatch(/onClick=\{\(\) => handlePeriodoChange\(\{ modo: 'hoy', fecha: c\.fecha\.slice\(0, 10\) \}\)\}/)
    expect(readFileSync('components/caja/CajaPorRuta.jsx', 'utf8')).toMatch(/\}\}>Recaudado \{cuando\}<\/span>/)
    expect(cuadreDia).toMatch(/setErrorGuardar\(d\.error \|\| 'No se pudo guardar el cuadre\.'\)/)
    expect(cuadreDia).not.toMatch(/catch \{ \/\* noop \*\/ \}/)
  })
})
