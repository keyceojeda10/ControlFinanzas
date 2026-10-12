// El seguimiento de ventas no se reprograma sin fin (12 oct 2026): ver
// `despuesDeAgotar` en lib/bot-v2/cadencia.js y los datos que lo justifican.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { despuesDeAgotar, DIAS_ULTIMO_TOQUE } from '@/lib/bot-v2/cadencia'

describe('despuesDeAgotar', () => {
  it('frío: se acaba al agotar', () => {
    expect(despuesDeAgotar({ intento: 2, maxIntentos: 2, temperatura: 20, plantilla: 'seguimiento_lead' })).toEqual({ estado: 'no_interesado', proximoEnDias: null })
  })
  it('caliente sin enlace: se acaba (descubrimiento y lead no responden al 3.º)', () => {
    for (const plantilla of ['seguimiento_descubrimiento', 'seguimiento_lead']) {
      expect(despuesDeAgotar({ intento: 3, maxIntentos: 3, temperatura: 80, plantilla })).toEqual({ estado: 'contactado', proximoEnDias: null })
    }
  })
  it('caliente con el enlace: UN toque más a los 14 días', () => {
    expect(despuesDeAgotar({ intento: 3, maxIntentos: 3, temperatura: 70, plantilla: 'seguimiento_postlink' })).toEqual({ estado: 'contactado', proximoEnDias: DIAS_ULTIMO_TOQUE })
  })
  it('ese toque extra es el último: la vuelta siguiente ya no se reprograma', () => {
    expect(despuesDeAgotar({ intento: 4, maxIntentos: 3, temperatura: 90, plantilla: 'seguimiento_postlink' }).proximoEnDias).toBeNull()
  })
  it('el envío usa la regla, no los +14 días a mano de antes', () => {
    const src = readFileSync('lib/bot-v2/sender.js', 'utf8')
    expect(src).toMatch(/const fin = despuesDeAgotar\(\{ intento, maxIntentos/)
    expect(src).not.toMatch(/estadoFinal === 'contactado' \? new Date\(Date\.now\(\) \+ 14 \* 24 \* 3600000\)/)
  })
})
