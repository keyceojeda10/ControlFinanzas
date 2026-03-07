// lib/email.js — Sistema de emails transaccionales con Resend

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = 'Control Finanzas <notificaciones@control-finanzas.com>'
const SOPORTE = 'soporte@control-finanzas.com'
const APP_URL = 'https://app.control-finanzas.com'

// ─── Utilidad para enviar emails ────────────────────────────────
export async function enviarEmail({ to, subject, html }) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
    })
    if (error) {
      console.error('[Email] Error enviando a', to, error)
      return { ok: false, error }
    }
    console.log('[Email] Enviado a', to, 'id:', data?.id)
    return { ok: true, id: data?.id }
  } catch (err) {
    console.error('[Email] Excepción enviando a', to, err)
    return { ok: false, error: err.message }
  }
}

// ─── Layout base ────────────────────────────────────────────────
const layout = (contenido) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
      <tr><td align="center" style="padding-bottom:12px;">
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="48" height="48" align="center" valign="middle" style="background:#f5c518;border-radius:8px;color:#0a0a0a;font-size:22px;font-weight:900;font-family:Arial,Helvetica,sans-serif;">CF</td>
        </tr></table>
      </td></tr>
      <tr><td align="center"><h1 style="color:#f5c518;font-size:20px;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Control Finanzas</h1></td></tr>
    </table>
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px;padding:28px;">
      ${contenido}
    </div>
    <div style="text-align:center;margin-top:24px;">
      <p style="color:#555;font-size:11px;margin:0;">
        ${SOPORTE} · <a href="${APP_URL}" style="color:#f5c518;text-decoration:none;">control-finanzas.com</a>
      </p>
    </div>
  </div>
</body>
</html>`

const boton = (texto, url) => `
<div style="text-align:center;margin-top:24px;">
  <a href="${url}" style="display:inline-block;background:#f5c518;color:#0a0a0a;font-weight:700;font-size:14px;padding:12px 28px;border-radius:12px;text-decoration:none;">
    ${texto}
  </a>
</div>`

const formatCOP = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

// ─── Templates ──────────────────────────────────────────────────

// 1. Bienvenida al registrarse
export function emailBienvenida({ nombre, email, nombreOrg, fechaVencimiento }) {
  const fechaFmt = new Date(fechaVencimiento).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
  return {
    subject: `Bienvenido a Control Finanzas, ${nombre}`,
    html: layout(`
      <h2 style="color:#fff;font-size:18px;margin:0 0 8px;">Bienvenido, ${nombre}</h2>
      <p style="color:#888;font-size:14px;margin:0 0 20px;">Tu cuenta ha sido creada exitosamente.</p>

      <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:16px;margin-bottom:16px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:#888;font-size:12px;padding:4px 0;">Organización</td><td style="color:#fff;font-size:14px;text-align:right;font-weight:600;">${nombreOrg}</td></tr>
          <tr><td style="color:#888;font-size:12px;padding:4px 0;">Email</td><td style="color:#fff;font-size:14px;text-align:right;">${email}</td></tr>
          <tr><td style="color:#888;font-size:12px;padding:4px 0;">Plan</td><td style="color:#f5c518;font-size:14px;text-align:right;font-weight:600;">Prueba gratuita (7 días)</td></tr>
          <tr><td style="color:#888;font-size:12px;padding:4px 0;">Vence</td><td style="color:#fff;font-size:14px;text-align:right;">${fechaFmt}</td></tr>
        </table>
      </div>

      <p style="color:#888;font-size:13px;margin:0;">Ingresa a la plataforma para comenzar a gestionar tu cartera de préstamos.</p>
      ${boton('Ir a Control Finanzas', APP_URL + '/login')}
    `),
  }
}

// 2. Pago aprobado
export function emailPagoAprobado({ nombre, plan, monto, fechaVencimiento }) {
  const fechaFmt = new Date(fechaVencimiento).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
  return {
    subject: 'Pago confirmado - Control Finanzas',
    html: layout(`
      <div style="text-align:center;margin-bottom:16px;">
        <div style="width:48px;height:48px;border-radius:50%;background:rgba(34,197,94,0.12);display:inline-flex;align-items:center;justify-content:center;">
          <span style="color:#22c55e;font-size:24px;">✓</span>
        </div>
      </div>
      <h2 style="color:#fff;font-size:18px;margin:0 0 8px;text-align:center;">Pago confirmado</h2>
      <p style="color:#888;font-size:14px;margin:0 0 20px;text-align:center;">Hola ${nombre}, tu pago ha sido procesado exitosamente.</p>

      <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:16px;margin-bottom:16px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:#888;font-size:12px;padding:4px 0;">Plan</td><td style="color:#f5c518;font-size:14px;text-align:right;font-weight:600;">${plan}</td></tr>
          <tr><td style="color:#888;font-size:12px;padding:4px 0;">Monto</td><td style="color:#22c55e;font-size:14px;text-align:right;font-weight:700;">${formatCOP(monto)}</td></tr>
          <tr><td style="color:#888;font-size:12px;padding:4px 0;">Vigente hasta</td><td style="color:#fff;font-size:14px;text-align:right;">${fechaFmt}</td></tr>
        </table>
      </div>

      <p style="color:#888;font-size:13px;margin:0;">Tu suscripción está activa. Disfruta de todas las funcionalidades de tu plan.</p>
      ${boton('Ir al dashboard', APP_URL + '/dashboard')}
    `),
  }
}

// 3. Pago fallido
export function emailPagoFallido({ nombre, plan, monto }) {
  return {
    subject: 'Pago no procesado - Control Finanzas',
    html: layout(`
      <div style="text-align:center;margin-bottom:16px;">
        <div style="width:48px;height:48px;border-radius:50%;background:rgba(239,68,68,0.12);display:inline-flex;align-items:center;justify-content:center;">
          <span style="color:#ef4444;font-size:24px;">✕</span>
        </div>
      </div>
      <h2 style="color:#fff;font-size:18px;margin:0 0 8px;text-align:center;">Pago no procesado</h2>
      <p style="color:#888;font-size:14px;margin:0 0 20px;text-align:center;">Hola ${nombre}, no pudimos procesar tu pago.</p>

      <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:16px;margin-bottom:16px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:#888;font-size:12px;padding:4px 0;">Plan</td><td style="color:#fff;font-size:14px;text-align:right;">${plan}</td></tr>
          <tr><td style="color:#888;font-size:12px;padding:4px 0;">Monto</td><td style="color:#fff;font-size:14px;text-align:right;">${formatCOP(monto)}</td></tr>
        </table>
      </div>

      <p style="color:#888;font-size:13px;margin:0 0 8px;">Puedes intentar de nuevo desde la configuración de tu cuenta o contactarnos si necesitas ayuda.</p>
      <p style="color:#888;font-size:13px;margin:0;">Soporte: <a href="mailto:${SOPORTE}" style="color:#f5c518;text-decoration:none;">${SOPORTE}</a></p>
      ${boton('Reintentar pago', APP_URL + '/configuracion/plan')}
    `),
  }
}

// 4. Aviso de vencimiento próximo
export function emailAvisoVencimiento({ nombre, plan, diasRestantes, fechaVencimiento }) {
  const fechaFmt = new Date(fechaVencimiento).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
  const urgente = diasRestantes <= 1
  return {
    subject: `Tu plan vence ${diasRestantes <= 1 ? 'mañana' : `en ${diasRestantes} días`} - Control Finanzas`,
    html: layout(`
      <div style="text-align:center;margin-bottom:16px;">
        <div style="width:48px;height:48px;border-radius:50%;background:rgba(245,197,24,0.12);display:inline-flex;align-items:center;justify-content:center;">
          <span style="color:#f5c518;font-size:24px;">⚠</span>
        </div>
      </div>
      <h2 style="color:#fff;font-size:18px;margin:0 0 8px;text-align:center;">Tu suscripción está por vencer</h2>
      <p style="color:#888;font-size:14px;margin:0 0 20px;text-align:center;">
        Hola ${nombre}, tu plan <strong style="color:#f5c518;">${plan}</strong> vence el <strong style="color:#fff;">${fechaFmt}</strong>.
      </p>

      ${urgente ? '<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:12px;margin-bottom:16px;text-align:center;"><p style="color:#ef4444;font-size:13px;font-weight:600;margin:0;">Tu acceso se suspenderá mañana si no renuevas.</p></div>' : ''}

      <p style="color:#888;font-size:13px;margin:0;">Renueva ahora para no perder acceso a tu cartera y datos.</p>
      ${boton('Renovar plan', APP_URL + '/configuracion/plan')}
    `),
  }
}

// 5. Reset de contraseña
export function emailResetPassword({ nombre, resetUrl }) {
  return {
    subject: 'Recuperar contraseña - Control Finanzas',
    html: layout(`
      <h2 style="color:#fff;font-size:18px;margin:0 0 8px;text-align:center;">Recuperar contraseña</h2>
      <p style="color:#888;font-size:14px;margin:0 0 20px;text-align:center;">
        Hola ${nombre}, recibimos una solicitud para restablecer tu contraseña.
      </p>

      <p style="color:#888;font-size:13px;margin:0 0 8px;">Haz clic en el botón para crear una nueva contraseña. Este enlace expira en 1 hora.</p>
      ${boton('Restablecer contraseña', resetUrl)}

      <p style="color:#555;font-size:12px;margin:20px 0 0;text-align:center;">
        Si no solicitaste este cambio, ignora este correo. Tu contraseña no será modificada.
      </p>
    `),
  }
}

// 6. Suscripción vencida
export function emailSuscripcionVencida({ nombre, plan }) {
  return {
    subject: 'Tu suscripción ha vencido - Control Finanzas',
    html: layout(`
      <div style="text-align:center;margin-bottom:16px;">
        <div style="width:48px;height:48px;border-radius:50%;background:rgba(239,68,68,0.12);display:inline-flex;align-items:center;justify-content:center;">
          <span style="color:#ef4444;font-size:24px;">⏰</span>
        </div>
      </div>
      <h2 style="color:#fff;font-size:18px;margin:0 0 8px;text-align:center;">Tu suscripción ha vencido</h2>
      <p style="color:#888;font-size:14px;margin:0 0 20px;text-align:center;">
        Hola ${nombre}, tu plan <strong style="color:#ef4444;">${plan}</strong> ha expirado. Tu acceso a la plataforma está suspendido.
      </p>

      <p style="color:#888;font-size:13px;margin:0 0 8px;">Tus datos están seguros. Renueva tu suscripción para recuperar el acceso completo.</p>
      <p style="color:#888;font-size:13px;margin:0;">¿Necesitas ayuda? <a href="mailto:${SOPORTE}" style="color:#f5c518;text-decoration:none;">${SOPORTE}</a></p>
      ${boton('Renovar ahora', APP_URL + '/configuracion/plan')}
    `),
  }
}
