import { describe, it, expect } from 'vitest'
import { seccionesConfig, idsVisibles, modoDeTrabajo } from '@/lib/adaptadores/configuracion'

// Las ocho secciones y su ORDEN salen del diseño «01 · Configuración», no de mi
// criterio: la primera vez me inventé una sección («Rutas»), me faltó otra
// («Portal del cliente») y el orden era otro. Estas pruebas fijan la lista real.

describe('las ocho secciones son las del diseño', () => {
  it('en el orden del diseño, no alfabético ni por módulo', () => {
    expect(idsVisibles({ rol: 'owner', cobradores: 9 })).toEqual([
      'negocio', 'comoPrestas', 'plan', 'equipo', 'portal', 'avisos', 'whatsapp', 'seguridad', 'datos',
    ])
  })

  it('«Portal del cliente» existe: se me había olvidado', () => {
    expect(idsVisibles({ rol: 'owner' })).toContain('portal')
  })

  it('«Rutas» NO es una sección de configuración: me la inventé', () => {
    expect(idsVisibles({ rol: 'owner', cobradores: 9 })).not.toContain('rutas')
  })

  it('la de notificaciones se llama «Notificaciones», como en cualquier teléfono', () => {
    const nombres = seccionesConfig({ rol: 'owner', cobradores: 9 }).map((s) => s.nombre)
    expect(nombres).toContain('Notificaciones')
    expect(nombres).not.toContain('Qué te avisamos')
  })

  it('ninguna se llama como el módulo técnico', () => {
    const nombres = seccionesConfig({ rol: 'owner', cobradores: 9 }).map((s) => s.nombre)
    // «Notificaciones» SALIÓ de esta lista el 20 sep 2026. Estaba prohibida como
    // «nombre técnico» y la sección se llamó «Qué te avisamos»; el dueño: «no sé
    // por qué manejamos esa terminología tan extraña… es mucho más enredado».
    // No es un nombre técnico: es la palabra que la gente busca en unos ajustes.
    for (const tecnico of ['Organización', 'Suscripción', 'Referidos', 'Apariencia']) {
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
    // «Notificaciones» es de todos: el cobrador también recibe avisos (19 sep 2026).
    expect(idsVisibles({ rol: 'cobrador' })).toEqual(['avisos', 'seguridad', 'datos'])
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
