// lib/__tests__/gestionar-los-pagos.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Tres cosas del 31 ago 2026 sobre «Gestionar los pagos», dentro del detalle de
// un préstamo. Las tres las dijo el dueño mirando la pantalla:
//
//   «Esas tarjetas quedaron con el diseño de la versión anterior, se ve que no
//    contrasta bien con lo nuevo que tenemos.»
//
//   «El botón compartir solamente saca la lista para imprimir. Si queremos
//    compartir un movimiento en específico, una transacción, a través de una
//    imagen o por WhatsApp, no deja. Si ahí dice compartir, compartir no es
//    solamente imprimir.»
//
//   «Han habido clientes que me dicen que dónde pueden borrar los pagos que han
//    quedado mal, para volverlos a hacer, y no lo encuentran fácilmente.»
//
// ⚠ TODO SE ANCLA EN JSX O EN LA EXPRESIÓN, NUNCA EN LA PROSA. Este repo guarda
// las citas de los clientes junto al código que las obedece, así que buscar
// «Compartir» a secas cae dentro de este mismo comentario y la prueba pasa
// mirándose el ombligo.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const raiz = resolve(__dirname, '../..')

/* ⚠ SE MIRA EL CÓDIGO, NO LOS COMENTARIOS.
 *
 * Tres de estas pruebas fallaron en su primera versión y las tres por lo mismo:
 * el comentario que explica el arreglo CITA el patrón viejo —«se pintaba con un
 * linear-gradient», «casa con bg-[rgba(59,130,246»— y la búsqueda lo encontraba
 * ahí. Es el mismo tropiezo que ya está fichado al revés: `indexOf('Te queda en
 * la mano')` caía en el comentario y la prueba pasaba mirándose el ombligo.
 *
 * Aquí pasa lo contrario y es peor: la prueba FALLA con el código correcto, y
 * el siguiente que la vea creerá que el arreglo se perdió. */
const quitarComentarios = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|\s)\/\/[^\n]*/g, '$1 ')

const pagina = quitarComentarios(readFileSync(resolve(raiz, 'app/(dashboard)/prestamos/[id]/page.jsx'), 'utf8'))
const vistas = quitarComentarios(readFileSync(resolve(raiz, 'components/prestamos/PrestamoDetalleViews.jsx'), 'utf8'))

/** El cuerpo de `PagoMiniCard` y solo el suyo: hasta la siguiente función. */
function cuerpoDeLaTarjeta() {
  const i = vistas.indexOf('export function PagoMiniCard(')
  expect(i).toBeGreaterThan(-1)
  const j = vistas.indexOf('\nexport function ', i + 10)
  return vistas.slice(i, j === -1 ? vistas.length : j)
}

describe('⚠ compartir tiene que compartir', () => {
  it('el recibo como imagen NO cuelga de que el cliente tenga teléfono', () => {
    /* EL FALLO EXACTO. El único botón que compartía iba dentro de
       `{cliente?.telefono && (…)}`, así que sin número quedaba solo «Imprimir»
       debajo de un botón que dice «Compartir». Son 588 clientes (7,5 %) y 495
       préstamos activos medidos en producción.

       Se comprueba por posición: `BotonCompartirRecibo` tiene que aparecer
       ANTES de la guarda del teléfono dentro del panel. */
    const i = pagina.indexOf('{comprobanteAbierto && (')
    expect(i).toBeGreaterThan(-1)
    const panel = pagina.slice(i, i + 2200)

    const imagen = panel.indexOf('<BotonCompartirRecibo')
    const guarda = panel.indexOf('{cliente?.telefono && (')
    expect(imagen).toBeGreaterThan(-1)
    expect(guarda).toBeGreaterThan(-1)
    expect(imagen).toBeLessThan(guarda)
  })

  it('el estado de cuenta tampoco: se arreglaron LAS DOS vías', () => {
    /* Arreglar la tarjeta y dejar la cabecera es exactamente cómo el fallo del
       comprobante se reportó tres veces seguidas. */
    const i = pagina.indexOf('label="Generar estado de cuenta"')
    expect(i).toBeGreaterThan(-1)
    const bloque = pagina.slice(Math.max(0, i - 1400), i)
    const compartir = bloque.lastIndexOf('<BotonCompartir tipo="historial"')
    const guarda = bloque.lastIndexOf('{cliente?.telefono && (')
    expect(compartir).toBeGreaterThan(-1)
    expect(compartir).toBeLessThan(guarda)
  })

  it('imprimir NO se perdió por el camino', () => {
    /* Un rediseño pierde funciones en silencio: lo nuevo se suma, no sustituye. */
    const i = pagina.indexOf('{comprobanteAbierto && (')
    const panel = pagina.slice(i, i + 2200)
    expect(panel).toMatch(/<BotonAbrirRecibo\s/)
    expect(panel).toMatch(/<BotonWhatsApp\s/)
  })

  it('el botón que abre el panel no se disfraza de alarma', () => {
    /* En la captura salía «⚠ Compartir» en ámbar dentro de un pago CORRECTO:
       era un avión de papel dorado que a 12px parece un triángulo de aviso. Y
       el dorado está reservado por canon a tres cosas, ninguna es compartir. */
    const i = pagina.indexOf('title="Compartir el recibo de este pago"')
    expect(i).toBeGreaterThan(-1)
    const boton = pagina.slice(Math.max(0, i - 700), i + 900)
    expect(boton).not.toMatch(/cf-gold/)
    expect(boton).not.toMatch(/245,197,24/)
    // el avión de papel de heroicons, que era el que se leía como aviso
    expect(boton).not.toMatch(/M12 19l9 2-9-18-9 18 9-2z/)
  })
})

describe('⚠ la tarjeta de un pago, según el canon', () => {
  it('no tiñe el fondo: la superficie es blanca', () => {
    /* `DESIGN.md`, regla 4: «El estado va en el acento, nunca en el fondo. La
       superficie de la tarjeta es SIEMPRE blanca.» Esta tarjeta se pintaba con
       un `linear-gradient` del color del tipo de pago — con quince pagos
       seguidos, quince rectángulos verdes. */
    const t = cuerpoDeLaTarjeta()
    expect(t).not.toMatch(/linear-gradient/)
    expect(t).toMatch(/background: 'var\(--cf-card\)'/)
  })

  it('el estado va en el anillo del icono y en la pastilla', () => {
    const t = cuerpoDeLaTarjeta()
    expect(t).toMatch(/border: `2px solid \$\{t\.color\}`/)
    expect(t).toMatch(/<Pastilla tono=\{t\.pastilla\}>/)
  })

  it('el monto NO se tiñe del color del tipo salvo que lleve signo', () => {
    /* Era el cuarto portador de color y el más ruidoso: una columna de quince
       cifras verdes donde la vista no encuentra ninguna. Solo recargo (+) y
       descuento (−) conservan color, porque ahí el color ES el signo. */
    const t = cuerpoDeLaTarjeta()
    expect(t).toMatch(/color: signo \? t\.color : 'var\(--cf-ink\)'/)
  })

  it('sigue enseñando todo lo que enseñaba', () => {
    /* Al sustituir un componente hay que listar qué hacía ADEMÁS de pintarse.
       Ésta es esa lista. */
    const t = cuerpoDeLaTarjeta()
    expect(t).toMatch(/pago\.cuotaNumero/)        // «Cuota 13»
    expect(t).toMatch(/isOffline/)                // el pago aún sin enviar
    expect(t).toMatch(/pago\.metodoPago/)         // efectivo / Nequi / Daviplata
    expect(t).toMatch(/<PlataformaIcon/)          // con el logo de la cuenta
    expect(t).toMatch(/pago\.nota/)               // la nota del cobrador
    expect(t).toMatch(/pago\.fotoUrl/)            // la foto de evidencia
    expect(t).toMatch(/\{children\}/)             // la fila de acciones
  })

  it('la fecha va sin el «de» que mete el ICU nuevo', () => {
    /* `month:'short'` escribe «6 de ago. de 2026»: dos preposiciones y una
       abreviatura, en una tarjeta donde el sitio se le quita al monto. */
    const i = vistas.indexOf('const fmtFecha =')
    expect(i).toBeGreaterThan(-1)
    /* ⚠ HASTA `fmtFechaCorta`, NI UN CARÁCTER MÁS. La función de al lado SÍ usa
       `month:'short'` —es otra cosa y otro sitio— y una ventana de 400
       caracteres se la tragaba entera. */
    const j = vistas.indexOf('const fmtFechaCorta', i)
    expect(j).toBeGreaterThan(i)
    const fn = vistas.slice(i, j)
    expect(fn).not.toMatch(/month: 'short'/)
    expect(fn).toMatch(/MESES_CORTOS\[f\.getMonth\(\)\]/)
  })

  it('no usa los rgba viejos que el apaño de la migración deja encendidos', () => {
    /* `globals.css` tiene una regla de la migración a claro que casa por
       SUBCADENA —`[class*="bg-[rgba(59,130,246"]`— y por tanto casa también con
       la variante `hover:`, pintándola con `!important` haya o no puntero
       encima. Por eso el botón de editar fecha salía con un recuadro azul
       encendido en las catorce tarjetas. Aquí se esquiva con tokens. */
    const i = pagina.indexOf('title="Editar fecha"')
    expect(i).toBeGreaterThan(-1)
    const boton = pagina.slice(Math.max(0, i - 900), i)
    expect(boton).not.toMatch(/bg-\[rgba\(/)
  })
})

describe('⚠ el pago mal hecho tiene que encontrarse', () => {
  it('hay un chip «Pagos» que abre la sección y lleva la vista', () => {
    /* Medido en el espejo con un préstamo activo de 14 pagos a 412×900:
       «Gestionar los pagos» caía a 1.676px —1,9 pantallas— y además llegaba
       cerrado. El chip lo pone a 361px, que son 0,4. */
    const i = pagina.indexOf("label: 'Pagos',")
    expect(i).toBeGreaterThan(-1)
    const chip = pagina.slice(i, i + 1500)
    expect(chip).toMatch(/setHistorialOpen\(true\)/)
    expect(chip).toMatch(/getElementById\('cf-historial-pagos'\)\?\.scrollIntoView/)
  })

  it('el chip solo sale si hay pagos que gestionar', () => {
    /* Un chip que abre una lista vacía es una puerta a una habitación sin nada. */
    const i = pagina.indexOf("label: 'Pagos',")
    const antes = pagina.slice(Math.max(0, i - 400), i)
    expect(antes).toMatch(/\.\.\.\(pagos\.length > 0 \? \[\{/)
  })

  it('y la fila de chips aparece aunque lo ÚNICO que haya sean pagos', () => {
    /* La fila colgaba de tres condiciones y ninguna miraba los pagos: en un
       préstamo ya saldado y sin teléfono, el chip no se habría pintado nunca. */
    const i = pagina.indexOf('<ChipsAccionesSecundarias')
    expect(i).toBeGreaterThan(-1)
    const guarda = pagina.slice(Math.max(0, i - 300), i)
    expect(guarda).toMatch(/pagos\.length > 0\) && \(/)
  })

  it('el cuarto chip no le come el rótulo a WhatsApp', () => {
    /* ⚠ TERCERA VEZ QUE ESTE RÓTULO SE QUEDA SIN SITIO.
       Ya se acortó «Enviar por WhatsApp» a «WhatsApp» porque salía «Enviar por
       Wh…», y al meter «Pagos» volvió a cortarse por debajo de 390px — 360 es
       de los anchos más comunes en Android. Medido en el espejo: cortado a 320
       y a 360, entero de 390 en adelante.

       No se arregla encogiendo la letra: se parte en dos por dos. Y no con
       `flex-wrap`, que dejaba «Pagos» solo y estirado en el segundo renglón. */
    const css = readFileSync(resolve(raiz, 'app/globals.css'), 'utf8')
    expect(css).toMatch(/\.cf-chips-acciones\s*\{[^}]*display:\s*grid/)
    expect(css).toMatch(/repeat\(var\(--cf-chips-n/)
    expect(css).toMatch(/@media \(max-width: 389px\)[\s\S]{0,200}repeat\(2, minmax\(0, 1fr\)\)/)

    /* ⚠ Y SOLO CUANDO SON CUATRO.
       La primera versión bajaba a dos columnas a bulto, y los casos de TRES
       chips —cliente sin WhatsApp, o préstamo todavía sin pagos— quedaban con
       dos arriba y uno abajo, con un hueco al lado que se lee como un botón que
       falta. Los reportó el dueño con dos capturas, una de cada caso.
       Medido después: 3 chips van en fila hasta en 320px. */
    expect(css).toMatch(/\.cf-chips-acciones\[data-n="4"\]/)
    expect(vistas).toMatch(/data-n=\{acciones\.length\}/)

    /* Y que el componente le pase de verdad el número de columnas: sin esto la
       rejilla se queda en las 3 de la variable de reserva y el cuarto chip cae
       a un renglón para él solo. */
    expect(vistas).toMatch(/className="cf-chips-acciones"/)
    expect(vistas).toMatch(/'--cf-chips-n': acciones\.length/)
  })

  it('la sección NO se movió: sigue después de la ficha', () => {
    /* Decisión del dueño el 31 ago: puerta arriba, lista donde estaba. Subirla
       empujaría hacia abajo la cifra que explica la pantalla. */
    /* `LE FALTA PAGAR` se pinta en otro componente, así que aquí no sirve de
       marca. La ficha se reconoce por su `onVerTodos`, que es el atajo que
       lleva a esta misma sección. */
    const historial = pagina.indexOf('id="cf-historial-pagos"')
    const chips = pagina.indexOf('<ChipsAccionesSecundarias')
    const ficha = pagina.indexOf('onVerTodos={')
    expect(chips).toBeGreaterThan(-1)
    expect(ficha).toBeGreaterThan(-1)
    expect(historial).toBeGreaterThan(chips)
    expect(historial).toBeGreaterThan(ficha)
  })
})
