// «Volver a mi cuenta»: desde la vista, sin contraseña ni PIN, porque ya eras tú.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { firmarPase } from '@/lib/pase-de-vista'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.vistaDe?.id) {
    return Response.json({ error: 'No estás viendo como nadie.' }, { status: 400 })
  }
  const pase = firmarPase({ tipo: 'volver', ownerId: session.user.vistaDe.id }, process.env.NEXTAUTH_SECRET)
  return Response.json({ pase, cobradorId: session.user.id })
}
