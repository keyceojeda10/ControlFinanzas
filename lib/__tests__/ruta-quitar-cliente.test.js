import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { tramosDelRecorrido } from '@/lib/adaptadores/ruta'

// ── «NO SE PUDO QUITAR DE LA RUTA» ──────────────────────────────────────────
//
// Reportado con captura: se pulsa el botón de quitar y sale un error rojo que
// no dice por qué. «Solamente debería de eliminarlo, o sea, desenrutarlo».
//
// La causa: las paradas de la pantalla de ordenar se armaban SIN el `id` del
// cliente. El botón manda `parada.id` al API, llegaba `undefined`, y el
// servidor respondía «Cliente no encontrado en esta ruta» — que la pantalla
// traducía a un mensaje genérico.
//
// ⚠ POR QUÉ ERA INVISIBLE: `tramosDelRecorrido` hace `id: p.id ?? i`, así que
// cuando falta pone el ÍNDICE. Las claves de React parecían válidas y el botón
// mandaba un número (0, 1, 2) que el API interpretaba como un id de cliente
// inexistente. En el código se ve todo correcto.

const pagina = readFileSync(resolve(process.cwd(), 'app/(dashboard)/rutas/[id]/page.jsx'), 'utf8')

describe('las paradas llevan el id del cliente', () => {
  it('en los DOS montajes de la pantalla de ordenar', () => {
    // Uno para escritorio y otro para móvil. Si solo se arregla uno, el fallo
    // sigue vivo en la mitad de los dispositivos — que es como se han colado
    // otros bugs de esta misma pantalla.
    const montajes = pagina.split('paradas={tramosDelRecorrido(clientesFiltrados.map((c, i) => ({')
    expect(montajes.length - 1, 'esperaba dos montajes: revisa esta prueba').toBe(2)
    for (const [n, trozo] of montajes.slice(1).entries()) {
      const bloque = trozo.slice(0, 700)
      expect(bloque, `al montaje nº${n + 1} le falta el id`).toMatch(/id: c\.id,/)
    }
  })

  it('el botón manda ese id al API', () => {
    expect(pagina).toMatch(/body: JSON\.stringify\(\{ clienteId: parada\.id \}\)/)
  })
})

describe('el adaptador respeta el id', () => {
  it('lo pasa tal cual cuando viene', () => {
    const [p] = tramosDelRecorrido([{ id: 'cli_abc', nombre: 'Ana', direccion: 'Calle 1' }])
    expect(p.id).toBe('cli_abc')
  })

  it('⚠ sin id pone el ÍNDICE, y por eso el fallo no se veía', () => {
    // Esta línea es la que hacía que todo pareciera correcto: la lista se
    // pintaba con claves 0,1,2 y el botón mandaba esos números como si fueran
    // ids de cliente.
    const [p0, p1] = tramosDelRecorrido([{ nombre: 'Ana' }, { nombre: 'Beto' }])
    expect(p0.id).toBe(0)
    expect(p1.id).toBe(1)
  })
})

describe('el API rechaza lo que no existe', () => {
  const api = readFileSync(resolve(process.cwd(), 'app/api/rutas/[id]/clientes/route.js'), 'utf8')

  it('busca al cliente DENTRO de esa ruta', () => {
    // La comprobación está bien y no se toca: es lo que impide sacar a alguien
    // de una ruta que no es la suya. El fallo era el dato que le llegaba.
    expect(api).toMatch(/where: \{ id: clienteId, organizationId, rutaId: id \}/)
    expect(api).toContain('Cliente no encontrado en esta ruta')
  })

  it('quitar NO borra al cliente ni su préstamo', () => {
    // Lo que el dueño espera: «sigue siendo tu cliente y su préstamo no se
    // toca». Solo se le suelta la ruta.
    expect(api).toMatch(/data: \{ rutaId: null, ordenRuta: null \}/)
    const i = api.indexOf('export async function DELETE')
    const bloque = api.slice(i)
    expect(bloque, 'el endpoint borra registros en vez de desenrutar')
      .not.toMatch(/cliente\.delete|prestamo\.delete/)
  })
})
