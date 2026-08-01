import { describe, it, expect } from 'vitest'
import { seccionesConfig, idsVisibles, modoDeTrabajo } from '@/lib/adaptadores/configuracion'

// Las ocho secciones y su ORDEN salen del diseño «01 · Configuración», no de mi
// criterio: la primera vez me inventé una sección («Rutas»), me faltó otra
// («Portal del cliente») y el orden era otro. Estas pruebas fijan la lista real.

describe('las ocho secciones son las del diseño', () => {
  it('en el orden del diseño, no alfabético ni por módulo', () => {
    expect(idsVisibles({ rol: 'owner', cobradores: 9 })).toEqual([
      'negocio', 'comoPrestas', 'plan', 'equipo', 'portal', 'whatsapp', 'seguridad', 'datos',
    ])
  })

  it('«Portal del cliente» existe: se me había olvidado', () => {
    expect(idsVisibles({ rol: 'owner' })).toContain('portal')
  })

  it('«Rutas» NO es una sección de configuración: me la inventé', () => {
    expect(idsVisibles({ rol: 'owner', cobradores: 9 })).not.toContain('rutas')
  })

  it('ninguna se llama como el módulo técnico', () => {
    const nombres = seccionesConfig({ rol: 'owner', cobradores: 9 }).map((s) => s.nombre)
    for (const tecnico of ['Organización', 'Suscripción', 'Referidos', 'Apariencia', 'Notificaciones']) {
      expect(nombres).not.toContain(tecnico)
    }
  })
})

describe('la app se comporta como una sola persona por defecto', () => {
  it('sin cobradores, Equipo no aparece', () => {
    expect(idsVisibles({ rol: 'owner', cobradores: 0 })).not.toContain('equipo')
  })

  it('con cobradores, Equipo aparece CON su cifra', () => {
    const equipo = seccionesConfig({ rol: 'owner', cobradores: 9 }).find((s) => s.id === 'equipo')
    expect(equipo.cifra).toBe(9)
  })

  it('el cobrador solo ve lo suyo', () => {
    expect(idsVisibles({ rol: 'cobrador' })).toEqual(['seguridad', 'datos'])
  })
})

describe('modoDeTrabajo — explica por qué el menú tiene lo que tiene', () => {
  it('sin cobradores dice qué pasaría si los hubiera', () => {
    const m = modoDeTrabajo(0)
    expect(m.titulo).toBe('Cobras tú solo')
    expect(m.nota).toContain('primer cobrador')
  })

  it('con equipo dice cuántos, y por qué se ven Rutas y Equipo', () => {
    expect(modoDeTrabajo(9).titulo).toBe('Con equipo · 9 cobradores')
    expect(modoDeTrabajo(1).titulo).toBe('Con equipo · 1 cobrador')
    expect(modoDeTrabajo(9).nota).toContain('se ocultan')
  })
})
