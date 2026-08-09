// lib/__tests__/acciones-clientes-cobradores.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Clientes es la pantalla más transversal de la app —192 negocios crearon
// clientes en dos meses, 95 los editaron, 90 los borraron— y aun así tenía una
// función ENTERA inalcanzable: los grupos de cobro. El modal estaba escrito,
// terminado, y `setModalGrupos` no lo llamaba nadie.
//
// Cobradores tiene el problema contrario: las acciones están a la vista pero
// SIN NOMBRE. Activar/suspender es una pastilla que parece una etiqueta de
// estado, editar y eliminar son dos iconos pelados, y enviar las credenciales
// vive dentro de un acordeón cerrado.
//
// Lo que se prueba aquí no es que exista un array —eso sería fijar la
// implementación—, sino la conducta: **que las frases con que la gente pide
// estas cosas encuentren algo en la pantalla donde se hacen**.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buscarAcciones } from '../acciones/registro.js'

const raiz = join(import.meta.dirname, '..', '..')
const leer = (p) => readFileSync(join(raiz, p), 'utf8')

/* Saca del código lo que la pantalla ofrece de verdad. Se lee el fuente como
 * texto —las pruebas corren en `node`, sin transformar JSX— y se reconstruye
 * la lista con la que trabajará el buscador en el navegador. */
function accionesDe(ruta) {
  const src = leer(ruta)
  const lista = []
  const re = /label: '([^']+)'[\s\S]{0,400}?sinonimos: \[([\s\S]*?)\]/g
  let m
  while ((m = re.exec(src))) {
    lista.push({
      id: m[1],
      label: m[1],
      sinonimos: [...m[2].matchAll(/'([^']+)'/g)].map((s) => s[1]),
    })
  }
  return lista
}

const PANTALLAS = {
  'clientes (lista)': 'app/(dashboard)/clientes/page.jsx',
  'clientes (ficha)': 'app/(dashboard)/clientes/[id]/page.jsx',
  'cobradores (lista)': 'app/(dashboard)/cobradores/page.jsx',
  'cobradores (ficha)': 'app/(dashboard)/cobradores/[id]/page.jsx',
}

describe('las cuatro pantallas ofrecen lo que esconden', () => {
  for (const [nombre, ruta] of Object.entries(PANTALLAS)) {
    it(`${nombre}: registra acciones y las muestra`, () => {
      const src = leer(ruta)
      // Registrar sin mostrar es lo mismo que no tener nada: la caja visible
      // es la que ve quien no sabe que hay un buscador.
      expect(src).toContain('RegistrarAcciones')
      expect(src).toContain('QueNecesitas')
      expect(accionesDe(ruta).length).toBeGreaterThan(2)
    })
  }
})

describe('la frase de quien pregunta encuentra la acción', () => {
  const caso = (ruta, frase, esperado) => {
    const r = buscarAcciones(accionesDe(ruta), frase)
    expect(r.length, `«${frase}» no encontró nada`).toBeGreaterThan(0)
    expect(r[0].label.toLowerCase()).toContain(esperado)
  }

  it('⚠ los grupos de cobro, que llevaban meses sin puerta', () => {
    caso(PANTALLAS['clientes (lista)'], 'quiero agrupar clientes', 'grupos')
    caso(PANTALLAS['clientes (lista)'], 'crear un grupo', 'grupos')
  })

  it('crear un cliente, dicho de cuatro maneras', () => {
    for (const f of ['nuevo cliente', 'quiero meter un cliente',
                     'como agrego un cliente', 'registrar cliente']) {
      caso(PANTALLAS['clientes (lista)'], f, 'crear un cliente')
    }
  })

  it('dejar de cobrarle a alguien sin borrarlo', () => {
    caso(PANTALLAS['clientes (ficha)'], 'quiero dejar de cobrarle', 'activar o desactivar')
  })

  it('⚠ «restringir al cobrador», la pregunta literal de WhatsApp', () => {
    caso(PANTALLAS['cobradores (ficha)'], 'como restringir al cobrador', 'permisos')
    caso(PANTALLAS['cobradores (ficha)'], 'que no pueda borrar', 'permisos')
  })

  it('el cobrador no puede entrar', () => {
    caso(PANTALLAS['cobradores (ficha)'], 'no puede entrar', 'contraseña')
  })

  it('el ranking, que hoy es solo un icono', () => {
    caso(PANTALLAS['cobradores (lista)'], 'quien cobra mas', 'ranking')
  })
})

describe('no se ofrece lo que no se puede ejecutar', () => {
  it('⚠ el portal del cliente NO se registra en la ficha', () => {
    // `togglePortal` y el PIN viven dentro de otro componente, con su propio
    // estado: desde fuera no se pueden llamar. Ofrecer un botón que no hace
    // nada es peor que no ofrecerlo.
    const acciones = accionesDe(PANTALLAS['clientes (ficha)'])
    const portal = acciones.find((a) => /portal/i.test(a.label))
    expect(portal).toBeUndefined()
  })

  it('cada acción tiene sinónimos: sin ellos no la encuentra nadie', () => {
    for (const ruta of Object.values(PANTALLAS)) {
      for (const a of accionesDe(ruta)) {
        expect(a.sinonimos.length, `«${a.label}» sin sinónimos`).toBeGreaterThan(1)
      }
    }
  })
})
