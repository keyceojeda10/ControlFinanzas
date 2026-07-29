import { describe, it, expect } from 'vitest'
import { seccionesConfig, idsVisibles } from '@/lib/adaptadores/configuracion'

// «Ocho secciones nombradas COMO EL DUEÑO PIENSA, en vez de por módulo
// técnico», y las que no aplican desaparecen. Hoy las pestañas se llaman
// Organización, Suscripción, Referidos, Apariencia: son nombres de tablas, no
// palabras que un prestamista use para hablar de su negocio.

describe('los nombres son los del dueño, no los del módulo', () => {
  it('no queda ninguna pestaña con nombre técnico', () => {
    const nombres = seccionesConfig({ rol: 'owner' }).map((s) => s.nombre)
    for (const tecnico of ['Organización', 'Suscripción', 'Referidos', 'Apariencia', 'Notificaciones']) {
      expect(nombres).not.toContain(tecnico)
    }
  })

  it('«Plan y pagos», no «Suscripción»: suscripción es lo que la app le cobra a él', () => {
    expect(seccionesConfig({ rol: 'owner' }).find((s) => s.id === 'plan').nombre).toBe('Plan y pagos')
  })

  it('cada sección dice para qué sirve, no solo cómo se llama', () => {
    for (const s of seccionesConfig({ rol: 'owner', hayEquipo: true, hayRutas: true })) {
      expect(s.nota).toBeTruthy()
    }
  })
})

describe('lo que no aplica desaparece', () => {
  it('19 de cada 20 cuentas cobran solas: ni Rutas ni Equipo', () => {
    const ids = idsVisibles({ rol: 'owner', hayEquipo: false, hayRutas: false })
    expect(ids).not.toContain('rutas')
    expect(ids).not.toContain('equipo')
  })

  it('con equipo y rutas, las dos aparecen', () => {
    const ids = idsVisibles({ rol: 'owner', hayEquipo: true, hayRutas: true })
    expect(ids).toContain('rutas')
    expect(ids).toContain('equipo')
  })

  it('una cuenta con rutas pero sin equipo solo ve Rutas', () => {
    const ids = idsVisibles({ rol: 'owner', hayEquipo: false, hayRutas: true })
    expect(ids).toContain('rutas')
    expect(ids).not.toContain('equipo')
  })
})

describe('el cobrador', () => {
  it('no ve nada del negocio: ni el plan, ni cómo se presta, ni los avisos', () => {
    const ids = idsVisibles({ rol: 'cobrador' })
    for (const suyo of ['plan', 'comoPrestas', 'whatsapp', 'negocio', 'equipo', 'rutas']) {
      expect(ids).not.toContain(suyo)
    }
  })

  it('pero sí lo suyo: sus datos y su seguridad', () => {
    expect(idsVisibles({ rol: 'cobrador' })).toEqual(['datos', 'seguridad'])
  })
})

describe('el orden', () => {
  it('primero lo de todos los días, al final lo que se toca una vez', () => {
    const ids = idsVisibles({ rol: 'owner', hayEquipo: true, hayRutas: true })
    expect(ids[0]).toBe('comoPrestas')
    expect(ids[ids.length - 1]).toBe('seguridad')
    // El plan va antes que los datos personales: se consulta más.
    expect(ids.indexOf('plan')).toBeLessThan(ids.indexOf('datos'))
  })

  it('son ocho cuando la cuenta las tiene todas', () => {
    expect(idsVisibles({ rol: 'owner', hayEquipo: true, hayRutas: true })).toHaveLength(8)
  })
})
