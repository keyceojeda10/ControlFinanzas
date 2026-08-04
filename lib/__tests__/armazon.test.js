// La regla de supresión del armazón (docs/design_handoff/02-ARMAZON.md, sección E).
//
// Se prueba como tabla normativa: si mañana alguien agrega una pantalla y le
// pone armazón completo "porque sí", esto lo detecta. La regla es el corazón
// del rediseño y lo que más fácil se desincroniza cuando la tocan varias manos.

import { describe, it, expect } from 'vitest'
import { resolverArmazon, destinoActivo, DESTINOS, CABECERA } from '@/lib/armazon'
import fs from 'node:fs'
import path from 'node:path'

describe('la tabla normativa', () => {
  it('las 6 pantallas de navegación llevan cabecera de navegación', () => {
    for (const p of ['/dashboard', '/cobros-hoy', '/clientes', '/prestamos', '/rutas', '/caja']) {
      expect(resolverArmazon(p).cabecera, p).toBe(CABECERA.NAVEGACION)
    }
  })

  it('cinco de las seis llevan pastilla; «cobrar hoy» NO', () => {
    // T02-02 dibuja «Empezar ruta · 11» y el mapa EN EL SITIO de la pastilla, y
    // no dibuja la pastilla: comprobado en el archivo de la lámina, no tiene el
    // FAB (T02-01 y T02-05 sí lo tienen). Es la regla §4 de «lo que nunca
    // cambia»: «cuando la pastilla no está, su sitio lo ocupa la acción de la
    // pantalla […] cuando la pantalla es una lista sobre la que se actúa».
    //
    // LA TABLA DE §E DICE LO CONTRARIO y esta prueba lo fijaba. No caben las
    // dos: mismo hueco, 62px a 18px del borde. Manda la lámina de la pantalla,
    // que es más específica — decidido con el usuario.
    for (const p of ['/dashboard', '/clientes', '/prestamos', '/rutas', '/caja']) {
      expect(resolverArmazon(p).pastilla, p).toBe(true)
    }
    expect(resolverArmazon('/cobros-hoy').pastilla).toBe(false)
    expect(resolverArmazon('/cobros-hoy').motivo).toMatch(/ocupa el sitio de la pastilla/)
  })

  it('las fichas llevan cabecera de detalle Y TAMBIÉN pastilla', () => {
    // Cambiado el 30 jul con el usuario. Antes la ficha no llevaba pastilla —
    // «llegó desde una lista: su salida es volver, no saltar»— y en la práctica
    // no se cumple: desde la ficha de un cliente se salta a la caja o a cobrar
    // hoy, no se vuelve a la lista para volver a bajar.
    for (const p of ['/clientes/abc123', '/prestamos/xyz', '/rutas/r1', '/cobradores/c9']) {
      const a = resolverArmazon(p)
      expect(a.cabecera, p).toBe(CABECERA.DETALLE)
      expect(a.pastilla, p).toBe(true)
    }
  })

  /* ── NINGÚN FORMULARIO LLEVA PASTILLA ────────────────────────────────────
     `/clientes/[id]/editar` estaba en `DETALLE` por llevar un id en la ruta, y
     era el ÚNICO formulario de la app con pastilla. La pastilla le tapaba el
     botón de guardar: se editaba el cliente y no había forma de guardarlo.

     Lo arreglé mal la primera vez —subí la barra de botones por encima de la
     pastilla, y en los dos formularios, así que «Crear cliente» y «Revisar
     préstamo», que nunca tuvieron pastilla, quedaron flotando a media pantalla
     con un hueco debajo—. Editar no es una ficha: es una tarea. */
  it('editar un cliente es TAREA, como todos los demás formularios', () => {
    const a = resolverArmazon('/clientes/abc123/editar')
    expect(a.cabecera).toBe(CABECERA.TAREA)
    expect(a.pastilla).toBe(false)
    expect(a.motivo).toMatch(/pierde datos/)
  })

  it('ni un solo formulario conserva la pastilla', () => {
    const formularios = [
      '/clientes/nuevo', '/clientes/abc123/editar',
      '/prestamos/nuevo', '/cobradores/nuevo', '/socios/nuevo',
      '/lineas-credito/nueva', '/soporte/nuevo',
    ]
    for (const p of formularios) {
      expect(resolverArmazon(p).pastilla, `${p} NO puede llevar pastilla: le tapa el botón de guardar`).toBe(false)
    }
    // El historial NO es un formulario: sigue siendo ficha y conserva pastilla.
    expect(resolverArmazon('/clientes/abc123/historial').pastilla).toBe(true)
  })

  /* ── ESTA PRUEBA DECIA LO CONTRARIO, Y ESTABA MAL ────────────────────────
     Fijaba que el segundo nivel iba SIN pastilla, con el motivo «se entra desde
     el menú Más, y la pastilla llevaría justo a donde se acaba de estar».

     Falso, y lo reportó el dueño usando la app: «entramos a un callejón sin
     salida porque no hay ningún botón que nos devuelva al menú principal o al
     Home». No se viene del panel, se viene de «Más» — así que la flecha te
     devuelve a «Más» y llegar al Home cuesta dos toques, sabiendo el camino.
     Sin pastilla la única salida es una flecha de 40px en la esquina.

     Una prueba puede fijar una decisión equivocada con toda la firmeza del
     mundo. Cuando el que usa la app dice que se siente encerrado, gana él. */
  it('el segundo nivel SÍ lleva pastilla: tiene que poder salir a cualquier sitio', () => {
    for (const p of ['/capital', '/gastos', '/reportes', '/configuracion', '/actividad']) {
      const a = resolverArmazon(p)
      expect(a.cabecera, p).toBe(CABECERA.DETALLE)
      expect(a.pastilla, p).toBe(true)
    }
  })

  it('las tareas llevan cabecera de tarea y NO pastilla', () => {
    for (const p of ['/prestamos/nuevo', '/clientes/nuevo', '/migrador', '/carga-masiva']) {
      const a = resolverArmazon(p)
      expect(a.cabecera, p).toBe(CABECERA.TAREA)
      expect(a.pastilla, p).toBe(false)
    }
  })

  it('firma, portal y registro no llevan nada', () => {
    for (const p of ['/firma/abc', '/portal', '/portal/login', '/registro', '/login']) {
      const a = resolverArmazon(p)
      expect(a.cabecera, p).toBe(CABECERA.NINGUNA)
      expect(a.pastilla, p).toBe(false)
    }
  })

  it('el segundo nivel vuelve Y ADEMÁS puede saltar a cualquier destino', () => {
    // Decía «puede volver pero no es un destino», con pastilla en false. La
    // vuelta sola no basta: desde «Más» la flecha te devuelve a «Más», no al
    // Home. Ver la nota larga de la prueba de arriba.
    for (const p of ['/capital', '/gastos', '/reportes', '/configuracion', '/actividad', '/dashboard/analiticas']) {
      const a = resolverArmazon(p)
      expect(a.cabecera, p).toBe(CABECERA.DETALLE)
      expect(a.pastilla, p).toBe(true)
    }
  })
})

describe('la invariante del rediseño', () => {
  it('la pastilla: quién la lleva y quién no', () => {
    const rutas = [
      '/dashboard', '/cobros-hoy', '/clientes', '/prestamos', '/rutas', '/caja',
      '/clientes/abc', '/prestamos/abc', '/prestamos/nuevo', '/capital', '/gastos',
      '/configuracion', '/migrador', '/firma/x', '/portal', '/socios', '/reportes',
      '/rutas/r1', '/cobradores', '/clavos', '/asistente', '/soporte',
    ]
    const conPastilla = rutas.filter((p) => resolverArmazon(p).pastilla)

    /* La lista se escribe ENTERA a propósito: si mañana alguien mete una ruta
       nueva en DETALLE o en NAVEGACION, esta prueba lo dice en vez de dejar que
       aparezca o desaparezca una barra sin que nadie lo decida.

       ⚠ EL SEGUNDO NIVEL ENTRÓ AQUÍ el 2 ago 2026. Antes se quedaba fuera, y el
       dueño lo reportó usando la app: «entramos a un callejón sin salida porque
       no hay ningún botón que nos devuelva al menú principal o al Home».

       Quiénes siguen SIN pastilla, y por qué:
         · las TAREAS (`/prestamos/nuevo`, `/migrador`) — salirse a medias
           pierde datos, y la barra invita a salirse
         · `/cobros-hoy` — su acción ocupa ese mismo hueco
         · `/asistente` — entró el 3 ago: el chat de Lucas tiene su barra de
           escribir fija abajo y la pastilla se la TAPABA, igual que le pasó al
           botón de guardar en «editar cliente». Reportado con captura
         · lo que no lleva armazón (`/firma/x`, `/portal`) */
    const sinPastilla = rutas.filter((p) => !resolverArmazon(p).pastilla)
    expect(sinPastilla.sort()).toEqual([
      '/asistente', '/cobros-hoy', '/firma/x', '/migrador', '/portal', '/prestamos/nuevo',
    ].sort())
  })

  it('la pastilla nunca aparece donde salirse pierde datos', () => {
    // Era «nunca hay pastilla sin cabecera de navegación», y desde que la ficha
    // la lleva eso ya no se sostiene. Lo que SÍ tiene que seguir siendo cierto
    // es lo que la regla protegía de verdad: en una TAREA a medias —crear un
    // préstamo, importar el Excel— no puede haber cinco atajos para irse, y en
    // las pantallas sin armazón no hay nada que pintar.
    for (const p of ['/prestamos/nuevo', '/clientes/nuevo', '/migrador', '/carga-masiva', '/firma/a', '/login']) {
      expect(resolverArmazon(p).pastilla, p).toBe(false)
    }
  })

  it('toda decisión trae su motivo escrito', () => {
    for (const p of ['/dashboard', '/clientes/x', '/prestamos/nuevo', '/firma/a', '/capital']) {
      expect(resolverArmazon(p).motivo.length, p).toBeGreaterThan(10)
    }
  })

  it('la query string y la barra final no cambian la decisión', () => {
    expect(resolverArmazon('/clientes?buscar=ana')).toEqual(resolverArmazon('/clientes'))
    expect(resolverArmazon('/clientes/')).toEqual(resolverArmazon('/clientes'))
    expect(resolverArmazon('/prestamos/nuevo?clienteId=1').cabecera).toBe(CABECERA.TAREA)
  })
})

describe('los destinos de la pastilla', () => {
  it('son cinco y en el orden del diseño', () => {
    expect(DESTINOS.map(d => d.nombre)).toEqual(['Panel', 'Clientes', 'Préstamos', 'Rutas', 'Más'])
  })

  it('Rutas NUNCA se oculta — decisión del proyecto contra el handoff', () => {
    // El handoff dice que Rutas desaparece sin cobradores. No se adopta: sacar
    // un destino ya rompió al cliente con más cobradores, el mismo día.
    expect(DESTINOS.some(d => d.href === '/rutas')).toBe(true)
    expect(DESTINOS).toHaveLength(5)
  })

  it('marca el destino activo, y el más específico gana', () => {
    expect(destinoActivo('/dashboard')).toBe('/dashboard')
    expect(destinoActivo('/clientes/abc')).toBe('/clientes')
    expect(destinoActivo('/prestamos/nuevo')).toBe('/prestamos')
    expect(destinoActivo('/rutas/r1')).toBe('/rutas')
  })

  it('una pantalla que no es destino no marca ninguno', () => {
    expect(destinoActivo('/capital')).toBeNull()
    expect(destinoActivo('/configuracion')).toBeNull()
  })
})

// El quinto destino de la pastilla llegaba a una pantalla clasificada como
// DETALLE: con flecha de volver y sin titulo. Una pantalla a la que se llega
// desde la barra no es el detalle de nada.
describe('el quinto destino', () => {
  it('/mas es navegacion, no detalle', () => {
    const a = resolverArmazon('/mas')
    expect(a.cabecera).toBe(CABECERA.NAVEGACION)
    expect(a.pastilla).toBe(true)
  })
})

// ── La lista de destinos, contra la lámina T39-05 y la regla §E ──
describe('el grupo principal son las SEIS pantallas de navegación', () => {
  const lateral = fs.readFileSync(
    path.join(process.cwd(), 'components/armazon/BarraLateral.jsx'), 'utf8')

  it('ni una más: «Líneas de crédito» no está entre ellas', () => {
    // Tenía siete. La séptima desplazaba a las que sí se tocan a diario, y eso
    // es exactamente lo que la regla prohíbe: lo secundario no desplaza.
    // Se parte por el nombre REAL de la constante. Antes partía por
    // «MAS_HERRAMIENTAS», que no existe: el split devolvía el archivo entero y
    // la prueba comprobaba lo contrario de lo que dice creer.
    const principal = lateral.split('const HERRAMIENTAS')[0]
    expect(principal).not.toMatch(/lineas-credito/)
  })

  it('están las seis, en el orden de la lámina', () => {
    const orden = [...lateral.matchAll(/href: '(\/[a-z-]+)'/g)].map((m) => m[1])
    expect(orden.slice(0, 6)).toEqual([
      '/dashboard', '/cobros-hoy', '/rutas', '/prestamos', '/clientes', '/caja',
    ])
  })

  it('«Líneas de crédito» sigue existiendo, en «Más herramientas»', () => {
    // Moverla no puede ser perderla.
    expect(lateral).toMatch(/lineas-credito/)
  })
})
