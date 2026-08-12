// lib/__tests__/lo-subido-no-vive-en-public.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Todo lo que vive en `public/` lo sirve Next como archivo ESTÁTICO, antes de
// cualquier rewrite y **sin pasar por la sesión**. Comprobado contra producción:
//
//     GET /uploads/firmas/<org>/<hash>.png       → 200  (sin sesión)
//     GET /api/uploads/firmas/<org>/<hash>.png   → 401
//
// El API con permisos existía y funcionaba. La ruta estática lo rodeaba, así
// que el rewrite de `next.config.mjs` nunca llegaba a dispararse.
//
// Eran **1.313 archivos**: 1.066 firmas, 184 fotos de clientes, 61 fotos de
// pagos, 2 tickets. Firmas y cédulas de gente real, abiertas a quien tuviera el
// enlace — no se adivinan ni se listan, pero un enlace reenviado entra para
// siempre y sin cuenta.
//
// `lib/fotos-donadas.js` ya lo había descubierto en agosto y por eso las fotos
// donadas nunca fueron a `public/`. Esta prueba impide que la próxima subida
// vuelva a caer ahí.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const RAIZ = process.cwd()
const leer = (r) => readFileSync(path.join(RAIZ, r), 'utf8')
const sinNotas = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/* Los cuatro sitios donde alguien sube algo. Es una lista cerrada a propósito:
   si aparece un quinto, la prueba de abajo obliga a decidir dónde escribe. */
const SUBIDAS = [
  'app/api/clientes/[id]/foto/route.js',
  'app/api/pagos/[id]/foto/route.js',
  'app/api/prestamos/[id]/firma/route.js',
  'app/api/soporte/[id]/upload/route.js',
]

/* Sube archivos pero YA vivía fuera de `public/`, con su propia carpeta
   (`FOTOS_DONADAS_DIR`, en `/opt/cf-fotos-donadas`). Es el precedente que
   descubrió este agujero en agosto y el motivo de que nunca cayera en él.
   Va aparte para que la barrida no lo señale, y listado para que se sepa que
   se miró. */
const CON_CASA_PROPIA = ['app/api/fotos-donadas/route.js']

describe('nada de lo que sube la gente se escribe en public/', () => {
  it('las fotos donadas siguen teniendo su propia carpeta, fuera de public/', () => {
    const src = sinNotas(leer('lib/fotos-donadas.js'))
    expect(src).toMatch(/FOTOS_DONADAS_DIR/)
    expect(src).not.toMatch(/'public',\s*'uploads'/)
  })

  it.each(SUBIDAS)('%s escribe en el almacén', (ruta) => {
    const src = sinNotas(leer(ruta))
    expect(src, 'sigue escribiendo en public/').not.toMatch(/'public',\s*'uploads'/)
    expect(src).toMatch(/directorioAlmacen\(\)/)
  })

  it('la lista de subidas está completa', () => {
    /* Un endpoint nuevo que escriba en `public/uploads` reabriría el agujero sin
       que nadie lo note: no falla, solo deja el archivo al alcance de cualquiera. */
    const hallados = []
    const barrer = (dir) => {
      for (const e of readdirSync(dir)) {
        const f = path.join(dir, e)
        if (statSync(f).isDirectory()) barrer(f)
        else if (e === 'route.js') {
          const src = sinNotas(readFileSync(f, 'utf8'))
          if (/writeFile\s*\(/.test(src) && /uploads|almacen|firma|foto/i.test(src)) {
            hallados.push(path.relative(RAIZ, f).replace(/\\/g, '/'))
          }
        }
      }
    }
    barrer(path.join(RAIZ, 'app', 'api'))
    const nuevos = hallados.filter((h) => !SUBIDAS.includes(h) && !CON_CASA_PROPIA.includes(h))
    expect(nuevos, `endpoints que suben archivos y no están en la lista: ${nuevos.join(', ')}`).toEqual([])
  })
})

describe('el almacén vive fuera del árbol del proyecto', () => {
  const almacen = sinNotas(leer('lib/almacen.js'))

  it('se puede fijar por variable de entorno, como el respaldo', () => {
    expect(almacen).toMatch(/process\.env\.UPLOADS_DIR/)
  })

  it('el sitio por defecto NO es public/', () => {
    const porDefecto = almacen.slice(almacen.indexOf('directorioAlmacen'), almacen.indexOf('directorioViejo'))
    expect(porDefecto).not.toMatch(/'public'/)
  })

  it('⚠ sigue sabiendo LEER del sitio viejo', () => {
    /* Un archivo que no alcance la mudanza tiene que seguir viéndose. Si esto
       se quita antes de tiempo, el prestamista se encuentra la firma de su
       pagaré rota — peor que el problema que estamos cerrando. */
    expect(almacen).toMatch(/directorioViejo/)
    expect(almacen).toMatch(/'public',\s*'uploads'/)
  })
})

describe('la puerta: sesión, y que el archivo sea suyo', () => {
  const api = sinNotas(leer('app/api/uploads/[...path]/route.js'))

  it('exige sesión', () => {
    expect(api).toMatch(/!session\?\.user.*401/s)
  })

  it('⚠ y que la organización de la RUTA sea la suya', () => {
    /* Sin esto, cualquiera de los 457 negocios abría la firma del pagaré de
       otro cambiando un id en la URL: eso es multi-tenant roto, no un permiso
       flojo. La ruta es `<tipo>/<organizationId>/<archivo>`. */
    expect(api).toMatch(/orgEnLaRuta !== session\.user\.organizationId/)
    expect(api).toMatch(/superadmin/)
  })

  it('los adjuntos de soporte son solo del superadmin', () => {
    expect(api).toMatch(/tickets/)
  })

  it('la caché es PRIVADA', () => {
    /* Con `public`, un proxy o una CDN podría guardar la firma de un pagaré y
       servírsela a otro: la caché no sabe de sesiones. */
    expect(api).toMatch(/'private, max-age/)
    expect(api).not.toMatch(/'public, max-age/)
  })
})

describe('quien LEE un archivo subido lo busca en los dos sitios', () => {
  it('el pagaré estampa la firma por `leerSubido`', () => {
    /* Un pagaré sin la firma no se ve roto: se ve normal y no sirve. Nadie se
       entera hasta que hay que cobrarlo. */
    const src = sinNotas(leer('app/api/prestamos/[id]/pagare/route.js'))
    expect(src).toMatch(/leerSubido\(prestamo\.firmaUrl\)/)
    expect(src).not.toMatch(/'public',\s*prestamo\.firmaUrl/)
  })

  it('los borrados quitan el archivo esté donde esté', () => {
    for (const r of ['app/api/clientes/[id]/foto/route.js',
      'app/api/prestamos/[id]/firma/route.js',
      'app/api/cron/limpieza/route.js']) {
      expect(sinNotas(leer(r)), r).toMatch(/borrarSubido\(/)
    }
  })
})
