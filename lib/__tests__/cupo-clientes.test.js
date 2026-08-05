import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { PLANES_CONFIG, LIMITES_PLAN } from '@/lib/planes'

// ── EL CUPO DE CLIENTES POR CUENTA ──────────────────────────────────────────
//
// `clientesExtra` en Organization, igual que `cobradoresExtra` y `rutasExtra`:
// un cupo por encima del plan para casos puntuales.
//
// ⚠ LO QUE HACE FALTA VIGILAR es que se aplique en TODOS los sitios. Hay cinco
// que miran el límite y solo DOS bloquean de verdad —crear un cliente y la
// importación masiva—; los otros tres informan. Al primer barrido solo encontré
// los tres que informan, porque los dos que cortan tienen su propia lista
// (`LIMITES_PLAN`) en vez de leer `PLANES_CONFIG`.

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

const CREAR = 'app/api/clientes/route.js'
const IMPORTAR = 'app/api/carga-masiva/importar/route.js'
const LIMITES = 'lib/limites-plan.js'
const USO = 'app/api/plan/uso/route.js'

describe('los dos sitios que BLOQUEAN', () => {
  it.each([CREAR, IMPORTAR])('%s suma el cupo extra', (ruta) => {
    const src = leer(ruta)
    expect(src, 'no lee el cupo de la organización').toContain('clientesExtra: true')
    expect(src, 'no lo suma al límite').toMatch(/clientesExtra \?\? 0/)
  })

  it.each([CREAR, IMPORTAR])('%s lee el plan de la BASE, no del token', (ruta) => {
    // El plan del JWT no se refresca sin volver a entrar —está documentado en
    // este proyecto—, así que a quien acababa de subir de plan se le seguía
    // aplicando el viejo hasta cerrar sesión.
    const src = leer(ruta)
    expect(src, 'vuelve a fiarse del plan del token')
      .toMatch(/organization\.findUnique\(\{[\s\S]{0,200}select: \{ plan: true, clientesExtra: true \}/)
  })

  it('crear un cliente ya no nombra el plan del token en el error', () => {
    // Decía «Tu plan starter permite…» con el plan del JWT, que podía ser otro.
    const src = leer(CREAR)
    expect(src).not.toMatch(/Tu plan \$\{plan\} permite/)
  })
})

describe('los tres que INFORMAN', () => {
  it('lib/limites-plan suma el cupo', () => {
    const src = leer(LIMITES)
    expect(src).toContain('clientesExtra: true')
    expect(src).toMatch(/const limiteClientes = config\.maxClientes \+ \(org\.clientesExtra \|\| 0\)/)
    expect(src, 'el `excede` sigue comparando contra el tope del plan pelado')
      .not.toMatch(/clientes > config\.maxClientes/)
  })

  it('api/plan/uso devuelve el límite CON el cupo', () => {
    // Es lo que pinta la pantalla de plan: si devuelve el del plan pelado, el
    // usuario ve «113 de 100» aunque pueda crear hasta 150.
    const src = leer(USO)
    expect(src).toContain('clientesExtra: true')
    expect(src).toMatch(/const limiteClientes = config\.maxClientes \+ \(org\?\.clientesExtra \?\? 0\)/)
    expect(src).toContain('clientes:       { usado: clientes, limite: limiteClientes }')
  })

  it('el esquema tiene la columna con su valor por defecto', () => {
    // Sin `@default(0)` las filas viejas quedarían en null y `null + 100` es
    // NaN: el límite se volvería «no un número» para todos los que ya existen.
    const schema = leer('prisma/schema.prisma')
    expect(schema).toMatch(/clientesExtra\s+Int\s+@default\(0\)/)
  })
})

describe('lo que el bot promete y lo que el sistema da', () => {
  const bot = leer('lib/bot/prompts/contexto.js')

  it('coinciden en los cinco planes', () => {
    /* ⚠ AQUÍ ESTABA EL FALLO DE FONDO: el bot vendía el plan Inicial con 150
       clientes y el sistema cortaba en 100. Llevaba meses prometiendo un tope
       que la aplicación no daba — el cliente pagaba, llegaba a 100 y no podía
       registrar más.
       Salió de revisar por qué una cuenta con 113 clientes estaba bloqueada. */
    const delBot = {}
    for (const m of bot.matchAll(/nombre: '([^']+)',\s*precio: \d+, maxClientes: (\d+)/g)) {
      delBot[m[1]] = Number(m[2])
    }
    expect(Object.keys(delBot).length, 'no encuentro los planes del bot').toBe(5)

    const porNombre = {}
    for (const [, cfg] of Object.entries(PLANES_CONFIG)) porNombre[cfg.nombre] = cfg.maxClientes

    // El bot escribe «Basico» y «Profesional» sin tilde; se comparan por su
    // posición en la escalera, que es lo que de verdad importa.
    const escalera = ['starter', 'basic', 'growth', 'standard', 'professional']
    const delSistema = escalera.map((id) => PLANES_CONFIG[id].maxClientes)
    expect(Object.values(delBot), 'el bot promete topes que el sistema no da')
      .toEqual(delSistema)
  })

  it('el plan Inicial da 100, que es lo que se vende', () => {
    expect(PLANES_CONFIG.starter.maxClientes).toBe(100)
    expect(LIMITES_PLAN.starter).toBe(100)
    expect(bot).toContain("nombre: 'Inicial',      precio: 39000, maxClientes: 100")
  })
})

describe('el superadministrador puede cambiarlo', () => {
  const api = leer('app/api/admin/organizaciones/[id]/route.js')
  const pagina = leer('app/admin/organizaciones/[id]/page.jsx')

  it('existe la acción y valida el rango', () => {
    // Sin tope, un dedazo pone 500000 y el plan deja de significar nada.
    expect(api).toContain("if (accion === 'cambiarClientes')")
    expect(api).toMatch(/cantidad < 0 \|\| cantidad > 5000/)
  })

  it('queda registrado quién lo cambió', () => {
    // Es una concesión comercial: tiene que dejar rastro, como las otras.
    const i = api.indexOf("if (accion === 'cambiarClientes')")
    const bloque = api.slice(i, i + 900)
    expect(bloque).toContain('adminLog.create')
    expect(bloque).toContain("accion:         'cambiar_clientes'")
    expect(bloque, 'el registro no dice de cuánto a cuánto').toContain('${anterior} → ${cantidad}')
  })

  it('la pantalla tiene su tarjeta', () => {
    expect(pagina).toContain('Clientes extra')
    expect(pagina).toContain("ejecutarAccion('cambiarClientes'")
  })

  it('el contador de arriba también cuenta el cupo', () => {
    // Si no, a una cuenta con cupo le seguiría diciendo «113 / 100» aunque SÍ
    // pueda crear clientes. Es el mismo dato en dos sitios diciendo cosas
    // distintas.
    expect(pagina).toMatch(/limite\.clientes \+ \(org\.clientesExtra \?\? 0\)/)
  })
})
