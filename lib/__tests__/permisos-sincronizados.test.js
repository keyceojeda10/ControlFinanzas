import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// «Tiene el permiso activo y el cobrador no puede usarlo». Comprobado contra
// producción: los permisos SÍ están guardados (37 de 38 con «reportar gastos»,
// cero NULL). El fallo estaba en aplicarlos.
//
// `desembolsarLinea` estaba en el LOGIN pero no en el REFRESCO de 15 minutos:
// funcionaba al entrar y se apagaba solo a los 15 min. Esta prueba compara las
// tres listas —el `select`, el login y el refresco— para que no se separen otra
// vez.
const auth = readFileSync(resolve(process.cwd(), 'lib/auth.js'), 'utf8')
const hook = readFileSync(resolve(process.cwd(), 'hooks/useAuth.js'), 'utf8')
const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8')

/** Las claves de un objeto `permisos = { ... }` a partir de su posición. */
function clavesDelBloque(src, desde) {
  const ini = src.indexOf('{', desde)
  let prof = 0, fin = ini
  for (let i = ini; i < src.length; i++) {
    if (src[i] === '{') prof++
    else if (src[i] === '}') { prof--; if (prof === 0) { fin = i; break } }
  }
  return [...src.slice(ini, fin).matchAll(/^\s{2,}([a-zA-Z]+):/gm)].map((m) => m[1])
}

describe('los permisos no se pierden por el camino', () => {
  it('el login y el refresco del token dan LOS MISMOS permisos', () => {
    // OJO: en el login es `permisos = {` (una asignación), no `permisos:`.
    // Buscando `permisos:` caía en `permisos,` del objeto devuelto y salían 0
    // claves — y una lista vacía no encuentra ninguna diferencia: la prueba
    // habría pasado en verde sin comprobar nada.
    const enLogin = clavesDelBloque(auth, auth.indexOf('permisos = {'))
    const enRefresco = clavesDelBloque(auth, auth.indexOf('token.permisos = {'))
    expect(enLogin.length, 'no se encontró el bloque del login').toBeGreaterThan(5)
    expect(enRefresco.length, 'no se encontró el bloque del refresco').toBeGreaterThan(5)
    const faltan = enLogin.filter((k) => !enRefresco.includes(k))
    expect(faltan, `se apagarían solos a los 15 minutos: ${faltan.join(', ')}`).toEqual([])
    const sobran = enRefresco.filter((k) => !enLogin.includes(k))
    expect(sobran, `solo existirían tras el refresco: ${sobran.join(', ')}`).toEqual([])
  })

  it('el `select` pide TODAS las columnas que luego se leen', () => {
    // Una columna que no se pide llega `undefined`, y el `?? false` la apaga.
    const enRefresco = clavesDelBloque(auth, auth.indexOf('token.permisos = {'))
    for (const clave of enRefresco) {
      const columna = 'puede' + clave[0].toUpperCase() + clave.slice(1)
      // Solo si esa columna existe en el esquema: `gestionarPrestamos` cae con
      // fallback a otra, y alguna clave podría no ser 1-a-1.
      if (!schema.includes(`  ${columna} `)) continue
      expect(auth, `el select no pide ${columna}: llegaría undefined`)
        .toContain(`${columna}: true`)
    }
  })

  it('`useAuth` expone todos los permisos del token', () => {
    const enRefresco = clavesDelBloque(auth, auth.indexOf('token.permisos = {'))
    for (const clave of enRefresco) {
      expect(hook, `useAuth no expone «${clave}»: la UI no puede consultarlo`)
        .toContain(`permisos.${clave}`)
    }
  })
})

describe('la pantalla de gastos respeta el permiso', () => {
  const pantalla = readFileSync(resolve(process.cwd(), 'app/(dashboard)/gastos/page.jsx'), 'utf8')

  it('un cobrador CON permiso entra', () => {
    // Decía `if (!esOwner) return «Solo el administrador…»`, que le cerraba la
    // puerta a los 37 cobradores que tienen el permiso encendido.
    expect(pantalla).toContain('!esOwner && !puedeReportarGastos')
    expect(pantalla).not.toMatch(/if \(!esOwner\) \{\s*\n\s*return \(/)
  })

  it('pero aprobar y rechazar siguen siendo del dueño', () => {
    expect(pantalla, 'el cobrador podría aprobarse su propio gasto').toMatch(/\{!esOwner \?/)
  })
})
