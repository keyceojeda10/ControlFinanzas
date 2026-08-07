import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ── DOS COSAS QUE SALIERON MIRANDO LA RUTA ──────────────────────────────────
//
//   «los nombres de los clientes en las rutas no se pueden cortar con tres
//    puntos suspensivos […] si hay varios Carlos y lo que los diferencia es el
//    apellido, y el apellido sale cortado, es difícil identificarlos. Igual que
//    la dirección»
//
//   «no hay un filtro claro para los préstamos clavos […] tampoco hay un filtro
//    claro de nuevos préstamos […] hay otros filtros que no se entienden
//    claramente a qué se refieren»

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const tarjetaRuta  = leer('components/cf/ParadaDeCobro.jsx')
const hojaCobro    = leer('components/pantallas/AtajosCobro.jsx')
const metadatos    = leer('components/cf/Metadatos.jsx')
const pPrestamos   = leer('app/(dashboard)/prestamos/page.jsx')
const pClientes    = leer('app/(dashboard)/clientes/page.jsx')
const apiPrestamos = leer('app/api/prestamos/route.js')
const apiClientes  = leer('app/api/clientes/route.js')

/** El bloque de un `<span>` que pinta cierta variable, sin comentarios. */
const bloqueDe = (src, marca) => {
  const i = src.indexOf(marca)
  if (i < 0) return ''
  const abre = src.lastIndexOf('<span', i)
  return src.slice(abre, i)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
}

describe('nada que identifique a alguien se corta', () => {
  it('el nombre en la parada de ruta', () => {
    /* Iba con `nowrap` + puntos suspensivos: salía «Carlos Prueb…». En una ruta
       de 143 clientes eso es tocar la puerta equivocada. */
    const b = bloqueDe(tarjetaRuta, '}}>{nombre}</span>')
    expect(b, 'volvió el recorte del nombre').not.toMatch(/textOverflow: 'ellipsis'/)
    expect(b).toMatch(/overflowWrap: 'anywhere'/)
  })

  it('la dirección, que es a dónde hay que llegar', () => {
    const b = bloqueDe(tarjetaRuta, '}}>{donde}</span>')
    expect(b, 'volvió el recorte de la dirección').not.toMatch(/textOverflow: 'ellipsis'/)
    expect(b).toMatch(/overflowWrap: 'anywhere'/)
  })

  it('y la fila que la contiene envuelve, o no tendría a dónde bajar', () => {
    // La pastilla y la distancia son `flex: none` y se quedan arriba; lo que
    // baja de renglón es la dirección.
    const i = tarjetaRuta.indexOf('}}>{donde}</span>')
    expect(tarjetaRuta.slice(Math.max(0, i - 1400), i)).toMatch(/flexWrap: 'wrap', rowGap: 3/)
  })

  it('el nombre en la hoja de cobro', () => {
    const b = bloqueDe(hojaCobro, '}}>{nombre}</span>')
    expect(b).not.toMatch(/textOverflow: 'ellipsis'/)
    expect(b).toMatch(/overflowWrap: 'anywhere'/)
  })

  it('y la cédula, el teléfono y la ruta de las tarjetas', () => {
    /* «La información se puede leer completa, no puede salir cortada.» Media
       cédula no identifica a nadie, que es para lo único que existe esa línea. */
    const b = bloqueDe(metadatos, '}}>{children}</span>')
    expect(b).not.toMatch(/textOverflow: 'ellipsis'/)
    expect(b).toMatch(/overflowWrap: 'anywhere'/)
  })
})

describe('los dos filtros que no existían', () => {
  it('préstamos perdidos, en la fila de chips', () => {
    // En los chips y no dentro de «Más filtros»: un filtro que hay que buscar
    // es un filtro que no se usa. «O yo no lo he encontrado fácilmente.»
    expect(pPrestamos).toMatch(/\{ value: 'clavo',\s+label: 'Perdidos'/)
    expect(pPrestamos).toMatch(/if \(est === 'clavo'\) params\.set\('clavo', '1'\)/)
    expect(apiPrestamos).toMatch(/const soloClavos = searchParams\.get\('clavo'\) === '1'/)
    expect(apiPrestamos).toMatch(/\.\.\.\(soloClavos && \{ esClavo: true \}\)/)
  })

  it('préstamos nuevos: las ÚLTIMAS 24 HORAS, como la pastilla', () => {
    /* Dos definiciones distintas darían una lista filtrada con tarjetas sin
       pastilla y nadie sabría por qué. Y 24h y no «hoy»: uno metido a las 23:50
       dejaría de ser nuevo diez minutos después. */
    expect(pPrestamos).toMatch(/\{ value: 'nuevos',\s+label: 'Nuevos \(24h\)' \}/)
    expect(apiPrestamos).toMatch(/soloNuevos && \{ createdAt: \{ gte: new Date\(Date\.now\(\) - 24 \* 60 \* 60 \* 1000\) \} \}/)
  })

  it('⚠ y «nuevos» no fuerza `activo`', () => {
    /* Un préstamo metido hace dos horas puede estar pendiente de aprobación, y
       ése es justo el que se busca al revisar lo que entró hoy. */
    expect(pPrestamos).toMatch(/const apiEstado = est === 'nuevos' \? '' :/)
  })

  it('en clientes: nuevos y con perdidos', () => {
    expect(pClientes).toMatch(/\{ value: 'nuevos',\s+label: 'Nuevos \(24h\)'/)
    expect(pClientes).toMatch(/\{ value: 'clavo',\s+label: 'Con perdidos'/)
    expect(apiClientes).toMatch(/const soloNuevos = searchParams\.get\('nuevos'\) === '1'/)
    // Un clavo VIVO: uno perdido y ya cancelado es historia, no una alarma.
    expect(apiClientes).toMatch(/prestamos: \{ some: \{ esClavo: true, estado: 'activo' \} \}/)
  })

  it('⚠ y NO viajan como `estado`', () => {
    /* Mandarlos en `estado` daría un enum inválido y el endpoint devolvería la
       lista entera sin filtrar — que es peor que un error, porque parece que
       funciona. */
    expect(pClientes).toMatch(/if \(calculados\.estado === 'nuevos'\) params\.set\('nuevos', '1'\)/)
    expect(pClientes).toMatch(/else if \(calculados\.estado === 'clavo'\) params\.set\('clavo', '1'\)/)
  })

  it('⚠ y no se inventan un conteo', () => {
    /* La fila pinta los conteos desde `soloConteos`, que el endpoint calcula
       por ESTADO. Un «· 0» que no es cierto se lee como «no hay ninguno» y hace
       descartar el filtro sin probarlo. */
    expect(pClientes).toMatch(/sinConteo: true/)
    expect(pClientes).toMatch(/conteo: sinConteo \|\| !conteos \? undefined :/)
  })

  it('los dos filtran en SQL, así que la paginación sigue siendo cierta', () => {
    // La mora hay que calcularla en JS y por eso obliga a traer la cartera
    // entera; éstos son columnas.
    expect(apiClientes).toMatch(/if \(soloNuevos\) condiciones\.push/)
    expect(apiClientes).toMatch(/if \(soloConClavo\) condiciones\.push/)
  })
})

describe('los rótulos dicen lo que filtran', () => {
  it('el título pregunta y la opción responde entera', () => {
    // «Días de mora → Más de 7» obliga a completar la frase de cabeza.
    for (const src of [pPrestamos, pClientes]) {
      expect(src).toMatch(/titulo: 'Lleva atrasado'/)
      expect(src).toMatch(/nombre: 'Más de 7 días'/)
    }
  })

  it('sin tildes perdidas', () => {
    expect(pPrestamos, 'volvió «Dias de mora»').not.toMatch(/titulo: 'Dias de mora'/)
    expect(pPrestamos, 'volvió «Mas de»').not.toMatch(/nombre: 'Mas de/)
  })

  it('«nuevos o renovados» ya no choca con el chip de las 24 horas', () => {
    expect(pPrestamos).not.toMatch(/titulo: 'Nuevos o renovados'/)
    expect(pPrestamos).toMatch(/titulo: '¿Es una renovación\?'/)
  })

  it('«Cómo verlo» y «Cómo se ven» eran dos rótulos que sonaban igual', () => {
    for (const src of [pPrestamos, pClientes]) {
      expect(src).not.toMatch(/titulo: 'Cómo se ven'/)
      expect(src).toMatch(/titulo: 'Tamaño de la ficha'/)
    }
    expect(pPrestamos).not.toMatch(/titulo: 'Cómo verlo'/)
  })
})
