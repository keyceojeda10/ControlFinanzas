/* LOS VIDEOS DEL PROFE: el catálogo manda (19 oct 2026). */
import { describe, it, expect } from 'vitest'
import {
  CATALOGO, SERIES, videoPorId, videosPara, videoDeLaPantalla, desdeDe, capituloEn, duracionCorta, reloj,
  partesDe, tareaDe, TAREAS, profeHabilitado, PROFE_PARA_TODOS,
  ayudaDeLaPantalla, pantallaDeEntrada, duracionDe, preguntaDe, VISTO_DESDE, PRIMERA_VEZ, volverDe,
} from '@/lib/tutoriales/profe'
import { seccionesConfig } from '@/lib/adaptadores/configuracion'

const todos = CATALOGO.videos

describe('el catálogo copiado', () => {
  it('trae los 45 videos, cada uno con su archivo y su portada en la app', () => {
    expect(todos).toHaveLength(45)
    for (const v of todos) {
      expect(v.src, v.id).toMatch(/^\/videos\/.+\.mp4$/)
      expect(v.poster, v.id).toMatch(/^\/videos\/.+\.jpg$/)
      expect(v.origen, v.id).toBeUndefined()
    }
  })
  it('toda serie del catálogo tiene su lugar en la lista de Ayuda', () => {
    const ids = new Set(SERIES.map((s) => s.id))
    for (const v of todos) expect(ids.has(v.serie), v.serie).toBe(true)
  })
  it('los capítulos van en orden y empiezan en 0', () => {
    for (const v of todos) {
      expect(v.capitulos[0].t, v.id).toBe(0)
      for (let i = 1; i < v.capitulos.length; i++) expect(v.capitulos[i].t, v.id).toBeGreaterThan(v.capitulos[i - 1].t)
    }
  })
})

describe('primero lo revisa Carlos en su cuenta (19 oct 2026)', () => {
  it('solo su negocio y la demo de los videos, hasta abrirlo a todos', () => {
    if (PROFE_PARA_TODOS) return
    expect(profeHabilitado('cmm7iigyr00011t2rwyg9luph')).toBe(true)
    expect(profeHabilitado('zzvideodemo000000000000org')).toBe(true)
    expect(profeHabilitado('otro-negocio')).toBe(false)
    expect(profeHabilitado(undefined)).toBe(false)
  })
  it('sin habilitar: el servidor no lee nada y Configuración no enseña «Ayuda»', () => {
    const fs = require('fs')
    const api = fs.readFileSync('app/api/tutoriales/route.js', 'utf8')
    const corte = api.indexOf('if (!profeHabilitado(u.organizationId)) return Response.json(APAGADO)')
    expect(corte).toBeGreaterThan(0)
    expect(corte).toBeLessThan(api.indexOf('await Promise.all(['))
    expect(seccionesConfig({ rol: 'owner', ayuda: false }).map((s) => s.id)).not.toContain('ayuda')
    const conf = fs.readFileSync('app/(dashboard)/configuracion/page.jsx', 'utf8')
    expect(conf).toContain('seccionesConfig({ rol, cobradores, ayuda: Boolean(profe?.activo) })')
    expect(conf).toContain('filasIndice({ rol, cobradores, ayuda: Boolean(profe?.activo) }, valores)')
    expect(conf).toMatch(/ayuda=\{Boolean\(profe\?\.activo\)\}/)
  })
})

describe('quién ve qué', () => {
  it('solo lo terminado: nada en «revisar»', () => {
    expect(videosPara({ rol: 'owner' }).some((v) => v.estado === 'revisar')).toBe(false)
  })
  it('el cobrador ve solo los suyos, y nada si el dueño lo apagó', () => {
    const suyos = videosPara({ rol: 'cobrador' })
    expect(suyos.length).toBeGreaterThan(0)
    expect(suyos.every((v) => v.para.includes('cobrador'))).toBe(true)
    expect(videosPara({ rol: 'cobrador', paraCobradores: false })).toHaveLength(0)
  })
  it('los siete del cobrador del catálogo', () => {
    const ids = todos.filter((v) => v.para.includes('cobrador')).map((v) => v.id).sort()
    expect(ids).toEqual(['caja-gastos', 'cobradores-dia', 'prestamos-otro-monto', 'prestamos-registrar-pago', 'rutas-lista-clientes', 'rutas-recorrido', 'rutas-tarjeta'])
  })
})

describe('la lengüeta (D1) de cada pantalla', () => {
  const lista = todos
  it('la pantalla y su pestaña', () => {
    expect(videoDeLaPantalla('/caja', null, lista)?.id).toBe('caja-caja')
    expect(videoDeLaPantalla('/caja', 'Por ruta', lista)?.id).toBe('caja-caja-ruta')
    expect(videoDeLaPantalla('/caja', 'Cuadre', lista)?.id).toBe('caja-cuadre')
    expect(videoDeLaPantalla('/caja', 'Cuentas', lista)?.id).toBe('caja-caja')
  })
  it('las rutas con corchetes, y la fija gana', () => {
    expect(videoDeLaPantalla('/clientes/abc123', null, lista)?.id).toBe('clientes-ficha')
    expect(videoDeLaPantalla('/clientes/nuevo', null, lista)?.id).toBe('clientes-crear-cliente')
    expect(videoDeLaPantalla('/cobradores/nuevo', null, lista)?.id).toBe('cobradores-crear')
    expect(videoDeLaPantalla('/rutas/r1', null, lista)?.id).toBe('rutas-por-dentro')
  })
  it('sin video, nada', () => {
    expect(videoDeLaPantalla('/configuracion', null, lista)).toBe(null)
    expect(videoDeLaPantalla('/clientes/abc/editar', null, lista)).toBe(null)
  })
  it('solo con los que la persona puede ver', () => {
    const cobrador = videosPara({ rol: 'cobrador' })
    expect(videoDeLaPantalla('/caja', null, cobrador)).toBe(null)
    expect(videoDeLaPantalla('/cobros-hoy', null, cobrador)?.id).toBe('cobradores-dia')
  })
})

describe('la ayuda de cada pantalla: la general y las de sus funciones (Adenda 6)', () => {
  const ids = (a) => ({ general: a.general?.id ?? null, funciones: a.funciones.map((v) => v.id) })
  it('las hojas van a la pantalla donde se abren', () => {
    expect(pantallaDeEntrada({ pantalla: '/prestamos/[id] → hoja «Gestión»' })).toBe('/prestamos/[id]')
    expect(pantallaDeEntrada({ pantalla: 'Hoja de pago' })).toBe('/prestamos/[id]')
    expect(pantallaDeEntrada({ pantalla: 'Hoja «Editar la ruta»' })).toBe('/rutas/[id]')
    expect(pantallaDeEntrada({ pantalla: '/caja (cobrador)' })).toBe('/caja')
    expect(pantallaDeEntrada({ pantalla: '/dashboard (cuenta nueva)' })).toBeNull()
    expect(pantallaDeEntrada({ pantalla: 'Primera entrada de una cuenta nueva' })).toBeNull()
  })
  it('la ficha del préstamo: «Empieza aquí» y lo que se hace en ella, con la Gestión y el pago', () => {
    const a = ids(ayudaDeLaPantalla('/prestamos/abc', null, videosPara({ rol: 'owner' }), { rol: 'owner' }))
    expect(a.general).toBe('prestamos-ficha')
    for (const id of ['prestamos-recibos', 'prestamos-paga-todo', 'prestamos-renovar', 'prestamos-cerrar', 'prestamos-registrar-pago', 'prestamos-otro-monto', 'prestamos-abono-capital', 'prestamos-intereses']) {
      expect(a.funciones, id).toContain(id)
    }
    expect(new Set(a.funciones).size).toBe(a.funciones.length)
    expect(a.funciones).not.toContain('prestamos-ficha')
    expect(a.funciones).not.toContain('clientes-whatsapp')
  })
  it('la caja: cada pestaña su video; el cobrador, los suyos', () => {
    expect(ids(ayudaDeLaPantalla('/caja', null, videosPara({ rol: 'owner' }), { rol: 'owner' }))).toEqual({ general: 'caja-caja', funciones: [] })
    expect(ayudaDeLaPantalla('/caja', 'Cuadre', videosPara({ rol: 'owner' }), { rol: 'owner' }).general.id).toBe('caja-cuadre')
    expect(ids(ayudaDeLaPantalla('/caja', null, videosPara({ rol: 'cobrador' }), { rol: 'cobrador' }))).toEqual({ general: null, funciones: ['caja-gastos', 'cobradores-dia'] })
  })
  it('la ruta por dentro lleva también la hoja «Editar la ruta»', () => {
    const a = ids(ayudaDeLaPantalla('/rutas/r1', null, videosPara({ rol: 'owner' }), { rol: 'owner' }))
    expect(a.general).toBe('rutas-por-dentro')
    for (const id of ['rutas-recorrido', 'rutas-clientes', 'rutas-ordenar', 'rutas-unir', 'rutas-eliminar', 'capital-capital-ruta']) expect(a.funciones, id).toContain(id)
  })
  it('la ruta fija gana y sin video no hay pastilla', () => {
    expect(ids(ayudaDeLaPantalla('/clientes/nuevo', null, videosPara({ rol: 'owner' }), { rol: 'owner' }))).toEqual({ general: 'clientes-crear-cliente', funciones: [] })
    expect(ayudaDeLaPantalla('/configuracion', null, videosPara({ rol: 'owner' })).todos).toHaveLength(0)
    expect(ayudaDeLaPantalla('/dashboard', null, videosPara({ rol: 'owner' })).todos).toHaveLength(0)
    expect(ids(ayudaDeLaPantalla('/actividad', null, videosPara({ rol: 'owner' })))).toEqual({ general: null, funciones: ['cobradores-seguir'] })
  })
  it('la duración de lo que se va a ver, y visto al 80 %', () => {
    const v = videoPorId('prestamos-cerrar')
    expect(duracionDe(v, 'Anular')).toBeGreaterThan(0)
    expect(duracionDe(v, 'Anular')).toBeLessThan(v.duracion)
    expect(duracionDe(v, 'No existe')).toBe(v.duracion)
    expect(preguntaDe({ titulo: 'Los gastos' })).toBe('Los gastos')
    expect(preguntaDe({ titulo: 'Los gastos', pregunta: '¿Cómo anoto un gasto?' })).toBe('¿Cómo anoto un gasto?')
    expect(VISTO_DESDE).toBe(80)
  })
})

describe('el botón E2 y el reproductor', () => {
  it('abre en el capítulo de su función', () => {
    const v = videoPorId('prestamos-cerrar')
    expect(desdeDe(v, 'Anular')).toBe(37.2)
    expect(desdeDe(v, 'No existe')).toBe(0)
  })
  it('el capítulo que suena', () => {
    const v = videoPorId('prestamos-cerrar')
    expect(capituloEn(v, 0)).toBe(0)
    expect(capituloEn(v, 37.2)).toBeGreaterThan(0)
  })
  it('las partes duran hasta la siguiente, y la última hasta el final', () => {
    const v = videoPorId('caja-cuadre')
    const p = partesDe(v)
    expect(p).toHaveLength(v.capitulos.length)
    expect(p[0]).toMatchObject({ n: 1, t: 0, titulo: 'Presentación' })
    expect(p[0].dura).toBeCloseTo(v.capitulos[1].t, 5)
    expect(p.at(-1).dura).toBeCloseTo(v.duracion - v.capitulos.at(-1).t, 5)
    expect(partesDe({ titulo: 'Solo', duracion: 30 })).toEqual([{ n: 1, t: 0, titulo: 'Solo', dura: 30 }])
  })
  it('todo video con tarea sabe a dónde lleva; los demás no tienen botón', () => {
    for (const v of todos) {
      if (v.tarea) expect(tareaDe(v), v.id).toMatchObject({ texto: v.tarea, href: expect.stringMatching(/^\//) })
      else expect(tareaDe(v), v.id).toBeNull()
    }
    expect(tareaDe(videoPorId('capital-capital'))).toEqual({ texto: 'Registrar mi capital inicial', accion: 'capital-inicial', href: '/capital' })
    // Ninguna tarea apunta a un video que ya no está en el catálogo.
    for (const id of Object.keys(TAREAS)) expect(videoPorId(id), id).not.toBeNull()
  })
  it('las cifras de tiempo', () => {
    expect(duracionCorta(45)).toBe('45 s')
    expect(duracionCorta(138.1)).toBe('2 min')
    expect(reloj(95.6)).toBe('1:35')
  })
})

/* LA AYUDA, DONDE ESTÁ LA DUDA (Adenda 6, 19 oct 2026). Los 44 botones sueltos
   se fueron: una pastilla por pantalla, minutos en los menús y enlaces con la
   pregunta en los formularios. Anclado en el JSX, sin comentarios. */
describe('la ayuda está donde está la duda', () => {
  const fs = require('fs')
  const path = require('path')
  const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const lee = (f) => sinComentarios(fs.readFileSync(path.join(process.cwd(), f), 'utf8'))
  const fuentes = []
  const recorrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) { if (e.name !== 'node_modules' && !e.name.startsWith('.')) recorrer(p) }
      else if (/\.jsx?$/.test(e.name)) fuentes.push(sinComentarios(fs.readFileSync(p, 'utf8')))
    }
  }
  recorrer(path.join(process.cwd(), 'app'))
  recorrer(path.join(process.cwd(), 'components'))
  const todo = fuentes.join('\n')
  const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  it('no queda ningún botón suelto', () => {
    expect(todo).not.toMatch(/<BotonProfe\b/)
    expect(fs.existsSync('components/tutoriales/BotonProfe.jsx')).toBe(false)
  })
  it('una pastilla por pantalla: en las tres cabeceras del teléfono y en la barra de escritorio', () => {
    const cab = lee('components/armazon/CabeceraMovil.jsx')
    for (const v of ['Navegacion', 'Detalle', 'Tarea']) expect(cab, v).toMatch(new RegExp(`function ${v}\\([^)]*profe = null`))
    expect(cab.match(/\{profe\}/g)?.length).toBeGreaterThanOrEqual(3)
    expect(lee('components/armazon/Armazon.jsx')).toContain('profe={<PastillaProfe />}')
    expect(lee('components/armazon/BarraLateral.jsx')).toContain('<PastillaProfe lateral />')
  })
  it('todo video del catálogo tiene por dónde abrirse: su pastilla, o su enlace o minuto', () => {
    for (const v of todos) {
      for (const d of v.donde ?? []) {
        if (d.tipo === 'pantalla completa' || pantallaDeEntrada(d)) continue
        const re = new RegExp(`<(EnlaceProfe|BotonMinutoProfe)\\b[^>]*id="${escapar(v.id)}"[^>]*junto="${escapar(d.junto_a)}"`)
        expect(re.test(todo), `${v.id} · ${d.junto_a}`).toBe(true)
      }
    }
  })
  it('el menú de Gestión lleva el minuto de cada opción con video', () => {
    const menu = lee('components/pantallas/MenuGestion.jsx')
    const deGestion = todos.flatMap((v) => (v.donde ?? []).filter((d) => /hoja «Gestión»/.test(d.pantalla ?? '')).map((d) => [v.id, d.junto_a]))
    expect(deGestion.length).toBeGreaterThan(10)
    for (const [id, junto] of deGestion) expect(menu, `${id} · ${junto}`).toContain(`['${id}', '${junto}']`)
    expect(menu).toContain('{minuto && <BotonMinutoProfe id={minuto[0]} junto={minuto[1]}')
    const ruta = lee('app/(dashboard)/rutas/[id]/page.jsx')
    expect(ruta).toContain('<BotonMinutoProfe id="rutas-unir" junto="Unir con otra ruta" />')
    expect(ruta).toContain('<BotonMinutoProfe id="rutas-eliminar" junto="Eliminar esta ruta" />')
  })
  it('las decisiones de formulario llevan su pregunta', () => {
    expect(lee('app/(dashboard)/prestamos/nuevo/page.jsx')).toContain('<EnlaceProfe id="prestamos-modos" junto="¿Cómo cobra el interés?" pregunta="¿Cuál elijo?" />')
    const cobro = lee('components/pantallas/RegistrarCobro.jsx')
    expect(cobro).toContain('<EnlaceProfe id="prestamos-registrar-pago"')
    expect(cobro).toMatch(/id=\{aplicacion === 'intereses' \? 'prestamos-intereses' : 'prestamos-abono-capital'\}/)
  })
  it('la primera vez, la tarjeta; y la caja dice su pestaña', () => {
    const caja = lee('app/(dashboard)/caja/page.jsx')
    expect(caja).toContain('<AvisoPrimeraVez nombre="cierreCobrador" />')
    expect(caja).toContain('<AvisoPrimeraVez nombre="cierreDueno"')
    expect(caja).toContain("usePestanaProfe({ porruta: 'Por ruta', cuadre: 'Cuadre' }[cajaTab] ?? null)")
    expect(lee('app/(dashboard)/prestamos/nuevo/page.jsx')).toContain('<AvisoPrimeraVez nombre="prestamo"')
    for (const a of Object.values(PRIMERA_VEZ)) expect(videoPorId(a.video), a.video).not.toBeNull()
  })
})
