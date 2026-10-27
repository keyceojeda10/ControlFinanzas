import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// DETALLES-COBRADORES #11 (27 oct 2026): el + del cobrador traía «Capital»,
// «Pasar mi cartera» y «Mi plan», y con «Mi plan» podía llegar a pagar o
// suscribir el plan del dueño. Anclado en el JSX y en el código, sin comentarios.

const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const leer = (p) => sinComentarios(readFileSync(resolve(process.cwd(), p), 'utf8'))

describe('el menú del + según quién lo abre', () => {
  const m = leer('components/pantallas/MenuCrear.jsx')
  it('lo del dueño no sale al cobrador', () => {
    expect(m).toMatch(/\{!esCobrador && <Destino icono="miplata" nombre="Capital"/)
    expect(m).toMatch(/\{!esCobrador && <Destino icono="plan"\s+nombre="Mi plan"/)
    expect(m).toMatch(/\{!esCobrador && \(\s*<Accion icono="cartera" nombre="Pasar mi cartera"/)
  })
  it('lo que pide permiso, solo con el permiso', () => {
    expect(m).toMatch(/\{prestar && <Accion icono="prestar" nombre="Prestarle a alguien"/)
    expect(m).toMatch(/\{gasto && <Accion icono="gasto" nombre="Anotar un gasto" primera=\{!prestar\}/)
    expect(m).toMatch(/\{clienteNuevo && <Accion icono="cliente" nombre="Un cliente nuevo"/)
    // Un grupo sin filas no deja su rótulo solo.
    expect(m).toContain('].filter((g) => g.filas)')
  })
  it('lo de siempre sigue para todos', () => {
    for (const nombre of ['Registrar un pago', 'Escanear un QR']) expect(m).toMatch(new RegExp(`<Accion icono="\\w+" nombre="${nombre}"`))
    for (const nombre of ['Cobrar hoy', 'La caja']) expect(m).toMatch(new RegExp(`^\\s*<Destino icono="\\w+"\\s+nombre="${nombre}"`, 'm'))
  })
  it('el armazón le dice quién es, y la hoja de la cuenta tampoco ofrece el plan al cobrador', () => {
    const a = leer('components/armazon/Armazon.jsx')
    expect(a).toContain("const esCobrador = rol === 'cobrador'")
    expect(a).toContain('esCobrador={esCobrador}')
    expect(a).toContain('puede={puedeEnElMenu}')
    expect(a).toMatch(/onPlan=\{esCobrador \? undefined :/)
    expect(leer('components/armazon/HojaCuenta.jsx')).toMatch(/\{onPlan && \(\s*<FilaAcceso\s+nombre="Plan y pagos"/)
  })
})

describe('el plan lo maneja el dueño, también en el servidor', () => {
  for (const ruta of ['app/api/pagos/cancelar-suscripcion/route.js', 'app/api/pagos/crear-suscripcion/route.js']) {
    it(ruta, () => {
      const r = leer(ruta)
      const guarda = r.indexOf("if (session.user.rol !== 'owner') {")
      expect(guarda).toBeGreaterThan(0)
      // Antes de leer el cuerpo y de tocar MercadoPago.
      expect(guarda).toBeLessThan(r.indexOf('await req.json()'))
    })
  }
})

describe('«Cómo pagar tu plan» en la pantalla de vencida (catálogo del profe)', () => {
  it('junto a «Renovar mi plan», con su propio reproductor', () => {
    expect(leer('app/suscripcion-vencida/page.jsx')).toContain('<EnlaceProfeSuelto id="inicio-plan" junto="Renovar mi plan"')
    const e = leer('components/tutoriales/EnlaceProfeSuelto.jsx')
    expect(e).toContain("guardado.botonVisible === false) return null")
    expect(e).toContain("(video.para ?? []).includes(rol === 'cobrador' ? 'cobrador' : 'dueno')")
  })
  it('con el plan vencido se puede apuntar que se vio', () => {
    // Sin quitar comentarios: el middleware dice «/api/*» en uno de línea.
    const mw = readFileSync(resolve(process.cwd(), 'middleware.js'), 'utf8')
    expect(mw).toMatch(/const EXENTAS = \[[^\]]*\n\s*'\/api\/tutoriales'\]/)
  })
})
