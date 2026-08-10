// Las fechas del comprobante NO pueden restar un día.
//
// ── POR QUÉ EXISTE ESTA PRUEBA ─────────────────────────────────────────────
//
// Un prestamista lo reportó con el comprobante en la mano: «me dice que inició
// el primero de julio y que termina el 30 de julio». En la base ese préstamo
// termina el **31**.
//
// La causa: `toLocaleDateString('es-CO', ...)` SIN `timeZone` usa la zona del
// TELÉFONO. Un `2026-07-31T00:00:00Z` visto desde Bogotá (UTC−5) es el 30 de
// julio a las 19:00, así que se imprimía un día antes.
//
// ⚠ `'es-CO'` NO fija la zona: el locale es el idioma y el formato, no el huso.
// Es lo que hace que el fallo sea invisible leyendo el código.
//
// Y no era un caso raro. Medido en producción:
//   · `Prestamo.fechaInicio`: 8.696 de 8.696 a las 05:00Z -> se veían BIEN
//   · `Prestamo.fechaFin`   : **7.418 de 8.696 (85%) a las 00:00Z** -> MAL
//
// Por eso él veía bien el inicio y mal el fin: son dos convenios distintos en
// la misma tabla. Ver [[fechas_un_solo_calendario]].

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatFechaCalendario, formatFechaCorta } from '../i18n'

const leer = (p) => readFileSync(join(process.cwd(), p), 'utf8')
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('una fecha de CALENDARIO se lee en su día', () => {
  it('el 31 de julio a las 00:00Z NO es el 30', () => {
    // El caso exacto del comprobante que reportó.
    expect(formatFechaCalendario('2026-07-31T00:00:00.000Z')).toContain('31')
    expect(formatFechaCalendario('2026-07-31T00:00:00.000Z')).not.toContain('30')
  })

  it('el convenio de las 05:00Z también cae en su día', () => {
    expect(formatFechaCalendario('2026-08-02T05:00:00.000Z')).toContain('2')
  })

  it('el último día del mes no se va al mes anterior', () => {
    // Es donde más se nota: un día de menos cambia también el mes.
    const f = formatFechaCalendario('2026-09-01T00:00:00.000Z')
    expect(f).toContain('1')
    expect(f).toMatch(/sept?/i)
  })

  it('⚠ forzar la zona del negocio NO sirve para estas fechas', () => {
    // Lo intenté primero y da el mismo día de menos: en Bogotá ese instante
    // ES el 30 a las 19:00. Queda escrito para no volver a intentarlo.
    expect(formatFechaCorta('2026-07-31T00:00:00.000Z')).toContain('30')
  })
})

describe('el comprobante fija la zona horaria', () => {
  const COMP = sinComentarios(leer('components/prestamos/FirmaDigital.jsx'))

  it('su `formatFecha` lee en UTC', () => {
    expect(COMP).toMatch(/timeZone: 'UTC'/)
  })

  it('el país sale de la sesión, no de un valor fijo', () => {
    /* Fijaba la línea ENTERA del `useAuth`, así que añadirle un campo más
       —`orgNombre`, para nombrar al acreedor en la pantalla de firma— la
       rompía sin que nada estuviera mal. Lo que importa es de dónde sale el
       país, no qué más se saque en la misma línea. */
    expect(COMP).toMatch(/country: paisSesion/)
    expect(COMP).toMatch(/timezone: tzSesion/)
    expect(COMP).toMatch(/= useAuth\(\)/)
    expect(COMP).toMatch(/generarComprobante\(prestamo, paisSesion, tzSesion\)/)
  })

  it('las tres fechas del comprobante van con zona', () => {
    // Inicio, fin y cada pago del historial.
    expect(COMP).toMatch(/formatFecha\(p\.fechaInicio, pais\)/)
    expect(COMP).toMatch(/formatFecha\(p\.fechaFin, pais\)/)
    // El PAGO es un instante: va en la zona del negocio, no en UTC.
    expect(COMP).toMatch(/formatFechaCorta\(pago\.fechaPago, pais, tz\)/)
  })
})

describe('las otras pantallas que pintan fechaFin', () => {
  it('usan el ayudante con zona, no `toLocaleDateString` pelado', () => {
    for (const p of [
      'components/prestamos/EditarPrestamo.jsx',
      'components/prestamos/ModificarPlazo.jsx',
    ]) {
      const t = sinComentarios(leer(p))
      expect(t, `${p} sigue formateando fechaFin sin zona`)
        .not.toMatch(/new Date\((resumen\.)?fechaFin[A-Za-z]*\)\.toLocaleDateString/)
      expect(t, `${p} no usa formatFechaCalendario`).toMatch(/formatFechaCalendario/)
    }
  })
})
