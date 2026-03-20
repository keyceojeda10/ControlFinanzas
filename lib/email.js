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
      <tr><td align="center">
        <img src="https://app.control-finanzas.com/Logo_CF_Mail2.png" width="200" alt="Control Finanzas" style="display:block;height:auto;margin:0 auto;" />
      </td></tr>
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

// 0. Verificación de email — se envía justo al registrarse
export function emailVerificacion({ nombre, link }) {
  return {
    subject: 'Confirma tu correo - Control Finanzas',
    html: layout(`
      <div style="text-align:center;margin-bottom:16px;">
        <div style="width:56px;height:56px;border-radius:50%;background:rgba(245,197,24,0.1);border:2px solid rgba(245,197,24,0.2);display:inline-block;text-align:center;line-height:56px;">
          <span style="font-size:28px;">📧</span>
        </div>
      </div>
      <h2 style="color:#fff;font-size:18px;margin:0 0 8px;text-align:center;">Hola ${nombre}, confirma tu correo</h2>
      <p style="color:#888;font-size:14px;margin:0 0 20px;text-align:center;">
        Para activar tu cuenta en Control Finanzas haz clic en el botón de abajo. El link expira en <strong style="color:#f5c518;">24 horas</strong>.
      </p>
      ${boton('Verificar mi correo', link)}
      <p style="color:#555;font-size:12px;margin:20px 0 0;text-align:center;">
        Si no creaste esta cuenta, ignora este mensaje.
      </p>
    `),
  }
}

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
          <tr><td style="color:#888;font-size:12px;padding:4px 0;">Plan</td><td style="color:#f5c518;font-size:14px;text-align:right;font-weight:600;">Prueba gratuita (14 días)</td></tr>
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
        <div style="width:48px;height:48px;border-radius:50%;background:rgba(34,197,94,0.12);display:inline-block;text-align:center;line-height:48px;">
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
        <div style="width:48px;height:48px;border-radius:50%;background:rgba(239,68,68,0.12);display:inline-block;text-align:center;line-height:48px;">
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
        <div style="width:48px;height:48px;border-radius:50%;background:rgba(245,197,24,0.12);display:inline-block;text-align:center;line-height:48px;">
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
        <div style="width:48px;height:48px;border-radius:50%;background:rgba(239,68,68,0.12);display:inline-block;text-align:center;line-height:48px;">
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

// 7. Referido exitoso — se notifica al referidor cuando alguien usa su código
export function emailReferidoExitoso({ nombre, nombreReferido }) {
  return {
    subject: 'Ganaste 1 mes gratis - Control Finanzas',
    html: layout(`
      <div style="text-align:center;margin-bottom:16px;">
        <div style="width:48px;height:48px;border-radius:50%;background:rgba(34,197,94,0.12);display:inline-block;text-align:center;line-height:48px;">
          <span style="color:#22c55e;font-size:24px;">🎁</span>
        </div>
      </div>
      <h2 style="color:#fff;font-size:18px;margin:0 0 8px;text-align:center;">¡Ganaste 1 mes gratis!</h2>
      <p style="color:#888;font-size:14px;margin:0 0 20px;text-align:center;">
        Hola ${nombre}, <strong style="color:#fff;">${nombreReferido}</strong> se registró con tu código de referido.
      </p>
      <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:16px;margin-bottom:16px;text-align:center;">
        <p style="color:#22c55e;font-size:16px;font-weight:700;margin:0;">+30 días agregados a tu suscripción</p>
        <p style="color:#888;font-size:12px;margin:4px 0 0;">Sigue invitando para ganar más meses gratis.</p>
      </div>
      <p style="color:#888;font-size:13px;margin:0;">Comparte tu link de referido con más prestamistas y acumula meses gratis.</p>
      ${boton('Ver mi suscripción', APP_URL + '/configuracion?tab=suscripcion')}
    `),
  }
}

// 8. Onboarding día 1 — guía de primeros pasos
export function emailOnboardingDia1({ nombre }) {
  return {
    subject: '3 pasos para empezar - Control Finanzas',
    html: layout(`
      <h2 style="color:#fff;font-size:18px;margin:0 0 8px;">Hola ${nombre}, ¡empecemos!</h2>
      <p style="color:#888;font-size:14px;margin:0 0 20px;">Tu cuenta está lista. Sigue estos 3 pasos para organizar tu cartera:</p>

      <div style="margin-bottom:12px;">
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:16px;">
          <div style="width:28px;height:28px;border-radius:50%;background:rgba(245,197,24,0.15);color:#f5c518;font-size:14px;font-weight:700;text-align:center;line-height:28px;flex-shrink:0;">1</div>
          <div>
            <p style="color:#fff;font-size:14px;font-weight:600;margin:0;">Registra tu primer cliente</p>
            <p style="color:#888;font-size:12px;margin:4px 0 0;">Nombre, cédula, teléfono y dirección.</p>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:16px;">
          <div style="width:28px;height:28px;border-radius:50%;background:rgba(245,197,24,0.15);color:#f5c518;font-size:14px;font-weight:700;text-align:center;line-height:28px;flex-shrink:0;">2</div>
          <div>
            <p style="color:#fff;font-size:14px;font-weight:600;margin:0;">Crea un préstamo</p>
            <p style="color:#888;font-size:12px;margin:4px 0 0;">Monto, interés, plazo y frecuencia de pago.</p>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="width:28px;height:28px;border-radius:50%;background:rgba(245,197,24,0.15);color:#f5c518;font-size:14px;font-weight:700;text-align:center;line-height:28px;flex-shrink:0;">3</div>
          <div>
            <p style="color:#fff;font-size:14px;font-weight:600;margin:0;">Registra pagos</p>
            <p style="color:#888;font-size:12px;margin:4px 0 0;">Controla cada abono desde el celular o computador.</p>
          </div>
        </div>
      </div>

      ${boton('Empezar ahora', APP_URL + '/clientes/nuevo')}
    `),
  }
}

// 9. Onboarding día 3 — seguimiento adaptado al progreso del usuario
export function emailOnboardingDia3({ nombre, clientesCreados }) {
  const contenido = clientesCreados > 0
    ? `<p style="color:#888;font-size:14px;margin:0 0 20px;">Ya tienes <strong style="color:#22c55e;">${clientesCreados} cliente${clientesCreados > 1 ? 's' : ''}</strong> registrado${clientesCreados > 1 ? 's' : ''}. ¡Vas por buen camino!</p>
       <p style="color:#888;font-size:13px;margin:0 0 8px;">Siguiente paso: crea rutas y asigna cobradores para organizar tus cobros.</p>
       ${boton('Crear ruta', APP_URL + '/rutas')}`
    : `<p style="color:#888;font-size:14px;margin:0 0 20px;">Aún no has registrado ningún cliente. Es súper fácil, solo toma 1 minuto.</p>
       <p style="color:#888;font-size:13px;margin:0 0 8px;">Empieza con tu primer cliente y luego crea un préstamo para ver el poder de la plataforma.</p>
       ${boton('Registrar mi primer cliente', APP_URL + '/clientes/nuevo')}`
  return {
    subject: clientesCreados > 0 ? '¡Buen progreso! - Control Finanzas' : '¿Ya creaste tu primer cliente? - Control Finanzas',
    html: layout(`
      <h2 style="color:#fff;font-size:18px;margin:0 0 8px;">Hola ${nombre}</h2>
      ${contenido}
    `),
  }
}

// 10. Onboarding día 7 — tip avanzado + mitad de prueba
export function emailOnboardingDia7({ nombre }) {
  return {
    subject: 'Tip: envía comprobantes por WhatsApp - Control Finanzas',
    html: layout(`
      <h2 style="color:#fff;font-size:18px;margin:0 0 8px;">¡Vas a mitad de tu prueba, ${nombre}!</h2>
      <p style="color:#888;font-size:14px;margin:0 0 20px;">Te compartimos una función que les encanta a nuestros usuarios:</p>

      <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:16px;margin-bottom:16px;">
        <p style="color:#f5c518;font-size:20px;margin:0 0 8px;">📲</p>
        <p style="color:#fff;font-size:14px;font-weight:600;margin:0 0 6px;">Comprobantes por WhatsApp</p>
        <p style="color:#888;font-size:13px;margin:0;">Al registrar un pago, envíale al deudor el resumen directo a su WhatsApp. Sin apps extra. Un solo toque desde el historial del préstamo.</p>
      </div>

      <p style="color:#888;font-size:13px;margin:0 0 16px;">Esto elimina los malentendidos sobre cuánto deben y genera confianza con tus clientes.</p>
      ${boton('Ir a mis préstamos', APP_URL + '/prestamos')}
    `),
  }
}

// 11. Onboarding día 12 — tu prueba termina en 2 días
export function emailOnboardingDia12({ nombre }) {
  return {
    subject: 'Tu prueba gratuita termina en 2 días - Control Finanzas',
    html: layout(`
      <div style="text-align:center;margin-bottom:16px;">
        <div style="width:48px;height:48px;border-radius:50%;background:rgba(245,158,11,0.12);display:inline-block;text-align:center;line-height:48px;">
          <span style="color:#f59e0b;font-size:24px;">⏳</span>
        </div>
      </div>
      <h2 style="color:#fff;font-size:18px;margin:0 0 8px;text-align:center;">Tu prueba termina en 2 días</h2>
      <p style="color:#888;font-size:14px;margin:0 0 20px;text-align:center;">
        Hola ${nombre}, tu período gratuito de 14 días está por terminar. Elige un plan para seguir sin interrupciones.
      </p>

      <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:16px;margin-bottom:16px;">
        <p style="color:#888;font-size:12px;margin:0 0 8px;">Elige un plan para seguir usando Control Finanzas:</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:#fff;font-size:13px;padding:6px 0;font-weight:600;">Básico</td><td style="color:#f5c518;font-size:13px;text-align:right;">$59.000/mes</td></tr>
          <tr><td style="color:#fff;font-size:13px;padding:6px 0;font-weight:600;">Profesional</td><td style="color:#f5c518;font-size:13px;text-align:right;">$119.000/mes</td></tr>
          <tr><td style="color:#fff;font-size:13px;padding:6px 0;font-weight:600;">Empresarial</td><td style="color:#f5c518;font-size:13px;text-align:right;">$199.000/mes</td></tr>
        </table>
      </div>

      <p style="color:#888;font-size:13px;margin:0;">Si no renuevas, perderás acceso a tu cartera y datos (se guardan por 30 días).</p>
      ${boton('Elegir plan ahora', APP_URL + '/configuracion/plan')}
    `),
  }
}

// 12. Onboarding día 14 — último día
export function emailOnboardingDia14({ nombre }) {
  return {
    subject: 'Hoy es tu último día de prueba - Control Finanzas',
    html: layout(`
      <div style="text-align:center;margin-bottom:16px;">
        <div style="width:48px;height:48px;border-radius:50%;background:rgba(239,68,68,0.12);display:inline-block;text-align:center;line-height:48px;">
          <span style="color:#ef4444;font-size:24px;">🔴</span>
        </div>
      </div>
      <h2 style="color:#fff;font-size:18px;margin:0 0 8px;text-align:center;">Hoy termina tu prueba gratuita</h2>
      <p style="color:#888;font-size:14px;margin:0 0 20px;text-align:center;">
        Hola ${nombre}, hoy es el último día de tu período de prueba. No pierdas acceso a tu cartera.
      </p>

      <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:16px;margin-bottom:16px;">
        <p style="color:#888;font-size:12px;margin:0 0 8px;">Elige un plan para continuar:</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:#fff;font-size:13px;padding:6px 0;font-weight:600;">Básico</td><td style="color:#f5c518;font-size:13px;text-align:right;">$59.000/mes</td></tr>
          <tr><td style="color:#fff;font-size:13px;padding:6px 0;font-weight:600;">Profesional</td><td style="color:#f5c518;font-size:13px;text-align:right;">$119.000/mes</td></tr>
          <tr><td style="color:#fff;font-size:13px;padding:6px 0;font-weight:600;">Empresarial</td><td style="color:#f5c518;font-size:13px;text-align:right;">$199.000/mes</td></tr>
        </table>
      </div>

      <p style="color:#888;font-size:13px;margin:0;">Tus datos están seguros por 30 días adicionales si no renuevas.</p>
      ${boton('Activar mi plan', APP_URL + '/configuracion/plan')}
    `),
  }
}
