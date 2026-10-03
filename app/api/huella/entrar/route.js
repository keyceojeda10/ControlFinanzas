// app/api/huella/entrar/route.js — entrar con huella o cara, SIN sesión.
// POST { paso: 'opciones' }                     → { opciones, sello }
// POST { paso: 'verificar', sello, respuesta }  → { pase }  (lo canjea el proveedor `huella`)
// La cuenta, en lib/huella.js.
import { loginLimiter } from '@/lib/rate-limit'
import { opcionesEntrar, verificarEntrada } from '@/lib/huella'

export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  if (body?.paso === 'opciones') return Response.json(await opcionesEntrar())
  if (body?.paso === 'verificar') {
    // El mismo tope que la contraseña: 5 intentos fallidos cada 15 min por dirección.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'sin-ip'
    const rl = loginLimiter(`huella:${ip}`)
    if (!rl.ok) return Response.json({ error: 'Demasiados intentos. Intenta en 15 minutos.' }, { status: 429 })
    const r = await verificarEntrada({ sello: body.sello, respuesta: body.respuesta })
    return r.error ? Response.json({ error: r.error }, { status: 400 }) : Response.json({ pase: r.pase })
  }
  return Response.json({ error: 'Paso no válido' }, { status: 400 })
}
