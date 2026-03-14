import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// POST - Recibir alerta de backup fallido (llamado desde el script de backup)
export async function POST(request) {
  try {
    const backupSecret = request.headers.get('X-Backup-Secret')
    if (!backupSecret || backupSecret !== process.env.BACKUP_SECRET) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { subject, body } = await request.json()

    await resend.emails.send({
      from: 'Control Finanzas <notificaciones@control-finanzas.com>',
      to: 'soporte@control-finanzas.com',
      subject: `⚠️ ${subject}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; background: #1a1a1a; color: #fff; border-radius: 8px;">
          <h2 style="color: #f5c518;">Alerta de Backup</h2>
          <p>${body}</p>
          <p style="color: #888; font-size: 12px;">Servidor: ${new Date().toISOString()}</p>
        </div>
      `
    })

    return NextResponse.json({ sent: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
