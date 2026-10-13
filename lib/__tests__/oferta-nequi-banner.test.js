// El 35 % por Nequi dentro de la app (12 oct 2026): una VENTANA, nada fijo.
// «No quiero que se vea como spam»: sale una vez; con «Ahora no» vuelve a la
// semana, o antes al entrar en los 3 últimos días del plan. Por negocio.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { debeAbrirseVentanaNequi, precioConOferta, DIAS_ENTRE_VENTANAS } from '@/lib/oferta-nequi-aviso'

const DIA = 86400000
const ahora = new Date('2026-10-12T15:00:00Z').getTime()
const vence = (dias) => new Date(ahora + dias * DIA).toISOString()
const hace = (dias) => new Date(ahora - dias * DIA).toISOString()
const base = { ofertaNequi: 35, tipo: 'unico', fechaVencimiento: vence(20), diasRestantes: 20, ofertaVistaAt: null }

describe('la ventana: cuándo sale', () => {
  it('la primera vez: sí', () => expect(debeAbrirseVentanaNequi(base, { rol: 'owner', ahora })).toBe(true))
  it('la vio hace 2 días: no', () => expect(debeAbrirseVentanaNequi({ ...base, ofertaVistaAt: hace(2) }, { rol: 'owner', ahora })).toBe(false))
  it('la vio hace una semana: vuelve', () => expect(debeAbrirseVentanaNequi({ ...base, ofertaVistaAt: hace(DIAS_ENTRE_VENTANAS) }, { rol: 'owner', ahora })).toBe(true))
  it('entra en los 3 últimos días y la última vez fue antes: vuelve aunque no haya pasado la semana', () => {
    expect(debeAbrirseVentanaNequi({ ...base, fechaVencimiento: vence(2), diasRestantes: 2, ofertaVistaAt: hace(3) }, { rol: 'owner', ahora })).toBe(true)
  })
  it('ya la vio dentro de esos 3 días: no se repite cada día', () => {
    expect(debeAbrirseVentanaNequi({ ...base, fechaVencimiento: vence(2), diasRestantes: 2, ofertaVistaAt: hace(0.5) }, { rol: 'owner', ahora })).toBe(false)
  })
  it('vencido, cobrador, sin oferta o con cobro automático: no', () => {
    expect(debeAbrirseVentanaNequi({ ...base, diasRestantes: -1 }, { rol: 'owner', ahora })).toBe(false)
    expect(debeAbrirseVentanaNequi(base, { rol: 'cobrador', ahora })).toBe(false)
    expect(debeAbrirseVentanaNequi({ ...base, ofertaNequi: null }, { rol: 'owner', ahora })).toBe(false)
    expect(debeAbrirseVentanaNequi({ ...base, cobroAutomatico: { activo: true } }, { rol: 'owner', ahora })).toBe(false)
    expect(debeAbrirseVentanaNequi({ ...base, tipo: 'recurrente', mpStatus: 'authorized' }, { rol: 'owner', ahora })).toBe(false)
  })
  it('el precio con oferta, con el redondeo del servidor', () => expect(precioConOferta(39000, 35)).toBe(25400))
})

describe('nada fijo en la app', () => {
  it('ni el aviso verde ni la franja de 3 días; solo la ventana', () => {
    const layout = readFileSync('app/(dashboard)/layout.jsx', 'utf8')
    expect(layout).not.toMatch(/OfertaNequiBanner/)
    expect(layout).toMatch(/<AvisoOfertaNequi \/>/)
    expect(readFileSync('components/layout/SuscripcionBanner.jsx', 'utf8')).not.toMatch(/const porVencer =/)
  })
  it('la vista se apunta en el servidor (por negocio), no en el teléfono', () => {
    const v = readFileSync('components/cf/AvisoOfertaNequi.jsx', 'utf8')
    expect(v).toMatch(/fetch\('\/api\/seguimiento\/oferta-vista', \{ method: 'POST', keepalive: true \}\)/)
    expect(v).not.toMatch(/localStorage/)
  })
  it('«Ahora no» no la vuelve a abrir en la misma sesión (el estado en caché aún no trae la vista)', () => {
    const v = readFileSync('components/cf/AvisoOfertaNequi.jsx', 'utf8')
    expect(v).toMatch(/if \(rol !== 'owner' \|\| d \|\| yaSalio\.current\) return/)
    expect(v).toMatch(/yaSalio\.current = true\n\s+apuntarVista\(\)/)
  })
  it('el botón abre la hoja para guardar el Nequi', () => {
    expect(readFileSync('components/cf/AvisoOfertaNequi.jsx', 'utf8')).toMatch(/window\.location\.assign\('\/configuracion\/plan\?suscribir=1'\)/)
  })
})
