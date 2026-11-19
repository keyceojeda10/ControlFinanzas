import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PLANES_DEL_REGISTRO, PLANES_REGISTRO_SOLO, PLANES_REGISTRO_EQUIPO, PLANES_CONFIG } from '@/lib/planes'

// El registro de antes del 16 jul 2026, adaptado (18 nov): el plan se elige en
// el paso 1 y vale. Antes de esto el formulario mandaba un plan y el servidor
// lo tiraba: todos nacían en Inicial.

const api = readFileSync('app/api/auth/registro/route.js', 'utf8')

describe('el plan elegido al registrarse vale', () => {
  it('se ofrecen los cinco que se venden, en dos grupos, y ningún plan interno', () => {
    expect(PLANES_REGISTRO_SOLO).toEqual(['starter', 'basic'])
    expect(PLANES_REGISTRO_EQUIPO).toEqual(['growth', 'standard', 'professional'])
    for (const p of PLANES_REGISTRO_SOLO) expect(PLANES_CONFIG[p].maxUsuarios).toBe(1)
    for (const p of PLANES_REGISTRO_EQUIPO) expect(PLANES_CONFIG[p].maxUsuarios).toBeGreaterThan(1)
    expect(PLANES_DEL_REGISTRO).not.toContain('test')
  })

  it('el servidor lo guarda en el negocio y en la prueba; si no es válido, Inicial', () => {
    expect(api).toMatch(/const planElegido = PLANES_DEL_REGISTRO\.includes\(body\.plan\) \? body\.plan : null/)
    expect(api).toMatch(/const planInicial = planElegido \?\? 'starter'/)
    expect((api.match(/plan: +planInicial,/g) || []).length).toBe(2)
    expect(api).not.toMatch(/plan: +'starter',/)
  })

  it('y el asistente se entera para no volver a preguntarlo', () => {
    const progreso = readFileSync('app/api/onboarding/progreso/route.js', 'utf8')
    expect(progreso).toMatch(/planYaElegido: planElegidoAlRegistrarse\(org\?\.origenRegistro\)/)
    expect(readFileSync('app/(dashboard)/dashboard/page.jsx', 'utf8')).toMatch(/planYaElegido=\{onboarding\.planYaElegido\}/)
  })
})

import { presentacionDelPlan, INCLUYEN_TODOS, PLAN_POPULAR } from '@/lib/adaptadores/planes'

describe('cada plan se presenta como en julio, con lo que de verdad trae', () => {
  it('la frase de julio para quien empieza', () => {
    expect(presentacionDelPlan('starter').descripcion).toBe('Para carteras pequeñas. Ideal si estás empezando.')
    expect(presentacionDelPlan('professional').descripcion).toBe('Máxima capacidad y soporte prioritario.')
  })
  it('la lista sale de la configuración del plan', () => {
    expect(presentacionDelPlan('starter').incluye).toEqual(['Hasta 100 clientes', '1 ruta de cobro', 'Registro de pagos y préstamos', 'Recordatorios por WhatsApp'])
    // Lucas y los reportes, solo donde el plan los tiene.
    expect(presentacionDelPlan('starter').incluye.join(' ')).not.toMatch(/Lucas|Reportes/)
    expect(presentacionDelPlan('growth').incluye).toContain(`Asistente IA Lucas (${PLANES_CONFIG.growth.aiMensajesDia} consultas al día)`)
    expect(presentacionDelPlan('standard').incluye).toContain('Reportes avanzados')
  })
  it('Profesional lleva «Popular» y hay una lista común', () => {
    expect(PLAN_POPULAR).toBe('standard')
    expect(presentacionDelPlan('standard').popular).toBe(true)
    expect(INCLUYEN_TODOS).toContain('Funciona sin señal')
  })
})

describe('14 días gratis fijos para las cuentas nuevas (18 nov 2026)', () => {
  it('el registro da los 14 y deja el regalo ya dado', () => {
    expect(api).toMatch(/vencimiento\.setDate\(vencimiento\.getDate\(\) \+ DIAS_PRUEBA\)/)
    expect(api).toMatch(/await marcarPruebaSiete\(tx, org\.id\)\n\s+await darRegaloDesdeElRegistro\(tx, org\.id\)/)
  })
  it('y lo dice como en julio', () => {
    const form = readFileSync('app/registro/RegistroForm.jsx', 'utf8')
    expect(form).toMatch(/\{DIAS_PRUEBA\} días gratis · Sin tarjeta de crédito/)
    expect(form).not.toMatch(/DIAS_COBRO_PARA_REGALO/)
  })
})

import { pareceCorreo } from '@/lib/normalizar-email'

describe('el correo tiene que parecer un correo (18 nov 2026)', () => {
  it('lo que entró en producción no pasa; los correos de verdad sí', () => {
    expect(pareceCorreo('@andres.15')).toBe(false)
    expect(pareceCorreo('andres')).toBe(false)
    expect(pareceCorreo('andres@gmail')).toBe(false)
    expect(pareceCorreo('nombre@gmail.com')).toBe(true)
    expect(pareceCorreo(' nombre+prueba1@gmail.com ')).toBe(true)
    expect(pareceCorreo('ventas@prestamos.com.co')).toBe(true)
  })
  it('lo miran el formulario y el servidor', () => {
    expect(readFileSync('app/registro/RegistroForm.jsx', 'utf8')).toMatch(/if \(!pareceCorreo\(form\.email\)\)/)
    expect(api).toMatch(/if \(!pareceCorreo\(email\)\)/)
  })
})
