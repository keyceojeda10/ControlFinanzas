import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { etiquetaDispositivo } from '@/lib/dispositivo'

const src = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')

describe('el aparato', () => {
  it('iPhone con Safari y Android con Chrome', () => {
    expect(etiquetaDispositivo('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')).toBe('iPhone · Safari')
    expect(etiquetaDispositivo('Mozilla/5.0 (Linux; Android 13; SM-A135M) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36')).toBe('Android · Chrome')
    expect(etiquetaDispositivo('')).toBe('Desconocido')
  })
})

describe('el proveedor de la cuenta guardada', () => {
  const auth = src('lib/auth.js')
  it('existe, limita intentos y arma la sesión con la función compartida', () => {
    expect(auth).toMatch(/id: 'cuenta-guardada'/)
    expect(auth).toMatch(/loginLimiter\(`cg:\$\{credentials\?\.id\}`\)/)
    expect(auth).toMatch(/const userId = await abrirCuentaGuardada\(\{ id: credentials\?\.id, llave: credentials\?\.llave, pin: credentials\?\.pin \}\)/)
    expect(auth).toMatch(/return sesionDeUsuario\(usuario\)/)
  })
})

describe('las rutas', () => {
  it('guardar exige sesión y el PIN cuando el rol lo lleva', () => {
    const r = src('app/api/cuentas-guardadas/route.js')
    expect(r).toMatch(/if \(llevaPin\(session\.user\.rol\) && !pinValido\(body\?\.pin\)\)/)
    expect(r).toMatch(/crearCuentaGuardada\(\{ userId: session\.user\.id, rol: session\.user\.rol, pin: body\?\.pin, dispositivo: etiquetaDispositivo\(/)
  })
  it('la «x» sin sesión exige la llave', () => {
    expect(src('app/api/cuentas-guardadas/[id]/route.js')).toMatch(/quitarConLlave\(\{ id, llave: body\?\.llave \}\)/)
  })
  it('el dueño solo ve y corta los aparatos de SUS cobradores', () => {
    const r = src('app/api/cobradores/[id]/cuentas-guardadas/route.js')
    expect(r).toMatch(/session\.user\.rol !== 'owner'/)
    expect(r).toMatch(/where: \{ id, organizationId: session\.user\.organizationId, rol: 'cobrador' \}/)
  })

  // Tarea final ítem 5 (parte servidor): sin este corte, un aparato vencido
  // (que `abrirCuentaGuardada` ya rechazaría) seguía contando en la lista como
  // un teléfono vivo — «Teléfonos con su cuenta guardada» se llenaba de aparatos
  // fantasma. El límite es DIAS_VIGENCIA, no un 60 suelto que puede desincronizarse.
  it('las dos listas de aparatos solo cuentan los vigentes, con DIAS_VIGENCIA importado (no un 60 a pelo)', () => {
    const propia = src('app/api/cuentas-guardadas/route.js')
    expect(propia).toMatch(/import \{ crearCuentaGuardada, llevaPin, pinValido, DIAS_VIGENCIA \} from '@\/lib\/cuentas-guardadas'/)
    expect(propia).toMatch(/lastUsedAt: \{ gte: new Date\(Date\.now\(\) - DIAS_VIGENCIA \* 24 \* 60 \* 60 \* 1000\) \}/)
    expect(propia).not.toMatch(/60 \* 24 \* 60 \* 60 \* 1000/)

    const delCobrador = src('app/api/cobradores/[id]/cuentas-guardadas/route.js')
    expect(delCobrador).toMatch(/import \{ DIAS_VIGENCIA \} from '@\/lib\/cuentas-guardadas'/)
    expect(delCobrador).toMatch(/lastUsedAt: \{ gte: new Date\(Date\.now\(\) - DIAS_VIGENCIA \* 24 \* 60 \* 60 \* 1000\) \}/)
  })
})
