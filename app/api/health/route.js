import { prisma } from '@/lib/prisma'

export async function GET() {
  const start = Date.now()

  let dbOk = false
  try {
    await prisma.$queryRaw`SELECT 1`
    dbOk = true
  } catch {}

  return Response.json({
    ok: dbOk,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    dbLatency: Date.now() - start,
  }, { status: dbOk ? 200 : 503 })
}
