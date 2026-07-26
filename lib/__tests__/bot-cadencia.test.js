import { describe, it, expect } from 'vitest'
import { rachaSinRespuesta, reintentarEnVentana, MAX_RACHA_SIN_RESPUESTA, REINTENTO_EN_VENTANA_MS } from '../bot-v2/cadencia'

// La secuencia REAL que se midio en produccion (lead "Aldair", 26 jul 2026):
//   18:26 bot manda el link           (webhook agenda seguimiento a 2h)
//   20:31 bot "pudo registrarse?"     (sender.js agendaba otro a 1,5h)
//   22:30 bot otra pregunta           <- 3 mensajes en 4h SIN respuesta del lead
// El tope de racha corta el encadenamiento: tras 2 mensajes seguidos sin respuesta
// el siguiente seguimiento se espacia a dias, no a horas.

const bot = (t = 'x') => ({ rol: 'bot', texto: t })
const lead = (t = 'x') => ({ rol: 'lead', texto: t })

// Se usa la funcion REAL que decide la cadencia, no una replica.
const reintentaHoy = reintentarEnVentana

describe('rachaSinRespuesta', () => {
  it('cuenta los mensajes del bot al final sin respuesta en medio', () => {
    expect(rachaSinRespuesta([lead(), bot()])).toBe(1)
    expect(rachaSinRespuesta([lead(), bot(), bot()])).toBe(2)
    expect(rachaSinRespuesta([lead(), bot(), bot(), bot()])).toBe(3)
  })
  it('se reinicia cuando el lead contesta', () => {
    expect(rachaSinRespuesta([bot(), bot(), lead()])).toBe(0)
    expect(rachaSinRespuesta([bot(), bot(), lead(), bot()])).toBe(1)
  })
  it('historial vacio = 0', () => {
    expect(rachaSinRespuesta([])).toBe(0)
  })
})

describe('cadencia: no encadenar mensajes en la misma tarde', () => {
  it('tras el link (1 mensaje del bot) todavia puede haber UN seguimiento cercano', () => {
    const historial = [lead('ok'), bot('aqui el link')]
    expect(reintentaHoy(historial, true)).toBe(false) // racha 1+1=2 -> ya toca espaciar
  })

  it('la secuencia real que quemaba al lead se corta: el 3er mensaje NO va el mismo dia', () => {
    // link + "pudo registrarse?" sin respuesta del lead
    const historial = [lead('Aja como es la cosa'), bot('link'), bot('pudo registrarse?')]
    expect(reintentaHoy(historial, true)).toBe(false)
  })

  it('si el lead SI contesto, se puede seguir conversando el mismo dia', () => {
    const historial = [bot('link'), lead('si me registre')]
    expect(reintentaHoy(historial, true)).toBe(true) // racha 0+1=1 < 2
  })

  it('ventana cerrada nunca reintenta el mismo dia', () => {
    const historial = [bot('link'), lead('si')]
    expect(reintentaHoy(historial, false)).toBe(false)
  })
})
