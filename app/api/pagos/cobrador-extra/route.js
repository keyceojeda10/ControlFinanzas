// ⚠ RETIRADO el 24 sep 2026. Cobraba UNA vez por MercadoPago —también en
// Colombia, que paga por Wompi— y daba el cupo para siempre: nadie lo volvía a
// cobrar. Los cobradores y rutas adicionales ahora van con el plan y se
// compran en «Mi plan» (lib/adicionales.js). Se queda contestando en vez de
// borrarse: una pantalla vieja en caché que lo llame recibe a dónde ir, no un
// 404 mudo.
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Los cobradores y rutas adicionales ahora se agregan en Mi plan.', irA: '/configuracion/plan#adicionales' },
    { status: 410 }
  )
}
