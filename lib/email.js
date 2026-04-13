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
  crearPrestamo: 'https://youtu.be/wuk7J8zd_Ko',
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
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;border-radius:16px 16px 0 0;margin:-40px -32px 32px;">
  <tr><td style="padding:48px 32px 40px;">
    ${eyebrow ? `<p style="margin:0 0 12px;color:#f5c518;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;">${eyebrow}</p>` : ''}
    <h1 style="margin:0 0 ${sub ? '12px' : '0'};color:#ffffff;font-size:30px;line-height:1.15;font-weight:800;letter-spacing:-0.02em;">${titular}</h1>
    ${sub ? `<p style="margin:0;color:#a1a1aa;font-size:15px;line-height:1.5;">${sub}</p>` : ''}
  </td></tr>
</table>
<div style="height:8px;line-height:8px;font-size:0;">&nbsp;</div>`

// Bloque de beneficio con número/badge + titular + body
// `badge` puede ser un número (1, 2, 3) o un caracter Unicode (✓, ★)
const beneficio = ({ badge, titular, texto }) => `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
  <tr>
    <td width="60" valign="top" style="padding-right:16px;">
      <table cellpadding="0" cellspacing="0" border="0"><tr><td width="44" height="44" align="center" valign="middle" style="background:#fef3c7;border-radius:12px;color:#a16207;font-size:18px;font-weight:800;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:44px;text-align:center;">${badge}</td></tr></table>
    </td>
    <td valign="top">
      <p style="margin:0 0 4px;color:#0a0a0a;font-size:16px;font-weight:700;line-height:1.3;letter-spacing:-0.01em;">${titular}</p>
      <p style="margin:0;color:#52525b;font-size:14px;line-height:1.55;">${texto}</p>
    </td>
  </tr>
</table>`

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
    subject: `${nombre}, te ganaste 1 mes gratis`,
    html: layout(`
      ${hero({
        eyebrow: 'Programa de referidos',
        titular: '¡Acabas de ganar 1 mes gratis!',
        sub: `${nombreReferido} se registró con tu código. Tú ganas, así de simple.`,
      })}

      ${cardSuccess(`
        <p style="margin:0 0 6px;color:#15803d;font-size:18px;font-weight:800;">+30 días agregados a tu suscripción</p>
        <p style="margin:0;color:#166534;font-size:14px;line-height:1.55;">Ya se aplicaron a tu cuenta. No tienes que hacer nada más.</p>
      `)}

      ${parrafo(`Hola ${nombre}, <strong>${nombreReferido}</strong> creó su cuenta usando tu enlace de referido y eso te suma automáticamente un mes gratis a tu suscripción. Así de fácil.`)}

      ${quote('Cada referido que invitas es un mes que no pagas. Sin límite.')}

      ${beneficio({
        badge: '∞',
        titular: 'Invita más, paga menos',
        texto: 'No hay tope. Cada prestamista que se registre con tu código te suma 30 días más. Invita a 12 y tienes un año gratis.',
      })}

      ${ctaGrande({
        texto: 'Compartir mi código',
        url: APP_URL + '/configuracion?tab=suscripcion',
        debajo: 'Tu enlace de referido está en la pestaña de Suscripción.',
      })}

      ${videoCard({
        videoId: 'yoFFF6V-oow',
        titulo: 'Cómo funcionan los referidos',
        descripcion: 'Te explicamos en 1 minuto cómo invitar y acumular meses gratis.',
      })}

      <p style="margin:24px 0 0;color:#0a0a0a;font-size:14px;font-weight:600;">— El equipo de Control Finanzas</p>
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
        badge: '1',
        titular: 'Registra tu primer cliente',
        texto: 'Nombre, cédula, teléfono y dirección. En 30 segundos lo tienes en el sistema y nunca más se te pierde un dato.',
      })}

      ${beneficio({
        badge: '2',
        titular: 'Crea su primer préstamo',
        texto: 'Monto, interés y frecuencia. El sistema calcula la cuota automáticamente y lleva el saldo al día. Tú dejas de hacer cuentas con los dedos.',
      })}

      ${beneficio({
        badge: '3',
        titular: 'Registra cada abono',
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
    subject: tieneClientes
      ? `${nombre}, ya arrancaste. Ahora no pares.`
      : `${nombre}, tres días y ni un cliente todavía`,
    html: layout(
      tieneClientes
        ? `
      ${hero({
        eyebrow: 'Día 3 · Vas bien',
        titular: `Ya tienes ${clientesCreados} cliente${clientesCreados > 1 ? 's' : ''} en el sistema`,
        sub: 'El siguiente paso es organizar tus cobros para que nada se te escape.',
      })}

      ${parrafo(`Arrancar es lo más difícil, y ya lo hiciste. Pero el verdadero valor de Control Finanzas aparece cuando <strong>cada cobro del día tiene dueño, hora y ruta</strong>. Sin eso, el sistema es apenas una libreta digital.`)}

      ${quote('Un cobrador sin ruta es plata en la calle sin regreso.')}

      <h2 style="margin:32px 0 16px;color:#0a0a0a;font-size:18px;font-weight:700;letter-spacing:-0.01em;">Tu siguiente movida</h2>

      ${beneficio({
        badge: '→',
        titular: 'Crea tu primera ruta',
        texto: 'Agrupa tus clientes por zona, día o cobrador. El sistema arma el recorrido y tú ves en tiempo real quién pagó y quién no.',
      })}

      ${beneficio({
        badge: '→',
        titular: 'Asigna un cobrador',
        texto: 'Tu cobrador entra desde su celular, solo ve su ruta del día y registra cada abono. Tú recibes el reporte al instante, sin llamadas ni excusas.',
      })}

      ${ctaGrande({
        texto: 'Crear mi primera ruta',
        url: APP_URL + '/rutas',
        debajo: 'Se crea en menos de 1 minuto.',
      })}

      ${videoCard({
        videoId: 'tldha8LjE4c',
        titulo: 'Cómo crear una ruta de cobro',
        descripcion: 'Te mostramos cómo organizar tus cobros del día en menos de 2 minutos.',
      })}

      ${parrafo(`Si tienes cobradores, este es el momento de <a href="${APP_URL}/cobradores/nuevo" style="color:#0a0a0a;text-decoration:underline;font-weight:600;">agregarlos</a>. Cada uno con su propio usuario, su propia ruta y su propio reporte.`)}

      <p style="margin:24px 0 0;color:#0a0a0a;font-size:14px;font-weight:600;">— El equipo de Control Finanzas</p>
    `
        : `
      ${hero({
        eyebrow: 'Día 3 · ¿Aún no arrancas?',
        titular: `${nombre}, 30 segundos te separan de tu primer cliente`,
        sub: 'Lo único que se pierde es el tiempo que pasa sin empezar.',
      })}

      ${parrafo(`Han pasado 3 días desde que creaste tu cuenta y todavía no has registrado ningún cliente. Sabemos por qué: empezar algo nuevo siempre da flojera. Pero te prometemos algo:`)}

      ${quote('Vas a tardar más leyendo este correo que registrando tu primer cliente.')}

      ${parrafo(`No necesitas tener todo perfecto. Un cliente. Nombre y cédula. Listo. Después lo editas cuando quieras.`)}

      ${beneficio({
        badge: '1',
        titular: 'Registra a cualquier cliente',
        texto: 'El que más te debe, el que acabas de prestarle o uno inventado para probar. No importa — es solo para romper el hielo.',
      })}

      ${beneficio({
        badge: '2',
        titular: 'Créale un préstamo de prueba',
        texto: 'Monto, interés y plazo. El sistema calcula la cuota y te muestra el poder real de la plataforma en 10 segundos.',
      })}

      ${ctaGrande({
        texto: 'Registrar mi primer cliente',
        url: APP_URL + '/clientes/nuevo',
        debajo: 'Toma 30 segundos. Y después no quieres volver al cuaderno.',
      })}

      ${videoCard({
        videoId: 'EEGrlsU-k7Y',
        titulo: 'Cómo registrar un cliente (1 min)',
        descripcion: 'Te mostramos el paso a paso. Si después de verlo no arrancas, respondemos este correo.',
      })}

      ${parrafo(`¿Atascado en algo? Respóndeme este correo. Te leo personalmente.`)}

      <p style="margin:24px 0 0;color:#0a0a0a;font-size:14px;font-weight:600;">— El equipo de Control Finanzas</p>
    `,
      { unsubscribeUserId: userId }
    ),
  }
}

// 10. Onboarding día 7
export function emailOnboardingDia7({ nombre, userId }) {
  return {
    subject: `${nombre}, el truco que acaba con el "ya te pagué"`,
    html: layout(`
      ${hero({
        eyebrow: 'Día 7 · Mitad de camino',
        titular: 'El comprobante que cambia la conversación',
        sub: 'Un toque, un WhatsApp, cero discusiones sobre cuánto debe tu cliente.',
      })}

      ${parrafo(`Vamos a mitad de tu prueba, ${nombre}. Hoy te queremos mostrar la función que, según nuestros usuarios, <strong>es la que más cambia el día a día</strong>.`)}

      ${quote('"Ya te pagué" es la frase más cara del negocio de prestar.')}

      ${parrafo(`Cada vez que un cliente te dice eso y tú no tienes con qué responderle, pierdes plata o pierdes la relación. A veces las dos. Por eso existe esta función:`)}

      ${beneficio({
        badge: '💬',
        titular: 'Comprobante por WhatsApp al instante',
        texto: 'Cuando registras un pago, el sistema genera un resumen con el monto, el saldo restante y la firma del cliente. Un toque y va directo a su WhatsApp. Sin apps externas, sin copiar y pegar.',
      })}

      ${beneficio({
        badge: '✓',
        titular: 'Queda trazabilidad en los dos lados',
        texto: 'Tú tienes el historial en el sistema. Tu cliente tiene el comprobante en su celular. Nadie discute, nadie olvida, nadie pierde plata.',
      })}

      ${beneficio({
        badge: '★',
        titular: 'Tus clientes te ven más profesional',
        texto: 'Y los clientes que ven orden, pagan más puntual. Esto no lo decimos nosotros, lo dicen los prestamistas que llevan años con nosotros.',
      })}

      ${ctaGrande({
        texto: 'Probar con un pago real',
        url: APP_URL + '/prestamos',
        debajo: 'Abre cualquier préstamo, registra un abono y mira el botón de WhatsApp.',
      })}

      ${videoCard({
        videoId: 'CPnWwHtrTiQ',
        titulo: 'Cómo registrar un cobro y enviar comprobante',
        descripcion: 'Un minuto de video. Después no vuelves a cobrar sin comprobante.',
      })}

      ${parrafo(`Te quedan <strong>7 días de prueba</strong>. Aprovecha esta semana para probar todo lo que quieras. Sin límites, sin tarjeta.`)}

      <p style="margin:24px 0 0;color:#0a0a0a;font-size:14px;font-weight:600;">— El equipo de Control Finanzas</p>
    `, { unsubscribeUserId: userId }),
  }
}

// 11. Onboarding día 12
export function emailOnboardingDia12({ nombre, userId }) {
  return {
    subject: `${nombre}, 48 horas para no perder tu cartera`,
    html: layout(`
      ${hero({
        eyebrow: 'Día 12 · Quedan 2 días',
        titular: 'En 48 horas decides si sigues adelante',
        sub: 'Tu cartera, tus clientes, tus rutas — todo queda guardado si eliges un plan.',
      })}

      ${parrafo(`Hola ${nombre}, ya casi termina tu prueba. Queremos ser directos contigo: si el sistema te sirvió estos días, <strong>no hay razón para volver al cuaderno</strong>.`)}

      ${quote('El costo de un mes de Control Finanzas es menos que una cuota que no te pagaron.')}

      <h2 style="margin:32px 0 16px;color:#0a0a0a;font-size:18px;font-weight:700;letter-spacing:-0.01em;">Planes disponibles</h2>

      ${card(dataTable(
        dataRow('Básico', '$59.000/mes', { bold: true }) +
        dataRow('Crecimiento', '$79.000/mes', { bold: true }) +
        dataRow('Profesional', '$119.000/mes', { bold: true }) +
        dataRow('Empresarial', '$259.000/mes', { bold: true })
      ))}

      ${beneficio({
        badge: '✓',
        titular: 'Pago desde la misma plataforma',
        texto: 'Tarjeta, PSE, Nequi, Daviplata. Procesamos con Mercado Pago, tus datos nunca tocan nuestros servidores.',
      })}

      ${beneficio({
        badge: '✓',
        titular: 'Cancelas cuando quieras',
        texto: 'Sin letra chica, sin permanencias, sin llamadas de cobranza. Si ya no lo quieres usar, cancelas desde la app.',
      })}

      ${ctaGrande({
        texto: 'Elegir mi plan',
        url: APP_URL + '/configuracion/plan',
        debajo: 'Si no renuevas, tus datos se guardan 30 días por si cambias de opinión.',
      })}

      ${parrafo(`¿Dudas sobre cuál plan elegir? Respóndeme este correo y te ayudo a decidir según el tamaño de tu cartera.`)}

      <p style="margin:24px 0 0;color:#0a0a0a;font-size:14px;font-weight:600;">— El equipo de Control Finanzas</p>
    `, { unsubscribeUserId: userId }),
  }
}

// 12. Onboarding día 14
export function emailOnboardingDia14({ nombre, userId }) {
  return {
    subject: `${nombre}, hoy es el último día`,
    html: layout(`
      ${hero({
        eyebrow: 'Día 14 · Último día',
        titular: 'Hoy decides si tu cartera se queda organizada',
        sub: 'A partir de mañana, sin plan, pierdes el acceso a la plataforma.',
      })}

      ${parrafo(`Hola ${nombre}, hoy es tu último día de prueba. Queremos que tomes una decisión con información, no con presión. Estas son tus dos opciones:`)}

      ${beneficio({
        badge: 'A',
        titular: 'Activas tu plan y sigues como hasta hoy',
        texto: 'Tu cartera, tus clientes, tus rutas y todo el historial se mantienen. Pagas desde $59.000/mes, cancelas cuando quieras.',
      })}

      ${beneficio({
        badge: 'B',
        titular: 'No haces nada y pierdes el acceso',
        texto: 'Tus datos se guardan por 30 días más. Si cambias de opinión en ese lapso, los recuperamos. Después de eso, se eliminan por seguridad.',
      })}

      ${quote('Volver al cuaderno después de probar el sistema es como volver a usar velas después de tener luz.')}

      <h2 style="margin:32px 0 16px;color:#0a0a0a;font-size:18px;font-weight:700;letter-spacing:-0.01em;">Planes disponibles</h2>

      ${card(dataTable(
        dataRow('Básico', '$59.000/mes', { bold: true }) +
        dataRow('Crecimiento', '$79.000/mes', { bold: true }) +
        dataRow('Profesional', '$119.000/mes', { bold: true }) +
        dataRow('Empresarial', '$259.000/mes', { bold: true })
      ))}

      ${ctaGrande({
        texto: 'Activar mi plan ahora',
        url: APP_URL + '/configuracion/plan',
        debajo: 'El pago se procesa en segundos y tu cuenta no se corta.',
      })}

      ${parrafo(`¿Quieres una extensión de 7 días para pensarlo? Respóndeme este correo y te la damos. En serio.`)}

      <p style="margin:24px 0 0;color:#0a0a0a;font-size:14px;font-weight:600;">— El equipo de Control Finanzas</p>
    `, { unsubscribeUserId: userId }),
  }
}

// 13. Recuperación día 17
export function emailRecuperacionDia17({ nombre, clientesCreados, prestamosCreados, userId }) {
  const tieneData = clientesCreados > 0 || prestamosCreados > 0
  return {
    subject: `${nombre}, tu cartera sigue aquí esperándote`,
    html: layout(`
      ${hero({
        eyebrow: 'Día 17 · Volvamos al control',
        titular: `${nombre}, ${tieneData ? 'tu cartera no se va a organizar sola' : 'volver al cuaderno duele más que empezar'}`,
        sub: 'Tu cuenta sigue activa. Tus datos están intactos. Solo falta un paso.',
      })}

      ${parrafo(`Tu prueba terminó hace unos días y no renovaste. Está bien, a veces uno se atraviesa con otras cosas. Pero tu cuenta sigue aquí, con todo lo que configuraste.`)}

      ${tieneData ? card(`
        <p style="margin:0 0 8px;color:#71717a;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Lo que te espera adentro</p>
        <p style="margin:0 0 4px;color:#0a0a0a;font-size:22px;font-weight:800;letter-spacing:-0.01em;">${clientesCreados} cliente${clientesCreados !== 1 ? 's' : ''} · ${prestamosCreados} préstamo${prestamosCreados !== 1 ? 's' : ''}</p>
        <p style="margin:0;color:#52525b;font-size:13px;line-height:1.5;">Todo guardado, todo al día, listo para seguir como si nada.</p>
      `) : ''}

      ${quote('Cada día sin sistema es un día más de cuadernos que se pierden.')}

      ${beneficio({
        badge: '✓',
        titular: 'Recuperas todo en 30 segundos',
        texto: 'Activas cualquier plan y vuelves al punto donde te quedaste. Sin migraciones, sin recargar datos, sin perder nada.',
      })}

      ${beneficio({
        badge: '✓',
        titular: 'Desde $59.000/mes',
        texto: 'Menos que una cuota atrasada. El costo se paga solo con el primer cliente que ya no te quede pendiente.',
      })}

      ${ctaGrande({
        texto: 'Reactivar mi cuenta',
        url: APP_URL + '/configuracion/plan',
        debajo: `¿Necesitas ayuda? Escribe a ${SOPORTE} y te respondemos hoy.`,
      })}

      <p style="margin:24px 0 0;color:#0a0a0a;font-size:14px;font-weight:600;">— El equipo de Control Finanzas</p>
    `, { unsubscribeUserId: userId }),
  }
}

// 14. Recuperación día 21
export function emailRecuperacionDia21({ nombre, userId }) {
  return {
    subject: `${nombre}, te regalamos 7 días más`,
    html: layout(`
      ${hero({
        eyebrow: 'Día 21 · Segunda oportunidad',
        titular: '7 días más, sin cobrarte un peso',
        sub: 'Porque sabemos que a veces la prueba cae en mala semana.',
      })}

      ${parrafo(`Hola ${nombre}. Tu prueba terminó hace una semana y no volvimos a saber de ti. Antes de soltarte, queremos hacerte una oferta:`)}

      ${cardSuccess(`
        <p style="margin:0 0 6px;color:#15803d;font-size:18px;font-weight:800;">7 días gratis adicionales</p>
        <p style="margin:0;color:#166534;font-size:14px;line-height:1.55;">Sin tarjeta, sin compromiso. Una semana más para que puedas probar el sistema con calma, en un momento menos cargado.</p>
      `)}

      ${quote('No todos los meses son buenos para aprender algo nuevo. Lo entendemos.')}

      ${parrafo(`Muchos prestamistas arrancan la prueba en semana de cierre, de fiestas o en plena ruta. Y luego no les queda cabeza para explorar la plataforma. Si fue tu caso, queremos darte una segunda vuelta.`)}

      ${beneficio({
        badge: '1',
        titular: 'Respondes este correo',
        texto: 'Con un "sí" nos basta. No necesitas explicar nada.',
      })}

      ${beneficio({
        badge: '2',
        titular: 'Te activamos 7 días extra',
        texto: 'En minutos tu cuenta vuelve a estar abierta con todo lo que habías configurado.',
      })}

      ${beneficio({
        badge: '3',
        titular: 'Pruebas con calma esta vez',
        texto: 'Sin la presión del reloj. Si al final decides que no es para ti, no pasa nada. Nosotros quedamos tranquilos de que le diste una oportunidad real.',
      })}

      ${ctaGrande({
        texto: 'Sí, quiero los 7 días extra',
        url: `mailto:${SOPORTE}?subject=Quiero%207%20d%C3%ADas%20extra&body=Hola%2C%20quiero%20que%20me%20reactiven%20la%20prueba.`,
        debajo: 'O escríbenos directo a ' + SOPORTE,
      })}

      <p style="margin:24px 0 0;color:#0a0a0a;font-size:14px;font-weight:600;">— El equipo de Control Finanzas</p>
    `, { unsubscribeUserId: userId }),
  }
}

// 15. Recuperación día 30
export function emailRecuperacionDia30({ nombre, clientesCreados, prestamosCreados, userId }) {
  const tieneData = clientesCreados > 0 || prestamosCreados > 0
  return {
    subject: `${nombre}, último aviso antes de borrar tus datos`,
    html: layout(`
      ${hero({
        eyebrow: 'Día 30 · Último aviso',
        titular: 'Esta es la última vez que te escribimos',
        sub: 'Después de hoy, tus datos se eliminan por seguridad. No hay vuelta atrás.',
      })}

      ${parrafo(`Hola ${nombre}. Tu cuenta lleva más de 2 semanas inactiva y estamos por cerrar el ciclo. No queremos incomodarte más — solo avisarte que este es el último paso antes de eliminar tu información.`)}

      ${tieneData ? cardError(`
        <p style="margin:0 0 8px;color:#991b1b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Lo que se va a eliminar</p>
        <p style="margin:0 0 4px;color:#0a0a0a;font-size:22px;font-weight:800;letter-spacing:-0.01em;">${clientesCreados} cliente${clientesCreados !== 1 ? 's' : ''} · ${prestamosCreados} préstamo${prestamosCreados !== 1 ? 's' : ''}</p>
        <p style="margin:0;color:#7f1d1d;font-size:13px;line-height:1.5;">Con todos sus pagos, historial, saldos y notas. No se puede recuperar después.</p>
      `) : ''}

      ${quote('La plata que no quedó registrada, no existió.')}

      ${parrafo(`Si activas cualquier plan antes de que eliminemos tu cuenta, <strong>todo se conserva intacto</strong> y puedes retomar donde te quedaste. Desde $59.000/mes, cancelas cuando quieras.`)}

      ${ctaGrande({
        texto: 'Activar plan y conservar mis datos',
        url: APP_URL + '/configuracion/plan',
        debajo: 'Tarda 30 segundos. Después no hay cómo traerlos de vuelta.',
      })}

      <p style="margin:32px 0 0;color:#a1a1aa;font-size:12px;line-height:1.6;text-align:center;">
        Si ya no necesitas el servicio, no tienes que hacer nada. Gracias por haber probado Control Finanzas.
      </p>
    `, { unsubscribeUserId: userId }),
  }
}
