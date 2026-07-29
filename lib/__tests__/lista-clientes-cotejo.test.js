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
  it('alto 46 y radio de control, NO una pildora', () => {
    // Lo tenia con `borderRadius: 999`, que es la forma del buscador de la
    // BARRA LATERAL — otra pieza.
    expect(lista).toMatch(/height: 46, padding: '0 14px', borderRadius: 'var\(--cf-r-control\)'/)
    const b = lista.slice(lista.indexOf('export function BuscadorLista'), lista.indexOf('Tira de filtros'))
    expect(b).not.toMatch(/borderRadius: 999/)
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

  it('relleno 14 y letra 13', () => {
    expect(prims).toMatch(/height: 'var\(--cf-h-chip\)', padding: '0 14px'/)
    expect(prims).toMatch(/fontSize: 13, fontWeight: activo \? 700 : 600/)
  })

  it('el conteo va PEGADO: «Todos 31», sin punto medio', () => {
    // Con el separador, el conteo se lee como una segunda etiqueta en vez de
    // como la cantidad de lo que el chip filtra.
    const chip = prims.slice(prims.indexOf('export function Chip'))
    expect(chip.slice(0, 1400)).toMatch(/\{conteo\}<\/span>/)
    expect(chip.slice(0, 1400)).not.toMatch(/\u00b7 \{conteo\}/)
  })

  it('el cuarto chip abre algo de verdad, no es decorativo', () => {
    // Se conecta al modal de grupos que YA existe. Un boton nuevo sin destino
    // es el patron que ya costo cuatro controles muertos en esta sesion.
    expect(lista).toMatch(/onMasFiltros/)
    expect(pagina).toMatch(/onMasFiltros=\{\(\) => \{ setTabModalGrupos\('filtrar'\); setModalGrupos\(true\) \}\}/)
  })
})
