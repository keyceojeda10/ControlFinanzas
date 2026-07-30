import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { valoresIndice, filasIndice } from '../adaptadores/configuracion.js'

const ruta = readFileSync(join(process.cwd(), 'app/(dashboard)/configuracion/page.jsx'), 'utf8')
const cuerpo = ruta.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const ORG = {
  nombre: 'Prestamos Castro', country: 'co', plan: 'starter',
  frecuenciaDefault: 'diario', tasaDefault: 20,
}
const PAIS = { nombre: 'Colombia', moneda: 'COP' }

describe('el índice contesta sin entrar', () => {
  it('tu negocio dice país y moneda', () => {
    // Es lo que define cómo se lee TODA cifra de la app.
    expect(valoresIndice({ org: ORG, pais: PAIS }).negocio).toBe('Colombia · COP')
  })

  it('cómo prestas dice frecuencia y tasa', () => {
    // «¿En qué tasa quedé?» es la pregunta que más se repite.
    expect(valoresIndice({ org: ORG, pais: PAIS }).comoPrestas).toBe('Diario · 20%')
  })

  it('la tasa no arrastra decimales inútiles, pero conserva los reales', () => {
    expect(valoresIndice({ org: { ...ORG, tasaDefault: 20.0 } }).comoPrestas).toContain('20%')
    expect(valoresIndice({ org: { ...ORG, tasaDefault: 20.5 } }).comoPrestas).toContain('20,5%')
  })

  it('sin valores por defecto dice «sin definir», que es el estado real', () => {
    // No es inventarse un valor: es el único dato accionable de la lista. Sin
    // él la fila parece configurada y el dueño lo descubre al crear el préstamo.
    const v = valoresIndice({ org: { ...ORG, frecuenciaDefault: null, tasaDefault: null } })
    expect(v.comoPrestas).toBe('sin definir')
  })

  it('mientras el API no ha contestado, NO se inventa nada', () => {
    // Enseñar «Diario · 20%» por defecto cuando el dueño configuró otra cosa es
    // peor que no enseñar nada: se toman decisiones mirando esa línea.
    const v = valoresIndice({ org: null, pais: null })
    expect(v.comoPrestas).toBeNull()
    expect(v.negocio).toBeUndefined()
  })

  it('el plan dice cuándo renueva, no cómo se llama', () => {
    // El nombre del plan ya está en la cabecera del negocio.
    expect(valoresIndice({ diasParaRenovar: 13 }).plan).toBe('renueva en 13 días')
    expect(valoresIndice({ diasParaRenovar: 1 }).plan).toBe('renueva en 1 día')
    expect(valoresIndice({ diasParaRenovar: 0 }).plan).toBe('renueva hoy')
    expect(valoresIndice({ diasParaRenovar: -3 }).plan).toBe('vencido')
  })

  it('sin fecha de renovación la fila va sin valor', () => {
    expect(valoresIndice({ org: ORG }).plan).toBeUndefined()
  })

  it('equipo dice cuántos son', () => {
    // Un «Equipo» pelado no dice si hay uno o nueve.
    expect(valoresIndice({ cobradores: 1 }).equipo).toBe('1 cobrador')
    expect(valoresIndice({ cobradores: 4 }).equipo).toBe('4 cobradores')
    expect(valoresIndice({ cobradores: 0 }).equipo).toBeUndefined()
  })

  it('el consumo del plan sale del API, nunca escrito a mano', () => {
    // En el intento anterior puse «hasta 20 clientes» cuando el plan Inicial son
    // 100: vendía el producto cinco veces peor de lo que es.
    const v = valoresIndice({ uso: { clientes: { usado: 9, limite: 100 } } })
    expect(v.clientesNota).toBe('9 de 100 clientes')
    expect(valoresIndice({ uso: null }).clientesNota).toBeUndefined()
  })
})

describe('las filas del índice', () => {
  it('son las mismas secciones que ve el escritorio', () => {
    const ids = filasIndice({ rol: 'owner', cobradores: 2 }, {}).map((f) => f.id)
    expect(ids).toContain('negocio')
    expect(ids).toContain('comoPrestas')
    expect(ids).toContain('equipo')
  })

  it('un cobrador no ve lo que no puede tocar', () => {
    const ids = filasIndice({ rol: 'cobrador' }, {}).map((f) => f.id)
    expect(ids).toEqual(['seguridad', 'datos'])
  })

  it('una alerta tapa al valor', () => {
    // Un problema real manda sobre un dato de estado.
    const f = filasIndice({ rol: 'owner' }, { seguridadAlerta: 'Sin PIN', seguridad: 'ok' })
      .find((x) => x.id === 'seguridad')
    expect(f.alerta).toBe('Sin PIN')
  })
})

describe('la ruta: el índice lleva a pantallas, no a anclas', () => {
  it('el móvil monta el índice de verdad', () => {
    // Estaba construido y sin importar por nadie: la ruta seguía pintando la
    // página vieja de 1.588 líneas, que en un teléfono medía 15.510 px.
    expect(ruta).toMatch(/import \{ IndiceConfiguracion \}/)
    expect(cuerpo).toMatch(/<IndiceConfiguracion/)
  })

  it('la sección abierta va en la URL, no en un estado', () => {
    // Así el botón de atrás del teléfono sale de la sección en vez de sacarte de
    // configuración, y un enlace a «Cómo prestas» abre «Cómo prestas».
    expect(cuerpo).toMatch(/searchParams\.get\('s'\)/)
    expect(cuerpo).toMatch(/router\.push\(`\/configuracion\?s=\$\{f\.id\}`\)/)
  })

  it('el ancho se lee en un efecto, no al pintar', () => {
    // Leer matchMedia en el primer render hace que el servidor diga una cosa y
    // el cliente otra, y React tira el árbol entero.
    expect(cuerpo).toMatch(/useEffect\(\(\) => \{\s*const mq = window\.matchMedia\('\(min-width: 1024px\)'\)/)
  })

  it('el escritorio conserva las dos columnas', () => {
    // «Configuración es tarea de PC»: menú a la izquierda y todo apilado a la
    // derecha. Son dos diseños distintos, no uno responsive.
    expect(cuerpo).toMatch(/<Configuracion/)
  })

  it('el tema se cambia por el proveedor, no escribiendo localStorage a mano', () => {
    // El proveedor es quien pone el atributo en <html>; por fuera el tema cambia
    // en disco y la pantalla se queda igual hasta recargar.
    expect(cuerpo).toMatch(/setThemeGlobal\(t\)/)
  })
})
