import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'

// «Cargar mi cartera» (plan «La carga de cartera la revisa y la carga el dueño»,
// 22 nov 2026). El dueño sube fotos, Excel o PDF; la app los lee y le enseña lo
// que encontró para que él mismo lo complete y lo cargue, o pida ayuda. Ya no hay
// «un asesor que te la deja cargada en 24 horas».

const leer = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '')
/* Sin comentarios: los de este repo citan a los clientes y nombran lo que se
   prohíbe, así que buscar en el texto entero da por bueno un comentario. */
const sinNotas = (s) => s
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')

const PAGINA = 'app/(dashboard)/cargar-cartera/page.jsx'
const REVISION = 'components/carga/RevisionDeLaCarga.jsx'
const pagina = sinNotas(leer(PAGINA))
const revision = sinNotas(leer(REVISION))

describe('la pantalla del dueño en /cargar-cartera', () => {
  it('existe RevisionDeLaCarga y la página la monta en en_revision', () => {
    expect(existsSync(REVISION)).toBe(true)
    expect(pagina).toMatch(/import RevisionDeLaCarga from '@\/components\/carga\/RevisionDeLaCarga'/)
    expect(pagina).toMatch(/const enRevision = sol\?\.estado === 'en_revision'/)
    expect(pagina).toMatch(/<RevisionDeLaCarga[\s\S]*?solicitud=\{sol\}[\s\S]*?revision=\{estado\.revision\}/)
  })

  it('mientras lee se refresca sola, y solo entonces', () => {
    expect(pagina).toMatch(/const LEYENDO = \['recibida', 'leyendo'\]/)
    expect(pagina).toMatch(/if \(!LEYENDO\.includes\(estadoSol\)\) return/)
    expect(pagina).toMatch(/const t = setInterval\(\(\) => cargar\(\{ callado: true \}\), 5000\)/)
    expect(pagina).toMatch(/return \(\) => clearInterval\(t\)/)
    expect(pagina).toMatch(/`Estamos leyendo tus \$\{sol\.archivos\.length\} archivos`/)
  })

  it('guarda la revisión que trae el GET', () => {
    expect(pagina).toMatch(/revision: j\.revision \?\? null/)
  })

  it('el veredicto pinta leídos, listos y por revisar', () => {
    expect(revision).toMatch(/>\{v\.leidos\} \{v\.leidos === 1 \? 'cliente leído' : 'clientes leídos'\}</)
    expect(revision).toMatch(/\{v\.listos\} \{v\.listos === 1 \? 'listo' : 'listos'\}/)
    expect(revision).toMatch(/\{v\.revisar\} \{v\.revisar === 1 \? 'necesita algo' : 'necesitan algo'\}/)
  })

  it('un archivo sin filas lo dice y enlaza la plantilla', () => {
    expect(revision).toMatch(/\{p\.sinFilas && \(/)
    expect(revision).toMatch(/href="\/api\/carga-masiva\/plantilla"[^>]*>Usa la plantilla</)
  })

  it('con cero filas no se monta LoteFotos', () => {
    expect(revision).toMatch(/const puedeCargar = !revision\?\.bloqueada && solicitud\?\.estado === 'en_revision' && Array\.isArray\(revision\?\.filas\)/)
    expect(revision).toMatch(/\{puedeCargar && revision\.filas\.length > 0 && \(\s*<LoteFotos/)
  })

  it('LoteFotos en modo solicitud: sin subir, con lo leído y apuntando cada préstamo', () => {
    const lote = revision.match(/<LoteFotos[\s\S]*?\/>/)?.[0] ?? ''
    expect(lote).toMatch(/\bsinSubir\b/)
    expect(lote).toMatch(/filasIniciales=\{revision\.filas\}/)
    expect(lote).toMatch(/creadas=\{revision\.creadas \?\? \[\]\}/)
    expect(lote).toMatch(/baseInicial=\{revision\.base\}/)
    expect(lote).toMatch(/claveLote=\{`carga:\$\{solicitud\.id\}`\}/)
    expect(lote).toMatch(/enlaceArchivo=\{enlaceArchivo\}/)
    expect(lote).toMatch(/onCreada=\{apuntar\}/)
    expect(lote).toMatch(/onQuitadas=\{terminar\}/)
    expect(lote).toMatch(/onListo=\{listo\}/)
    // El original siempre con su solicitud.
    expect(revision).toMatch(/`\/api\/carga-asesor\/archivo\/\$\{n\}\?solicitudId=\$\{encodeURIComponent\(solicitud\.id\)\}`/)
  })

  it('si no se pudo apuntar, LoteFotos se entera (el error sube)', () => {
    const apuntar = revision.match(/const apuntar = async[\s\S]*?\n {2}\}/)?.[0] ?? ''
    expect(apuntar).toMatch(/'\/api\/carga-asesor\/cargada'/)
    expect(apuntar).toMatch(/filaId: fila\._id, clienteId, prestamoId/)
    expect(apuntar).toMatch(/if \(!r\.ok\) throw new Error/)
    // Sin try: un apunte fallido tiene que llegar a LoteFotos.
    expect(apuntar).not.toMatch(/try \{/)
  })

  it('terminar lee `ok` y no toma «quedan filas» por error', () => {
    const terminar = revision.match(/const terminar = async[\s\S]*?\n {2}\}\n/)?.[0] ?? ''
    expect(terminar).toMatch(/terminar: true, quitadas/)
    expect(terminar).toMatch(/if \(r\.ok && j\.ok\) \{/)
    expect(terminar).toMatch(/if \(r\.ok \|\| r\.status === 409\)/)
    expect(terminar).toMatch(/setError\(j\.error \|\|/)
  })

  it('al terminar: invalidar clientes y, en la vista de cargada, PreguntaPlataDeHoy', () => {
    expect(revision).toMatch(/import \{ invalidarCachePorPrefijo \} from '@\/lib\/offline'/)
    expect(revision).toMatch(/invalidarCachePorPrefijo\('clientes:'\)\.catch\(\(\) => \{\}\)/)
    expect(pagina).toMatch(/import PreguntaPlataDeHoy from '@\/components\/cf\/PreguntaPlataDeHoy'/)
    expect(pagina).toMatch(/\{cargada && <PreguntaPlataDeHoy \/>\}/)
  })

  it('al quedarse sin filas cierra la carga; con filas pendientes no', () => {
    const listo = revision.match(/const listo = [\s\S]*?\n {2}\}/)?.[0] ?? ''
    expect(listo).toMatch(/if \(quedanFilas\)/)
    expect(listo).toMatch(/terminar\(quitadas \?\? \[\]\)/)
  })

  it('excede el plan: lo dice antes de la revisión', () => {
    expect(revision).toMatch(/\{revision\?\.excedePlan && revision\.espacio != null && \(/)
    expect(revision).toMatch(/`Tu plan deja \$\{revision\.espacio\} clientes más`/)
    const aviso = revision.indexOf('revision?.excedePlan &&')
    const lote = revision.indexOf('<LoteFotos')
    expect(aviso).toBeGreaterThan(-1)
    expect(aviso).toBeLessThan(lote)
  })

  it('el error de lectura no se enseña crudo', () => {
    expect(revision).toMatch(/\{revision\?\.errorLectura && \(/)
    expect(revision).toMatch(/No pudimos leer todo\. Si falta algo, pide ayuda\./)
    expect(revision).not.toMatch(/\{revision\??\.errorLectura\}/)
  })

  it('«Necesito ayuda» llama a /api/carga-asesor/ayuda con la nota y va antes del pie del lote', () => {
    expect(revision).toMatch(/>Necesito ayuda</)
    const pedir = revision.match(/const pedirAyuda = async[\s\S]*?\n {2}\}/)?.[0] ?? ''
    expect(pedir).toMatch(/'\/api\/carga-asesor\/ayuda'/)
    expect(pedir).toMatch(/solicitudId: solicitud\.id, nota: nota\.trim\(\)/)
    expect(revision).toMatch(/maxLength=\{1000\}/)
    // El pie de LoteFotos es fijo: lo que va DESPUÉS del lote queda tapado.
    expect(revision.indexOf('>Necesito ayuda<')).toBeLessThan(revision.indexOf('<LoteFotos'))
  })

  it('en ayuda: «Carlos la está revisando»', () => {
    expect(pagina).toMatch(/>Carlos la está revisando\. Te avisamos cuando esté\.</)
  })

  it('título y subtítulo nuevos', () => {
    expect(pagina).toMatch(/useCabecera\(\{ titulo: 'Cargar mi cartera', subtitulo: 'Lo leemos y tú lo revisas'/)
  })
})

describe('las cifras del veredicto', async () => {
  const { veredictoDe, motivoParaElDueno } = await import('@/components/carga/RevisionDeLaCarga')
  const base = { tasa: '20', frecuencia: 'diario', modoInteres: 'fijo', rutaId: '' }

  it('leídos = filas; listos con el mismo semáforo que LoteFotos', () => {
    const filas = [
      { _id: 'a', nombre: 'Ana', monto: 500000, frecuencia: 'diario', plazoUnidades: '24', _dudas: [] },
      { _id: 'b', nombre: 'Beto', monto: '', _dudas: [] },
      { _id: 'c', nombre: 'Caro', monto: 300000, frecuencia: 'diario', plazoUnidades: '24', _dudas: [{ campo: 'monto', texto: '¿Son $300?' }] },
    ]
    expect(veredictoDe({ filas, base })).toEqual({ leidos: 3, listos: 1, revisar: 2 })
  })

  it('sin base del negocio no se supone nada: sin tasa nada está listo', () => {
    const filas = [{ _id: 'a', nombre: 'Ana', monto: 500000, frecuencia: 'diario', plazoUnidades: '24', _dudas: [] }]
    expect(veredictoDe({ filas, base: { tasa: '', frecuencia: '', modoInteres: 'fijo', rutaId: '' } })).toEqual({ leidos: 1, listos: 0, revisar: 1 })
  })

  it('sin filas, ceros', () => {
    expect(veredictoDe({ filas: [], base })).toEqual({ leidos: 0, listos: 0, revisar: 0 })
    expect(veredictoDe(null)).toEqual({ leidos: 0, listos: 0, revisar: 0 })
  })

  it('el motivo técnico no llega al dueño', () => {
    expect(motivoParaElDueno('No se pudo leer: PrismaClientKnownRequestError at SELECT')).toBe('No pudimos leer este archivo')
    expect(motivoParaElDueno('Monto debe ser mayor a 0')).toBe('Falta el monto prestado')
    expect(motivoParaElDueno('No encontré clientes en la foto')).toBe('No encontré clientes en la foto')
  })
})

describe('sin emojis y sin la promesa de las 24 horas', () => {
  const tocados = [PAGINA, REVISION, 'components/pantallas/TraerCartera.jsx', 'components/pantallas/CarteraVacia.jsx', 'app/(dashboard)/clientes/nuevo/page.jsx']

  it('sin emojis', () => {
    for (const f of tocados) {
      // En lo que se pinta: los comentarios del repo usan «⚠» a propósito.
      const src = sinNotas(leer(f))
      expect(src.length, f).toBeGreaterThan(0)
      expect(src.match(/\p{Extended_Pictographic}/gu), f).toBeNull()
    }
  })

  it('ya no promete un asesor en 24 horas', () => {
    for (const f of [...tocados, 'lib/bot/cartera-post-registro.js']) {
      const src = sinNotas(leer(f))
      expect(src, f).not.toMatch(/24 horas/)
      expect(src, f).not.toMatch(/[Uu]n asesor/)
    }
  })

  it('los textos nuevos dicen que se lee y lo revisa el dueño', async () => {
    const { mensajeBienvenida, respuestaDeBoton } = await import('@/lib/bot/cartera-post-registro')
    expect(mensajeBienvenida('Ana', { grande: true })).toMatch(/lo revises y lo cargues/)
    expect(respuestaDeBoton('cartera_asesor').texto).toMatch(/lo revises y lo cargues/)
    expect(sinNotas(leer('components/pantallas/TraerCartera.jsx'))).toMatch(/Lo leemos en unos minutos y te enseñamos lo que encontramos para que lo revises y lo cargues/)
    expect(pagina).toMatch(/Sube las fotos del cuaderno, el Excel o el PDF\. Lo leemos en unos minutos y te enseñamos lo que encontramos para que lo revises y lo cargues/)
  })
})
