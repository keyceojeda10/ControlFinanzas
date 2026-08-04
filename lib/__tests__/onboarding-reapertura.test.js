import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { debeReabrirse, motivoReapertura } from '@/lib/onboarding-reapertura'

const AHORA = new Date('2026-08-04T12:00:00Z').getTime()
const hace = (dias) => new Date(AHORA - dias * 86400000)

describe('a quién se le devuelve la guía', () => {
  it('a quien NUNCA ha cobrado nada', () => {
    // El caso más claro: 35 cuentas cargaron un préstamo, no llegaron a cobrar
    // y la guía se les apagó a los 14 días. Un préstamo sin cobros no es haber
    // arrancado: es haber probado el sistema una vez.
    expect(debeReabrirse({ onboardingStep: 99, clientes: 2, ultimoPago: null }, AHORA)).toBe(true)
  })

  it('a quien lleva más de un mes parado', () => {
    expect(debeReabrirse({ onboardingStep: 99, clientes: 3, ultimoPago: hace(45) }, AHORA)).toBe(true)
  })

  it('NO a quien está cobrando', () => {
    // 15 cuentas tienen pocos clientes pero cobran cada semana: negocios
    // pequeños que funcionan. Devolverles la guía sería decirles que no han
    // empezado cuando llevan meses.
    expect(debeReabrirse({ onboardingStep: 99, clientes: 3, ultimoPago: hace(5) }, AHORA)).toBe(false)
  })

  it('NO a quien tiene cartera de verdad, aunque esté parado', () => {
    // Con más de cinco clientes ya sabe usar el sistema, y lo que le pase no lo
    // arregla una lista de primeros pasos. Son 98 cuentas.
    expect(debeReabrirse({ onboardingStep: 99, clientes: 40, ultimoPago: hace(200) }, AHORA)).toBe(false)
    expect(debeReabrirse({ onboardingStep: 99, clientes: 40, ultimoPago: null }, AHORA)).toBe(false)
  })

  it('NO a quien ya la tiene abierta', () => {
    // Si no está cerrada no hay nada que reabrir; tocarla resetearía su avance.
    expect(debeReabrirse({ onboardingStep: 0, clientes: 1, ultimoPago: null }, AHORA)).toBe(false)
    expect(debeReabrirse({ onboardingStep: 50, clientes: 1, ultimoPago: null }, AHORA)).toBe(false)
  })

  it('el umbral es 30 días, no «hace tiempo»', () => {
    expect(debeReabrirse({ onboardingStep: 99, clientes: 1, ultimoPago: hace(29) }, AHORA)).toBe(false)
    expect(debeReabrirse({ onboardingStep: 99, clientes: 1, ultimoPago: hace(31) }, AHORA)).toBe(true)
  })

  it('cinco clientes se reabre, seis no', () => {
    expect(debeReabrirse({ onboardingStep: 99, clientes: 5, ultimoPago: null }, AHORA)).toBe(true)
    expect(debeReabrirse({ onboardingStep: 99, clientes: 6, ultimoPago: null }, AHORA)).toBe(false)
  })

  it('aguanta datos que faltan sin reventar', () => {
    expect(debeReabrirse(null, AHORA)).toBe(false)
    expect(debeReabrirse({}, AHORA)).toBe(false)
  })
})

describe('se dice POR QUÉ ha vuelto', () => {
  it('distingue «nunca cobró» de «se paró»', () => {
    // Reaparecer sin explicación se lee como un fallo —«esto ya lo hice»—.
    expect(motivoReapertura({ onboardingStep: 99, clientes: 1, ultimoPago: null }, AHORA).clave).toBe('sin_cobros')
    expect(motivoReapertura({ onboardingStep: 99, clientes: 1, ultimoPago: hace(60) }, AHORA).clave).toBe('parada')
  })

  it('sin reapertura no hay motivo que dar', () => {
    expect(motivoReapertura({ onboardingStep: 99, clientes: 40, ultimoPago: null }, AHORA)).toBeNull()
  })

  it('los dos textos hablan en castellano llano', () => {
    for (const c of [{ ultimoPago: null }, { ultimoPago: hace(60) }]) {
      const m = motivoReapertura({ onboardingStep: 99, clientes: 1, ...c }, AHORA)
      expect(m.texto.length).toBeGreaterThan(20)
      expect(m.texto).not.toMatch(/onboarding|step|null/i)
    }
  })
})

describe('las TRES puertas se abren a la vez', () => {
  const api = readFileSync(
    join(process.cwd(), 'app', 'api', 'onboarding', 'progreso', 'route.js'), 'utf8')

  it('la puerta del paso 99 consulta si hay que reabrir', () => {
    expect(api).toContain('debeReabrirse')
  })

  it('la regla de los 14 días NO vuelve a cerrar lo reabierto', () => {
    // Sin esto, la cuenta se reabre y se cierra en la MISMA petición: cumple
    // «>14 días» y «tiene un préstamo», que es justo por lo que se cerró.
    expect(api).toMatch(/if \(!reapertura && diasDesdeCreacion > 14\)/)
  })

  it('el auto-completar por core tampoco', () => {
    // Tercera puerta: una cuenta parada con 1 cliente, 1 préstamo y un pago de
    // hace meses cumple `coreCompleto`. Si no se excluye, se cierra otra vez.
    expect(api).toMatch(/if \(!reapertura && coreCompleto/)
  })

  it('al reabrir NO se lanza el asistente de bienvenida', () => {
    // Se reabre poniendo el paso en 0, y con paso 0 el wizard toma la pantalla
    // entera: le saldría «¿cómo prestas?» a alguien que lleva meses con la
    // cuenta abierta. Lo que vuelve es la LISTA, que se mira de reojo.
    expect(api).toMatch(/const showWizard = !reapertura &&/)
  })

  it('el motivo viaja hasta la respuesta', () => {
    expect(api).toMatch(/^\s+reapertura,$/m)
  })
})

describe('llega hasta la pantalla', () => {
  it('el hook lo guarda y lo expone', () => {
    const hook = readFileSync(join(process.cwd(), 'components', 'onboarding', 'useOnboarding.js'), 'utf8')
    expect(hook).toMatch(/setReapertura\(data\.reapertura \?\? null\)/)
    expect(hook).toMatch(/^\s+reapertura,$/m)
  })

  it('el checklist lo dice en su cabecera', () => {
    const cl = readFileSync(join(process.cwd(), 'components', 'onboarding', 'OnboardingChecklist.jsx'), 'utf8')
    expect(cl).toMatch(/reapertura = null/)
    expect(cl).toContain('Retomemos donde lo dejaste')
    expect(cl).toMatch(/reapertura\.texto/)
  })

  it('el dashboard se lo pasa', () => {
    const dash = readFileSync(join(process.cwd(), 'app', '(dashboard)', 'dashboard', 'page.jsx'), 'utf8')
    expect(dash).toMatch(/reapertura=\{onboarding\.reapertura\}/)
  })
})
