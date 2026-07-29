// lib/__tests__/lateral-t39-05-cotejo.test.js
//
// La barra lateral, cotejada contra T39-05 con `node scripts/medir.mjs
// /clientes aside 1440`. Las cifras salen de MEDIR, no de leer.
//
// La barra estaba marcada como terminada. El cotejo encontró trece cosas.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const leer = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const lateral = leer('components/armazon/BarraLateral.jsx')
const armazon = leer('components/armazon/Armazon.jsx')
const layout  = leer('app/(dashboard)/layout.jsx')

describe('T39-05 · las medidas', () => {
  it('la barra no se encoge', () => {
    // La lámina dice `flex:none`. Salía con shrink 1: en un escritorio estrecho
    // se estrujaba en vez de dejar que el contenido de al lado se apretara.
    const aside = lateral.slice(lateral.indexOf('<aside'), lateral.indexOf('Zona superior'))
    expect(aside).toMatch(/flex: 'none'/)
  })

  it('el glifo va a radio 11, un punto más redondo que el de móvil', () => {
    expect(lateral).toMatch(/borderRadius: 11 \}/)
  })

  it('los destinos llevan hueco 11 y alto 37', () => {
    expect(lateral).toMatch(/height: 37, minHeight: 37, padding: '0 12px', borderRadius: 13, gap: 11/)
  })

  it('el buscador lleva relleno 12 y hueco 9', () => {
    expect(lateral).toMatch(/gap: 9,\s*\n\s*height: 38, padding: '0 12px'/)
  })

  it('el rótulo del grupo lleva ÉL el borde de arriba, a 35 de alto', () => {
    // Antes iba un <div> separador aparte y el rótulo a 30.
    expect(lateral).toMatch(/height: 35, minHeight: 35,\s*\n\s*padding: '13px 12px 0', marginTop: 6,/)
    expect(lateral).not.toMatch(/height: 1, background: 'var\(--cf-divider\)', margin: '8px 0'/)
  })

  it('el chevron del grupo apunta abajo cerrado y arriba abierto', () => {
    expect(lateral).toMatch(/abierto \? 'rotate\(180deg\)' : 'none'/)
  })

  it('las iniciales del pie van a 11px', () => {
    expect(lateral).toMatch(/fontSize: 11, fontWeight: 700, color: '#FFF'/)
  })
})

describe('T39-05 · la estructura', () => {
  it('NO hay grupo «Cuenta»: la lámina no lo tiene', () => {
    expect(lateral).not.toMatch(/titulo="Cuenta"/)
    expect(lateral).not.toMatch(/^const CUENTA = \[/m)
  })

  it('pero Tutoriales sigue alcanzable, que no está en HojaCuenta', () => {
    // Configuración y Soporte sí están en la hoja; Tutoriales no. Quitar el
    // grupo sin más lo dejaba sin ninguna vía desde la barra.
    expect(lateral).toMatch(/href: '\/tutoriales'/)
    const hoja = leer('components/armazon/HojaCuenta.jsx')
    expect(hoja).toMatch(/nombre="Configuración"/)
    expect(hoja).toMatch(/nombre="Soporte"/)
  })

  it('detrás del grupo va el espaciador vacío, y nada más', () => {
    expect(lateral).toMatch(/<div style=\{\{ flex: 1, minHeight: 0 \}\} \/>/)
  })

  it('la campana de escritorio lleva NÚMERO, no punto', () => {
    // T40-00-a quitó el conteo, pero es una lámina de 390 y no hay variante de
    // escritorio del turno 40. La única de 1440 es T39-05, y dibuja un «3».
    expect(lateral).toMatch(/minWidth: 16, height: 16, padding: '0 4px'/)
    expect(lateral).toMatch(/\{cuantosAvisos\}/)
  })
})

describe('los controles que estaban muertos', () => {
  it('HojaCuenta está montada en la app, no solo en el banco', () => {
    // Estaba construida entera y el único sitio que la instanciaba era
    // app/estilo/page.jsx. Pulsar el avatar no hacía nada.
    expect(armazon).toMatch(/import HojaCuenta/)
    expect(armazon).toMatch(/<HojaCuenta/)
  })

  it('el avatar la abre desde las DOS barras', () => {
    expect(armazon).toMatch(/onCuenta=\{\(\) => setCuenta\(true\)\}/)   // móvil
    expect(armazon).toMatch(/cf:abrir-cuenta/)                          // escritorio
    expect(lateral).toMatch(/onCuenta \?\? abrirCuenta/)
  })

  it('el selector de tema cambia el tema de verdad', () => {
    // Llegaba por prop con 'light' por defecto y nadie se la pasaba: las tres
    // pastillas se pulsaban y no hacían nada, y la activa era siempre «Claro».
    expect(lateral).toMatch(/useTheme\(\)/)
    expect(lateral).toMatch(/onCambiar=\{setTheme\}/)
    expect(lateral).not.toMatch(/tema = 'light'/)
  })

  it('la conexión usa useOnline(), que hace ping, no navigator.onLine a secas', () => {
    // navigator.onLine miente con WiFi sin paso a internet: el limbo del
    // cobrador en la calle, justo el caso en que hay que avisar.
    expect(lateral).toMatch(/const conectado = useOnline\(\)/)
    // Solo el uso, no la palabra: el comentario de arriba explica por qué
    // `navigator.onLine` no sirve, y una prueba que busque el texto a secas se
    // caza a sí misma. Lo que no puede volver es la LECTURA directa.
    expect(lateral).not.toMatch(/setConectado\(navigator\.onLine\)/)
    expect(lateral).not.toMatch(/addEventListener\('(online|offline)'/)
  })

  it('el layout le pasa el rol a Armazon para la hoja', () => {
    expect(layout).toMatch(/<Armazon nombre=\{nombre\} rol=\{/)
  })
})
