// lib/email.js — Sistema de emails transaccionales con Resend

import { Resend } from 'resend'
import { generarTokenUnsubscribe } from './unsubscribe.js'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = 'Control Finanzas <notificaciones@control-finanzas.com>'
const SOPORTE = 'soporte@control-finanzas.com'
const APP_URL = 'https://app.control-finanzas.com'
const LOGO_URL = `${APP_URL}/logo-mail-negro.png`

// Links de tutoriales (limpios, sin playlist)
const YT = {
  primerosPasos: 'https://youtu.be/b5x-lWu_vbA',
  registrarCliente: 'https://youtu.be/EEGrlsU-k7Y',
  crearPrestamo: 'https://youtu.be/bbdJsxiKMX8',
  registrarPago: 'https://youtu.be/CPnWwHtrTiQ',
  crearRuta: 'https://youtu.be/tldha8LjE4c',
  crearCobrador: 'https://youtu.be/zQdJ8019zrQ',
  plan: 'https://youtu.be/Sm71tPRlAtg',
  referidos: 'https://youtu.be/yoFFF6V-oow',
  playlist: 'https://www.youtube.com/playlist?list=PLY7xKt7sjM3PnG5Tly5Xght2cvu-q7jvk',
}

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

// ─── Helpers de UI ──────────────────────────────────────────────
const formatCOP = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const layout = (contenido, opts = {}) => {
  const { unsubscribeUserId } = opts
  const unsubBlock = unsubscribeUserId
    ? `
        <tr><td style="padding:16px 8px 0;">
          <p style="margin:0;color:#a1a1aa;font-size:11px;line-height:1.6;">
            ¿No quieres recibir estos correos de tips y novedades? <a href="${APP_URL}/api/unsubscribe?t=${generarTokenUnsubscribe(unsubscribeUserId)}" style="color:#71717a;text-decoration:underline;">Darme de baja</a>. Seguirás recibiendo notificaciones importantes de tu cuenta.
          </p>
        </td></tr>`
    : ''
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Control Finanzas</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">

        <!-- Header -->
        <tr><td style="padding:0 0 24px;">
          <img src="${LOGO_URL}" alt="Control Finanzas" width="160" style="display:block;height:auto;border:0;outline:none;" />
        </td></tr>

        <!-- Card principal -->
        <tr><td style="background:#ffffff;border-radius:16px;padding:40px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.04),0 1px 2px rgba(0,0,0,0.02);">
          ${contenido}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 8px 0;">
          <p style="margin:0 0 8px;color:#a1a1aa;font-size:12px;line-height:1.6;">
            Control Finanzas — Software de gestión de préstamos
          </p>
          <p style="margin:0 0 8px;color:#a1a1aa;font-size:12px;line-height:1.6;">
            <a href="mailto:${SOPORTE}" style="color:#71717a;text-decoration:none;">${SOPORTE}</a>
            &nbsp;·&nbsp;
            <a href="${APP_URL}" style="color:#71717a;text-decoration:none;">app.control-finanzas.com</a>
          </p>
          <p style="margin:0;color:#d4d4d8;font-size:11px;line-height:1.6;">
            Recibiste este correo porque tienes una cuenta en Control Finanzas.
          </p>
        </td></tr>
        ${unsubBlock}
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

const titulo = (texto) => `
<h1 style="margin:0 0 12px;color:#0a0a0a;font-size:24px;line-height:1.3;font-weight:700;letter-spacing:-0.01em;">${texto}</h1>`

const parrafo = (texto) => `
<p style="margin:0 0 16px;color:#52525b;font-size:15px;line-height:1.6;">${texto}</p>`

const boton = (texto, url) => `
<table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;">
  <tr><td style="background:#0a0a0a;border-radius:10px;">
    <a href="${url}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:-0.01em;">${texto}</a>
  </td></tr>
</table>`

const card = (contenido) => `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa;border:1px solid #f4f4f5;border-radius:12px;margin:16px 0;">
  <tr><td style="padding:20px;">${contenido}</td></tr>
</table>`

const cardError = (contenido) => `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fef2f2;border:1px solid #fee2e2;border-radius:12px;margin:16px 0;">
  <tr><td style="padding:16px 20px;">${contenido}</td></tr>
</table>`

const cardSuccess = (contenido) => `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fdf4;border:1px solid #dcfce7;border-radius:12px;margin:16px 0;">
  <tr><td style="padding:16px 20px;">${contenido}</td></tr>
</table>`

const dataRow = (label, valor, opts = {}) => `
<tr>
  <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#71717a;font-size:13px;font-weight:500;">${label}</td>
  <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#0a0a0a;font-size:14px;font-weight:${opts.bold ? '700' : '500'};text-align:right;${opts.color ? `color:${opts.color};` : ''}">${valor}</td>
</tr>`

const dataTable = (rows) => `
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  ${rows}
</table>`

// Sección de tutoriales — formato lista limpia
const tutoriales = (titulo, items) => `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa;border:1px solid #f4f4f5;border-radius:12px;margin:24px 0 8px;">
  <tr><td style="padding:20px;">
    <p style="margin:0 0 12px;color:#71717a;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">${titulo}</p>
    ${items.map((it) => `
      <p style="margin:0 0 8px;">
        <a href="${it.url}" style="color:#0a0a0a;font-size:14px;text-decoration:none;font-weight:500;">▸ ${it.label}</a>
      </p>
    `).join('')}
  </td></tr>
</table>`

// ─── Helpers de marketing/narrativa ─────────────────────────────

// Hero — banda de color con titular grande tipo portada de revista
const hero = ({ eyebrow, titular, sub }) => `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;border-radius:16px 16px 0 0;margin:-40px -32px 24px;">
  <tr><td style="padding:48px 32px 40px;">
    ${eyebrow ? `<p style="margin:0 0 12px;color:#f5c518;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;">${eyebrow}</p>` : ''}
    <h1 style="margin:0 0 ${sub ? '12px' : '0'};color:#ffffff;font-size:30px;line-height:1.15;font-weight:800;letter-spacing:-0.02em;">${titular}</h1>
    ${sub ? `<p style="margin:0;color:#a1a1aa;font-size:15px;line-height:1.5;">${sub}</p>` : ''}
  </td></tr>
</table>`

// Bloque de beneficio con icono SVG inline + titular + body
const beneficio = ({ icono, titular, texto }) => `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
  <tr>
    <td width="48" valign="top" style="padding-right:16px;">
      <table cellpadding="0" cellspacing="0" border="0"><tr><td width="44" height="44" align="center" valign="middle" style="background:#fef3c7;border-radius:12px;">${icono}</td></tr></table>
    </td>
    <td valign="top">
      <p style="margin:0 0 4px;color:#0a0a0a;font-size:16px;font-weight:700;line-height:1.3;letter-spacing:-0.01em;">${titular}</p>
      <p style="margin:0;color:#52525b;font-size:14px;line-height:1.55;">${texto}</p>
    </td>
  </tr>
</table>`

// Iconos SVG (24x24) — colores ámbar oscuro
const icons = {
  cliente: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a16207" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  dinero: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a16207" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  ruta: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a16207" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  alerta: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a16207" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  tiempo: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a16207" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  whatsapp: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#a16207"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>`,
  check: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a16207" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
}

// Card de video destacado — thumbnail YouTube + titulo + duracion + boton
const videoCard = ({ videoId, titulo: tit, descripcion }) => `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;background:#fafafa;border:1px solid #f4f4f5;border-radius:14px;overflow:hidden;">
  <tr><td>
    <a href="https://youtu.be/${videoId}" style="display:block;text-decoration:none;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="background:#0a0a0a;text-align:center;padding:0;position:relative;">
          <img src="https://img.youtube.com/vi/${videoId}/maxresdefault.jpg" alt="${tit}" width="516" style="display:block;width:100%;height:auto;border:0;opacity:0.85;" />
        </td></tr>
        <tr><td style="padding:20px;">
          <p style="margin:0 0 6px;color:#a16207;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">▶ Video tutorial · 1 min</p>
          <p style="margin:0 0 6px;color:#0a0a0a;font-size:16px;font-weight:700;line-height:1.3;">${tit}</p>
          ${descripcion ? `<p style="margin:0;color:#52525b;font-size:13px;line-height:1.5;">${descripcion}</p>` : ''}
        </td></tr>
      </table>
    </a>
  </td></tr>
</table>`

// Bloque de cita / pregunta / dolor — pull quote estilo editorial
const quote = (texto) => `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td width="4" style="background:#f5c518;border-radius:2px;"></td>
    <td style="padding:4px 0 4px 16px;">
      <p style="margin:0;color:#0a0a0a;font-size:17px;font-style:italic;line-height:1.5;font-weight:500;letter-spacing:-0.01em;">${texto}</p>
    </td>
  </tr>
</table>`

// CTA grande con botón + texto secundario debajo
const ctaGrande = ({ texto, url, debajo }) => `
<table cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
  <tr><td style="background:#0a0a0a;border-radius:12px;">
    <a href="${url}" style="display:inline-block;padding:18px 36px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:-0.01em;">${texto} →</a>
  </td></tr>
</table>
${debajo ? `<p style="margin:8px 0 0;color:#a1a1aa;font-size:12px;line-height:1.5;">${debajo}</p>` : ''}`

// ─── Templates ──────────────────────────────────────────────────

// 0. Verificación de email
export function emailVerificacion({ nombre, link }) {
  return {
    subject: 'Confirma tu correo · Control Finanzas',
    html: layout(`
      ${titulo(`Hola ${nombre}, confirma tu correo`)}
      ${parrafo(`Para activar tu cuenta en Control Finanzas haz clic en el botón. El link expira en <strong>24 horas</strong>.`)}
      ${boton('Verificar mi correo', link)}
      <p style="margin:24px 0 0;color:#a1a1aa;font-size:12px;line-height:1.6;">
        Si no creaste esta cuenta, puedes ignorar este mensaje.
      </p>
    `),
  }
}

// 1. Bienvenida
export function emailBienvenida({ nombre, email, nombreOrg, fechaVencimiento }) {
  const fechaFmt = new Date(fechaVencimiento).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
  return {
    subject: `Bienvenido a Control Finanzas, ${nombre}`,
    html: layout(`
      ${titulo(`Bienvenido, ${nombre}`)}
      ${parrafo('Tu cuenta ha sido creada exitosamente. Ya puedes empezar a gestionar tu cartera de préstamos desde cualquier dispositivo.')}
      ${card(dataTable(
        dataRow('Organización', nombreOrg, { bold: true }) +
        dataRow('Correo', email) +
        dataRow('Plan', 'Prueba gratuita 14 días') +
        dataRow('Vence', fechaFmt)
      ))}
      ${boton('Ir a Control Finanzas', APP_URL + '/login')}
    `),
  }
}

// 2. Pago aprobado
export function emailPagoAprobado({ nombre, plan, monto, fechaVencimiento }) {
  const fechaFmt = new Date(fechaVencimiento).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
  return {
    subject: 'Pago confirmado · Control Finanzas',
    html: layout(`
      ${titulo('Pago confirmado')}
      ${parrafo(`Hola ${nombre}, tu pago se procesó exitosamente. Tu suscripción está activa.`)}
      ${card(dataTable(
        dataRow('Plan', plan, { bold: true }) +
        dataRow('Monto', formatCOP(monto), { bold: true }) +
        dataRow('Vigente hasta', fechaFmt)
      ))}
      ${boton('Ir al dashboard', APP_URL + '/dashboard')}
    `),
  }
}

// 3. Pago fallido
export function emailPagoFallido({ nombre, plan, monto }) {
  return {
    subject: 'Pago no procesado · Control Finanzas',
    html: layout(`
      ${titulo('No pudimos procesar tu pago')}
      ${parrafo(`Hola ${nombre}, hubo un problema al procesar tu pago. Tu cuenta sigue activa, puedes reintentar cuando quieras.`)}
      ${card(dataTable(
        dataRow('Plan', plan) +
        dataRow('Monto', formatCOP(monto))
      ))}
      ${parrafo(`Si necesitas ayuda, escríbenos a <a href="mailto:${SOPORTE}" style="color:#0a0a0a;text-decoration:underline;">${SOPORTE}</a>.`)}
      ${boton('Reintentar pago', APP_URL + '/configuracion/plan')}
      ${tutoriales('¿No sabes cómo activar tu plan?', [
        { label: 'Cómo elegir y pagar tu plan', url: YT.plan },
      ])}
    `),
  }
}

// 4. Aviso de vencimiento próximo
export function emailAvisoVencimiento({ nombre, plan, diasRestantes, fechaVencimiento }) {
  const fechaFmt = new Date(fechaVencimiento).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
  const urgente = diasRestantes <= 1
  return {
    subject: `Tu plan vence ${diasRestantes <= 1 ? 'mañana' : `en ${diasRestantes} días`} · Control Finanzas`,
    html: layout(`
      ${titulo('Tu suscripción está por vencer')}
      ${parrafo(`Hola ${nombre}, tu plan <strong>${plan}</strong> vence el <strong>${fechaFmt}</strong>. Renueva ahora para no perder acceso a tu cartera.`)}
      ${urgente ? cardError('<p style="margin:0;color:#991b1b;font-size:14px;font-weight:600;">Tu acceso se suspenderá mañana si no renuevas.</p>') : ''}
      ${boton('Renovar plan', APP_URL + '/configuracion/plan')}
      ${tutoriales('¿Necesitas ayuda con el pago?', [
        { label: 'Cómo elegir y pagar tu plan', url: YT.plan },
      ])}
    `),
  }
}

// 5. Reset de contraseña
export function emailResetPassword({ nombre, resetUrl }) {
  return {
    subject: 'Recuperar contraseña · Control Finanzas',
    html: layout(`
      ${titulo('Recuperar contraseña')}
      ${parrafo(`Hola ${nombre}, recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón para crear una nueva. El enlace expira en <strong>1 hora</strong>.`)}
      ${boton('Restablecer contraseña', resetUrl)}
      <p style="margin:24px 0 0;color:#a1a1aa;font-size:12px;line-height:1.6;">
        Si no solicitaste este cambio, ignora este correo. Tu contraseña no será modificada.
      </p>
    `),
  }
}

// 6. Suscripción vencida
export function emailSuscripcionVencida({ nombre, plan }) {
  return {
    subject: 'Tu suscripción ha vencido · Control Finanzas',
    html: layout(`
      ${titulo('Tu suscripción ha vencido')}
      ${parrafo(`Hola ${nombre}, tu plan <strong>${plan}</strong> expiró y tu acceso a la plataforma está suspendido. Tus datos están seguros — renueva para recuperar el acceso completo.`)}
      ${boton('Renovar ahora', APP_URL + '/configuracion/plan')}
      ${parrafo(`¿Necesitas ayuda? Escríbenos a <a href="mailto:${SOPORTE}" style="color:#0a0a0a;text-decoration:underline;">${SOPORTE}</a>.`)}
      ${tutoriales('Mira cómo renovar en 1 minuto', [
        { label: 'Cómo elegir y pagar tu plan', url: YT.plan },
      ])}
    `),
  }
}

// 7. Referido exitoso
export function emailReferidoExitoso({ nombre, nombreReferido, userId }) {
  return {
    subject: 'Ganaste 1 mes gratis · Control Finanzas',
    html: layout(`
      ${titulo('¡Ganaste 1 mes gratis!')}
      ${parrafo(`Hola ${nombre}, <strong>${nombreReferido}</strong> se registró usando tu código de referido.`)}
      ${cardSuccess(`
        <p style="margin:0 0 4px;color:#15803d;font-size:16px;font-weight:700;">+30 días agregados a tu suscripción</p>
        <p style="margin:0;color:#16a34a;font-size:13px;">Sigue invitando para acumular más meses gratis.</p>
      `)}
      ${parrafo('Comparte tu link de referido con más prestamistas y haz crecer tu cuenta sin pagar de más.')}
      ${boton('Ver mi suscripción', APP_URL + '/configuracion?tab=suscripcion')}
      ${tutoriales('¿Cómo funcionan los referidos?', [
        { label: 'Programa de referidos explicado', url: YT.referidos },
      ])}
    `, { unsubscribeUserId: userId }),
  }
}

// 8. Onboarding día 1
export function emailOnboardingDia1({ nombre, userId }) {
  return {
    subject: `${nombre}, así dejas de perder plata con cada préstamo`,
    html: layout(`
      ${hero({
        eyebrow: 'Bienvenido a Control Finanzas',
        titular: `Hola ${nombre}, hoy empieza otra forma de prestar`,
        sub: 'Tres pasos para tener tu cartera bajo control antes de que termine la semana.',
      })}

      ${parrafo(`Sabemos cómo es. Cuadernos llenos, clientes que dicen "ya te pagué", cobradores que no reportan, y al final del mes no sabes si ganaste o perdiste plata.`)}

      ${quote('Si no controlas la cartera, la cartera te controla a ti.')}

      ${parrafo(`Control Finanzas existe para que <strong>cada peso que prestas vuelva</strong>. Sin cuadernos, sin Excel, sin pelear con cobradores. Empecemos por lo básico:`)}

      <h2 style="margin:32px 0 16px;color:#0a0a0a;font-size:18px;font-weight:700;letter-spacing:-0.01em;">Tus primeros 3 pasos</h2>

      ${beneficio({
        icono: icons.cliente,
        titular: '1. Registra tu primer cliente',
        texto: 'Nombre, cédula, teléfono y dirección. En 30 segundos lo tienes en el sistema y nunca más se te pierde un dato.',
      })}

      ${beneficio({
        icono: icons.dinero,
        titular: '2. Crea su primer préstamo',
        texto: 'Monto, interés y frecuencia. El sistema calcula la cuota automáticamente y lleva el saldo al día. Tú dejas de hacer cuentas con los dedos.',
      })}

      ${beneficio({
        icono: icons.check,
        titular: '3. Registra cada abono',
        texto: 'Desde el celular, en la calle, sin internet. Tu cliente firma con el dedo y recibe el comprobante por WhatsApp al instante.',
      })}

      ${ctaGrande({
        texto: 'Crear mi primer cliente',
        url: APP_URL + '/clientes/nuevo',
        debajo: 'Te toma 30 segundos. En serio.',
      })}

      ${videoCard({
        videoId: 'b5x-lWu_vbA',
        titulo: 'Primeros pasos en Control Finanzas',
        descripcion: 'Mira cómo configurar tu negocio en menos de 2 minutos. Paso a paso, sin tecnicismos.',
      })}

      ${parrafo(`Tienes <strong>14 días gratis</strong> para probar todo. Sin tarjeta, sin compromiso. Si en 14 días no sientes que tu negocio está más organizado, te devolvemos hasta el saludo.`)}

      ${parrafo(`Cualquier duda, respóndeme este mismo correo. Te leo personalmente.`)}

      <p style="margin:24px 0 0;color:#0a0a0a;font-size:14px;font-weight:600;">— El equipo de Control Finanzas</p>
    `, { unsubscribeUserId: userId }),
  }
}

// 9. Onboarding día 3
export function emailOnboardingDia3({ nombre, clientesCreados, userId }) {
  const tieneClientes = clientesCreados > 0
  return {
    subject: tieneClientes ? '¡Buen progreso! · Control Finanzas' : '¿Ya creaste tu primer cliente? · Control Finanzas',
    html: layout(`
      ${titulo(`Hola ${nombre}`)}
      ${tieneClientes
        ? parrafo(`Ya tienes <strong>${clientesCreados} cliente${clientesCreados > 1 ? 's' : ''}</strong> registrado${clientesCreados > 1 ? 's' : ''}. Vas por buen camino.`) +
          parrafo('Siguiente paso: crea rutas y asigna cobradores para organizar tus cobros del día.') +
          boton('Crear ruta', APP_URL + '/rutas') +
          tutoriales('Tutoriales recomendados', [
            { label: 'Cómo crear una ruta de cobro', url: YT.crearRuta },
            { label: 'Cómo agregar un cobrador', url: YT.crearCobrador },
          ])
        : parrafo('Aún no has registrado ningún cliente. Es muy fácil y solo toma 1 minuto.') +
          parrafo('Empieza con tu primer cliente y luego crea un préstamo para ver el poder de la plataforma.') +
          boton('Registrar mi primer cliente', APP_URL + '/clientes/nuevo') +
          tutoriales('Mira cómo se hace', [
            { label: 'Cómo registrar un cliente (1 min)', url: YT.registrarCliente },
            { label: 'Cómo crear un préstamo', url: YT.crearPrestamo },
          ])
      }
    `, { unsubscribeUserId: userId }),
  }
}

// 10. Onboarding día 7
export function emailOnboardingDia7({ nombre, userId }) {
  return {
    subject: 'Tip: envía comprobantes por WhatsApp · Control Finanzas',
    html: layout(`
      ${titulo(`Vas a mitad de tu prueba, ${nombre}`)}
      ${parrafo('Te compartimos una función que les encanta a nuestros usuarios:')}
      ${card(`
        <p style="margin:0 0 6px;color:#0a0a0a;font-size:15px;font-weight:600;">Comprobantes por WhatsApp</p>
        <p style="margin:0;color:#52525b;font-size:14px;line-height:1.6;">Al registrar un pago, envíale al deudor el resumen directo a su WhatsApp. Sin apps extra. Un solo toque desde el historial del préstamo.</p>
      `)}
      ${parrafo('Esto elimina los malentendidos sobre cuánto deben y genera confianza con tus clientes.')}
      ${boton('Ir a mis préstamos', APP_URL + '/prestamos')}
      ${tutoriales('Tutorial', [
        { label: 'Cómo registrar un cobro y enviar comprobante', url: YT.registrarPago },
      ])}
    `, { unsubscribeUserId: userId }),
  }
}

// 11. Onboarding día 12
export function emailOnboardingDia12({ nombre, userId }) {
  return {
    subject: 'Tu prueba gratuita termina en 2 días · Control Finanzas',
    html: layout(`
      ${titulo('Tu prueba termina en 2 días')}
      ${parrafo(`Hola ${nombre}, tu período gratuito de 14 días está por terminar. Elige un plan para seguir sin interrupciones.`)}
      ${card(dataTable(
        dataRow('Básico', '$59.000/mes', { bold: true }) +
        dataRow('Crecimiento', '$79.000/mes', { bold: true }) +
        dataRow('Profesional', '$119.000/mes', { bold: true }) +
        dataRow('Empresarial', '$259.000/mes', { bold: true })
      ))}
      ${parrafo('Si no renuevas, perderás acceso a tu cartera y datos (se guardan por 30 días).')}
      ${boton('Elegir plan ahora', APP_URL + '/configuracion/plan')}
      ${tutoriales('¿Tienes dudas sobre el pago?', [
        { label: 'Cómo elegir y pagar tu plan', url: YT.plan },
      ])}
    `, { unsubscribeUserId: userId }),
  }
}

// 12. Onboarding día 14
export function emailOnboardingDia14({ nombre, userId }) {
  return {
    subject: 'Hoy es tu último día de prueba · Control Finanzas',
    html: layout(`
      ${titulo('Hoy termina tu prueba gratuita')}
      ${parrafo(`Hola ${nombre}, hoy es el último día de tu período de prueba. No pierdas acceso a tu cartera.`)}
      ${card(dataTable(
        dataRow('Básico', '$59.000/mes', { bold: true }) +
        dataRow('Crecimiento', '$79.000/mes', { bold: true }) +
        dataRow('Profesional', '$119.000/mes', { bold: true }) +
        dataRow('Empresarial', '$259.000/mes', { bold: true })
      ))}
      ${parrafo('Tus datos están seguros por 30 días adicionales si no renuevas.')}
      ${boton('Activar mi plan', APP_URL + '/configuracion/plan')}
      ${tutoriales('Mira cómo activar tu plan en 1 minuto', [
        { label: 'Cómo elegir y pagar tu plan', url: YT.plan },
      ])}
    `, { unsubscribeUserId: userId }),
  }
}

// 13. Recuperación día 17
export function emailRecuperacionDia17({ nombre, clientesCreados, prestamosCreados, userId }) {
  const tieneData = clientesCreados > 0 || prestamosCreados > 0
  return {
    subject: 'Tu cartera te espera · Control Finanzas',
    html: layout(`
      ${titulo(`Hola ${nombre}, ¿todo bien?`)}
      ${parrafo('Tu prueba gratuita terminó hace unos días, pero tu cuenta sigue aquí esperándote.')}
      ${tieneData ? card(`
        <p style="margin:0 0 6px;color:#71717a;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Lo que dejaste en tu cuenta</p>
        <p style="margin:0;color:#0a0a0a;font-size:18px;font-weight:700;">${clientesCreados} cliente${clientesCreados !== 1 ? 's' : ''} · ${prestamosCreados} préstamo${prestamosCreados !== 1 ? 's' : ''}</p>
      `) : ''}
      ${parrafo(`Activa tu plan desde <strong>$59.000/mes</strong> y recupera el acceso a toda tu información.`)}
      ${parrafo(`¿Necesitas ayuda? Escríbenos a <a href="mailto:${SOPORTE}" style="color:#0a0a0a;text-decoration:underline;">${SOPORTE}</a>.`)}
      ${boton('Reactivar mi cuenta', APP_URL + '/configuracion/plan')}
      ${tutoriales('Tutoriales', [
        { label: 'Cómo elegir y pagar tu plan', url: YT.plan },
        { label: 'Ver todos los tutoriales', url: YT.playlist },
      ])}
    `, { unsubscribeUserId: userId }),
  }
}

// 14. Recuperación día 21
export function emailRecuperacionDia21({ nombre, userId }) {
  return {
    subject: '¿Te ayudamos a empezar de nuevo? · Control Finanzas',
    html: layout(`
      ${titulo(`Queremos ayudarte, ${nombre}`)}
      ${parrafo('Sabemos que organizar la cartera de préstamos no es fácil. Por eso queremos darte una mano.')}
      ${cardSuccess(`
        <p style="margin:0 0 4px;color:#15803d;font-size:16px;font-weight:700;">7 días adicionales de prueba gratis</p>
        <p style="margin:0;color:#16a34a;font-size:13px;">Escríbenos y te extendemos la prueba para que puedas configurar todo con calma.</p>
      `)}
      ${parrafo('Muchos prestamistas necesitan unos días más para probar bien el sistema. No hay problema.')}
      ${parrafo(`Escríbenos a <a href="mailto:${SOPORTE}" style="color:#0a0a0a;text-decoration:underline;">${SOPORTE}</a> y te reactivamos la prueba.`)}
      ${boton('Reactivar mi cuenta', APP_URL + '/configuracion/plan')}
      ${tutoriales('Si no tuviste tiempo de explorar', [
        { label: 'Primeros pasos (configura tu negocio)', url: YT.primerosPasos },
        { label: 'Registrar cobros y enviar comprobantes', url: YT.registrarPago },
        { label: 'Agregar cobradores a tu equipo', url: YT.crearCobrador },
        { label: 'Cómo elegir y pagar tu plan', url: YT.plan },
      ])}
    `, { unsubscribeUserId: userId }),
  }
}

// 15. Recuperación día 30
export function emailRecuperacionDia30({ nombre, clientesCreados, prestamosCreados, userId }) {
  const tieneData = clientesCreados > 0 || prestamosCreados > 0
  return {
    subject: 'Último aviso: tus datos se eliminarán pronto · Control Finanzas',
    html: layout(`
      ${titulo(`Último aviso, ${nombre}`)}
      ${parrafo('Tu cuenta lleva más de 2 semanas inactiva. Por seguridad, eliminaremos los datos próximamente.')}
      ${tieneData ? cardError(`
        <p style="margin:0 0 4px;color:#991b1b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Se perderán</p>
        <p style="margin:0;color:#0a0a0a;font-size:18px;font-weight:700;">${clientesCreados} cliente${clientesCreados !== 1 ? 's' : ''} · ${prestamosCreados} préstamo${prestamosCreados !== 1 ? 's' : ''}</p>
      `) : ''}
      ${parrafo(`Activa cualquier plan para conservar tu información. Planes desde <strong>$59.000/mes</strong>.`)}
      ${boton('Activar plan y conservar mis datos', APP_URL + '/configuracion/plan')}
      ${tutoriales('Mira cómo activar tu plan', [
        { label: 'Cómo elegir y pagar tu plan', url: YT.plan },
      ])}
      <p style="margin:24px 0 0;color:#a1a1aa;font-size:12px;line-height:1.6;text-align:center;">
        Si ya no necesitas el servicio, no tienes que hacer nada. Gracias por haber probado Control Finanzas.
      </p>
    `, { unsubscribeUserId: userId }),
  }
}
