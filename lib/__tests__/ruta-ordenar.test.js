import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { moverParadaEnRuta } from '@/lib/adaptadores/ruta'

const C = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => ({ id, orden: i + 1 }))
const ids = (l) => l.map((x) => x.id).join('')

describe('reordenar VIENDO SOLO UNA PARTE de la ruta', () => {
  it('sin filtro se comporta como siempre', () => {
    expect(ids(moverParadaEnRuta(C, C, 0, 2))).toBe('bcadef')
  })

  it('con filtro NO se pierde a nadie', () => {
    // El fallo: la pantalla reordenaba `clientesFiltrados` y mandaba a guardar
    // ESA lista. El servidor pone ordenRuta 0,1,2… a los ids que recibe, así que
    // los que no salían conservaban números viejos que ahora chocan: la ruta
    // quedaba revuelta. Y basta con «Solo hoy», que está al lado de «Ordenar».
    const visibles = [C[0], C[2], C[4]]   // a, c, e
    for (const [d, h] of [[0, 2], [2, 0], [1, 2], [2, 1]]) {
      const r = moverParadaEnRuta(C, visibles, d, h)
      expect(r, `${d}→${h} perdió clientes`).toHaveLength(6)
      expect(new Set(r.map((x) => x.id)).size).toBe(6)
    }
  })

  it('el orden queda consecutivo y sin repetidos', () => {
    const r = moverParadaEnRuta(C, [C[0], C[2], C[4]], 0, 2)
    expect(r.map((x) => x.orden)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('bajando, la parada queda DESPUÉS del ancla', () => {
    // a baja hasta la posición de e → queda justo detrás de e.
    expect(ids(moverParadaEnRuta(C, [C[0], C[2], C[4]], 0, 2))).toBe('bcdeaf')
  })

  it('subiendo, queda ANTES del ancla', () => {
    expect(ids(moverParadaEnRuta(C, [C[0], C[2], C[4]], 2, 0))).toBe('eabcdf')
  })

  it('un índice imposible no toca nada', () => {
    const v = [C[0], C[2], C[4]]
    for (const [d, h] of [[-1, 1], [0, 9], [1, 1], [null, 2]]) {
      expect(moverParadaEnRuta(C, v, d, h)).toBe(C)
    }
  })
})

describe('lo que faltaba en la pantalla de ordenar', () => {
  const comp = readFileSync(join(process.cwd(), 'components', 'pantallas', 'RutaEditar.jsx'), 'utf8')
  const pag = readFileSync(join(process.cwd(), 'app', '(dashboard)', 'rutas', '[id]', 'page.jsx'), 'utf8')

  it('el número de posición se puede teclear', () => {
    // «Antes uno picaba en el número, colocaba el que quisiera y lo podía hacer.
    // Ya no se puede». Y arrastrar no sirve igual: mover el 30 al 2 en un
    // teléfono son treinta filas de scroll con el dedo puesto.
    expect(comp).toMatch(/onPosicion \? \(/)
    expect(comp).toMatch(/inputMode="numeric"/)
    expect(pag).toContain('onPosicion={reordenarPorNumero}')
  })

  it('la posición tecleada se valida contra el rango', () => {
    // Un campo que acepta el 99 en una ruta de 7 deja el orden en un estado
    // imposible y hace dudar de si se guardó.
    const bloque = comp.match(/onBlur=\{\(e\) => \{[\s\S]{0,420}/)[0]
    expect(bloque).toMatch(/n > paradas\.length/)
    expect(bloque).toMatch(/n < 1/)
  })

  it('se puede quitar un cliente de la ruta', () => {
    // No existía en ningún sitio: un cliente que se muda se queda en el
    // recorrido para siempre y el cobrador sigue pasando por su puerta.
    expect(comp).toMatch(/onQuitar && !activa/)
    expect(pag).toContain('onQuitar={quitarDeLaRuta}')
    expect(pag).toMatch(/method: 'DELETE'/)
  })

  it('quitar NO borra al cliente, solo lo saca del recorrido', () => {
    const h = pag.match(/const quitarDeLaRuta = useCallback\([\s\S]{0,900}/)[0]
    expect(h).toMatch(/confirm\(/)
    expect(h).toMatch(/su préstamo no se toca/)
  })

  it('el arrastre y el número usan el MISMO camino seguro', () => {
    // Si uno usara `moverParada` a secas volvería el fallo del filtro por esa vía.
    const usos = pag.match(/moverParadaEnRuta\(/g) ?? []
    expect(usos.length).toBeGreaterThanOrEqual(3)   // 2 arrastres + 1 por número
  })
})

describe('el pie de ordenar', () => {
  const comp = readFileSync(join(process.cwd(), 'components', 'pantallas', 'RutaEditar.jsx'), 'utf8')

  it('ya no hay un «Guardar» que nunca se enciende', () => {
    // El orden se guarda solo al soltar. El botón salía siempre apagado y se
    // reportó como roto — con razón: un control que nunca se enciende parece
    // averiado.
    // ⚠ SOBRE EL CODIGO, sin comentarios: el comentario que explica por que se
    // quito el boton lo NOMBRA, y la prueba se cazaba a si misma. Octava vez
    // esta sesion que la prosa dispara una asercion de texto.
    const codigo = comp
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(codigo).not.toContain('Guardar el orden')
  })

  it('en su sitio va el estado real', () => {
    expect(comp).toMatch(/\{estado \?\? 'El orden se guarda solo al soltar\.'\}/)
  })

  it('«Deshacer» se queda: arrastrar se falla', () => {
    expect(comp).toContain('>Deshacer</button>')
  })
})

describe('el ancho de «Ordenar»', () => {
  it('no se auto-aplica relleno lateral', () => {
    // Se sumaba al de la página: medido en el navegador, las filas salían a
    // 291px dentro de un contenedor de 333. Ahora 331 de 333.
    const comp = readFileSync(join(process.cwd(), 'components', 'pantallas', 'RutaEditar.jsx'), 'utf8')
    const scroll = comp.match(/flex: 1, minHeight: 0, overflowY: 'auto',[^\n]*/g) ?? []
    for (const l of scroll) expect(l).not.toMatch(/padding: '0 20px'/)
  })
})
