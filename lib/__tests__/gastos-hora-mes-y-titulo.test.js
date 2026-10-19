import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { anotadoEnDelId, cuandoGasto, textoAprobadosMes } from '@/lib/gastos'
import { rangoDePeriodo } from '@/lib/reportes/contador'

// Sin los comentarios: el arreglo se explica citando el fallo, y una prueba que
// busca texto lo encontraría en la cita.
const leer = (...p) => readFileSync(join(process.cwd(), ...p), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\{\s*\}/g, '')

const api = leer('app', 'api', 'gastos', 'route.js')
const pagina = leer('app', '(dashboard)', 'gastos', 'page.jsx')
const hoja = leer('components', 'gastos', 'ReportarGasto.jsx')

// Los espacios de «a. m.» cambian con la versión de ICU (normal, U+00A0, U+202F).
const plano = (s) => String(s).replace(/[\u00A0\u202F]/g, ' ')

/** Un cuid v1 nacido en `ms`: «c» + instante en base 36 + 16 caracteres. */
const cuidEn = (ms) => `c${ms.toString(36)}0032jwe2j56vllnd`

// Andrés anota la gasolina el 19 de octubre a las 8:41 a. m. de Bogotá.
const ANOTADO = Date.parse('2026-10-19T13:41:51.625Z')
const DIA_19 = '2026-10-19T17:00:00.000Z' // el mediodía de Bogotá, como lo guarda el API
const AHORA = new Date('2026-10-19T20:00:00.000Z')

describe('#26 la hora de un gasto es cuando se anotó, no el mediodía', () => {
  it('el id lleva el instante en que se creó', () => {
    const id = cuidEn(ANOTADO)
    expect(id).toMatch(/^c[0-9a-z]{24}$/)
    expect(anotadoEnDelId(id, DIA_19, AHORA)?.toISOString()).toBe('2026-10-19T13:41:51.625Z')
  })

  it('la lista dice «19 de oct, 8:41 a. m.», no «12:00 p. m.»', () => {
    const texto = plano(cuandoGasto({ fecha: DIA_19, anotadoEn: anotadoEnDelId(cuidEn(ANOTADO), DIA_19, AHORA) }))
    expect(texto).toMatch(/^19( de)? oct\.?, 8:41 a\. ?m\.$/)
    expect(texto).not.toMatch(/12:00/)
  })

  it('sin hora conocida, solo el día: nunca la del mediodía guardado', () => {
    expect(plano(cuandoGasto({ fecha: DIA_19 }))).toMatch(/^19( de)? oct\.?$/)
    expect(plano(cuandoGasto({ fecha: DIA_19, anotadoEn: null }))).not.toMatch(/\d:\d\d/)
  })

  it('lo de ayer anotado hoy dice los dos días, no la hora de hoy pegada a ayer', () => {
    const ayer = '2026-10-18T17:00:00.000Z'
    const texto = plano(cuandoGasto({ fecha: ayer, anotadoEn: new Date(ANOTADO) }))
    expect(texto).toMatch(/^18( de)? oct\.? · anotado el 19( de)? oct\.?, 8:41 a\. ?m\.$/)
  })

  it('un id que no es cuid, o una hora imposible, no inventa hora', () => {
    expect(anotadoEnDelId('zzvideodemo000000gasto001', DIA_19, AHORA)).toBeNull()
    expect(anotadoEnDelId(undefined, DIA_19, AHORA)).toBeNull()
    // Anotado antes de que empiece su día: el API no admite fechas futuras.
    expect(anotadoEnDelId(cuidEn(Date.parse('2026-10-18T20:00:00Z')), DIA_19, AHORA)).toBeNull()
    // Anotado en el futuro.
    expect(anotadoEnDelId(cuidEn(AHORA.getTime() + 3600e3), DIA_19, AHORA)).toBeNull()
  })

  it('los gastos viejos, con `fecha` = el momento de crearse, también la tienen', () => {
    // Antes del mediodía fijo, `fecha` era `@default(now())`: 11:58 p. m. del 3 de marzo.
    const fecha = '2026-03-04T04:58:49.000Z'
    const a = anotadoEnDelId(cuidEn(Date.parse(fecha) - 40), fecha, AHORA)
    expect(a).not.toBeNull()
    expect(plano(cuandoGasto({ fecha, anotadoEn: a }))).toMatch(/^3( de)? mar\.?, 11:58 p\. ?m\.$/)
  })

  it('el API manda `anotadoEn` en cada fila, y la página la usa', () => {
    expect(api).toMatch(/anotadoEn:\s*anotadoEnDelId\(g\.id,\s*g\.fecha,\s*ahora\)/)
    // `findMany` sin `select`: trae `id` y `fecha` enteros. Si alguien le pone un
    // `select`, tiene que pedir los dos o la hora se apaga callada.
    const consulta = api.slice(api.indexOf('prisma.gastoMenor.findMany({'), api.indexOf('orderBy: { fecha:'))
    expect(consulta).toMatch(/include: \{ cobrador: \{ select: \{ id: true, nombre: true \} \} \}/)
    expect(consulta).not.toMatch(/^\s{4}select:/m)
    expect(pagina).toMatch(/\{g\.cobradorNombre \|\| 'Tú'\} · \{cuandoGasto\(g\)\}/)
    expect(pagina).not.toMatch(/cuando\(g\.fecha\)/)
    expect(pagina).not.toMatch(/hour:\s*'2-digit'/)
  })
})

describe('#27 la cifra de arriba es lo aprobado del mes, sea cual sea la pestaña', () => {
  const fmt = (v) => `$${Number(v).toLocaleString('es-CO')}`

  it('dice que es lo aprobado', () => {
    expect(plano(textoAprobadosMes(15000, fmt))).toBe('$15.000 aprobados este mes')
    expect(textoAprobadosMes(0, fmt)).toBe('nada aprobado este mes')
    // Mientras no se sabe, nada: un $0 que no es sería mentira.
    expect(textoAprobadosMes(null, fmt)).toBeUndefined()
  })

  it('la cabecera sale de su propia consulta, no de la lista de la pestaña', () => {
    expect(pagina).toMatch(/subtitulo:\s*textoAprobadosMes\(aprobadosMes,\s*fmt\)/)
    expect(pagina).toMatch(/fetch\('\/api\/gastos\?estado=aprobado&periodo=mes'/)
    // La consulta del mes no lleva la pestaña ni los filtros.
    const traerMes = pagina.slice(pagina.indexOf('const traerMes = useCallback'), pagina.indexOf('useEffect(() => { traerMes() }'))
    expect(traerMes).not.toMatch(/estado\b(?!=aprobado)|fecha|cobradorId/)
    expect(pagina).not.toMatch(/subtitulo:\s*total/)
  })

  it('y se rehace al aprobar, rechazar, borrar o anotar', () => {
    expect(pagina).toMatch(/const refrescar = useCallback\(\(\) => \{ traer\(\); traerMes\(\) \}/)
    expect(pagina.match(/refrescar\(\)/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('el API corta el mes en la hora del país con el corte de los informes', () => {
    expect(api).toMatch(/if \(periodoParam === 'mes'\) \{\s*const \{ desde, hasta \} = rangoDePeriodo\('mes', Math\.abs\(getUtcOffset\(session\.user\.country \?\? 'co'\)\)\)\s*where\.fecha = \{ gte: desde, lt: hasta \}/)
  })

  it('el mes es el de Bogotá: el 31 a las 10 p. m. sigue siendo octubre', () => {
    // 1 nov 03:00Z = 31 oct 22:00 en Bogotá. En UTC ya sería noviembre.
    const { desde, hasta } = rangoDePeriodo('mes', 5, new Date('2026-11-01T03:00:00Z'))
    expect(desde.toISOString()).toBe('2026-10-01T05:00:00.000Z')
    expect(hasta.toISOString()).toBe('2026-11-01T05:00:00.000Z')
    const dentro = (f) => new Date(f) >= desde && new Date(f) < hasta
    expect(dentro('2026-10-01T17:00:00.000Z')).toBe(true)  // el 1 de octubre
    expect(dentro('2026-10-31T17:00:00.000Z')).toBe(true)  // el 31 de octubre
    expect(dentro('2026-09-30T17:00:00.000Z')).toBe(false)
    expect(dentro('2026-11-01T17:00:00.000Z')).toBe(false)
  })
})

describe('#28 el dueño anota, el cobrador reporta', () => {
  it('el título y el botón salen del rol, como el API decide si nace aprobado', () => {
    expect(hoja).toMatch(/const \{ esOwner \} = useAuth\(\)/)
    expect(hoja).toMatch(/const titulo = esOwner \? 'Anotar gasto' : 'Reportar gasto menor'/)
    expect(hoja).toMatch(/const accion = esOwner \? 'Anotar' : 'Reportar'/)
    expect(hoja).toMatch(/<Modal open=\{open\} onClose=\{handleClose\} title=\{titulo\}>/)
    expect(hoja).toMatch(/className="flex-1">\s*\{accion\}\s*<\/Button>/)
    // Ni el título en Title Case ni el «Reportar» fijo.
    expect(hoja).not.toMatch(/title="Reportar Gasto Menor"/)
    expect(hoja).not.toMatch(/className="flex-1">\s*Reportar\s*<\/Button>/)
    // El API: solo el dueño anota sin aprobación.
    expect(api).toMatch(/const loAnotaElDueno = session\.user\.rol === 'owner'/)
  })
})
