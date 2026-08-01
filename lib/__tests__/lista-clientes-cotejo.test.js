// lib/__tests__/lista-clientes-cotejo.test.js
//
// T02-05 «Clientes», cotejada con `node scripts/medir.mjs clientes`.
// Las cifras salen de MEDIR contra la lamina, no de leerla.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const leer = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const lista = leer('components/pantallas/ListaClientes.jsx')
const prims = leer('components/cf/primitivos.jsx')
const tokens = leer('app/tokens-2026.css')
const pagina = leer('app/(dashboard)/clientes/page.jsx')

describe('el encabezado, que faltaba entero', () => {
  it('el titulo va a 22px Space Grotesk, en el CUERPO', () => {
    // La cabecera del armazon es la de navegacion y no lleva titulo: la
    // pantalla no decia ni como se llama ni cuantos clientes hay.
    expect(lista).toMatch(/export function EncabezadoLista/)
    expect(lista).toMatch(/fontSize: 22, fontWeight: 600, letterSpacing: '-\.02em'/)
  })

  it('la mora va en rojo, y SOLO la mora', () => {
    // «31 · 20 en mora» todo en rojo diria que los 31 estan mal.
    const enc = lista.slice(lista.indexOf('export function EncabezadoLista'), lista.indexOf('BuscadorLista'))
    expect(enc).toMatch(/color: 'var\(--cf-ink-3\)'/)
    expect(enc).toMatch(/color: 'var\(--cf-red-dark\)', fontWeight: 700/)
  })
})

describe('el buscador de la lista', () => {
  it('el buscador es EXACTAMENTE el de la lamina: 46, relleno 14, radio 14, icono 17', () => {
    // TERCERA VEZ que el usuario reporta la lupa, y la leccion no es de pixeles.
    //
    // La primera la «arregle» en tres pantallas que no eran esta. La segunda
    // subi el relleno a 18 y el icono a 19 razonando sobre la curva del borde
    // — inventando, porque T02-05 dice 14 y 17. La tercera MEDI esta caja:
    // 350x46, radio 14, 19px de aire a la izquierda. O sea que le habia puesto
    // MAS aire del que pide el diseño.
    //
    // Y aun asi se veia mal, porque lo que el tenia delante era el buscador de
    // `main` —«Buscar cliente…», con el icono absoluto sobre el relleno—
    // servido por un service worker con la version vieja en el cajon.
    //
    // Asi que esta prueba vuelve a clavar la lamina, y nada mas.
    expect(lista).toMatch(/height: 46, padding: '0 14px', borderRadius: 'var\(--cf-r-control\)'/)
    const b = lista.slice(lista.indexOf('export function BuscadorLista'), lista.indexOf('Tira de filtros'))
    expect(b).not.toMatch(/borderRadius: 999/)
    expect(b).toMatch(/<svg width="17" height="17"/)
    expect(b).toMatch(/gap: 10/)
  })

  it('dice «Nombre o cedula», que es por lo que se puede buscar', () => {
    expect(lista).toMatch(/placeholder = 'Nombre o c\u00e9dula'/)
  })

  it('la pagina ya no pinta un + al lado del buscador', () => {
    // Habia un + dorado de 54px junto al buscador Y el FAB de la pastilla: dos
    // botones de crear en la misma pantalla, uno encima del otro.
    expect(pagina).not.toMatch(/aria-label="Nuevo cliente"/)
  })
})

describe('los chips, con las medidas de las dos laminas de lista', () => {
  it('alto 36, no 34', () => {
    // La receta da el rango 33-36 y yo eleji 34 a ojo; T02-05 y T02-06 usan 36.
    expect(tokens).toMatch(/--cf-h-chip:\s*36px/)
  })

  it('relleno 14 y letra 13; el CHICO va a 34/13/12', () => {
    // Son dos chips y la receta los mete en el mismo rango (33-36). El de FILTRO
    // de lista va a 36/14/13 porque lleva su conteo y hay que tocarlo con el
    // pulgar mientras se recorre. El de RANGO —T06-01, «Hoy · Ayer · 7 días ·
    // 30 días · Rango»— va a 34/13/12: son cinco en una fila de 350px, y a 36/14
    // no caben sin que el último se corte.
    expect(prims).toMatch(/height: chico \? 34 : 'var\(--cf-h-chip\)'/)
    expect(prims).toMatch(/padding: chico \? '0 13px' : '0 14px'/)
    expect(prims).toMatch(/fontSize: chico \? 12 : 13, fontWeight: activo \? 700 : 600/)
  })

  it('el conteo va PEGADO: «Todos 31», sin punto medio', () => {
    // Con el separador, el conteo se lee como una segunda etiqueta en vez de
    // como la cantidad de lo que el chip filtra.
    const chip = prims.slice(prims.indexOf('export function Chip'))
    expect(chip.slice(0, 1400)).toMatch(/\{conteo\}<\/span>/)
    expect(chip.slice(0, 1400)).not.toMatch(/\u00b7 \{conteo\}/)
  })

  it('el cuarto chip abre la HOJA DE FILTROS, no el modal de grupos', () => {
    // Abria el modal de GRUPOS DE COBRO en su pestaña de filtrar: se pulsaba
    // «Más filtros» y salia la gestion de grupos, que es otra cosa. Ahora abre
    // `HojaFiltros`, la misma de prestamos, con ruta y grupo dentro.
    // Y LA MISMA FILA QUE PRESTAMOS. El acceso era un chip con icono al final
    // de la tira de estados — una tira que se desplaza, asi que en cuanto hay
    // cuatro estados el boton queda fuera de pantalla. Dos pantallas hermanas
    // con dos disposiciones distintas obligan a aprender la app dos veces.
    expect(pagina).toMatch(/<BotonFiltros n=\{nFiltros\} onClick=\{\(\) => setHojaFiltros\(true\)\}/)
    expect(pagina).toMatch(/<HojaFiltros/)
    expect(pagina).not.toMatch(/onMasFiltros=/)

    const prest = fs.readFileSync(path.join(process.cwd(), 'app/(dashboard)/prestamos/page.jsx'), 'utf8')
    for (const t of ['<BotonFiltros n={nFiltros}', 'flex-1 min-w-0']) {
      expect(prest, `prestamos ya no usa ${t}`).toContain(t)
      expect(pagina, `clientes no copia ${t}`).toContain(t)
    }
  })

  it('los filtros que se ofrecen son los que el servidor sabe filtrar', () => {
    // `/api/clientes` acepta `rutaId` y `grupo`. Los de mora y «le toca hoy» no,
    // y filtrarlos en el navegador solo miraria los 50 de la pagina: un filtro
    // que miente es peor que no tenerlo.
    const api = fs.readFileSync(path.join(process.cwd(), 'app/api/clientes/route.js'), 'utf8')
    expect(api).toMatch(/searchParams\.get\('rutaId'\)/)
    expect(api).toMatch(/searchParams\.get\('grupo'\)/)
    expect(pagina).toMatch(/id: 'ruta'/)
  })
})
