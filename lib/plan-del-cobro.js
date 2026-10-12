import { PLANES_CONFIG } from '@/lib/planes'

/* EL PLAN QUE SE COBRA: el elegido, o el último pagado, o el suyo. Una sola
   regla: la usa el cobro y la usa la oferta del 35 % (lib/seguimiento/
   oferta-nequi.js), que tiene que caer sobre el MISMO plan o no aplica
   (`preferencialVigente` compara el plan). */
export function planDelCobro({ org, pagada = null, planElegido = null }) {
  const suyo = org?.planOriginal || org?.plan
  return planElegido && PLANES_CONFIG[planElegido] ? planElegido
    : pagada && PLANES_CONFIG[pagada.plan] ? pagada.plan
    : PLANES_CONFIG[suyo] ? suyo
    : null
}

