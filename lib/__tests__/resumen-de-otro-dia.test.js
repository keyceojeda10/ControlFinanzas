/* «Me llega la notificación del resumen del 16 de octubre. Si yo lo abro, me va
 * a salir el resumen del 17» (el dueño, 17 oct 2026). La notificación abría
 * `/dashboard?resumen=1` sin fecha, y la pantalla se arma con el Inicio de HOY. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { destinoDeNotificacion } from '@/lib/notificacion-destino'
import { queResumenAbrir, resumenGuardado, fechaLarga } from '@/lib/resumen-del-dia'

const notif = (tipo, datos) => ({ tipo, datos: JSON.stringify(datos) })

describe('a dónde lleva cada notificación', () => {
  it('el resumen lleva a SU día, aunque se haya guardado con el enlace viejo', () => {
    expect(destinoDeNotificacion(notif('resumen_dia', { href: '/dashboard?resumen=1', fecha: '2026-10-16', cobrado: 5 }))).toBe('/dashboard?resumen=2026-10-16')
    expect(destinoDeNotificacion(notif('resumen_dia', { href: '/dashboard?resumen=2026-10-14', fecha: '2026-10-14' }))).toBe('/dashboard?resumen=2026-10-14')
  })
  it('las demás siguen igual: su href, o la ficha del cliente', () => {
    expect(destinoDeNotificacion(notif('mora', { href: '/prestamos/p1' }))).toBe('/prestamos/p1')
    expect(destinoDeNotificacion(notif('pago', { clienteId: 'c1' }))).toBe('/clientes/c1')
    expect(destinoDeNotificacion(notif('otro', {}))).toBeNull()
    expect(destinoDeNotificacion({ tipo: 'x', datos: 'no es json' })).toBeNull()
  })
  it('las dos campanas usan la misma pieza', () => {
    for (const f of ['components/layout/NotificationsCenter.jsx', 'components/armazon/PilaAvisos.jsx']) {
      expect(readFileSync(f, 'utf8'), f).toMatch(/const destino = destinoDeNotificacion\(n\)/)
    }
  })
  it('el cron manda la fecha en el enlace y guarda las cifras del día', () => {
    const c = readFileSync('app/api/cron/resumen-diario/route.js', 'utf8')
    expect(c).toMatch(/href: destinoDelResumen\(fecha\)/)
    expect(c).toMatch(/datos: \{ fecha, cobrado, cobros, prestado, prestamos: nPrestamos, gastos: gastado, atrasados: prestamosAtrasados\.size \}/)
  })
})

describe('qué resumen se abre', () => {
  it('«1» o la fecha de hoy: el de hoy, completo', () => {
    expect(queResumenAbrir('1', '2026-10-17')).toEqual({ tipo: 'hoy' })
    expect(queResumenAbrir('2026-10-17', '2026-10-17')).toEqual({ tipo: 'hoy' })
  })
  it('otra fecha: ese día, no el de hoy', () => {
    expect(queResumenAbrir('2026-10-16', '2026-10-17')).toEqual({ tipo: 'otro', fecha: '2026-10-16' })
  })
  it('nada o basura: no se abre nada', () => {
    expect(queResumenAbrir(null, '2026-10-17')).toBeNull()
    expect(queResumenAbrir('<script>', '2026-10-17')).toBeNull()
  })
  it('las cifras de ese día salen de su notificación', () => {
    const lista = [
      notif('mora', { fecha: '2026-10-16' }),
      notif('resumen_dia', { fecha: '2026-10-16', cobrado: 850000, cobros: 12 }),
      notif('resumen_dia', { fecha: '2026-10-15', cobrado: 1 }),
    ]
    expect(resumenGuardado(lista, '2026-10-16')).toEqual({ fecha: '2026-10-16', cobrado: 850000, cobros: 12 })
    expect(resumenGuardado(lista, '2026-10-01')).toBeNull()
  })
  it('la fecha dicha como se dice', () => {
    expect(fechaLarga('2026-10-16')).toBe('viernes 16 de octubre')
  })
})
