// Una cifra, un nombre, una definición.
//
// ══ POR QUE ════════════════════════════════════════════════════════════════
//
// Ninguna de las cifras de esta app estaba mal calculada por un error de
// aritmética. Estaban mal porque la MISMA pregunta se contestaba en varios
// sitios y cada respuesta fue divergiendo. El caso que mejor lo resume: la
// pantalla de analíticas mostraba «Ganancia neta» y «Utilidad neta», una
// debajo de la otra, y eran dos números distintos del mismo mes.
//
// Estas pruebas no comprueban que las definiciones sean buenas —eso no lo puede
// comprobar una máquina—. Comprueban que sean ÚNICAS, que estén completas, y
// que la interfaz no se invente rótulos por su cuenta.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEFINICIONES, UNIDAD, ALCANCE, explicar, rotulo, faltanExplicacion,
  ROTULOS_PROTEGIDOS, ROTULOS_PROHIBIDOS,
} from '../dinero/definiciones'

const RAIZ = process.cwd()
const CARPETAS = ['app', 'components']

function archivos(dir, acc = []) {
  let entradas
  try { entradas = readdirSync(dir) } catch { return acc }
  for (const nombre of entradas) {
    if (nombre === 'node_modules' || nombre === '.next' || nombre.startsWith('.')) continue
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) archivos(ruta, acc)
    else if (/\.(js|jsx)$/.test(nombre) && !/\.test\.jsx?$/.test(nombre)) acc.push(ruta)
  }
  return acc
}

const FUENTES = CARPETAS.flatMap((c) => archivos(join(RAIZ, c)))

/* Un comentario que MENCIONA un rótulo no lo está pintando — al revés, suele
   ser la nota que explica de dónde sale. Lo que se persigue es el texto que
   llega a la pantalla, así que las líneas de comentario se quitan antes de
   buscar. Sin esto la prueba señalaba archivos donde el rótulo solo aparecía
   dentro de una explicación. */
function sinComentarios(texto) {
  return texto
    .split('\n')
    .filter((l) => {
      const t = l.trimStart()
      // `{/* ... */}` es el comentario de JSX, y se me escapaba: señalaba
      // archivos donde el rótulo solo estaba en una nota al margen.
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*') && !t.startsWith('{/*')
    })
    .join('\n')
}

const CUERPO = new Map(FUENTES.map((r) => [r, sinComentarios(readFileSync(r, 'utf8'))]))

describe('la regla dura: dos cifras no pueden llamarse igual', () => {
  /* Es la que mata «Ganancia neta» vs «Utilidad neta». Si alguien añade una
     definición cuyo rótulo ya existe, esto se pone rojo antes de que llegue a
     una pantalla. */
  it('cada rótulo pertenece a una sola cifra', () => {
    const porRotulo = new Map()
    for (const [id, e] of Object.entries(DEFINICIONES)) {
      const lista = porRotulo.get(e.rotulo) ?? []
      lista.push(id)
      porRotulo.set(e.rotulo, lista)
    }
    const repetidos = [...porRotulo.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([r, ids]) => `«${r}» lo usan ${ids.join(' y ')}`)

    expect(repetidos).toEqual([])
  })

  it('y cada id tiene su rótulo, no vale dejarlo vacío', () => {
    const sinRotulo = Object.entries(DEFINICIONES)
      .filter(([, e]) => !e.rotulo?.trim())
      .map(([id]) => id)
    expect(sinRotulo).toEqual([])
  })
})

describe('toda cifra declara su unidad y su alcance', () => {
  /* Sin unidad, un porcentaje y unos pesos se pintan igual y se comparan entre
     sí. Sin alcance, una banda puede mezclar la caja de un cobrador con el
     capital de la organización — que es exactamente lo que hacía, con
     «Ajustes» absorbiendo la diferencia. */
  it('la unidad sale del conjunto cerrado', () => {
    const validas = Object.values(UNIDAD)
    const malas = Object.entries(DEFINICIONES)
      .filter(([, e]) => !validas.includes(e.unidad))
      .map(([id, e]) => `${id}: ${e.unidad}`)
    expect(malas).toEqual([])
  })

  it('el alcance también, y al menos uno', () => {
    const validos = Object.values(ALCANCE)
    const malas = []
    for (const [id, e] of Object.entries(DEFINICIONES)) {
      if (!Array.isArray(e.alcances) || e.alcances.length === 0) {
        malas.push(`${id}: sin alcances`)
        continue
      }
      for (const a of e.alcances) {
        if (!validos.includes(a)) malas.push(`${id}: alcance «${a}» no existe`)
      }
    }
    expect(malas).toEqual([])
  })

  it('un porcentaje nunca se define sobre filas de dinero sin decirlo', () => {
    // Un porcentaje sale de dividir dos cifras; su explicación tiene que
    // nombrar las dos, o no se puede reconstruir.
    const flojas = Object.entries(DEFINICIONES)
      .filter(([, e]) => e.unidad === UNIDAD.PORCENTAJE)
      .filter(([, e]) => !/÷|\/|sobre/i.test(e.formula))
      .map(([id]) => id)
    expect(flojas, 'la fórmula de un porcentaje tiene que enseñar la división').toEqual([])
  })
})

describe('la interfaz no se inventa nombres de dinero', () => {
  /* ── EL DISPOSITIVO ANTI-RECAÍDA ────────────────────────────────────────
     Mientras el rótulo se escriba a mano en la pantalla, nada impide que dos
     pantallas lo escriban distinto o que dos cifras lo compartan. La regla es
     que se pida con `rotulo(id)`.

     Arranca con los que ya costaron dinero, no con los 33: migrar la interfaz
     entera de golpe es la clase de cambio que rompe pantallas sin que nadie lo
     note. La lista crece. */
  it('encuentra archivos que revisar (si no, la prueba no prueba nada)', () => {
    expect(FUENTES.length).toBeGreaterThan(200)
  })

  it('los rótulos protegidos no aparecen escritos a mano', () => {
    const culpables = []
    for (const id of ROTULOS_PROTEGIDOS) {
      const texto = DEFINICIONES[id]?.rotulo
      expect(texto, `${id} está protegido pero no existe`).toBeTruthy()
      for (const [ruta, contenido] of CUERPO) {
        if (contenido.includes(texto)) {
          culpables.push(`${ruta.slice(RAIZ.length + 1)} escribe «${texto}» (usa rotulo('${id}'))`)
        }
      }
    }
    expect(culpables).toEqual([])
  })

  it('los rótulos prohibidos no vuelven, y cada uno dice por qué', () => {
    const culpables = []
    for (const [texto, motivo] of Object.entries(ROTULOS_PROHIBIDOS)) {
      expect(motivo.length, `«${texto}» prohibido sin motivo escrito`).toBeGreaterThan(30)
      for (const [ruta, contenido] of CUERPO) {
        if (contenido.includes(texto)) {
          culpables.push(`${ruta.slice(RAIZ.length + 1)}: «${texto}» — ${motivo}`)
        }
      }
    }
    expect(culpables).toEqual([])
  })
})

describe('las funciones del diccionario', () => {
  it('rotulo() devuelve el nombre, y null si no lo conoce', () => {
    expect(rotulo('capitalEnCalle')).toBe('Capital en la calle')
    expect(rotulo('cifra-que-no-existe')).toBeNull()
  })

  it('explicar() trae la definición entera con su id', () => {
    const e = explicar('gananciaMes')
    expect(e.id).toBe('gananciaMes')
    expect(e.unidad).toBe(UNIDAD.DINERO)
    expect(e.pregunta).toMatch(/\?/)
  })

  it('faltanExplicacion() señala las que no están', () => {
    expect(faltanExplicacion(['recaudo', 'inventada'])).toEqual(['inventada'])
  })
})

describe('las decisiones que costaron dinero quedan escritas', () => {
  /* Cada una de estas frases es un hallazgo medido contra producción. Que estén
     en el diccionario significa que se leen en la pantalla, no que haya que
     explicarlas por teléfono. */
  it('la ganancia es interés menos gastos, nunca recaudado menos gastos', () => {
    expect(DEFINICIONES.gananciaMes.universo).toMatch(/NUNCA «lo recaudado menos gastos»/i)
  })

  it('el capital en la calle no es lo que salió alguna vez', () => {
    expect(DEFINICIONES.capitalEnCalle.universo).toMatch(/NO es «cuánto he prestado alguna vez»/i)
  })

  it('a un cliente en mora no se le esconde por su estado', () => {
    expect(DEFINICIONES.clientesEnMora.universo).toMatch(/estado de un cliente moroso es literalmente/i)
  })

  it('la suma de las cuotas es un techo, no la meta del día', () => {
    expect(DEFINICIONES.sumaDeCuotas.universo).toMatch(/es un TECHO, NO la meta del día/i)
  })

  it('un gasto rechazado no baja la ganancia', () => {
    expect(DEFINICIONES.gastosMes.universo).toMatch(/rechazados NO cuentan/i)
  })
})
