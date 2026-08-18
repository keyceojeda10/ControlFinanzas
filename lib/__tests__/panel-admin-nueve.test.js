// lib/__tests__/panel-admin-nueve.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Es un panel de superadministrador que no superadministra nada en absoluto.
//  Hay un montón de paneles, pero con datos iguales que se duplican y son igual
//  de irrelevantes. La ficha de mis clientes se ve fea. Yo puedo agregar días,
//  pero no puedo quitar días.»               — el dueño, 16 ago 2026
//
// Lo que se cuida: que el menú no vuelva a crecer con pantallas que contestan
// lo mismo, y —sobre todo— que al quitarlas del menú no se pierda ninguna
// función. Este proyecto ya se llevó por delante el modo abreviado rediseñando
// un campo; quitar cuatro pantallas de golpe es la misma trampa, más grande.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
const layout = leer('app/admin/layout.jsx')
const entradas = [...layout.matchAll(/href: '(\/admin\/[a-z-]+)'/g)].map((m) => m[1])

describe('⚠ el menú del panel', () => {
  it('tiene nueve entradas, no trece', () => {
    expect(entradas).toHaveLength(9)
  })

  it('las cuatro que absorbió Usuarios ya no están', () => {
    /* Las cinco consultaban la MISMA tabla para contestar variantes de la misma
       pregunta, y la misma organización salía «activa» en una y «muerta» en
       otra. La definición vive ahora en `lib/admin/segmentos.js`. */
    for (const fuera of ['/admin/organizaciones', '/admin/suscripciones', '/admin/retencion', '/admin/activacion']) {
      expect(entradas, `${fuera} volvió al menú`).not.toContain(fuera)
    }
    expect(entradas).toContain('/admin/usuarios')
  })

  it('⚠ pero sus PANTALLAS siguen vivas', () => {
    /* Quitar del menú no es borrar. La ficha de un negocio es a donde lleva cada
       renglón de la lista de Usuarios: sin ella, `usuarios` es una lista que no
       deja hacer nada. Y quien tenga la página guardada la sigue abriendo. */
    for (const ruta of [
      'app/admin/organizaciones/page.jsx',
      'app/admin/organizaciones/[id]/page.jsx',
      'app/admin/suscripciones/page.jsx',
      'app/admin/retencion/page.jsx',
      'app/admin/activacion/page.jsx',
    ]) {
      expect(existsSync(resolve(process.cwd(), ruta)), `se borró ${ruta}`).toBe(true)
    }
  })

  it('y Usuarios lleva a la ficha, que es donde se actúa', () => {
    expect(leer('app/admin/usuarios/page.jsx')).toMatch(/\/admin\/organizaciones\/\$\{u\.id\}/)
  })

  it('«Pruebas» se queda: lleva el marcador de conversión', () => {
    /* La trampa conocida de esta tanda: `negocio` tiene el marcador de las
       pruebas y el calendario de vencimientos a 30 días, y eso NO está en
       `inicio`. */
    expect(entradas).toContain('/admin/negocio')
  })
})

describe('⚠ el panel se ve, que era la queja', () => {
  /* «La ficha de mis clientes se ve fea.» La causa estaba escrita: la pantalla
     usaba `text-[white]` a pelo y la paleta del tema OSCURO
     (`--color-bg-card: #16171c`), y la app quedó en claro. Letra blanca sobre
     fondo blanco. */
  const PANTALLAS = [
    'app/admin/organizaciones/[id]/page.jsx',
    'app/admin/organizaciones/page.jsx',
    'app/admin/suscripciones/page.jsx',
    'app/admin/retencion/page.jsx',
    'app/admin/usuarios/page.jsx',
    'app/admin/negocio/page.jsx',
    'app/admin/leads/page.jsx',
  ]

  for (const ruta of PANTALLAS) {
    it(`${ruta.split('/').slice(2, -1).join('/')} no pinta letra blanca a pelo`, () => {
      expect(leer(ruta)).not.toMatch(/text-\[white\]|className="[^"]*\btext-white\b/)
    })

    it(`${ruta.split('/').slice(2, -1).join('/')} usa los tokens del rediseño`, () => {
      /* Los `--color-*` son la paleta oscura de antes: sobre el tema claro dan
         tarjetas negras y letra gris clarísima. */
      expect(leer(ruta)).not.toMatch(/--color-(text|bg|border|accent|success|danger|warning|info)/)
    })
  }
})
