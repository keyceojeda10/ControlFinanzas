// ¿Toda accion que el sistema ESCRIBE tiene una frase que el dueño pueda leer?
//
// El fallo que arregla: `/actividad` cae al codigo crudo cuando la accion no
// esta en el mapa, asi que el dueño leia «registrar_aporte», «crear_socio» y
// «renovar_prestamo» en su historial. Y no eran tres — habia **33** sin nombre.
//
// La prueba de al lado (`activity-log.test.js`) comprueba una lista de DOCE
// escrita a mano, asi que estaba verde con esas 33 sueltas. Por eso esta no
// escribe ninguna lista: **saca las acciones del propio codigo** y exige que
// cada una tenga su frase. Añadir una accion nueva sin nombrarla pone esto rojo.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { ACCIONES } from '../activity-log-types'

const RAIZ = join(__dirname, '..', '..')

function archivosJs(dir, acc = []) {
  for (const nombre of readdirSync(dir)) {
    if (nombre === 'node_modules' || nombre === '.next' || nombre === '.git') continue
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) archivosJs(ruta, acc)
    else if (/\.(js|jsx)$/.test(nombre)) acc.push(ruta)
  }
  return acc
}

// ⚠ SOLO LAS QUE VAN A `/actividad`. Hay una SEGUNDA tabla, `adminLog`, con sus
// propios codigos (`cambiar_plan`, `suspender`, `pago_directo`, `demo_day`…):
// esas son del panel de superadmin, NO salen en `/actividad` y no pasan por
// `ACCIONES`. Meterlas aqui obligaria a inventarles frases que el dueño de un
// negocio no vera nunca.
//
// Como se separan las dos: `logActividad()` (lib/activity-log.js) es el UNICO
// sitio que escribe en `actividadLog`, asi que la accion cuenta si es argumento
// de esa llamada. Nada mas.
//
// ⚠ NO intentar atribuirlas por el `prisma.X.create` mas cercano: casi todas
// estas llamadas van sueltas dentro de un endpoint que ademas toca `prestamo` o
// `cliente`, asi que mirar el prisma de al lado las asigna a la tabla
// equivocada. Probado: detectaba 3 de 48 y la prueba pasaba en vacio.
function accionesDelCodigo() {
  const encontradas = new Set()
  for (const ruta of archivosJs(join(RAIZ, 'app')).concat(archivosJs(join(RAIZ, 'lib')))) {
    // El propio mapa y esta prueba no cuentan como usos.
    if (ruta.includes('activity-log-types') || ruta.includes('__tests__')) continue
    const texto = readFileSync(ruta, 'utf8')
    // Desde cada `logActividad(` hasta el final de su llamada.
    for (const inicio of [...texto.matchAll(/\blogActividad\s*\(/g)]) {
      const trozo = texto.slice(inicio.index, inicio.index + 600)
      // ⚠ LAS DOS RAMAS DEL TERNARIO. Hay acciones escritas asi:
      //   accion: esPendiente ? 'solicitar_prestamo' : 'crear_prestamo'
      // Leyendo solo la primera comilla se escapaba `solicitar_prestamo`, que
      // es justo la que no tenia frase. Se coge el valor entero y de ahi TODAS
      // las cadenas que aparezcan.
      const valor = /\baccion:\s*([^,\n]+)/.exec(trozo)
      if (!valor) continue
      for (const c of valor[1].matchAll(/'([a-z_]+)'/g)) encontradas.add(c[1])
    }
  }
  return [...encontradas].sort()
}

describe('las acciones del historial se leen en español', () => {
  it('toda accion que se escribe tiene su frase', () => {
    const usadas = accionesDelCodigo()
    // ⚠ PRIMERO: que el detector vea algo. Una version anterior atribuia las
    // acciones por el `prisma.` de al lado, encontraba 3 de 48 y pasaba en
    // verde con 33 sin nombre — el fallo que esta prueba existe para cazar.
    // Si un dia el filtro se pasa de listo, salta aqui y no en produccion.
    expect(usadas.length, 'el detector no encontro acciones: revisa el filtro').toBeGreaterThan(30)
    const sinNombre = usadas.filter((a) => !ACCIONES[a])
    expect(sinNombre, `Sin frase en lib/activity-log-types.js: ${sinNombre.join(', ')}`).toEqual([])
  })

  it('ninguna frase se parece a un codigo crudo', () => {
    // Un `label` con guion bajo significa que alguien copio el codigo en vez de
    // escribir la frase — que es justo lo que el dueño vio en pantalla.
    const crudas = Object.entries(ACCIONES)
      .filter(([, v]) => v.label.includes('_'))
      .map(([k]) => k)
    expect(crudas).toEqual([])
  })

  it('toda frase trae icono y color, que si no la fila sale vacia', () => {
    for (const [accion, v] of Object.entries(ACCIONES)) {
      expect(v.label, accion).toBeTruthy()
      expect(v.icon, accion).toBeTruthy()
      expect(v.color, accion).toBeTruthy()
    }
  })

  it('todo icono existe de verdad en la pantalla', () => {
    // Un icono con nombre inventado no se dibuja: circulo gris vacio otra vez.
    const pantalla = readFileSync(join(RAIZ, 'app', '(dashboard)', 'actividad', 'page.jsx'), 'utf8')
    const dibujados = new Set(
      [...pantalla.matchAll(/^\s{2}'?([a-z-]+)'?:\s*\(color\)/gm)].map((m) => m[1])
    )
    expect(dibujados.size).toBeGreaterThan(0) // si el formato cambia, que no pase en falso
    const inventados = [...new Set(Object.values(ACCIONES).map((v) => v.icon))]
      .filter((i) => !dibujados.has(i))
    expect(inventados, `Iconos que no existen: ${inventados.join(', ')}`).toEqual([])
  })
})
