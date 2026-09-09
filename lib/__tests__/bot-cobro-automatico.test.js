import { describe, it, expect } from 'vitest'
import { sanitizar, detectarViolaciones } from '../bot-v2/sanitizador'

// Frase REAL que el bot le dijo a una lead en produccion (26 jul 2026) cuando ella
// pregunto "Es con debito automatico o debo transferir?":
//   "El cobro es automatico. Se debita de tu cuenta bancaria todos los meses el dia
//    que vence tu plan."
// Es FALSO: el sistema no debita la cuenta bancaria de nadie. Es la pregunta mas
// sensible del embudo, asi que no puede pasar el filtro.
//
// ⚠ ACTUALIZADO EL 9 SEP 2026. Aqui ponia que en Colombia se paga «por checkout
// cuando el prestamista decide», y eso dejo de ser toda la verdad el 1 sep: desde
// entonces el prestamista PUEDE dejar pagada su suscripcion sola cada mes (Wompi
// tokenizado, COBRO_RECURRENTE_ACTIVO=1 y el cron de las 13:00 corriendo en
// produccion). Son dos cosas distintas con el mismo nombre:
//   · cobrarle solo al DEUDOR del prestamista  → NO existe, se sigue filtrando
//   · pagar sola NUESTRA suscripcion           → SI existe, y tiene video (el 22)

const FRASE_REAL = 'El cobro es automatico. Se debita de tu cuenta bancaria todos los meses el dia que vence tu plan.'

describe('sanitizador: cobro automatico / debito de cuenta', () => {
  it('borra la frase real que dijo el bot', () => {
    const out = sanitizar(FRASE_REAL)
    expect(out.toLowerCase()).not.toContain('debita')
    expect(out.toLowerCase()).not.toContain('cuenta bancaria')
    expect(out.toLowerCase()).not.toMatch(/cobro es autom/)
  })

  it('la detecta como violacion (para poder medirla)', () => {
    expect(detectarViolaciones(FRASE_REAL)).toContain('cobro_automatico_inventado')
  })

  it('atrapa la variante con tilde', () => {
    const out = sanitizar('Se débita de su cuenta cada mes.')
    expect(out.toLowerCase()).not.toContain('débita')
    expect(detectarViolaciones('Se débita de su cuenta cada mes.')).toContain('cobro_automatico_inventado')
  })

  it('atrapa "pago automatico" y "descuento automatico"', () => {
    expect(detectarViolaciones('El pago es automatico cada mes.')).toContain('cobro_automatico_inventado')
    expect(detectarViolaciones('Hay descuento automatico de la tarjeta.')).toContain('cobro_automatico_inventado')
  })

  it('NO borra funciones reales que si son automaticas (calculo de cuotas/mora)', () => {
    const ok = 'El sistema calcula las cuotas y la mora automaticamente.'
    const out = sanitizar(ok)
    expect(out).toContain('calcula')
    expect(out.toLowerCase()).toContain('automatica')
    expect(detectarViolaciones(ok)).not.toContain('cobro_automatico_inventado')
  })

  it('no deja el mensaje vacio: cae al fallback', () => {
    const out = sanitizar('Se debita de tu cuenta.')
    expect(out.trim().length).toBeGreaterThan(0)
  })
})

describe('⚠ pero el cobro de NUESTRA suscripcion si existe, y el bot puede decirlo', () => {
  /* Encontrado el 9 sep enganchando el video de pagos: el filtro marcaba como
     alucinacion lo que la pantalla de planes ofrece con todas las letras («cada
     mes se cobra solo a tu tarjeta o a tu Nequi»). El bot contradecia al
     tutorial que acabamos de publicar. */
  const BUENA = 'Si quiere, deja su suscripcion pagada sola: el cobro es automatico cada mes.'

  it('el sanitizador ya no la marca ni la borra', () => {
    expect(detectarViolaciones(BUENA)).not.toContain('cobro_automatico_inventado')
    expect(sanitizar(BUENA).toLowerCase()).toContain('automatico')
  })

  it('y el validador tampoco, cuando quien pregunta YA es cliente', async () => {
    const { validar } = await import('../bot-v2/validador')
    expect(validar(BUENA, { yaRegistrado: true }).motivos).not.toContain('cobro_automatico')
  })

  it('⚠ con un lead que aun no se registra SIGUE siendo violacion dura', async () => {
    const { validar } = await import('../bot-v2/validador')
    const v = validar(BUENA, { yaRegistrado: false })
    expect(v.motivos).toContain('cobro_automatico')
    expect(v.duros).toContain('cobro_automatico')
  })

  it('⚠ y «se debita de tu cuenta bancaria» sigue siendo falso aunque nombre el plan', async () => {
    const { validar } = await import('../bot-v2/validador')
    // No se debita ninguna cuenta: se cobra al medio de pago que el cliente guardo.
    expect(validar(FRASE_REAL, { yaRegistrado: true }).motivos).toContain('cobro_automatico')
    expect(detectarViolaciones(FRASE_REAL)).toContain('cobro_automatico_inventado')
  })

  it('⚠ y prometerle al prestamista que le cobramos solo a SUS clientes, tampoco', async () => {
    const { validar } = await import('../bot-v2/validador')
    for (const t of ['El sistema le hace el cobro automatico a sus clientes cada semana.',
      'A su deudor se le debita la cuota de su cuenta.']) {
      expect(validar(t, { yaRegistrado: true }).motivos, t).toContain('cobro_automatico')
    }
  })
})
