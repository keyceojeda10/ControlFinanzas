// lib/__tests__/vigilante-errores.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// `/api/errores-cliente` guardaba cada pantalla rota en el registro de PM2 y
// ahí moría: ni pantalla, ni aviso, ni resumen. Medido el 18 ago 2026, esto era
// lo que la app sabía y nadie había leído nunca:
//
//     95  Cannot access 'tU' before initialization   (pantalla de rutas)
//     29  préstamo sin cuotasAmortizacion            (hoja de pago)
//     25  React #300                                 (ficha del préstamo)
//     16  onCerrarVisita is not defined              (cobros de hoy)
//
// 261 errores en 27 negocios, y NINGUNO lo reportó nadie. Las quejas llegaban
// por WhatsApp porque el sistema se enteraba antes que nosotros y no se lo
// contaba a nadie.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const guion = readFileSync(resolve(process.cwd(), 'scripts/vigilante-errores.sh'), 'utf8')

describe('⚠ el vigilante se puede ensayar sin molestar a nadie', () => {
  it('lo que se pasa por fuera manda sobre el `.env`', () => {
    /* La primera versión hacía `source .env` a secas, y eso PISA lo que uno
       pasa en la línea de órdenes. Probándolo con el token vacío para que
       imprimiera en pantalla, le mandó al dueño un Telegram de verdad con 261
       errores. Un guion de vigilancia que no se puede ensayar en seco se ensaya
       en la cara de alguien. */
    expect(guion).toMatch(/__tenia_tok/)
    expect(guion).toMatch(/TELEGRAM_BOT_TOKEN="\$__tok"/)
  })

  it('y hay una puerta explícita para el ensayo', () => {
    expect(guion).toMatch(/VIGILANTE_SECO/)
  })
})

describe('⚠ calla cuando no hay nada que decir', () => {
  it('sale sin mandar si el conteo es cero', () => {
    /* Un aviso que llega todos los días diciendo «cero» se vuelve ruido y a la
       semana nadie lo abre. Distinto del cero de la pantalla de caja, que el
       dueño abre cada mañana a propósito: esto interrumpe. */
    expect(guion).toMatch(/\[ "\$\{total:-0\}" -eq 0 \] && exit 0/)
  })
})

describe('⚠ los que se arreglan solos no tapan a los de verdad', () => {
  it('se cuentan aparte', () => {
    /* El «Loading chunk … failed» le sale a quien tiene la app abierta cuando
       desplegamos, y la pantalla se recupera sola —comprobado cortando un trozo
       a propósito: una recarga y vuelve con su contenido—. Mezclados, tapan: el
       7 de agosto fueron 13 de 13. Si el aviso dice «13 pantallas rotas» y doce
       eran parpadeos, a la tercera mañana nadie lo abre. */
    expect(guion).toMatch(/autocurados=/)
    expect(guion).toMatch(/se arreglaron solas al recargar/)
  })

  it('y si SOLO hubo parpadeos, no se molesta a nadie', () => {
    /* El conteo que decide si se manda es el de los graves, no el total. */
    expect(guion).toMatch(/total=\$\(printf '%s' "\$graves"/)
  })
})

describe('⚠ el aviso se lee de una pasada', () => {
  it('junta los trozos que no cargan en UNA línea', () => {
    /* Cada trozo lleva su número y su URL, así que el mismo problema salía en
       nueve renglones distintos. */
    expect(guion).toMatch(/Loading chunk \.\*\/Pantalla a medio cargar/)
  })

  it('acorta el de React, que traía su enlace de ayuda entero', () => {
    expect(guion).toMatch(/Minified React error #\(\[0-9\]\+\)\.\*\/React #/)
  })

  it('⚠ une lo que Safari y Chrome dicen distinto', () => {
    /* «Can't find variable: X» y «X is not defined» son EL MISMO fallo. Sin
       unirlos, 16 casos salían como 10 y 6 — y el de 6 se ve pequeño y se
       ignora. */
    /* ⚠ En el guion el reemplazo va con DOS barras (`\\1`) porque está dentro
       de comillas dobles de bash. Mi primera expresión buscaba una sola y
       fallaba con el código bien puesto. */
    expect(guion).toContain("s/Can't find variable: (.*)/")
    expect(guion).toContain('is not defined/')
  })

  it('y dice en cuántos NEGOCIOS, no solo cuántas veces', () => {
    /* 261 errores puede ser una persona con mala suerte o un fallo repartido.
       Son cosas distintas y se actúa distinto. */
    expect(guion).toMatch(/personas=/)
    expect(guion).toMatch(/en \$\{personas\} negocios/)
  })
})
