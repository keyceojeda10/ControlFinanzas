import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── E03 · CUATRO BLOQUES QUE DECÍAN TRES COSAS ──────────────────────────────
//
// Debajo del historial de pagos había, uno detrás de otro:
//
//   1 · un banner ámbar con ✕: «Faltan solo 2 cuotas para completar»
//   2 · dos chips: «2 cuotas pagadas» · «Préstamo #2 con este cliente»
//   3 · una tarjeta «Cliente recurrente» que REPETÍA el chip palabra por palabra
//   4 · la línea de tiempo, con fondo crema que la hacía parecer otro aviso
//
// Medido en la ficha de FERNANDO (espejo): «Préstamo #2 con este cliente» salía
// DOS veces seguidas, y la cabecera ya decía «1 préstamo completado · cliente
// recurrente». Tres sitios para el mismo dato.
//
// Son tres cosas: cómo va, si va adelantado, y si es cliente repetido.

const pagina = readFileSync(resolve(process.cwd(), 'app/(dashboard)/prestamos/[id]/page.jsx'), 'utf8')
const vistas = readFileSync(resolve(process.cwd(), 'components/prestamos/PrestamoDetalleViews.jsx'), 'utf8')

describe('los tres bloques que sobraban ya no se montan', () => {
  // ⚠ SOBRE EL CÓDIGO, sin comentarios: el comentario que explica QUÉ se quitó
  // los nombra y la prueba se cazaría a sí misma. Es la enésima vez en este
  // proyecto — está anotado igual en `caja-cotejo.test.js`.
  const codigo = pagina
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')

  for (const bloque of ['AiTipBanner', 'StatsContextuales', 'ComparativoPrestamosCliente']) {
    it(`${bloque} no aparece en la ficha`, () => {
      expect(codigo, `volvió a montarse ${bloque}`).not.toContain(bloque)
    })
  }

  it('y su cálculo huérfano tampoco quedó', () => {
    // `generarStatsContextuales` alimentaba unos chips que ya nadie pinta.
    expect(codigo).not.toContain('generarStatsContextuales')
  })
})

describe('«Cómo va» absorbe lo que decían', () => {
  it('se llama Cómo va, no Línea de tiempo', () => {
    expect(vistas).toMatch(/>\s*Cómo va\s*</)
  })

  it('las cuotas van EN el medio de la línea, no en un chip suelto', () => {
    // Los días que faltan no dicen cuántos PAGOS faltan, que es lo que se
    // pregunta mirando esto.
    expect(vistas).toMatch(/\{cuotasPagadas \?\? 0\} de \{cuotasTotales\} cuotas/)
  })

  it('el cliente repetido se dice como lo diría un prestamista', () => {
    // «Es su tercer préstamo contigo · pagó los 2 anteriores», no
    // «Cliente recurrente · Préstamo #3».
    expect(vistas).toMatch(/Es su \{ORDINAL\[prestamoNumeroCliente\]/)
    expect(vistas).toMatch(/pagó \{prestamosCompletadosCliente === 1 \? 'el anterior'/)
  })

  it('pierde el fondo teñido: no es un aviso', () => {
    const bloque = vistas.slice(vistas.indexOf('export function TimelinePrestamo'))
    const apertura = bloque.slice(0, bloque.indexOf('</div>'))
    expect(apertura, 'volvió el degradado que la hacía parecer un banner')
      .toMatch(/background: 'var\(--cf-card\)', border: '1px solid var\(--cf-border\)'/)
  })
})

describe('el total de cuotas sale de la misma fuente que el cálculo', () => {
  it('usa obtenerDiasPorPeriodo, no una división que se parezca', () => {
    /* ⚠ Probé con `totalAPagar / cuotaDiaria` y en un préstamo real daba
       «2 de 5 cuotas» cuando eran 3: la última cuota no es igual que las demás.
       La cifra se veía plausible y estaba mal. La fórmula buena es la de
       `calcularPrestamo` (`lib/calculos.js:652`). */
    expect(pagina).toMatch(/Math\.ceil\(diasPlazo \/ obtenerDiasPorPeriodo\(frecuencia\)\)/)
    expect(pagina).toMatch(/import \{ obtenerDiasPorPeriodo \} from '@\/lib\/dinero\/calendario'/)
  })

  it('con tabla de amortización manda la tabla', () => {
    expect(pagina).toMatch(/cuotasAmortizacion\.length > 0\s*\n\s*\? cuotasAmortizacion\.length/)
  })
})

describe('al cobrador no se le borra el dato', () => {
  it('«Cómo va» es solo del dueño…', () => {
    expect(pagina).toMatch(/\{esOwner && estaActivo && fechaInicio && fechaFin && \(/)
  })

  it('…así que al cobrador se le sigue diciendo en la cabecera', () => {
    // Quitarlo de los dos sitios le habría borrado el dato en vez de moverlo.
    expect(pagina).toMatch(/statsCliente=\{!esOwner && statsCliente/)
  })
})
