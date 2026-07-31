// lib/__tests__/hoja-whatsapp.test.js — el contrato de T11-01 con su pantalla.
//
// La regla del proyecto: la prueba comprueba el contrato con el COMPONENTE que
// consume, no el adaptador contra su propia aritmética. `Plantillas` espera
// `{ id, titulo, trozos:[{texto,dato}], resumen, faltan, libre }` y familias
// `{ id, etiqueta }`; si el adaptador deja de darle una de esas piezas, la hoja
// se pinta vacía y nada falla.

import { describe, it, expect } from 'vitest'
import {
  FAMILIAS, PLANTILLAS, rellena, comoTexto, huecosVacios,
  enlaceWhatsApp, preparaPlantilla,
} from '../adaptadores/plantillas'

const DATOS = {
  nombre: 'Steven Olmos',
  negocio: 'Prestamos Castro',
  medio: 'transferencia',
  cuota: '$20.000',
  saldo: '$460.000',
  atraso: '59 días de atraso',
  cuotasPagadas: '3 cuotas pagadas',
  proximoCobro: '2 de junio',
  portal: 'https://app.local/portal',
}

describe('las familias y las plantillas', () => {
  it('toda familia declarada tiene plantillas', () => {
    for (const f of FAMILIAS) {
      expect(PLANTILLAS[f.id], `familia ${f.id}`).toBeTruthy()
      expect(PLANTILLAS[f.id].length).toBeGreaterThan(0)
    }
  })

  it('toda familia ofrece la salida de escribir libre', () => {
    for (const f of FAMILIAS) {
      expect(PLANTILLAS[f.id].some((p) => p.libre), `familia ${f.id}`).toBe(true)
    }
  })

  it('ninguna plantilla lleva emojis', () => {
    // Regla del proyecto, y aquí importa el doble: el mensaje sale al chat del
    // cliente. Los de `whatsapp-plantillas.js` van llenos de 🙏 y 👋.
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u
    for (const [fam, lista] of Object.entries(PLANTILLAS)) {
      for (const p of lista) {
        expect(emoji.test(p.texto ?? ''), `${fam}/${p.id}`).toBe(false)
      }
    }
  })
})

describe('rellena devuelve trozos, no una cadena', () => {
  it('marca como dato lo que puso el sistema', () => {
    const trozos = rellena('Hola {nombre}, tu cuota es {cuota}.', DATOS)
    const datos = trozos.filter((t) => t.dato).map((t) => t.texto)
    expect(datos).toEqual(['Steven Olmos', '$20.000'])
    expect(comoTexto(trozos)).toBe('Hola Steven Olmos, tu cuota es $20.000.')
  })

  it('nunca deja un hueco crudo a la vista', () => {
    const trozos = rellena('Hola {nombre}, debes {saldo}.', { nombre: 'Ana' })
    expect(comoTexto(trozos)).not.toMatch(/\{/)
  })

  it('avisa de los huecos que quedaron sin llenar', () => {
    expect(huecosVacios('Hola {nombre}, debes {saldo}.', { nombre: 'Ana' })).toEqual(['saldo'])
  })
})

describe('preparaPlantilla, que es lo que la hoja pinta', () => {
  it('cada plantilla sale con las piezas que el componente lee', () => {
    for (const lista of Object.values(PLANTILLAS)) {
      for (const p of lista) {
        const lista1 = preparaPlantilla(p, DATOS)
        expect(lista1).toMatchObject({ id: expect.any(String), titulo: expect.any(String) })
        expect(Array.isArray(lista1.trozos)).toBe(true)
        expect(Array.isArray(lista1.faltan)).toBe(true)
        for (const t of lista1.trozos) expect(typeof t.texto).toBe('string')
      }
    }
  })

  it('con los datos completos no falta nada en cobro ni atraso', () => {
    for (const fam of ['cobro', 'atraso']) {
      for (const p of PLANTILLAS[fam].filter((x) => !x.libre)) {
        expect(preparaPlantilla(p, DATOS).faltan, `${fam}/${p.id}`).toEqual([])
      }
    }
  })

  it('la de mensaje libre no trae texto que enseñar', () => {
    const libre = PLANTILLAS.cobro.find((p) => p.libre)
    expect(preparaPlantilla(libre, DATOS).trozos).toEqual([])
  })
})

describe('el enlace', () => {
  it('sin teléfono devuelve null para poder apagar el botón', () => {
    expect(enlaceWhatsApp(null, 'hola')).toBe(null)
    expect(enlaceWhatsApp('123', 'hola')).toBe(null)
  })

  it('no añade un segundo indicativo al que ya lo trae', () => {
    expect(enlaceWhatsApp('573001234567', 'x')).toContain('wa.me/573001234567')
    expect(enlaceWhatsApp('3001234567', 'x')).toContain('wa.me/573001234567')
  })

  it('codifica el mensaje', () => {
    expect(enlaceWhatsApp('3001234567', 'Hola Ana, debes $20.000'))
      .toContain(encodeURIComponent('Hola Ana, debes $20.000'))
  })
})
