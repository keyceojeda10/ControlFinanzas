// lib/asistente-memoria.js — Extracción y recuperación de memoria persistente de Lucas
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

const client = new Anthropic()
const MAX_MEMORIAS = 20

export async function obtenerMemorias(orgId, userId) {
  try {
    return await prisma.asistenteMemoria.findMany({
      where: { organizationId: orgId, userId },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: { contenido: true, categoria: true },
    })
  } catch {
    return []
  }
}

export async function extraerYGuardarMemoria(orgId, userId, conversacion) {
  if (!conversacion || conversacion.length < 3) return

  const turnosUsuario = conversacion.filter(m => m.role === 'user').length
  if (turnosUsuario < 2) return

  try {
    const transcripcion = conversacion
      .map(m => `${m.role === 'user' ? 'Usuario' : 'Lucas'}: ${
        Array.isArray(m.content)
          ? m.content.filter(b => b.type === 'text').map(b => b.text).join(' ')
          : m.content
      }`)
      .join('\n')

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Analiza esta conversación y extrae SOLO hechos concretos y útiles para recordar en futuras sesiones con este usuario de una app de préstamos informales.

Devuelve SOLO un JSON array de máximo 3 objetos. Si no hay nada genuinamente nuevo y útil, devuelve [].

Formato: [{ "contenido": "...", "categoria": "preferencia|portafolio|comportamiento|accion" }]

Ejemplos VÁLIDOS:
- "El owner prefiere ver los datos en miles de pesos, no en millones"
- "La ruta Norte tiene históricamente más mora que la ruta Sur"
- "El negocio opera principalmente los sábados con cobros altos"

Ejemplos INVÁLIDOS (no extraer):
- Preguntas generales sobre el portafolio sin insight nuevo
- Respuestas que solo repiten datos del dashboard
- Saludos o conversaciones triviales

CONVERSACIÓN:
${transcripcion.slice(0, 3000)}

Responde SOLO con el JSON array, sin texto adicional.`,
      }],
    })

    const texto = response.content[0]?.text?.trim() ?? '[]'
    let hechos = []
    try {
      hechos = JSON.parse(texto)
      if (!Array.isArray(hechos)) hechos = []
    } catch {
      return
    }

    if (hechos.length === 0) return

    const categoriasValidas = ['preferencia', 'portafolio', 'comportamiento', 'accion']

    for (const hecho of hechos.slice(0, 3)) {
      if (!hecho.contenido || typeof hecho.contenido !== 'string') continue
      const categoria = categoriasValidas.includes(hecho.categoria) ? hecho.categoria : 'preferencia'

      const count = await prisma.asistenteMemoria.count({ where: { organizationId: orgId, userId } })
      if (count >= MAX_MEMORIAS) {
        const masAntigua = await prisma.asistenteMemoria.findFirst({
          where: { organizationId: orgId, userId },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        })
        if (masAntigua) await prisma.asistenteMemoria.delete({ where: { id: masAntigua.id } })
      }

      await prisma.asistenteMemoria.create({
        data: { organizationId: orgId, userId, contenido: hecho.contenido.slice(0, 300), categoria },
      })
    }
  } catch {
    // fire-and-forget, no propagar errores
  }
}
