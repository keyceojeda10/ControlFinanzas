// lib/__tests__/whatsapp-el-indicativo-es-del-pais.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Un prestamista de Argentina mandó la captura el 12 ago 2026. WhatsApp le
// contestaba, palabra por palabra:
//
//     «+573625325911 no es un número de teléfono válido.»
//
// Dos fallos en el mismo número:
//
//  1. **57 es el indicativo de Colombia.** El país de la organización estaba en
//     la base y en la sesión desde que se internacionalizó la app, pero los
//     enlaces de WhatsApp lo pegaban a mano. Eran CUATRO sitios inventándose la
//     misma regla, y uno de ellos con el comentario «Colombia por defecto».
//  2. **Al móvil argentino le falta el 9.** Aunque le hubiéramos puesto +54,
//     habría fallado igual: el número se escribe `362 5325911` dentro del país,
//     pero WhatsApp identifica a la gente por la forma de fuera —`+54 9 362
//     5325911`—. Es la única excepción de los 18 países.
//
// Medido contra los 5.841 teléfonos de producción antes de desplegar: los 5.721
// que armaban enlace lo siguen armando. Cero pérdidas.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { telefonoParaWhatsApp, formatearTelefonoIntl } from '@/lib/i18n'
import { enlaceWhatsApp } from '@/lib/adaptadores/plantillas'
import { COUNTRIES } from '@/lib/countries'

describe('el número que WhatsApp acepta', () => {
  it('Colombia sigue igual que siempre', () => {
    expect(telefonoParaWhatsApp('3001234567', 'co')).toBe('573001234567')
    expect(telefonoParaWhatsApp('573001234567', 'co')).toBe('573001234567')
    expect(telefonoParaWhatsApp('300 123 4567', 'co')).toBe('573001234567')
    expect(telefonoParaWhatsApp('+57 300 123-4567', 'co')).toBe('573001234567')
  })

  it('⚠ Argentina lleva el 9 de los móviles', () => {
    /* Este es el número exacto de la captura. Sin el 9, WhatsApp dice que no
       existe; con él, abre el chat. */
    expect(telefonoParaWhatsApp('3625325911', 'ar')).toBe('5493625325911')
  })

  it('y el 9 no se pone dos veces', () => {
    /* Un número ya guardado en forma internacional no se vuelve a tocar, y uno
       con +54 «normal» recibe el 9 que le falta. Un `54954 9…` no le llega a
       nadie y nadie se entera hasta que el cliente no contesta. */
    expect(telefonoParaWhatsApp('5493625325911', 'ar')).toBe('5493625325911')
    expect(telefonoParaWhatsApp('543625325911', 'ar')).toBe('5493625325911')
    expect(telefonoParaWhatsApp('+54 9 362 532-5911', 'ar')).toBe('5493625325911')
  })

  it('cada país pone SU indicativo', () => {
    expect(telefonoParaWhatsApp('912345678', 'pe')).toBe('51912345678')
    expect(telefonoParaWhatsApp('5512345678', 'mx')).toBe('525512345678')
    expect(telefonoParaWhatsApp('912345678', 'cl')).toBe('56912345678')
    expect(telefonoParaWhatsApp('981234567', 'py')).toBe('595981234567')
  })

  it('⚠ Ecuador y Venezuela cuentan el 0 dentro de sus dígitos', () => {
    /* Sus placeholders son `0991234567` y `04121234567`. Fuera del país el 0 no
       va. Sin contemplarlo, el botón de WhatsApp quedaba apagado para los dos
       países enteros — y no habría dado error: solo no habría hecho nada. */
    expect(telefonoParaWhatsApp('0991234567', 'ec')).toBe('593991234567')
    expect(telefonoParaWhatsApp('991234567', 'ec')).toBe('593991234567')
    expect(telefonoParaWhatsApp('04121234567', 've')).toBe('584121234567')
  })

  it('⚠ NO ES `formatearTelefonoIntl`: esa es para MARCAR', () => {
    /* Las dos «formatean un teléfono» y por eso están separadas y documentadas.
       La de marcar devuelve el número tal cual es; esta devuelve el que usa
       WhatsApp, que en Argentina NO coinciden. Confundirlas es el fallo. */
    expect(formatearTelefonoIntl('3625325911', 'ar')).toBe('543625325911')
    expect(telefonoParaWhatsApp('3625325911', 'ar')).toBe('5493625325911')
  })

  it('lo que no cuadra con el país devuelve null, no un enlace roto', () => {
    /* El `null` apaga el botón. Un `wa.me` inventado no falla en la app: falla
       en WhatsApp, delante del cliente del prestamista. */
    expect(telefonoParaWhatsApp('', 'co')).toBeNull()
    expect(telefonoParaWhatsApp('123', 'co')).toBeNull()
    expect(telefonoParaWhatsApp(null, 'ar')).toBeNull()
  })
})

describe('⚠ TODOS los países, no solo los que se reportaron', () => {
  /* La pregunta del dueño fue exactamente esta: «¿y si lo abren en Chile, en
     Uruguay, en Venezuela?». La respuesta no puede ser una lista escrita a
     mano: se recorre `COUNTRIES` entero, así que EL PAÍS QUE SE AÑADA MAÑANA
     entra solo en esta prueba y falla si se le olvidó el indicativo.

     Se usa el `phonePlaceholder` de cada país —el ejemplo que la propia app le
     enseña al usuario dentro del campo— porque es lo que la gente escribe. */
  it.each(Object.entries(COUNTRIES))('%s abre con su propio indicativo', (cc, cfg) => {
    const wa = telefonoParaWhatsApp(cfg.phonePlaceholder, cc)
    expect(wa, `${cfg.name}: el ejemplo de su propio campo no arma enlace`).toBeTruthy()

    const esperado = cc === 'ar' ? '549' : cfg.phonePrefix.replace('+', '')
    expect(wa.startsWith(esperado),
      `${cfg.name}: esperaba empezar por ${esperado} y salió ${wa}`).toBe(true)

    /* Y que no se le cuele el de Colombia a nadie más. Es el fallo que se
       reportó: 57 pegado a un número argentino. */
    if (cc !== 'co') expect(wa.startsWith('57'), `${cfg.name} lleva el 57 de Colombia`).toBe(false)
  })
})

describe('el enlace de las plantillas', () => {
  it('Colombia, como antes', () => {
    expect(enlaceWhatsApp('3001234567', 'x', 'co')).toContain('wa.me/573001234567')
    expect(enlaceWhatsApp('573001234567', 'x', 'co')).toContain('wa.me/573001234567')
  })

  it('⚠ y Argentina con su 9', () => {
    expect(enlaceWhatsApp('3625325911', 'x', 'ar')).toContain('wa.me/5493625325911')
    expect(enlaceWhatsApp('3625325911', 'x', 'ar')).not.toContain('wa.me/57')
  })
})

describe('nadie se inventa el indicativo por su cuenta', () => {
  const RAIZ = process.cwd()
  const leer = (r) => readFileSync(path.join(RAIZ, r), 'utf8')
  const sinNotas = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  /* Los cuatro sitios que lo pegaban a mano. Se listan uno por uno —y no con
     una barrida— porque el admin SÍ puede seguir asumiendo Colombia: los leads
     de Facebook y nuestro propio soporte son colombianos. Lo que no puede
     asumirlo es lo que usa el prestamista con SUS clientes. */
  const DEL_PRESTAMISTA = [
    'lib/whatsapp.js',
    'lib/adaptadores/plantillas.js',
    'components/cobradores/CompartirCredenciales.jsx',
    'app/(dashboard)/socios/[id]/page.jsx',
    'components/clientes/ClienteHeroCard.jsx',
  ]

  it.each(DEL_PRESTAMISTA)('%s no pega un 57 a mano', (ruta) => {
    const src = sinNotas(leer(ruta))
    expect(src, 'volvió el indicativo colombiano a mano').not.toMatch(/`57\$\{|'57'\s*\+|\+\s*'57'/)
  })

  it('el modal del teléfono no exige un celular colombiano', () => {
    /* Era `/^3\d{9}$/` con la etiqueta «+57» pegada al campo: al dueño de
       Argentina no le dejaba escribir el suyo, y es lo PRIMERO que ve al
       entrar. */
    const src = sinNotas(leer('components/layout/CompletarTelefonoModal.jsx'))
    expect(src).not.toMatch(/\^3\\d\{9\}\$/)
    expect(src).not.toMatch(/celular colombiano/)
    expect(src).toMatch(/useCountry/)
    expect(src).toMatch(/config\.phonePrefix/)
  })

  it('el servidor pasa el país a mano, que ahí no se hereda', () => {
    /* `fijarPaisActivo` solo vale en el navegador: en el servidor una petición
       argentina y otra colombiana comparten proceso. */
    const src = sinNotas(leer('app/api/asistente/accion/route.js'))
    expect(src).toMatch(/formatearTelefono\(cliente\?\.telefono, session\.user\.country\)/)
  })
})
