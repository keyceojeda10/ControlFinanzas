import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

// GET - Estado de backups
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.rol !== 'superadmin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const backupDir = '/home/backups'
    const logFile = path.join(backupDir, 'backup.log')

    let lastLogs = ''
    let backupFiles = []

    try {
      const logContent = await fs.readFile(logFile, 'utf-8')
      const lines = logContent.split('\n').filter(Boolean)
      lastLogs = lines.slice(-20).join('\n')
    } catch {
      lastLogs = 'No hay logs de backup aún'
    }

    // Listar backups en Google Drive
    try {
      const { stdout } = await execAsync('rclone ls gdrive:ControlFinanzas/backups 2>/dev/null | sort -k2 | tail -10', { timeout: 15000 })
      backupFiles = stdout.trim().split('\n').filter(Boolean).map(line => {
        const parts = line.trim().split(/\s+/)
        return { size: parseInt(parts[0]), name: parts.slice(1).join(' ') }
      })
    } catch {
      backupFiles = []
    }

    // Último backup exitoso
    const lastSuccess = lastLogs.match(/\[([^\]]+)\] ═══ Backup completado/g)
    const lastBackupDate = lastSuccess ? lastSuccess[lastSuccess.length - 1].match(/\[([^\]]+)\]/)[1] : null

    return NextResponse.json({
      lastBackup: lastBackupDate,
      backupCount: backupFiles.length,
      backups: backupFiles.reverse(),
      recentLogs: lastLogs
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Ejecutar backup manual
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.rol !== 'superadmin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Ejecutar backup en background
    exec('/home/control-finanzas/scripts/backup-gdrive.sh >> /home/backups/cron.log 2>&1 &')

    return NextResponse.json({
      message: 'Backup iniciado. Revisa los logs en unos minutos.',
      startedAt: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
