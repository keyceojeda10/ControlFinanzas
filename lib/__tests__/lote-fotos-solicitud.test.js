import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { estadoDe, efectivo, resumenDeLaFila, baseDeArranque } from '@/components/migrador/LoteFotos'

// La carga de cartera la revisa y la carga el dueño (22 nov 2026). `LoteFotos`
// recibe también las filas que ya leyó una solicitud de carga (`SolicitudCarga`):
// el dueño las termina de revisar y las crea. Es plata real: la pantalla tiene
// que crear lo que enseña y nunca el mismo préstamo dos veces.

const src = readFileSync('components/migrador/LoteFotos.jsx', 'utf8')
/* Sin comentarios: las notas del componente citan a los clientes y nombran lo
   que se prohíbe, así que buscar en el texto entero da por bueno un comentario. */
const sinNotas = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
const codigo = sinNotas(src)

const base = { tasa: '20', frecuencia: 'diario', modoInteres: 'fijo', rutaId: '' }
const ok = { nombre: 'Ana', monto: 500000, frecuencia: 'diario', plazoUnidades: '24', _dudas: [] }

describe('el semáforo de la fila', () => {
  it('repetida sin resolver es roja', () => expect(estadoDe({ ...ok, _repetidaDe: '3' }, base)).toBe('rojo'))
  it('repetida marcada «no es la misma» vuelve a su estado', () => expect(estadoDe({ ...ok, _repetidaDe: '3', noEsLaMisma: true }, base)).toBe('verde'))
  it('sin frecuencia en la fila ni arriba es roja', () => expect(estadoDe({ ...ok, frecuencia: '' }, { ...base, frecuencia: '' })).toBe('rojo'))
  it('sin tasa en la fila ni arriba es roja', () => expect(estadoDe(ok, { ...base, tasa: '' })).toBe('rojo'))
  it('la tasa de la fila basta aunque arriba no haya', () => expect(estadoDe({ ...ok, tasa: 10 }, { ...base, tasa: '' })).toBe('verde'))
  it('el migrador de siempre no cambia: base con valores, fila sin frecuencia ⇒ ámbar', () => expect(estadoDe({ ...ok, frecuencia: '' }, base)).toBe('ambar'))
  it('el migrador de siempre no cambia: sin nombre o sin monto ⇒ rojo', () => {
    expect(estadoDe({ ...ok, nombre: '' }, base)).toBe('rojo')
    expect(estadoDe({ ...ok, monto: '' }, base)).toBe('rojo')
  })
  it('una duda deja la fila en ámbar', () => expect(estadoDe({ ...ok, _dudas: [{ campo: 'monto', texto: 'x' }] }, base)).toBe('ambar'))
})

describe('efectivo: lo que de verdad se guarda', () => {
  it('la fila sin tasa cae a la de arriba', () => expect(efectivo({ ...ok, tasa: '' }, base).tasa).toBe(20))
  it('sin tasa en ninguna parte es null, no cero', () => expect(efectivo({ ...ok, tasa: '' }, { ...base, tasa: '' }).tasa).toBeNull())
})

describe('crear en modo solicitud', () => {
  it('onCreada va antes de sacar la fila del lote', () => {
    expect(codigo.indexOf('await onCreada(f, { clienteId, prestamoId })'))
      .toBeGreaterThan(-1)
    expect(codigo.indexOf('await onCreada(f, { clienteId, prestamoId })'))
      .toBeLessThan(codigo.indexOf('prev.filter((x) => x._id !== f._id)'))
  })

  it('el préstamo ya creado no se vuelve a crear: solo se reintenta apuntarlo', () => {
    expect(codigo).toMatch(/let prestamoId = f\._prestamoId \|\| null/)
    expect(codigo).toMatch(/if \(!prestamoId\) \{/)
    expect(codigo).toMatch(/'Se guardó pero no se pudo apuntar: toca Crear otra vez'/)
    // El préstamo creado se anota en la fila ANTES de apuntarlo: si se cierra
    // la pantalla entre medias, la caché ya lo sabe.
    const anota = codigo.indexOf('_prestamoId: idPrestamo')
    expect(anota).toBeGreaterThan(-1)
    expect(anota).toBeLessThan(codigo.indexOf('await onCreada(f, { clienteId, prestamoId })'))
  })

  it('la fila ya creada sigue siendo creable aunque cambie lo de arriba', () => {
    expect(codigo).toMatch(/const creables = conEstado\.filter\(\(f\) => f\._prestamoId \|\| f\._estado !== 'rojo'\)/)
  })

  it('en la carga del dueño ninguna fila se tira: las rojas se quedan', () => {
    const i = codigo.indexOf('if (solicitud) {\n      const conFallo')
    expect(i).toBeGreaterThan(-1)
    expect(i).toBeLessThan(codigo.indexOf('.filter((f) => conFallo.has(f._id))'))
  })

  it('sin solicitud no se manda la telemetría de cartulinas', () => {
    expect(codigo).toMatch(/if \(!solicitud\) \{\s*fetch\('\/api\/herramientas\/precision-cartulina'/)
  })

  it('las quitadas viajan en onListo y onQuitadas', () => {
    expect(codigo).toMatch(/onListo\?\.\(\{ creados, fallos, \.\.\.\(quedan > 0 && \{ quedanFilas: true \}\), quitadas \}\)/)
    // El migrador de siempre no manda `quitadas`.
    expect(codigo).toMatch(/onListo\?\.\(\{ creados, fallos \}\)/)
    expect(codigo).toMatch(/onListo\?\.\(\{ creados, fallos, quedanFilas: true \}\)/)
    expect(codigo).toMatch(/onQuitadas\?\.\(/)
  })
})

describe('las filas que trae la solicitud', () => {
  it('con filasIniciales nuevas se unen con unirFilasDelLote', () => expect(codigo).toMatch(/unirFilasDelLote\(/))

  it('se importa de la tarea 1, no se reescribe', () => {
    expect(src).toMatch(/import \{ unirFilasDelLote \} from '@\/lib\/carga-asesor\/al-lote'/)
  })

  it('lo ya creado sale aunque estuviera en la caché', () => {
    expect(codigo).toMatch(/\.filter\(\(f\) => !yaCreadas\.has\(f\._id\)\)/)
  })

  it('la clave del lote de la solicitud viene de fuera; la del migrador sigue igual', () => {
    expect(codigo).toMatch(/claveLote: claveDeFuera/)
    expect(src).toMatch(/const claveLote = `migrador:lote:\$\{organizationId \|\| 'sin-negocio'\}`/)
  })

  it('sin frecuencia arriba el selector lo dice, no enseña «Diario»', () => {
    expect(codigo).toMatch(/\{!base\.frecuencia && <option value="">/)
  })
})

describe('la fila repetida y el archivo de donde salió', () => {
  it('dice con cuál parece repetida y ofrece las dos salidas', () => {
    expect(codigo).toMatch(/Parece la misma que la fila \{f\._repetidaDe\}/)
    expect(codigo).toMatch(/onClick=\{\(\) => onEditar\('noEsLaMisma', true\)\}/)
    expect(codigo).toMatch(/>No es la misma<\/button>/)
    expect(codigo).toMatch(/>Quitar<\/button>/)
  })

  it('el enlace al original abre en otra pestaña', () => {
    expect(codigo).toMatch(/href=\{enlaceArchivo\(f\._archivo\)\} target="_blank" rel="noopener"/)
    expect(codigo).toMatch(/`foto \$\{n\}`/)
    expect(codigo).toMatch(/`Excel, hoja \$\{f\._hoja\}`/)
    expect(codigo).toMatch(/`archivo \$\{n\}`/)
  })

  it('sinSubir esconde la galería y la cámara', () => {
    expect(codigo).toMatch(/\{!sinSubir && \(/)
  })
})

describe('endurecimientos tras la revisión', () => {
  it('la fila ya creada enseña lo que se guardó, no lo de arriba de ahora', () => {
    const ficha = { monto: 300000, frecuencia: 'semanal', tasa: 10, modoInteres: 'fijo' }
    const f = { ...ok, monto: 999999, _prestamoId: 'p1', _ficha: ficha }
    const r = resumenDeLaFila(f, { ...base, tasa: '50', frecuencia: 'mensual' })
    expect(r).toMatch(/semanal 10%/)
    expect(r).not.toMatch(/50%|mensual/)
    expect(r).toMatch(/300/)
    // Sin préstamo creado sigue saliendo de `efectivo`.
    expect(resumenDeLaFila({ ...ok, tasa: '' }, base)).toMatch(/diario 20%/)
  })

  it('el préstamo ya creado no ofrece cambiar su modo', () => {
    expect(codigo).toMatch(/const ch = yaCreada \? null : choqueDeLaFila\(f, base\)/)
  })

  it('en la carga del dueño, sin baseInicial, lo de arriba arranca vacío', () => {
    expect(baseDeArranque(true, undefined)).toMatchObject({ tasa: '', frecuencia: '' })
    expect(baseDeArranque(true, null)).toMatchObject({ tasa: '', frecuencia: '' })
    expect(baseDeArranque(true, { tasa: '15', frecuencia: 'semanal' })).toMatchObject({ tasa: '15', frecuencia: 'semanal', modoInteres: 'fijo', rutaId: '' })
    // El migrador de siempre no cambia.
    expect(baseDeArranque(false, undefined)).toEqual({ tasa: '20', frecuencia: 'diario', modoInteres: 'fijo', rutaId: '' })
  })

  it('sin onCreada en la carga del dueño no se crea nada', () => {
    const i = codigo.indexOf("if (solicitud && typeof onCreada !== 'function') {")
    expect(i).toBeGreaterThan(-1)
    expect(i).toBeLessThan(codigo.indexOf("fetch('/api/clientes'"))
    expect(codigo).toMatch(/const SIN_APUNTAR = 'Falta cómo apuntar la carga'/)
    expect(codigo).toMatch(/console\.error\('LoteFotos: modo solicitud sin onCreada/)
  })

  it('quitar calcula con el estado de verdad y avisa fuera del setFilas', () => {
    expect(codigo).toMatch(/setQuitadas\(\(q\) => \(q\.includes\(id\) \? q : \[\.\.\.q, id\]\)\)/)
    expect(codigo).toMatch(/const quedan = prev\.filter\(\(f\) => f\._id !== id\)/)
    expect(codigo).toMatch(/onQuitadas\?\.\(quitadas\)/)
    expect(codigo).not.toMatch(/const quedan = filas\.filter\(\(f\) => f\._id !== id\)/)
  })
})
