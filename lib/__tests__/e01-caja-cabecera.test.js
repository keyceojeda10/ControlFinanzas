import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── E01 · La cabecera de caja: de tres barras a una fila ────────────────────
//
// De la lámina: «periodo (5 chips) + selector de fecha nativo + pestañas (4).
// Unos 150px de cromo antes del saldo».
//
// Las pestañas son NAVEGACIÓN —qué sección de caja miras— y el periodo es un
// FILTRO. Se veían idénticos: dos carriles grises apilados.

const filtro = readFileSync(resolve(process.cwd(), 'components/caja/FiltroPeriodo.jsx'), 'utf8')
const pagina = readFileSync(resolve(process.cwd(), 'app/(dashboard)/caja/page.jsx'), 'utf8')

describe('el selector de periodo', () => {
  it('la pastilla dice el periodo Y la fecha', () => {
    // Estaban separados diciendo lo mismo: el chip «Hoy» y debajo un campo con
    // la fecha de hoy.
    expect(filtro, 'no hay rótulo de periodo').toMatch(/const rotulo = /)
    expect(filtro, 'no hay fecha junto al rótulo').toMatch(/const detalle = /)
    expect(filtro).toContain('fechaLarga(fecha)')
  })

  it('las flechas mueven el día', () => {
    // Mirar la caja de ayer es un toque, no abrir un calendario.
    expect(filtro).toContain('etiqueta="Día anterior"')
    expect(filtro).toContain('etiqueta="Día siguiente"')
  })

  it('la flecha del futuro va apagada', () => {
    // No hay futuro que mirar.
    expect(filtro).toMatch(/apagada=\{esHoy\}/)
  })

  it('las flechas SOLO salen en vista de un día', () => {
    // Con «últimos 7» puestos, ¿qué sería «el día anterior»? Correr la ventana
    // entera es otra cosa y nadie la pidió.
    expect(filtro).toMatch(/const flechasVisibles = modo === 'hoy' \|\| modo === 'ayer'/)
  })

  it('los periodos bajan a una hoja', () => {
    // Cinco chips permanentes para un control que se usa una vez al día no
    // valen la fila que ocupan.
    expect(filtro).toContain('<HojaInferior')
    expect(filtro).toContain('titulo="Qué días quieres ver"')
  })

  it('«este mes» es nuevo y va del día 1 a hoy', () => {
    // No el mes natural entero: eso incluiría días que aún no han pasado.
    expect(filtro).toContain("{ key: 'mes',   label: 'Este mes' }")
    expect(filtro).toMatch(/desde: primeroDelMes\(hoy\), hasta: hoy/)
  })
})

describe('el input de fecha nativo', () => {
  it('ya no está en la cabecera', () => {
    // «05/08/2026» con el iconito del navegador es lo único de la app que no se
    // diseñó: cambia de aspecto en cada sistema operativo.
    const i = filtro.indexOf('export default function FiltroPeriodo')
    const j = filtro.indexOf('<HojaInferior')
    const cabecera = filtro.slice(i, j)
    expect(cabecera, 'volvió el input nativo a la cabecera').not.toContain('type="date"')
  })

  it('pero sigue DENTRO de la hoja, para el rango', () => {
    // Ahí sí vale: es un selector de fecha completo y escribirlo a mano sería
    // mucho código para el camino menos usado.
    const j = filtro.indexOf('<HojaInferior')
    expect(filtro.slice(j), 'se perdió la forma de elegir un rango').toContain('type="date"')
  })
})

describe('el rango que se elige a mano', () => {
  it('un día elegido dos veces no es un rango', () => {
    expect(filtro).toMatch(/if \(d === h\) onChange\(\{ modo: 'hoy'/)
  })

  it('al revés se ordena solo', () => {
    // Elegir «del 10 al 5» devolvería una caja vacía sin decir por qué.
    expect(filtro).toMatch(/else if \(d > h\) onChange\(\{ modo: 'rango', fecha: null, desde: h, hasta: d \}\)/)
  })
})

describe('la fila de la cabecera', () => {
  it('pestañas y filtro en la misma línea en pantalla ancha', () => {
    expect(pagina).toContain('flex flex-col lg:flex-row lg:items-center')
  })

  it('en móvil el filtro baja debajo', () => {
    // Las cuatro pestañas ya ocupan el ancho; apretarlo todo en 393px haría la
    // pastilla ilegible.
    const i = pagina.indexOf('E01 · UNA FILA, NO TRES BARRAS')
    const bloque = pagina.slice(i, i + 900)
    expect(bloque).toContain('flex-col lg:flex-row')
  })

  it('los ids de pestaña no cambian', () => {
    // Viajan en la URL (?tab=…) y los lee el resto del archivo.
    for (const id of ['cobros', 'porruta', 'cuentas', 'cuadre']) {
      expect(pagina, `se perdió la pestaña «${id}»`).toContain(`id: '${id}'`)
    }
  })
})

describe('lo que NO se toca', () => {
  it('la aritmética de fechas sigue en UTC-5', () => {
    /* ⚠ El aviso del archivo es explícito: con 12 países en producción, cambiar
       esto sin medir contra datos reales es lo que ya salió mal antes. Este
       turno cambia la PIEL. */
    expect(filtro).toContain('Date.now() - 5 * 60 * 60 * 1000')
    expect(filtro).toContain('T12:00:00-05:00')
  })

  it('el contrato con la página no cambia', () => {
    // Sigue notificando { modo, fecha, desde, hasta }: por eso el resto de la
    // caja no se entera del rediseño.
    expect(filtro).toMatch(/onChange\(\{ modo: 'hoy', fecha: hoy, desde: null, hasta: null \}\)/)
    expect(filtro).toMatch(/onChange\(\{ modo: '7d', fecha: null, desde: restarDias\(hoy, 6\), hasta: hoy \}\)/)
  })
})
