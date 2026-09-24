// La «x» de la tarjeta en la pantalla de entrada: sin sesión, la llave prueba que es suya.
import { quitarConLlave } from '@/lib/cuentas-guardadas'

export async function DELETE(request, { params }) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const ok = await quitarConLlave({ id, llave: body?.llave })
  return Response.json({ ok })
}
