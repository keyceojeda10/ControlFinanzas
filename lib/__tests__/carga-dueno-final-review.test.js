import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { estadoDe, filasAMedias, clienteDeLaRespuesta } from '@/components/migrador/LoteFotos'
import { sigueConElDueno, A_MEDIAS, CAMBIO_FUERA } from '@/components/carga/RevisionDeLaCarga'

// Final review de «La carga de cartera la revisa y la carga el dueño» (23 nov 2026).
//
// I1: el dueño pedía ayuda con una fila cuyo préstamo se creó y no se apuntó
//     («toca Crear otra vez»): el lote se desmontaba, el apunte no se
//     reintentaba y Carlos la importaba otra vez. Y desde otro teléfono podía
//     pedir ayuda mientras este seguía creando.
// I3: con una cédula REAL que ya estaba en la cartera, `/api/clientes` da 409 y
//     el lote le sumaba un préstamo sin preguntar: lo que el dueño volvía a
//     subir se cargaba dos veces.

/* Sin comentarios: las notas citan a los clientes y nombran lo prohibido. */
const sinNotas = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
const lote = sinNotas(readFileSync('components/migrador/LoteFotos.jsx', 'utf8'))
const revision = sinNotas(readFileSync('components/carga/RevisionDeLaCarga.jsx', 'utf8'))

const base = { tasa: '20', frecuencia: 'diario', modoInteres: 'fijo', rutaId: '' }
const ok = { nombre: 'Ana', monto: 500000, frecuencia: 'diario', plazoUnidades: '24', _dudas: [] }

describe('I1 · las filas a medias no dejan pedir ayuda', () => {
  it('filasAMedias cuenta las que tienen préstamo y siguen en el lote', () => {
    expect(filasAMedias([{ _prestamoId: 'p1' }, { _clienteId: 'c2' }, { _prestamoId: null }, {}])).toBe(1)
    expect(filasAMedias([])).toBe(0)
    expect(filasAMedias(undefined)).toBe(0)
  })

  it('el lote se lo avisa a la página, y al desmontarse vuelve a cero', () => {
    expect(lote).toMatch(/onCreando, solicitudId, onPendientesDeApuntar, antesDeCrear,\n\}\) \{/)
    expect(lote).toMatch(/const aMedias = filasAMedias\(filas\)\s*useEffect\(\(\) => \{ onPendientesDeApuntar\?\.\(aMedias\) \}, \[aMedias, onPendientesDeApuntar\]\)/)
    expect(lote).toMatch(/useEffect\(\(\) => \(\) => \{ onPendientesDeApuntar\?\.\(0\) \}, \[onPendientesDeApuntar\]\)/)
  })

  it('la revisión lo recibe y apaga «Necesito ayuda» y «Pedir ayuda» con filas a medias', () => {
    const i = revision.indexOf('<LoteFotos')
    const props = revision.slice(i, revision.indexOf('/>', i))
    expect(props).toMatch(/onPendientesDeApuntar=\{setAMedias\}/)
    expect(revision).toMatch(/<BotonSecundario onClick=\{\(\) => setAyudaAbierta\(true\)\} disabled=\{creandoLote \|\| aMedias > 0\}>/)
    expect(revision).toMatch(/<BotonSecundario onClick=\{pedirAyuda\} disabled=\{pidiendo \|\| creandoLote \|\| aMedias > 0\}>/)
    expect(revision).toMatch(/\{aMedias > 0 && \(\s*<span[^>]*>\{A_MEDIAS\}<\/span>/)
    expect(A_MEDIAS).toBe('Primero toca Crear para terminar de guardar las filas que quedaron a medias')
    // Y aunque el botón se colara, pedirAyuda no sale.
    expect(revision).toMatch(/const pedirAyuda = async \(\) => \{\s*if \(aMedias > 0\) \{ setError\(A_MEDIAS\); return \}/)
  })
})

describe('I1 (dos teléfonos) · antes de cada tanda se mira si la carga sigue con el dueño', () => {
  it('sigueConElDueno: solo la misma solicitud en «en_revision»', () => {
    expect(sigueConElDueno({ solicitud: { id: 's1', estado: 'en_revision' } }, 's1')).toBe(true)
    expect(sigueConElDueno({ solicitud: { id: 's1', estado: 'ayuda' } }, 's1')).toBe(CAMBIO_FUERA)
    expect(sigueConElDueno({ solicitud: { id: 's2', estado: 'en_revision' } }, 's1')).toBe(CAMBIO_FUERA)
    expect(sigueConElDueno({ solicitud: null }, 's1')).toBe(CAMBIO_FUERA)
    expect(sigueConElDueno(null, 's1')).toBe(CAMBIO_FUERA)
  })

  it('la revisión pregunta con ?solo=estado y se lo pasa al lote', () => {
    expect(revision).toMatch(/fetch\('\/api\/carga-asesor\?solo=estado', \{ cache: 'no-store' \}\)/)
    expect(revision).toMatch(/sigueConElDueno\(await r\.json\(\)\.catch\(\(\) => null\), solicitud\.id\)/)
    const i = revision.indexOf('<LoteFotos')
    expect(revision.slice(i, revision.indexOf('/>', i))).toMatch(/antesDeCrear=\{antesDeCrear\}/)
  })

  it('el lote pregunta ANTES de cada tanda (dentro del bucle, antes de crear nada) y se para si no es true', () => {
    const bucle = lote.indexOf('for (let i = 0; i < creables.length; i += A_LA_VEZ) {')
    const pregunta = lote.indexOf('sigue = await antesDeCrear()')
    const tanda = lote.indexOf('const tanda = creables.slice(i, i + A_LA_VEZ)')
    expect(bucle).toBeGreaterThan(-1)
    expect(pregunta).toBeGreaterThan(bucle)
    expect(pregunta).toBeLessThan(tanda)
    expect(lote).toMatch(/if \(sigue !== true\) \{ detenido = typeof sigue === 'string' && sigue \? sigue : DETENIDO; break \}/)
    // Lo que se dice: el motivo queda a la vista.
    expect(lote).toMatch(/if \(detenido\) setError\(detenido\)/)
  })

  it('al pararse por un cambio de fuera, la revisión lo dice arriba y refresca', () => {
    expect(revision).toMatch(/if \(cambioFuera\.current\) \{\s*cambioFuera\.current = false\s*setError\(CAMBIO_FUERA\)\s*onCambio\?\.\(\)/)
  })
})

describe('I3 · la cédula real que ya está en la cartera pregunta antes de sumar un préstamo', () => {
  const conflicto = { ok: false, status: 409, data: { error: 'Ya existe un cliente con esa cédula', existingId: 'c7' } }

  it('cédula real + 409: la fila se para (yaTiene), no sigue con el cliente', () => {
    expect(clienteDeLaRespuesta({ solicitud: true, ...conflicto, cedula: '1032456789' })).toEqual({ yaTiene: 'c7' })
  })

  it('con «Sí, es otro» sigue con ese cliente', () => {
    expect(clienteDeLaRespuesta({ solicitud: true, ...conflicto, cedula: '1032456789', esOtro: true })).toEqual({ clienteId: 'c7' })
  })

  it('cédula SIN-C_ de la fila + 409: es el reintento, sigue con él', () => {
    expect(clienteDeLaRespuesta({ solicitud: true, ...conflicto, cedula: 'SIN-C_s1_1-0' })).toEqual({ clienteId: 'c7' })
  })

  it('bloqueado en otra ruta: error, como antes', () => {
    const r = clienteDeLaRespuesta({ solicitud: true, ok: false, status: 409, data: { error: 'En otra ruta', existingId: 'c7', bloqueada: true }, cedula: 'SIN-C_s1_1-0' })
    expect(r).toEqual({ error: 'En otra ruta' })
  })

  it('fuera del modo solicitud (el migrador) un 409 sigue siendo error', () => {
    expect(clienteDeLaRespuesta({ solicitud: false, ...conflicto, cedula: 'SIN-C_s1_1-0' })).toEqual({ error: 'Ya existe un cliente con esa cédula' })
  })

  it('creado: el id nuevo', () => {
    expect(clienteDeLaRespuesta({ solicitud: true, ok: true, status: 201, data: { id: 'c9' }, cedula: '1' })).toEqual({ clienteId: 'c9' })
  })

  it('la fila que ya estaba queda en rojo hasta «Sí, es otro»', () => {
    expect(estadoDe({ ...ok, _yaTiene: { id: 'c7' } }, base)).toBe('rojo')
    expect(estadoDe({ ...ok, _yaTiene: { id: 'c7' }, _esOtro: true }, base)).toBe('verde')
  })

  it('el lote usa la respuesta: marca la fila y no crea el préstamo; «Sí, es otro» sigue con ese cliente', () => {
    expect(lote).toMatch(/const r = clienteDeLaRespuesta\(\{ solicitud, ok: resC\.ok, status: resC\.status, data: dataC, cedula, esOtro: f\._esOtro === true \}\)/)
    expect(lote).toMatch(/if \(r\.yaTiene\) \{[\s\S]{0,200}_yaTiene: \{ id: idYa \}[\s\S]{0,80}throw new Error\(YA_EN_LA_CARTERA\)/)
    expect(lote).toMatch(/let clienteId = f\._clienteId \|\| \(f\._esOtro && f\._yaTiene\?\.id\) \|\| null/)
    // Ya no queda el atajo que seguía con cualquier 409.
    expect(lote).not.toMatch(/resC\.status === 409 && dataC\.existingId/)
  })

  it('la fila lo pregunta con «Quitar» y «Sí, es otro»', () => {
    expect(lote).toMatch(/Ya tienes a \{f\.nombre\?\.trim\(\) \|\| 'este cliente'\} en tu cartera: ¿es otro préstamo\?/)
    expect(lote).toMatch(/\{yaTiene && \([\s\S]{0,900}onClick=\{onQuitar\}[^>]*>Quitar<\/button>\s*<button type="button" onClick=\{\(\) => onEditar\('_esOtro', true\)\}[^>]*>Sí, es otro<\/button>/)
  })

  it('cambiar la cédula de esa fila vuelve a preguntar', () => {
    expect(lote).toMatch(/if \(campo === 'cedula' && f\._yaTiene\) return \{ \.\.\.f, \[campo\]: valor, _dudas: dudas, _yaTiene: null, _esOtro: false \}/)
  })
})
