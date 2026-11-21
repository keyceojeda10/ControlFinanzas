// 21 nov 2026, auditoría del crecimiento: «renovar» desde el panel no apuntaba el
// pago en el libro, y el «leído» de WhatsApp se cortaba como teléfono inválido.
import { describe, it, expect } from 'vitest'
import fs from 'fs'

const ruta = fs.readFileSync('app/api/admin/suscripciones/[id]/route.js', 'utf8')
const org = fs.readFileSync('app/admin/organizaciones/[id]/page.jsx', 'utf8')
const lista = fs.readFileSync('app/admin/suscripciones/page.jsx', 'utf8')
const wa = fs.readFileSync('lib/bot/whatsapp-cloud.js', 'utf8')

describe('renovar dice cuánto se cobró', () => {
  const bloque = ruta.slice(ruta.indexOf("if (accion === 'renovar') {"), ruta.indexOf("if (accion === 'extender') {"))
  it('sin el monto no renueva', () => {
    expect(bloque).toMatch(/if \(!Number\.isFinite\(cobrado\) \|\| cobrado < 0\) \{\n\s+return NextResponse\.json\(\{ error: 'Escribe cuánto te pagó \(0 si es una cortesía\)' \}, \{ status: 400 \}\)/)
  })
  it('lo cobrado va al libro dentro de la misma transacción; 0 es cortesía', () => {
    expect(bloque).toMatch(/await prisma\.\$transaction\(async \(tx\) => \{/)
    expect(bloque).toMatch(/if \(cobrado > 0\) \{\n\s+await registrarPagoSuscripcion\(tx, \{/)
    expect(bloque).toMatch(/gateway:\s+'manual'/)
    expect(bloque).toMatch(/'cortesía, sin pago'/)
  })
  it('las dos pantallas del panel mandan el monto', () => {
    expect(org).toMatch(/accionSuscripcion\(sub\.id, 'renovar', \{ dias, diaFijo, montoCobrado \}\)/)
    expect(lista).toMatch(/ejecutar\(s\.id, 'renovar', \{ montoCobrado: Number\(limpio\) \}\)/)
  })
})

describe('el «leído» de WhatsApp no pasa por el filtro de teléfonos', () => {
  const marcar = wa.slice(wa.indexOf('export async function markRead'), wa.indexOf('export async function markRead') + 700)
  it('va directo a Meta y no se apunta como envío', () => {
    expect(marcar).not.toMatch(/postMessage\(/)
    expect(marcar).toMatch(/body: JSON\.stringify\(\{ messaging_product: 'whatsapp', status: 'read', message_id: messageId \}\)/)
  })
})
