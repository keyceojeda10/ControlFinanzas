import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enviarEmail } from '@/lib/email'

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { to, subject, body, organizationId } = await req.json()

  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'to, subject y body son requeridos' }, { status: 400 })
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
      <tr><td align="center" style="padding-bottom:12px;">
        <img src="https://app.control-finanzas.com/Logo_CF_Mail2.png" width="200" alt="Control Finanzas" style="display:block;height:auto;margin:0 auto;" />
      </td></tr>
    </table>
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px;padding:28px;">
      <div style="color:#e0e0e0;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(body)}</div>
    </div>
    <div style="text-align:center;margin-top:24px;">
      <p style="color:#555;font-size:11px;margin:0;">
        soporte@control-finanzas.com · <a href="https://app.control-finanzas.com" style="color:#f5c518;text-decoration:none;">control-finanzas.com</a>
      </p>
    </div>
  </div>
</body>
</html>`

  const result = await enviarEmail({ to, subject, html })

  if (result.ok) {
    await prisma.adminLog.create({
      data: {
        adminId: session.user.id,
        accion: 'crm_email',
        organizacionId: organizationId || null,
        detalle: `Email a ${to}: ${subject}`
      }
    })
  }

  return NextResponse.json(result)
}
