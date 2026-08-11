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

/** El `<span>` que termina en cierta posición, sin comentarios. */
const bloqueEn = (src, i) => {
  if (i < 0) return ''
  const abre = src.lastIndexOf('<span', i)
  return src.slice(abre, i)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
}

/** El bloque de un `<span>` que pinta cierta variable, sin comentarios. */
const bloqueDe = (src, marca) => bloqueEn(src, src.indexOf(marca))

describe('nada que identifique a alguien se corta', () => {
  it('el nombre en la parada de ruta, en TODAS las tarjetas que lo pintan', () => {
    /* Iba con `nowrap` + puntos suspensivos: salía «Carlos Prueb…». En una ruta
       de 143 clientes eso es tocar la puerta equivocada.

       ⚠ ESTA PRUEBA MEDÍA UN SOLO SITIO, y por la forma exacta de la línea:
       `indexOf('}}>{nombre}</span>')`. Dos consecuencias, las dos vistas ya:
       con la tarjeta compacta añadida, el «primero» pasó a ser el pequeño y la
       grande dejó de estar cubierta; y al ponerle al nombre la flecha de «abre
       la ficha» esa cadena dejó de existir y la prueba falló sin que nada
       estuviera mal.

       La regla no es una línea concreta: es que NINGUNA de las tarjetas corte
       el nombre. Así que se barren todas. */
    const sitios = [...tarjetaRuta.matchAll(/>\{nombre\}/g)]
    expect(sitios.length, 'la tarjeta de ruta ya no pinta el nombre').toBeGreaterThanOrEqual(2)
    for (const m of sitios) {
      const b = bloqueEn(tarjetaRuta, m.index)
      expect(b, 'volvió el recorte del nombre').not.toMatch(/textOverflow: 'ellipsis'/)
      expect(b).toMatch(/overflowWrap: 'anywhere'/)
    }
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

  it('ni en la TABLA de escritorio', () => {
    /* «ANGIE CAROLINA SOTO $4…» y «TONY WILSON ROMERO GA…». La regla del dueño
       no era de la ruta, era general: «la información se puede leer completa».
       En una tabla el precio es que la fila crece; esconder el nombre es peor. */
    expect(pClientes, 'volvió el recorte del nombre en la tabla').not.toMatch(/font-semibold truncate/)
    expect(pPrestamos, 'volvió el recorte del nombre en la tabla').not.toMatch(/font-semibold truncate/)
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

  it('⚠ «De hoy» es LA JORNADA, no una ventana de 24 horas', () => {
    /* Lo escribi primero a 24 horas y el dueño lo cuestiono. Tiene razon, y el
       motivo es de cuadre: TODO lo demas de esta app es un dia —caja, cierre,
       «recaudado hoy», «cobrar hoy»— y todos corren de 05:00Z a 05:00Z. Con una
       ventana movil, a las 9 de la mañana el filtro enseña desde las 9 de ayer:
       preguntas «cuantos prestamos salieron hoy», el filtro dice 7 y la caja
       dice 5 desembolsos. Dos numeros para lo mismo. */
    expect(pPrestamos).toMatch(/\{ value: 'nuevos',\s+label: 'De hoy' \}/)
    expect(apiPrestamos).toMatch(/soloNuevos && \{ createdAt: \{ gte: inicioDelDiaLocal\(/)
    expect(apiPrestamos, 'volvio la ventana de 24 horas')
      .not.toMatch(/soloNuevos && \{ createdAt: \{ gte: new Date\(Date\.now\(\)/)
  })

  it('y la frontera del dia sale de UN solo sitio', () => {
    /* Las dos lineas de convertir «ahora» al dia local estaban duplicadas en
       `/api/clientes` y a punto de duplicarse en `/api/prestamos`. En este
       proyecto las fechas duplicadas se separan: produccion corre en UTC y el
       desarrollo en Bogota, asi que un dia de diferencia no se ve hasta que
       esta desplegado. */
    const i18n = leer('lib/i18n.js')
    expect(i18n).toMatch(/export function inicioDelDiaLocal/)
    expect(apiClientes).toMatch(/gte: inicioDelDiaLocal\(/)
  })

  it('⚠ pero la PASTILLA de la tarjeta se queda en 24 horas', () => {
    /* Ahi manda el argumento original del dueño: uno metido a las 23:50 dejaria
       de ser nuevo diez minutos despues y otro de las 00:10 lo seria un dia
       entero. La pastilla dice «recien creado», el chip «entro en esta
       jornada»: dos preguntas distintas, y por eso el chip NO se llama «Nuevos». */
    const adaptador = leer('lib/adaptadores/clientes.js')
    expect(adaptador).toMatch(/transcurrido < 24 \* 60 \* 60 \* 1000/)
    expect(pPrestamos, 'el chip volvio a llamarse como la pastilla').not.toMatch(/label: 'Nuevos \(24h\)'/)
    expect(pClientes, 'el chip volvio a llamarse como la pastilla').not.toMatch(/label: 'Nuevos \(24h\)'/)
  })

  it('⚠ y «nuevos» no fuerza `activo`', () => {
    /* Un préstamo metido hace dos horas puede estar pendiente de aprobación, y
       ése es justo el que se busca al revisar lo que entró hoy. */
    expect(pPrestamos).toMatch(/const apiEstado = est === 'nuevos' \? '' :/)
  })

  it('en clientes: nuevos y con perdidos', () => {
    expect(pClientes).toMatch(/\{ value: 'nuevos',\s+label: 'De hoy'/)
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
