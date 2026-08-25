// lib/__tests__/tabla-se-manda-y-se-imprime.test.js
//
// ══ «SI LE DOY AL BOTÓN COMPARTIR TABLA NO HACE NADA» ══════════════════════
//
// Reportado el 25 ago 2026 con la captura, sobre `/prestamos/[id]/tabla`. Y era
// cierto EN ESCRITORIO: `navigator.share` no existe ahí, así que el botón caía
// al portapapeles y COPIABA EN SILENCIO. Un botón que copia sin decirlo es
// indistinguible de uno roto — la lección ya estaba escrita en el simulador
// («al portapapeles Y SE DICE») y esta pantalla no se enteró.
//
// ── Y LA SEGUNDA MITAD: «MIRA CÓMO SE VE CUANDO LE DOY IMPRIMIR» ───────────
//
// No había UNA SOLA regla de impresión en toda la app, así que `window.print()`
// imprimía la pantalla tal cual: la pastilla de navegación flotando encima del
// contenido, el botón «Imprimir» dibujado DENTRO del propio PDF, las tarjetas
// partidas entre página y página, y ni un nombre que dijera de quién era la
// tabla —porque el título lo pone el armazón, y el armazón tampoco se imprime—.
//
// ⚠ Nada de esto se ve leyendo el JSX. Salió generando el PDF de verdad con
//   `.auditoria/_ver-tabla-prestamo.mjs` y abriéndolo.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
const pagina = leer('app/(dashboard)/prestamos/[id]/tabla/page.jsx')
const css = leer('app/globals.css')

describe('⚠ «compartir tabla» hace algo, y se ve que lo hizo', () => {
  it('manda la tabla como imagen, igual que el simulador', () => {
    expect(pagina).toMatch(/import \{ compartirTablaImagen \} from '@\/lib\/simulacion-imagen'/)
    expect(pagina).toMatch(/compartirTablaImagen\(\{/)
  })

  it('⚠ y si no se puede, el portapapeles AVISA', () => {
    /* Es el fallo exacto que se reportó: copiaba y no decía nada. */
    const i = pagina.indexOf('onCompartir={')
    expect(i).toBeGreaterThan(-1)
    const bloque = pagina.slice(i, i + 2600)
    expect(bloque).toMatch(/navigator\.clipboard\.writeText\(datos\.textoParaCompartir\)/)
    expect(bloque, 'volvió a copiar en silencio').toMatch(/setAviso\('Copiado\./)
    expect(bloque).toMatch(/setAviso\('Este aparato no deja copiar ni compartir\.'\)/)
  })

  it('marca las cuotas ya pagadas', () => {
    /* Una tabla que va al cliente sin decir por dónde va es media tabla. */
    expect(pagina).toMatch(/pagada: pagadas\.get\(f\.numeroPeriodo\)/)
    const dibujo = leer('lib/simulacion-imagen.js')
    expect(dibujo).toMatch(/f\.pagada \? TINTA\.ink4 : TINTA\.ink/)
  })

  it('⚠ el aviso no se imprime', () => {
    const i = pagina.indexOf('{aviso && (')
    expect(i).toBeGreaterThan(-1)
    expect(pagina.slice(i, i + 220)).toMatch(/cf-no-print/)
  })
})

describe('⚠ lo que se imprime es un papel, no una captura de la app', () => {
  it('existe la hoja de impresión, y es una sola', () => {
    expect(css).toMatch(/@media print \{/)
    expect(css).toMatch(/\.cf-no-print,/)
    expect(css).toMatch(/nav\[data-imprimir="no"\]/)
  })

  it('el cromo lleva su marca', () => {
    expect(leer('components/armazon/PastillaNav.jsx')).toMatch(/data-imprimir="no"/)
    expect(leer('components/armazon/BarraLateral.jsx')).toMatch(/hidden lg:flex cf-no-print/)
    expect(leer('components/armazon/CabeceraMovil.jsx')).toMatch(/flex lg:hidden cf-no-print/)
  })

  it('los botones de acción NO salen dentro del PDF', () => {
    /* Un papel que se le manda al cliente con un botón «Imprimir» dibujado
       encima no es un papel. */
    const tabla = leer('components/pantallas/TablaAmortizacion.jsx')
    const i = tabla.indexOf('{conBarra && (')
    expect(i).toBeGreaterThan(-1)
    expect(tabla.slice(i, i + 260)).toMatch(/className="cf-no-print"/)
    const j = tabla.indexOf('onClick={onComparar}')
    expect(tabla.slice(j - 120, j + 120)).toMatch(/cf-no-print/)
  })

  it('⚠ el papel dice DE QUIÉN es', () => {
    /* El título lo pone el armazón y el armazón no se imprime: sin esto el PDF
       salía con doce tarjetas de cifras y ni un nombre. «Sin el nombre, una
       tabla compartida no se sabe a quién pertenece.» */
    expect(css).toMatch(/\.cf-solo-print \{ display: none; \}/)
    expect(css).toMatch(/\.cf-solo-print \{ display: block !important; \}/)
    const i = pagina.indexOf('cf-solo-print')
    expect(i, 'la tabla no tiene cabecera de papel').toBeGreaterThan(-1)
    expect(pagina.slice(i, i + 700)).toMatch(/\{datos\.subtitulo\}/)
  })

  it('una cuota no se parte entre dos páginas', () => {
    expect(css).toMatch(/\[data-tarjeta\] \{ break-inside: avoid/)
    expect(leer('components/pantallas/TablaAmortizacion.jsx')).toMatch(/data-tarjeta=""/)
  })

  it('los fondos se imprimen: las barras dicen cuánto se lleva pagado', () => {
    expect(css).toMatch(/print-color-adjust: exact/)
  })
})
