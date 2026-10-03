import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/* ENTRAR CON HUELLA O CARA (3 oct 2026). La firma del teléfono la revisa
 * @simplewebauthn/server (aquí simulada; la de verdad se prueba en el espejo con
 * un lector virtual). Lo que se prueba aquí es lo NUESTRO: qué reto vale, para
 * quién, y que una firma no sirva dos veces. */
process.env.NEXTAUTH_SECRET = 'secreto-de-prueba'
process.env.NEXTAUTH_URL = 'https://app.control-finanzas.com'

const llaves = []
vi.mock('@/lib/prisma', () => ({
  prisma: {
    llaveAcceso: {
      findMany: vi.fn(async ({ where }) => llaves.filter((l) => l.userId === where.userId)),
      findUnique: vi.fn(async ({ where }) => llaves.find((l) => l.credencialId === where.credencialId) ?? null),
      create: vi.fn(async ({ data }) => { const l = { id: `l${llaves.length + 1}`, ultimoReto: null, ...data }; llaves.push(l); return l }),
      updateMany: vi.fn(async ({ where, data }) => {
        const l = llaves.find((x) => x.id === where.id)
        if (!l || l.ultimoReto === data.ultimoReto) return { count: 0 }
        Object.assign(l, data); return { count: 1 }
      }),
    },
  },
}))
vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn(async (o) => ({ challenge: 'reto-activar-1', rp: { id: o.rpID }, authenticatorSelection: o.authenticatorSelection })),
  verifyRegistrationResponse: vi.fn(async () => ({ verified: true, registrationInfo: { credential: { id: 'cred-1', publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ['internal'] } } })),
  generateAuthenticationOptions: vi.fn(async () => ({ challenge: 'reto-entrar-1' })),
  verifyAuthenticationResponse: vi.fn(async () => ({ verified: true, authenticationInfo: { newCounter: 0 } })),
}))

const { opcionesActivar, guardarActivacion, opcionesEntrar, verificarEntrada, sitio } = await import('@/lib/huella')
const { leerPase, firmarPase } = await import('@/lib/pase-de-vista')
const { verifyAuthenticationResponse } = await import('@simplewebauthn/server')

beforeEach(() => { llaves.length = 0 })

describe('activar en este teléfono', () => {
  it('pide la llave DEL teléfono (huella, cara o patrón) y que verifique a la persona', async () => {
    const { opciones } = await opcionesActivar({ id: 'u1', email: 'a@b.co', nombre: 'Ana' })
    expect(opciones.rp.id).toBe('app.control-finanzas.com')
    expect(opciones.authenticatorSelection).toEqual({ authenticatorAttachment: 'platform', residentKey: 'required', userVerification: 'required' })
  })
  it('guarda la llave pública de quien la pidió, y de nadie más', async () => {
    const { sello } = await opcionesActivar({ id: 'u1', email: 'a@b.co' })
    expect((await guardarActivacion({ userId: 'u2', sello, respuesta: {} })).error).toBeTruthy()
    expect(llaves).toHaveLength(0)
    expect(await guardarActivacion({ userId: 'u1', sello, respuesta: {}, dispositivo: 'Android' })).toEqual({ ok: true })
    expect(llaves[0]).toMatchObject({ userId: 'u1', credencialId: 'cred-1', llavePublica: 'AQID', dispositivo: 'Android', transportes: 'internal' })
  })
})

describe('entrar', () => {
  const conLlave = () => llaves.push({ id: 'l1', userId: 'u1', credencialId: 'cred-1', llavePublica: 'AQID', contador: 0, transportes: 'internal', ultimoReto: null })

  it('con la firma buena devuelve un pase de «huella» para esa cuenta', async () => {
    conLlave()
    const { sello } = await opcionesEntrar()
    const r = await verificarEntrada({ sello, respuesta: { id: 'cred-1' } })
    expect(leerPase(r.pase, process.env.NEXTAUTH_SECRET)).toMatchObject({ tipo: 'huella', userId: 'u1' })
    // De quién es: el teléfono aprende DE QUÉ CUENTA es su huella.
    expect(r.userId).toBe('u1')
  })
  it('⚠ la misma firma NO sirve dos veces (muchos teléfonos no suben el contador)', async () => {
    conLlave()
    const { sello } = await opcionesEntrar()
    expect((await verificarEntrada({ sello, respuesta: { id: 'cred-1' } })).pase).toBeTruthy()
    expect((await verificarEntrada({ sello, respuesta: { id: 'cred-1' } })).error).toMatch(/ya se usó/)
  })
  it('un teléfono sin la huella activada no entra', async () => {
    const { sello } = await opcionesEntrar()
    expect((await verificarEntrada({ sello, respuesta: { id: 'otra' } })).error).toMatch(/no tiene la huella activada/)
  })
  it('un reto vencido, de otro tipo o falsificado no vale', async () => {
    conLlave()
    const viejo = firmarPase({ tipo: 'reto-entrar', reto: 'x' }, process.env.NEXTAUTH_SECRET, Date.now() - 10 * 60 * 1000)
    expect((await verificarEntrada({ sello: viejo, respuesta: { id: 'cred-1' } })).error).toBeTruthy()
    const deActivar = firmarPase({ tipo: 'reto-activar', reto: 'x', userId: 'u1' }, process.env.NEXTAUTH_SECRET)
    expect((await verificarEntrada({ sello: deActivar, respuesta: { id: 'cred-1' } })).error).toBeTruthy()
    expect((await verificarEntrada({ sello: 'inventado.firma', respuesta: { id: 'cred-1' } })).error).toBeTruthy()
  })
  it('si la firma del teléfono no cuadra, no entra', async () => {
    conLlave()
    verifyAuthenticationResponse.mockResolvedValueOnce({ verified: false })
    const { sello } = await opcionesEntrar()
    expect((await verificarEntrada({ sello, respuesta: { id: 'cred-1' } })).error).toBeTruthy()
  })
})

describe('las piezas alrededor', () => {
  const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
  it('el sitio sale de NEXTAUTH_URL', () => {
    expect(sitio()).toMatchObject({ rpID: 'app.control-finanzas.com', origin: 'https://app.control-finanzas.com' })
  })
  it('al cambiar la contraseña se quitan las huellas (la misma función de las 4 vías)', () => {
    expect(leer('lib/cuentas-guardadas.js')).toMatch(/await prisma\.llaveAcceso\.deleteMany\(\{ where: \{ userId \} \}\)/)
  })
  it('el proveedor `huella` arma la sesión con las mismas revisiones que la contraseña', () => {
    const auth = leer('lib/auth.js')
    expect(auth).toMatch(/id: 'huella',[\s\S]{0,700}if \(!p \|\| p\.tipo !== 'huella'\)[\s\S]{0,500}return sesionDeUsuario\(usuario\)/)
  })
  it('activar pide sesión y no vale en «Ver como»; quitar solo las propias', () => {
    const activar = leer('app/api/huella/activar/route.js')
    expect(activar).toMatch(/if \(session\.user\.soloLectura\)/)
    expect(leer('app/api/huella/route.js')).toMatch(/deleteMany\(\{ where: \{ id: String\(id \?\? ''\), userId: session\.user\.id \} \}\)/)
  })
})

/* ⚠ 3 oct 2026, en un teléfono de verdad: el botón salía aunque el teléfono no
   la hubiera activado y Android contestaba «No hay llaves de acceso
   disponibles». El dueño: «realmente no sirve». */
describe('el botón sale solo donde se activó, y la activación se ofrece al entrar', () => {
  const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
  const memoria = new Map()
  globalThis.localStorage = {
    getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
    setItem: (k, v) => memoria.set(k, String(v)),
    removeItem: (k) => memoria.delete(k),
  }

  it('se ofrece si no la tiene; no, si ya la tiene o dijo «Ahora no» hace menos de 30 días', async () => {
    const { tocaOfrecerHuella, noOfrecerHuellaPorAhora } = await import('@/lib/huella-cliente')
    memoria.clear()
    expect(tocaOfrecerHuella()).toBe(true)
    noOfrecerHuellaPorAhora(1_000)
    expect(tocaOfrecerHuella(1_000 + 29 * 86400000)).toBe(false)
    expect(tocaOfrecerHuella(1_000 + 31 * 86400000)).toBe(true)
    memoria.clear(); memoria.set('cf-huella', 'cred-1')
    expect(tocaOfrecerHuella()).toBe(false)
  })

  it('la pantalla de entrada: el botón solo con la huella de ESTE teléfono', () => {
    const login = leer('app/login/page.jsx')
    expect(login).toMatch(/useEffect\(\(\) => \{ if \(huellaDeEsteTelefono\(\)\) hayHuella\(\)\.then\(setPuedeHuella\) \}, \[\]\)/)
  })

  it('las cuatro salidas con éxito pasan por `alEntrar` (cuenta guardada, contraseña, PIN creado y su «Ahora no»)', () => {
    const login = leer('app/login/page.jsx')
    expect(login).toMatch(/await alEntrar\(cuenta\.rol === 'superadmin'/)
    expect(login).toMatch(/await guardarEsteTelefono\(\)\s*\}\s*await alEntrar\(url\)/)
    expect(login).toMatch(/await guardarEsteTelefono\(pin\)\s*await alEntrar\(destino\)/)
    expect(login).toMatch(/onClick=\{\(\) => alEntrar\(destino\)\}/)
    expect(login).toMatch(/modo === 'ofrecer-huella'/)
  })

  it('activar deja la marca en el teléfono; si el servidor ya no la tiene, se borra', () => {
    const cli = leer('lib/huella-cliente.js')
    expect(cli).toMatch(/ponerLocal\(AQUI, respuesta\.id\)/)
    expect(cli).toMatch(/if \(\/no tiene la huella activada\/\.test\(e\?\.message \?\? ''\)\) olvidarHuellaDeEsteTelefono\(\)/)
  })
})

/* ⚠ 3 oct 2026, segunda prueba del dueño: activó la huella, cerró sesión, tocó
   su tarjeta guardada y le pidió el PIN. La tarjeta no sabía de la huella. */
describe('la tarjeta guardada usa la huella de SU cuenta, y el PIN queda de respaldo', () => {
  const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
  it('la huella es de una cuenta: solo esa tarjeta la usa (por `userId`, que la tarjeta sí guarda)', async () => {
    const { huellaEsDe } = await import('@/lib/huella-cliente')
    const m = globalThis.localStorage
    m.removeItem('cf-huella'); m.removeItem('cf-huella-cuenta')
    expect(huellaEsDe('u-carlos')).toBe(false)
    m.setItem('cf-huella', 'cred-1'); m.setItem('cf-huella-cuenta', 'u-carlos')
    expect(huellaEsDe('u-carlos')).toBe(true)
    expect(huellaEsDe('u-superadmin')).toBe(false)
  })
  it('tocar la tarjeta pide la huella si es suya; si se cancela o falla, el PIN', () => {
    const login = leer('app/login/page.jsx')
    expect(login).toMatch(/function tocarCuenta\(cuenta\) \{[\s\S]{0,400}if \(huellaEsDe\(cuenta\.userId\)\) \{\s*entrarConHuella\(\{\s*alFallar:/)
    expect(login).toMatch(/if \(cuenta\.conPin\) \{ setCuentaPin\(cuenta\); setModo\('pin'\)/)
  })
  it('el teléfono recuerda la cuenta al activar y al entrar', () => {
    const cli = leer('lib/huella-cliente.js')
    expect(cli.match(/recordarCuenta\((d\.)?userId\)/g)).toHaveLength(2)
  })
})
