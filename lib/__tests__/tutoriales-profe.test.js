/* LOS VIDEOS DEL PROFE: el catálogo manda (19 oct 2026). */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  CATALOGO, SERIES, videoPorId, videosPara, videoDeLaPantalla, desdeDe, capituloEn, duracionCorta, reloj,
  partesDe, tareaDe, TAREAS, profeHabilitado, PROFE_PARA_TODOS,
  ayudaDeLaPantalla, pantallaDeEntrada, duracionDe, preguntaDe, VISTO_DESDE, PRIMERA_VEZ, volverDe, NOVEDAD_PROFE,
  conPuentes,
} from '@/lib/tutoriales/profe'
import { seccionesConfig } from '@/lib/adaptadores/configuracion'

const todos = CATALOGO.videos

describe('el catálogo copiado', () => {
  it('trae los videos del catálogo, cada uno con su archivo y su portada en la app', () => {
    expect(todos.length).toBeGreaterThanOrEqual(47)
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
  it('abierto a todos desde el 19 oct 2026 en la noche', () => {
    expect(PROFE_PARA_TODOS).toBe(true)
    expect(profeHabilitado('cualquier-negocio')).toBe(true)
    // La novedad: a quien ya tenía cuenta antes del estreno.
    expect(new Date(NOVEDAD_PROFE.estreno) < new Date('2026-10-21')).toBe(true)
  })
  it('con la puerta cerrada, solo su negocio y la demo de los videos', () => {
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
  it('los del cobrador del catálogo: sus ocho y los de todos (novedad, instalar, sin señal y la lupa)', () => {
    const ids = todos.filter((v) => v.para.includes('cobrador')).map((v) => v.id).sort()
    expect(ids).toEqual(['caja-gastos', 'cobradores-dia', 'cobradores-moverte', 'inicio-instalar', 'inicio-lupa', 'inicio-novedad-profe', 'inicio-sin-senal', 'prestamos-otro-monto', 'prestamos-registrar-pago', 'rutas-lista-clientes', 'rutas-recorrido', 'rutas-tarjeta'])
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
    expect(videoDeLaPantalla('/socios', null, lista)).toBe(null)
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
    expect(ayudaDeLaPantalla('/socios', null, videosPara({ rol: 'owner' })).todos).toHaveLength(0)
    // Configuración y Más llevan el de instalar la app (listo desde el 19 oct).
    // El de Configuración no va dentro sino en Más, junto a su fila (27 oct);
    // Más del cobrador tiene el suyo.
    expect(ids(ayudaDeLaPantalla('/configuracion', null, videosPara({ rol: 'owner' })))).toEqual({ general: null, funciones: ['inicio-instalar'] })
    expect(ids(ayudaDeLaPantalla('/mas', null, videosPara({ rol: 'cobrador' }), { rol: 'cobrador' }))).toEqual({ general: 'cobradores-moverte', funciones: ['inicio-instalar'] })
    // El Inicio del dueño tiene su video desde el 19 oct («Tu Inicio»).
    expect(ids(ayudaDeLaPantalla('/dashboard', null, videosPara({ rol: 'owner' })))).toEqual({ general: 'inicio-inicio', funciones: ['inicio-moverte', 'inicio-instalar'] })
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
        // La novedad tiene su propio aviso (NovedadProfe); la bienvenida, el suyo.
        if (d.tipo === 'pantalla completa' || d.tipo === 'novedades' || pantallaDeEntrada(d)) continue
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

/* LO QUE PIDIÓ CARLOS AL VERLO (19 oct 2026, noche). */
describe('los videos a la mano, en grande y a la vista', () => {
  const fs = require('fs')
  const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const lee = (f) => sinComentarios(fs.readFileSync(f, 'utf8'))

  it('el menú del + lleva el minuto de sus acciones', () => {
    const menu = lee('components/pantallas/MenuCrear.jsx')
    for (const id of ['prestamos-registrar-pago', 'prestamos-crear', 'caja-gastos', 'clientes-crear-cliente', 'cartera-cuaderno']) {
      expect(menu, id).toContain(`video="${id}"`)
      expect(videoPorId(id), id).not.toBeNull()
    }
    expect(menu).toContain('{video && <BotonMinutoProfe id={video} oscuro')
    // Encima del menú (z 90): el reproductor y la ayuda a z 95.
    expect(lee('components/tutoriales/ReproductorProfe.jsx')).toContain("<div style={{ position: 'relative', zIndex: 95 }}>")
    expect(lee('components/tutoriales/HojaAyudaProfe.jsx')).toContain("<div style={{ position: 'relative', zIndex: 95 }}>")
  })
  it('pantalla completa con las partes, moviendo el MISMO video', () => {
    const rep = lee('components/tutoriales/ReproductorProfe.jsx')
    expect(rep).toContain('aria-label="Ver en pantalla completa"')
    expect(rep).toContain("document.createElement('video')")
    expect(rep).toMatch(/if \(v && destino && v\.parentNode !== destino\) destino\.appendChild\(v\)/)
    expect(rep).toContain('Parte {Math.max(1, actual + 1)} de {partes.length}')
    expect(rep).toContain('aria-label="Parte anterior"')
    expect(rep).toContain('aria-label="Parte siguiente"')
    expect(rep).not.toMatch(/\.requestFullscreen\(\)\s*$/m)
  })
  it('la novedad: una vez, solo a quien ya usaba la app, nunca encima de pagar', () => {
    expect(videoPorId(NOVEDAD_PROFE.video)).not.toBeNull()
    const nov = lee('components/tutoriales/NovedadProfe.jsx')
    expect(nov).toContain("'/configuracion/plan'")
    expect(nov).toContain('saleLaOtra()')
    expect(nov).toContain('profe.descartarAviso(video.id)')
    expect(lee('components/tutoriales/ProfeProvider.jsx')).toContain('<NovedadProfe profe={valor}')
    expect(lee('app/api/tutoriales/route.js')).toContain('novedad: Boolean(yo?.createdAt && yo.createdAt < new Date(NOVEDAD_PROFE.estreno))')
  })
  it('cada quien ve el video de su Inicio y de su día de cobro', () => {
    const general = (ruta, rol, lista = videosPara({ rol })) => ayudaDeLaPantalla(ruta, null, lista, { rol }).general?.id
    expect(general('/dashboard', 'owner')).toBe('inicio-inicio')
    // El cobrador también entra al Inicio y «Tu Inicio» es del dueño. Tuvo el
    // puente hasta el 27 oct, cuando llegó el suyo: el puente se retiró solo.
    expect(general('/dashboard', 'cobrador')).toBe('cobradores-moverte')
    expect(general('/cobros-hoy', 'owner')).toBe('inicio-cobrar-dia')
    expect(general('/cobros-hoy', 'cobrador')).toBe('cobradores-dia')
    // Sin depender del orden del JSON: al revés da lo mismo.
    expect(general('/cobros-hoy', 'owner', [...videosPara({ rol: 'owner' })].reverse())).toBe('inicio-cobrar-dia')
    expect(general('/dashboard', 'owner', [...videosPara({ rol: 'owner' })].reverse())).toBe('inicio-inicio')
  })
  it('un video con dos D1 es el general de su primera pantalla y el segundo de la otra', () => {
    // «Cómo moverte en la app» (20 oct): el de /mas, y en el Inicio después de «Tu Inicio».
    const ids = (a) => ({ general: a.general?.id ?? null, funciones: a.funciones.map((v) => v.id) })
    const ver = (ruta, rol, lista = videosPara({ rol })) => ids(ayudaDeLaPantalla(ruta, null, lista, { rol }))
    expect(ver('/dashboard', 'owner')).toEqual({ general: 'inicio-inicio', funciones: ['inicio-moverte', 'inicio-instalar'] })
    expect(ver('/mas', 'owner')).toEqual({ general: 'inicio-moverte', funciones: ['inicio-configuracion', 'inicio-instalar'] })
    // Sin depender del orden del JSON (en el JSON «Cómo moverte» va antes).
    expect(ver('/dashboard', 'owner', [...videosPara({ rol: 'owner' })].reverse()).general).toBe('inicio-inicio')
    // Solo para dueños. El cobrador tiene su versión (27 oct), con los mismos
    // dos D1, y ninguno de los dos ve el del otro.
    expect(ver('/dashboard', 'cobrador')).toEqual({ general: 'cobradores-moverte', funciones: ['inicio-instalar'] })
    expect(ver('/mas', 'cobrador')).toEqual({ general: 'cobradores-moverte', funciones: ['inicio-instalar'] })
    expect(videoPorId('cobradores-moverte').para).toEqual(['cobrador'])
    // Y va en «Para empezar».
    expect(videoPorId('inicio-moverte').serie).toBe('inicio')
    expect(SERIES.find((x) => x.id === 'inicio').titulo).toBe('Para empezar')
  })
  it('el de Configuración se abre desde su fila en Más, no dentro de Configuración (27 oct)', () => {
    expect(videoPorId('inicio-configuracion').donde).toEqual([{ pantalla: '/mas', tipo: 'E2', junto_a: 'Configuración' }])
    const mas = readFileSync(resolve(process.cwd(), 'components/pantallas/PantallaMas.jsx'), 'utf8')
    expect(mas).toMatch(/<Fila icono="config"\s+nombre="Configuración"[^>]*video="inicio-configuracion" \/>/)
  })
  it('el Inicio lleva también «Instalar la app», y no se duplica si el catálogo lo trae', () => {
    // Carlos, 20 oct 2026: «Tu Inicio», «Cómo moverte» e «Instalar la app».
    expect(videoPorId('inicio-instalar').donde).toContainEqual({ pantalla: '/dashboard', tipo: 'E2', junto_a: 'el Inicio' })
    const conEl = conPuentes({ videos: [{ id: 'inicio-instalar', donde: [{ pantalla: '/dashboard', tipo: 'E2', junto_a: 'otro' }] }] })
    expect(conEl.videos[0].donde).toHaveLength(1)
    // A quien ya la tiene instalada no se le ofrece (la regla de `FilaInstalar`).
    const prov = lee('components/tutoriales/ProfeProvider.jsx')
    expect(prov).toContain('instalada ? visibles.filter((v) => v.id !== VIDEO_INSTALAR) : visibles')
    expect(prov).toContain('setInstalada(isStandalone())')
  })
  it('en la ayuda del Inicio se pueden ocultar todos los tutoriales, con confirmación y la ruta para volver', () => {
    const prov = lee('components/tutoriales/ProfeProvider.jsx')
    expect(prov).toContain("onOcultarTodo={pathname === '/dashboard' ? ocultarTodo : undefined}")
    const i = prov.indexOf('const ocultarTodo = useCallback(')
    expect(prov.slice(i, i + 200)).toMatch(/cambiarPreferencia\('prefBoton', false\)\s*cambiarPreferencia\('prefAvisos', false\)/)
    const hoja = lee('components/tutoriales/HojaAyudaProfe.jsx')
    // Primero se pregunta; ocultar solo pasa en el «Sí».
    expect(hoja).toContain("<button type=\"button\" onClick={() => setPaso('confirmar')}")
    expect(hoja).toContain("onClick={() => { onOcultarTodo?.(); setPaso('listo') }}>Sí, ocultarlos</button>")
    expect(hoja).toContain("onClick={() => setPaso('lista')}>Cancelar</button>")
    // La ruta que se le dice existe de verdad: la fila de Más, la de la barra
    // lateral y el interruptor que los vuelve a prender.
    expect(hoja).toContain("escritorio ? 'Más herramientas › Tutoriales' : 'Más › Tutoriales'")
    expect(hoja).toContain('prendiendo «Botones de video»')
    expect(lee('components/pantallas/PantallaMas.jsx')).toContain('nombre="Tutoriales"')
    expect(lee('components/armazon/BarraLateral.jsx')).toContain("{ href: '/tutoriales',           nombre: 'Tutoriales' }")
    expect(lee('components/tutoriales/AyudaProfe.jsx')).toContain('label="Botones de video"')
  })
  it('el puente solo cuenta para quien no tiene video propio en esa pantalla', () => {
    const cat = conPuentes({ videos: [
      { id: 'inicio-novedad-profe', estado: 'listo', para: ['dueno', 'cobrador'], donde: [] },
      { id: 'inicio-del-dueno', estado: 'listo', para: ['dueno'], donde: [{ pantalla: '/dashboard', tipo: 'D1' }] },
    ] })
    const general = (rol) => ayudaDeLaPantalla('/dashboard', null, videosPara({ rol }, cat.videos), { rol }).general?.id
    expect(general('owner')).toBe('inicio-del-dueno')
    expect(general('cobrador')).toBe('inicio-novedad-profe')
    const sinVideo = conPuentes({ videos: [{ id: 'inicio-novedad-profe', estado: 'listo', para: ['dueno', 'cobrador'], donde: [] }] })
    expect(ayudaDeLaPantalla('/dashboard', null, sinVideo.videos, { rol: 'owner' }).general?.id).toBe('inicio-novedad-profe')
  })
  it('la novedad en el computador no manda a buscar la pastilla «arriba»', () => {
    // Sentado no hay cabecera: la pastilla es «Videos de ayuda», en la barra lateral.
    expect(NOVEDAD_PROFE.porqueEscritorio).not.toMatch(/arriba/i)
    expect(NOVEDAD_PROFE.porqueEscritorio).toContain('«Videos de ayuda»')
    expect(lee('components/tutoriales/PiezasProfe.jsx')).toContain("{uno ? 'Video de ayuda' : 'Videos de ayuda'}")
    expect(lee('components/tutoriales/NovedadProfe.jsx')).toContain('{escritorio ? NOVEDAD_PROFE.porqueEscritorio : NOVEDAD_PROFE.porque}')
  })
  it('instalar la app: en Más, en Configuración y en una página sin sesión', () => {
    expect(lee('components/pantallas/PantallaMas.jsx').match(/<FilaInstalar \/>/g)).toHaveLength(2)
    expect(lee('app/(dashboard)/configuracion/page.jsx')).toContain('<EnlaceProfe id="inicio-instalar"')
    expect(fs.existsSync('app/instalar/page.jsx')).toBe(true)
    expect(fs.readFileSync('middleware.js', 'utf8')).not.toMatch(/'\/instalar/)
    expect(tareaDe({ ...videoPorId('inicio-instalar'), tarea: 'Instalar en este dispositivo' })).toMatchObject({ evento: 'cf:abrir-instalacion' })
    // DETALLES-CONFIGURACION #1: las tildes de la hoja de pasos.
    const pasos = fs.readFileSync('components/layout/InstallButton.jsx', 'utf8')
    for (const mal of ['Busca la opcion', "'Listo! ", 'aparecera', 'Estan ', 'tocalo', 'se abrira', 'abrelo', 'Ahi veras', 'esta arriba al lado']) expect(pasos, mal).not.toContain(mal)
  })
  it('/tutoriales y Configuración son la misma pantalla, con índice e interruptores', () => {
    expect(lee('app/(dashboard)/tutoriales/page.jsx')).toContain('return <AyudaProfe esOwner={esOwner} />')
    const ayuda = lee('components/tutoriales/AyudaProfe.jsx')
    expect(ayuda).toContain('Sin ver · {total - vistos}')
    expect(ayuda).toContain('<ListaVideosProfe soloSinVer={soloSinVer} />')
    expect(ayuda).toContain('label="Botones de video"')
  })
  it('la pastilla avisa: punto con videos por ver, y la primera vez se mueve, sin sonido', () => {
    const p = lee('components/tutoriales/PiezasProfe.jsx')
    expect(p).toContain('{porVer > 0 && <Punto')
    expect(p).toContain("{porVer} {porVer === 1 ? 'video por ver' : 'videos por ver'}")
    expect(p).toContain('@media (prefers-reduced-motion: reduce)')
    expect(p).not.toMatch(/new Audio|\.play\(\)/)
  })
})
