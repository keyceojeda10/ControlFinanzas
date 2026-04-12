// app/api/unsubscribe/route.js — Endpoint público para darse de baja de emails de marketing

import { prisma } from '@/lib/prisma'
import { verificarTokenUnsubscribe } from '@/lib/unsubscribe'

const APP_URL = 'https://app.control-finanzas.com'
const LOGO_URL = `${APP_URL}/logo-mail-negro.png`

const pageHtml = ({ titulo, mensaje, esError = false }) => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${titulo} · Control Finanzas</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;min-height:100vh;">
    <tr><td align="center" style="padding:60px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
        <tr><td style="padding:0 0 32px;text-align:center;">
          <img src="${LOGO_URL}" alt="Control Finanzas" width="180" style="display:block;height:auto;border:0;margin:0 auto;" />
        </td></tr>
        <tr><td style="background:#ffffff;border-radius:16px;padding:48px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.04);text-align:center;">
          <div style="width:56px;height:56px;border-radius:50%;background:${esError ? '#fef2f2' : '#f0fdf4'};display:inline-block;line-height:56px;margin-bottom:16px;">
            <span style="color:${esError ? '#ef4444' : '#22c55e'};font-size:28px;font-weight:700;">${esError ? '!' : '✓'}</span>
          </div>
          <h1 style="margin:0 0 12px;color:#0a0a0a;font-size:22px;font-weight:700;letter-spacing:-0.01em;">${titulo}</h1>
          <p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">${mensaje}</p>
          <a href="${APP_URL}" style="display:inline-block;background:#0a0a0a;color:#ffffff;padding:12px 24px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;">Volver a Control Finanzas</a>
        </td></tr>
        <tr><td style="padding:24px 8px 0;text-align:center;">
          <p style="margin:0;color:#a1a1aa;font-size:12px;">
            Seguirás recibiendo correos importantes de tu cuenta (pagos, vencimientos, seguridad).
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

export async function GET(req) {
  const url = new URL(req.url)
  const token = url.searchParams.get('t')

  const userId = verificarTokenUnsubscribe(token)
  if (!userId) {
    return new Response(pageHtml({
      titulo: 'Enlace no válido',
      mensaje: 'Este link de cancelación no es válido o ya expiró. Si quieres dejar de recibir correos de marketing, escríbenos a soporte@control-finanzas.com.',
      esError: true,
    }), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailsMarketing: true },
    })
    if (!user) {
      return new Response(pageHtml({
        titulo: 'Cuenta no encontrada',
        mensaje: 'No pudimos encontrar tu cuenta. Si crees que es un error, escríbenos a soporte@control-finanzas.com.',
        esError: true,
      }), { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    if (user.emailsMarketing) {
      await prisma.user.update({
        where: { id: userId },
        data: { emailsMarketing: false },
      })
    }

    return new Response(pageHtml({
      titulo: 'Te diste de baja',
      mensaje: `Listo. Ya no recibirás correos de marketing en <strong>${user.email}</strong>. Seguirás recibiendo notificaciones importantes de tu cuenta.`,
    }), { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (err) {
    console.error('[unsubscribe] Error:', err)
    return new Response(pageHtml({
      titulo: 'Error',
      mensaje: 'Hubo un problema procesando tu solicitud. Inténtalo de nuevo en unos minutos.',
      esError: true,
    }), { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
}
