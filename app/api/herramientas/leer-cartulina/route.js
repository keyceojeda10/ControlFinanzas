// app/api/herramientas/leer-cartulina/route.js
// Extrae datos de una foto de cartulina de prestamo usando Gemini Vision.
// Soporta hasta 5 fotos (multi-cartulina) y las fusiona en un solo resultado.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import sharp from 'sharp'

// Limites de cartulinas por plan (por dia, por organizacion)
const LIMITES_PLAN = {
  test:         3,
  basic:        10,
  standard:     20,
  professional: 40,
  enterprise:   80,
}
const LIMITE_DEFAULT = 5

// Pool de claves Gemini con rotacion automatica en 429
const GEMINI_KEYS = (process.env.GEMINI_API_KEYS ?? '').split(',').map(k => k.trim()).filter(Boolean)
let geminiKeyIndex = 0

async function llamarGemini(base64, mimeType) {
  if (GEMINI_KEYS.length === 0) throw new Error('No hay claves Gemini configuradas')

  const PROMPT = `Eres un asistente para una app de gestión de préstamos informales en Colombia/LATAM.
El usuario te envía una foto de un registro de préstamo. Puede ser una cartulina, cuaderno, libreta, hoja, tarjeta de cobro, anotación en papel, o cualquier documento manuscrito o impreso donde se registre información de un préstamo.
Extrae todos los datos que puedas en el siguiente JSON (omite los campos que no aparezcan claramente):
{
  "nombre": "",
  "cédula": "",
  "teléfono": "",
  "dirección": "",
  "montoPrestado": 0,
  "tasaInteres": 0,
  "frecuencia": "diario|semanal|quincenal|mensual",
  "diasPlazo": 0,
  "fechaInicio": "YYYY-MM-DD",
  "cuotasPagadas": 0,
  "montoPagadoHasta": 0,
  "notas": ""
}
Reglas:
- cédula y teléfono: solo dígitos, sin espacios ni guiones
- montoPrestado, tasaInteres, diasPlazo, cuotasPagadas, montoPagadoHasta: numeros sin puntos ni comas
- Si ves cuotas tachadas, marcadas o con visto bueno, cuentalas en cuotasPagadas
- Si detectas la frecuencia de cobro por el patron de pagos (diario, semanal, etc.), incluyela
- Si ves un total a pagar y un monto prestado, calcula la tasa si no esta explicita
- Si no puedes leer un campo con certeza, omitelo (no pongas 0 ni texto inventado)
- Solo devuelve el JSON puro, sin texto antes ni después, sin markdown`

  const intentos = GEMINI_KEYS.length
  for (let i = 0; i < intentos; i++) {
    const key = GEMINI_KEYS[geminiKeyIndex % GEMINI_KEYS.length]
    geminiKeyIndex++

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mimeType, data: base64 } },
            ],
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
        }),
      }
    )

    if (res.status === 429) continue // rotar a siguiente clave

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gemini error ${res.status}: ${err}`)
    }

    const json = await res.json()
    const texto = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    return texto
  }

  throw new Error('Todas las claves Gemini agotaron su cuota. Intenta mañana.')
}

function parsearRespuesta(texto) {
  // Extraer el JSON aunque venga con markdown o texto extra
  const match = texto.match(/\{[\s\S]*\}/)
  if (!match) return {}
  try { return JSON.parse(match[0]) } catch { return {} }
}

function fusionarResultados(resultados) {
  // Campos de identidad: se toma el primero que tenga valor
  const identidad = ['nombre', 'cedula', 'telefono', 'direccion', 'montoPrestado', 'tasaInteres', 'frecuencia', 'diasPlazo', 'notas']
  const merged = {}
  for (const campo of identidad) {
    for (const r of resultados) {
      if (r[campo] !== undefined && r[campo] !== null && r[campo] !== '' && r[campo] !== 0) {
        merged[campo] = r[campo]
        break
      }
    }
  }

  // fechaInicio: la mas antigua
  const fechas = resultados.map(r => r.fechaInicio).filter(Boolean).sort()
  if (fechas.length) merged.fechaInicio = fechas[0]

  // cuotasPagadas y montoPagadoHasta: se suman entre cartulinas
  merged.cuotasPagadas = resultados.reduce((acc, r) => acc + (Number(r.cuotasPagadas) || 0), 0)
  merged.montoPagadoHasta = resultados.reduce((acc, r) => acc + (Number(r.montoPagadoHasta) || 0), 0)

  // Advertencia si el monto prestado varia entre cartulinas
  const montos = resultados.map(r => Number(r.montoPrestado)).filter(Boolean)
  if (montos.length > 1 && new Set(montos).size > 1) {
    merged._advertencia = `Detectamos montos distintos entre cartulinas (${montos.join(', ')}). Verifica cuál es el correcto.`
  }

  return merged
}

async function procesarImagen(buffer, mimeType) {
  // Reducir a max 1600px para ahorrar tokens sin perder legibilidad del texto
  const reducida = await sharp(buffer)
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()

  const base64 = reducida.toString('base64')
  const texto = await llamarGemini(base64, 'image/jpeg')
  return parsearRespuesta(texto)
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const orgId = session.user.organizationId
  const plan = session.user.plan ?? 'basic'
  const limite = LIMITES_PLAN[plan] ?? LIMITE_DEFAULT

  // Verificar y actualizar contador diario
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { cartulinasHoy: true, cartulinasFecha: true },
  })

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fechaOrg = org?.cartulinasFecha ? new Date(org.cartulinasFecha) : null
  const esMismoDia = fechaOrg && fechaOrg >= hoy

  const usadasHoy = esMismoDia ? (org.cartulinasHoy ?? 0) : 0

  let formData
  try { formData = await req.formData() } catch {
    return NextResponse.json({ error: 'Formato de solicitud inválido' }, { status: 400 })
  }

  const fotos = formData.getAll('fotos')
  if (!fotos.length) return NextResponse.json({ error: 'No se recibió ninguna imagen' }, { status: 400 })

  const MAX_FOTOS = 5
  if (fotos.length > MAX_FOTOS) {
    return NextResponse.json({ error: `Máximo ${MAX_FOTOS} fotos por importación` }, { status: 400 })
  }

  // Validar que no supere el limite del plan
  if (usadasHoy + fotos.length > limite) {
    const restantes = Math.max(0, limite - usadasHoy)
    return NextResponse.json({
      error: `Alcanzaste el límite de ${limite} lecturas por día en tu plan. ${restantes > 0 ? `Puedes leer ${restantes} más hoy.` : 'Se renueva a medianoche.'}`,
      codigo: 'LIMITE_ALCANZADO',
      limite,
      usadas: usadasHoy,
      restantes,
    }, { status: 429 })
  }

  // Procesar imágenes
  const resultados = []
  const erroresFotos = []

  for (let i = 0; i < fotos.length; i++) {
    const foto = fotos[i]
    if (!foto || typeof foto.arrayBuffer !== 'function') {
      erroresFotos.push(`Foto ${i + 1}: formato inválido`)
      continue
    }

    const buffer = Buffer.from(await foto.arrayBuffer())
    const MAX_MB = 10 * 1024 * 1024
    if (buffer.length > MAX_MB) {
      erroresFotos.push(`Foto ${i + 1}: supera el límite de 10MB`)
      continue
    }

    // Validar magic bytes (JPEG, PNG, WebP)
    const esImagen = (
      (buffer[0] === 0xFF && buffer[1] === 0xD8) || // JPEG
      (buffer[0] === 0x89 && buffer[1] === 0x50) || // PNG
      (buffer[0] === 0x52 && buffer[3] === 0x57)    // WebP (RIFF...WEBP)
    )
    if (!esImagen) {
      erroresFotos.push(`Foto ${i + 1}: formato no soportado (usa JPEG, PNG o WebP)`)
      continue
    }

    try {
      const mimeType = (buffer[0] === 0xFF && buffer[1] === 0xD8) ? 'image/jpeg'
                     : (buffer[0] === 0x89 && buffer[1] === 0x50) ? 'image/png'
                     : 'image/webp'
      const datos = await procesarImagen(buffer, mimeType)
      resultados.push(datos)
    } catch (e) {
      erroresFotos.push(`Foto ${i + 1}: ${e.message}`)
    }
  }

  if (!resultados.length) {
    return NextResponse.json({
      error: erroresFotos.length
        ? erroresFotos.join('. ')
        : 'No pudimos leer la foto. Intenta con mejor iluminación y más cerca.',
    }, { status: 422 })
  }

  // Actualizar contador en DB
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      cartulinasHoy: usadasHoy + resultados.length,
      cartulinasFecha: new Date(),
    },
  }).catch(() => {})

  const datos = resultados.length === 1 ? resultados[0] : fusionarResultados(resultados)

  return NextResponse.json({
    ok: true,
    datos,
    fotosProcesadas: resultados.length,
    advertencias: [
      ...(datos._advertencia ? [datos._advertencia] : []),
      ...erroresFotos,
    ],
    uso: { usadas: usadasHoy + resultados.length, limite },
  })
}
