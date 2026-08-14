// lib/__tests__/buscador-encuentra-el-sistema.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El dueño escribió «Seguridad» en el buscador y la app le contestó:
//
//     «Nada con "Seguridad". Prueba con la cédula o el teléfono.»
//
// Dos fallos en una frase. Uno: la sección Seguridad EXISTE y el buscador no la
// conocía. Dos: le respondió como si buscara una persona — «no estoy buscando un
// cliente, estoy buscando una opción del sistema».
//
// Y la causa de fondo era peor que un olvido: el catálogo tenía las entradas de
// configuración apuntando a `?tab=perfil`, `?tab=organizacion`… cuando la
// pantalla usa `?s=`. Llevaban tiempo llevando al índice en vez de a la sección.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { obtenerComandos, filtrarComandos } from '@/lib/searchCommands'
import { seccionesConfig } from '@/lib/adaptadores/configuracion'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

const comandos = obtenerComandos({ esCobrador: false, permisos: {} })

describe('lo que el dueño escribió y no encontraba', () => {
  it.each([
    ['Seguridad', 'seguridad'],
    ['restablecer', 'seguridad'],
    ['reiniciar cuenta', 'seguridad'],
    ['tus datos', 'datos'],
    ['contraseña', 'datos'],
    ['whatsapp', 'whatsapp'],
    ['portal', 'portal'],
    ['oscuro', 'tema'],
  ])('buscar «%s» lleva a la sección correcta', (termino, esperado) => {
    const encontrados = filtrarComandos(comandos, termino)
    expect(encontrados.length, `«${termino}» no encuentra nada`).toBeGreaterThan(0)
    const ids = encontrados.map((c) => c.id).join(' ')
    expect(ids, `«${termino}» no ofrece «${esperado}»: salió ${ids}`).toContain(esperado)
  })
})

describe('⚠ los destinos existen de verdad', () => {
  /* El fallo silencioso de antes: entradas que apuntaban a URLs muertas. Se
     encontraban, se pulsaban, y te dejaban en la portada de configuración. */
  it('ninguna entrada apunta al viejo `?tab=`', () => {
    const conTab = comandos.filter((c) => (c.href || '').includes('?tab='))
    expect(conTab.map((c) => c.href), 'quedan destinos con el parámetro viejo').toEqual([])
  })

  it('cada sección de configuración tiene su entrada, y con su id real', () => {
    const secciones = seccionesConfig({ rol: 'owner', cobradores: 0 })
    for (const sec of secciones) {
      const cmd = comandos.find((c) => c.href === `/configuracion?s=${sec.id}`)
      expect(cmd, `la sección «${sec.nombre}» no está en el buscador`).toBeTruthy()
      expect(cmd.label).toBe(sec.nombre)
    }
  })

  it('y se derivan, no se escriben a mano', () => {
    /* Así la sección que se añada mañana entra sola y una que se renombre no
       puede quedarse con el nombre viejo aquí. */
    expect(leer('lib/searchCommands.js')).toMatch(/seccionesConfig\(\{ rol, cobradores: 0 \}\)/)
  })
})

describe('los textos ya no responden a otra pregunta', () => {
  it('el vacío no pide una cédula', () => {
    const src = leer('components/layout/GlobalSearch.jsx')
    expect(src, 'volvió a aconsejar la cédula a quien busca un ajuste')
      .not.toMatch(/Prueba con la cédula o el teléfono/)
    expect(src).toMatch(/en clientes, préstamos ni en el sistema/)
  })

  it('el campo dice que se busca más que gente', () => {
    const src = leer('components/pantallas/Estados.jsx')
    expect(src).toMatch(/Busca un cliente, una pantalla o un ajuste/)
  })
})

describe('los iconos son los del resto del sistema', () => {
  it('los accesos directos no los dibujan por su cuenta', () => {
    const src = leer('components/layout/GlobalSearch.jsx')
    expect(src).toMatch(/IconoDeRuta href=\{a\.href\}/)
    expect(src, 'volvieron los trazos sueltos en los atajos').not.toMatch(/function IconoAtajo/)
  })

  it('la barra lateral bebe de la misma fuente', () => {
    const src = leer('components/armazon/BarraLateral.jsx')
    expect(src).toMatch(/ICONO_DE_RUTA\['\/dashboard'\]/)
    expect(src).toMatch(/ICONO_DE_RUTA\['\/caja'\]/)
  })
})
