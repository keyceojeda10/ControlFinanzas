// «Optimizar» sin perder el orden de nadie (19 nov 2026, INVERSIONESJYM: 20 de
// 459 clientes con ubicación, el cobrador optimizó y la ruta del dueño quedó
// revuelta sin forma de volver). Ver lib/rutas/orden-de-ruta.js.
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  ubicacionSuficiente, textoSinUbicacion, ordenConLoNuevoAlFinal, MINIMO_CON_UBICACION,
} from '../rutas/orden-de-ruta'

const raiz = path.resolve(__dirname, '../..')
const leer = (f) => fs.readFileSync(path.join(raiz, f), 'utf8')
const ubicado = (id) => ({ id, latitud: 4.6, longitud: -74.1 })
const sinGps = (id) => ({ id, latitud: null, longitud: null })

describe('ubicacionSuficiente', () => {
  it('el caso real: 20 de 459 no alcanza', () => {
    const clientes = [...Array.from({ length: 20 }, (_, i) => ubicado(`u${i}`)), ...Array.from({ length: 439 }, (_, i) => sinGps(`s${i}`))]
    const u = ubicacionSuficiente(clientes)
    expect(u).toMatchObject({ con: 20, total: 459, alcanza: false })
    expect(u.faltan).toBe(Math.ceil(459 * MINIMO_CON_UBICACION) - 20)
    expect(textoSinUbicacion(u)).toMatch(/^Solo 20 de tus 459 clientes tienen ubicación/)
  })
  it('8 de cada 10 alcanza; uno menos, no', () => {
    const diez = (n) => [...Array.from({ length: n }, (_, i) => ubicado(`u${i}`)), ...Array.from({ length: 10 - n }, (_, i) => sinGps(`s${i}`))]
    expect(ubicacionSuficiente(diez(8)).alcanza).toBe(true)
    expect(ubicacionSuficiente(diez(7)).alcanza).toBe(false)
    expect(ubicacionSuficiente(diez(7)).faltan).toBe(1)
  })
  it('con menos de dos clientes no hay nada que ordenar', () => {
    expect(ubicacionSuficiente([ubicado('a')]).alcanza).toBe(false)
    expect(ubicacionSuficiente([]).alcanza).toBe(false)
  })
})

describe('ordenConLoNuevoAlFinal', () => {
  it('vuelve al orden guardado', () => {
    expect(ordenConLoNuevoAlFinal(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual(['a', 'b', 'c'])
  })
  it('quien llegó después va al final, en el orden de hoy; quien salió se salta', () => {
    expect(ordenConLoNuevoAlFinal(['a', 'b', 'x', 'c'], ['n2', 'c', 'b', 'n1', 'a'])).toEqual(['a', 'b', 'c', 'n2', 'n1'])
  })
  it('devuelve la ruta entera y sin repetir, aunque lo guardado venga raro', () => {
    expect(ordenConLoNuevoAlFinal(['a', 'a', 'b'], ['b', 'a', 'c'])).toEqual(['a', 'b', 'c'])
    expect(ordenConLoNuevoAlFinal(null, ['b', 'a'])).toEqual(['b', 'a'])
  })
})

describe('quién puede cambiar el orden', () => {
  const optimizar = leer('app/api/rutas/[id]/optimizar/route.js')
  const post = optimizar.slice(optimizar.indexOf('export async function POST'), optimizar.indexOf('export async function PATCH'))
  const patch = optimizar.slice(optimizar.indexOf('export async function PATCH'))

  it('el cobrador PIDE: su rama crea la solicitud y sale antes de optimizar', () => {
    const rama = post.slice(post.indexOf("if (rol === 'cobrador') {\n    const clientes"), post.indexOf('// ── EL DUEÑO OPTIMIZA ──'))
    expect(rama).toMatch(/clase: 'solicitud', estado: 'pendiente'/)
    expect(rama).toMatch(/status: 202/)
    expect(rama).not.toMatch(/optimizarGuardandoElAnterior\(/)
    expect(rama).not.toMatch(/ordenRuta: /)
  })
  it('el dueño optimiza guardando antes el orden, y nadie más escribe ordenRuta aquí', () => {
    expect(post).toMatch(/optimizarGuardandoElAnterior\(prisma, \{ organizationId, rutaId: id, userId \}\)/)
    expect(optimizar).not.toMatch(/prisma\.cliente\.update/)
  })
  it('solo el dueño aprueba o rechaza, y aprobar usa la misma optimización', () => {
    expect(patch).toMatch(/session\.user\.rol !== 'owner'/)
    expect(patch).toMatch(/optimizarGuardandoElAnterior\(/)
    expect(patch).toMatch(/estado !== 'pendiente'/)
  })
  it('volver al orden anterior es solo del dueño', () => {
    expect(leer('app/api/rutas/[id]/orden-anterior/route.js')).toMatch(/session\.user\.rol !== 'owner'/)
  })
  it('la optimización guarda el anterior en la misma transacción que escribe el orden', () => {
    const lib = leer('lib/rutas/orden-de-ruta.js')
    const f = lib.slice(lib.indexOf('export async function optimizarGuardandoElAnterior'), lib.indexOf('export async function volverAlOrdenAnterior'))
    const tx = f.slice(f.indexOf('$transaction'))
    expect(tx.indexOf("clase: 'anterior', estado: 'vigente', orden: antes")).toBeGreaterThan(0)
    expect(tx.indexOf("clase: 'anterior', estado: 'vigente', orden: antes")).toBeLessThan(tx.indexOf('escribirOrden(tx'))
    expect(f.indexOf('if (!ubicacion.alcanza)')).toBeLessThan(f.indexOf('$transaction'))
  })
})

describe('queda rastro', () => {
  it('reordenar a mano deja fila en el historial, una cada 30 minutos', () => {
    const src = leer('app/api/rutas/[id]/reordenar/route.js')
    expect(src).toMatch(/accion: 'reordenar_ruta'/)
    expect(src).toMatch(/30 \* 60000/)
  })
  it('el pedido llega a «Esperan tu decisión» y se resuelve con el PATCH', () => {
    expect(leer('app/api/notificaciones/pendientes/route.js')).toMatch(/clase: 'orden', id: o\.id, rutaId: o\.rutaId/)
    expect(leer('components/armazon/Pendientes.jsx')).toMatch(/fetch\(`\/api\/rutas\/\$\{p\.rutaId\}\/optimizar`, \{\s*method: 'PATCH'/)
  })
  it('la pantalla de la ruta lee lo mismo que el servidor', () => {
    const page = leer('app/(dashboard)/rutas/[id]/page.jsx')
    expect(page).toMatch(/const ubicacionRuta = ubicacionSuficiente\(ruta\?\.clientes \?\? \[\]\)/)
    expect(page).toMatch(/\{esOwner \? 'Optimizar' : 'Pedir al dueño'\}/)
    // Declarada antes de usarse: un const leído antes de existir tumba la pantalla.
    expect(page.indexOf('const ubicacionRuta =')).toBeLessThan(page.indexOf('!ubicacionRuta.alcanza'))
    expect(page.indexOf('const [decidiendoOrden')).toBeLessThan(page.indexOf("decidiendoOrden === 'volver',"))
  })
})
