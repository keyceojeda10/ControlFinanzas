'use client'
/* ── «TU SEGUNDO MES A MITAD DE PRECIO» EN LA PANTALLA DEL PLAN (1 nov 2026) ──
 *
 * El bloque oscuro de la pantalla mientras dura la oferta del segundo mes
 * (lib/seguimiento/segundo-mes.js). La cifra es la que cobrará el servidor:
 * el mismo redondeo (`precioConOferta` = `precioConDescuento`).
 *
 * El botón abre la hoja de suscripción (Nequi o tarjeta). No cobra nada al
 * guardar si el plan está al día: el cobro con descuento sale al renovar, y
 * así lo dice la hoja.
 */

import { BLOQUE } from '@/components/cf/bloqueOscuro'
import { formatMoney } from '@/lib/i18n'
import { precioConOferta } from '@/lib/oferta-nequi-aviso'
import EnlaceProfeSuelto from '@/components/tutoriales/EnlaceProfeSuelto'

const fechaLarga = (d) => new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' })

export default function SegundoMesMitad({ plan, precioMes, pct, hasta, onActivar }) {
  const conDescuento = precioConOferta(precioMes, pct)
  return (
    <section aria-label="Tu segundo mes a mitad de precio" style={{
      background: BLOQUE.fondo, color: BLOQUE.tinta, borderRadius: 20,
      border: `1px solid ${BLOQUE.linea}`, padding: '22px 20px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <span style={{
        alignSelf: 'flex-start', height: 26, padding: '0 10px', borderRadius: 999,
        display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 800,
        background: 'rgba(47,190,106,.16)', color: BLOQUE.verde,
      }}>Solo por tu segundo mes</span>
      <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-.01em' }}>
        Tu segundo mes a mitad de precio
      </h2>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span className="cf-fig" style={{ fontSize: 44, color: BLOQUE.oro }}>{formatMoney(conDescuento)}</span>
        <span className="cf-fig" style={{ fontSize: 17, fontWeight: 500, color: BLOQUE.apagado, textDecoration: 'line-through' }}>{formatMoney(precioMes)}</span>
      </div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: BLOQUE.rotulo }}>
        Plan {plan}. Activa el cobro automático con tu Nequi o tu tarjeta antes del{' '}
        <strong style={{ color: BLOQUE.tinta }}>{fechaLarga(hasta)}</strong>. Pagando a mano, sin descuento.
        Desde el tercer mes, el precio normal.
      </p>
      <button type="button" onClick={onActivar} style={{
        marginTop: 4, height: 48, borderRadius: 12, border: 0, cursor: 'pointer', font: 'inherit',
        background: BLOQUE.tinta, color: BLOQUE.fondo, fontSize: 15, fontWeight: 800,
      }}>
        Activar cobro automático
      </button>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <EnlaceProfeSuelto id="inicio-plan" pregunta="¿Cómo se activa?" capitulo="Que se cobre solo"
          origen="/configuracion/plan" color={BLOQUE.oro} />
      </div>
    </section>
  )
}
