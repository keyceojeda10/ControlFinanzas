/* LOS VIDEOS DEL PROFE: el catálogo manda (19 oct 2026). */
import { describe, it, expect } from 'vitest'
import {
  CATALOGO, SERIES, videoPorId, videosPara, videoDeLaPantalla, desdeDe, capituloEn, duracionCorta, reloj,
  partesDe, tareaDe, TAREAS, profeHabilitado, PROFE_PARA_TODOS,
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
    const corte = api.indexOf('if (!profeHabilitado(u.organizationId)) {')
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

/* Cada entrada E2 del catálogo tiene su botón en el código, con el MISMO id y el
   mismo `junto` (de ahí sale el capítulo en que abre). Anclado en el JSX, no en
   comentarios: `id="…"` y `junto="…"` dentro de un `<BotonProfe`. */
describe('los botones E2 están puestos', () => {
  const fs = require('fs')
  const path = require('path')
  const fuentes = []
  const recorrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) { if (e.name !== 'node_modules' && !e.name.startsWith('.')) recorrer(p) }
      // Sin comentarios: el ejemplo de uso de BotonProfe.jsx no es un botón.
      else if (/\.jsx?$/.test(e.name)) fuentes.push(fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'))
    }
  }
  recorrer(path.join(process.cwd(), 'app'))
  recorrer(path.join(process.cwd(), 'components'))
  const botones = fuentes.join('\n').match(/<BotonProfe\b[^>]*>/g) ?? []
  const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const entradas = todos.flatMap((v) => (v.donde ?? []).filter((d) => d.tipo === 'E2').map((d) => ({ id: v.id, junto: d.junto_a })))
  it.each(entradas)('$id · $junto', ({ id, junto }) => {
    const re = new RegExp(`id="${escapar(id)}"[^>]*junto="${escapar(junto)}"|junto="${escapar(junto)}"[^>]*id="${escapar(id)}"`)
    expect(botones.some((b) => re.test(b))).toBe(true)
  })
})
