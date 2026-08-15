// app/api/herramientas/leer-cartulina/route.js
//
// UNA persona, una o varias fotos SUYAS. Es el camino de «agregar este cliente
// con foto» que usan `/migrador`, `/clientes/nuevo`, `ImportarCartulina` y el
// asistente de arranque.
//
// ⚠ NO CONFUNDIR CON `leer-cartulinas-lote`. Este FUSIONA las fotos en un solo
// cliente —está pensado para el reverso de la cartulina, o para la segunda
// cartulina del mismo señor— y por eso nunca devuelve más de uno. El del lote
// es el que convierte veinte fotos en veinte clientes.
//
// El transporte (llamada a Gemini, rotación de claves, redimensionado, límites)
// vive en `lib/cartulina.js` desde que hay dos endpoints. Aquí queda lo propio
// de este caso: la fusión y el contrato de respuesta que esperan las cuatro
// pantallas que ya lo usan.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  PROMPT_UNO, procesarImagen, normalizarCliente, limiteDelDia,
} from '@/lib/cartulina'
import { trackEvent } from '@/lib/analytics'

const MAX_FOTOS = 5
const MAX_MB = 10 * 1024 * 1024

function tipoDeImagen(b) {
  if (b[0] === 0xFF && b[1] === 0xD8) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png'
  if (b[0] === 0x52 && b[3] === 0x57) return 'image/webp'
  return null
}

/* Varias fotos de la MISMA persona. Los datos de identidad se toman de la
   primera que los traiga; lo que se acumula entre cartulinas —cuotas pagadas y
   abonos— se suma. */
function fusionar(resultados) {
  const identidad = ['nombre', 'cedula', 'telefono', 'direccion', 'montoPrestado',
    'tasaInteres', 'frecuencia', 'diasPlazo', 'saldoPendiente', 'notas']
  const merged = {}
  for (const campo of identidad) {
    for (const r of resultados) {
      if (r[campo] !== undefined && r[campo] !== null && r[campo] !== '') { merged[campo] = r[campo]; break }
    }
  }
  const fechas = resultados.map((r) => r.fechaInicio).filter(Boolean).sort()
  if (fechas.length) merged.fechaInicio = fechas[0]

  const suma = (c) => resultados.reduce((a, r) => a + (Number(r[c]) || 0), 0)
  if (suma('cuotasPagadas')) merged.cuotasPagadas = suma('cuotasPagadas')
  if (suma('montoPagadoHasta')) merged.montoPagadoHasta = suma('montoPagadoHasta')

  /* Si el monto prestado no coincide entre cartulinas, alguien se equivocó —o
     son dos préstamos distintos. Se avisa en vez de elegir uno en silencio:
     ese número es el que decide toda la deuda. */
  const montos = resultados.map((r) => Number(r.montoPrestado)).filter(Boolean)
  if (montos.length > 1 && new Set(montos).size > 1) {
    merged._advertencia = `Detectamos montos distintos entre cartulinas (${montos.join(', ')}). Verifica cuál es el correcto.`
  }
  return merged
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  /* ⚠ EL LECTOR DE FOTOS NO DEJABA NI UN RASTRO.
   *
   * 17 de los 29 que se registraron con la campaña nueva no pasaron de «traer
   * tu cartera»: nueve se quedaron ahí y ocho la saltaron. Pero no había forma
   * de saber si INTENTARON la foto y les falló, o si ni la intentaron —y son
   * dos problemas distintos con dos arreglos distintos—.
   *
   * Se apunta el resultado de cada lectura con su duración. Nada más: sin esto
   * el rediseño del paso sería a ciegas, y con esto se decide con datos. */
  const arranque = Date.now()

  const orgId = session.user.organizationId
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { cartulinasHoy: true, cartulinasFecha: true, createdAt: true },
  })

  const limite = limiteDelDia(session.user.plan ?? 'basic', org?.createdAt)
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const fechaOrg = org?.cartulinasFecha ? new Date(org.cartulinasFecha) : null
  const usadasHoy = (fechaOrg && fechaOrg >= hoy) ? (org.cartulinasHoy ?? 0) : 0

  let formData
  try { formData = await req.formData() } catch {
    return NextResponse.json({ error: 'Formato de solicitud inválido' }, { status: 400 })
  }

  const fotos = formData.getAll('fotos')
  if (!fotos.length) return NextResponse.json({ error: 'No se recibió ninguna imagen' }, { status: 400 })
  if (fotos.length > MAX_FOTOS) {
    return NextResponse.json({ error: `Máximo ${MAX_FOTOS} fotos por importación` }, { status: 400 })
  }

  if (usadasHoy + fotos.length > limite) {
    const restantes = Math.max(0, limite - usadasHoy)
    trackEvent({
      organizationId: orgId, userId: session.user.id,
      evento: 'cartulina_leida', pagina: '/api/herramientas/leer-cartulina',
      metadata: { ok: false, via: 'una', motivo: 'limite', fotos: fotos.length, limite, usadas: usadasHoy, ms: Date.now() - arranque },
    })
    return NextResponse.json({
      error: restantes > 0
        ? `Solo te quedan ${restantes} lecturas de foto por hoy. Sube ${restantes} foto${restantes === 1 ? '' : 's'} ahora, o carga el resto de tu cartera de una vez con un Excel.`
        : `Ya usaste tus ${limite} lecturas de foto de hoy (se renuevan a medianoche). Si quieres seguir ahora, puedes subir tu cartera con un Excel o registrar el cliente a mano.`,
      codigo: 'LIMITE_ALCANZADO', limite, usadas: usadasHoy, restantes,
    }, { status: 429 })
  }

  const resultados = []
  const erroresFotos = []

  for (let i = 0; i < fotos.length; i++) {
    const foto = fotos[i]
    if (!foto || typeof foto.arrayBuffer !== 'function') { erroresFotos.push(`Foto ${i + 1}: formato inválido`); continue }
    const buffer = Buffer.from(await foto.arrayBuffer())
    if (buffer.length > MAX_MB) { erroresFotos.push(`Foto ${i + 1}: supera el límite de 10MB`); continue }
    const mime = tipoDeImagen(buffer)
    if (!mime) { erroresFotos.push(`Foto ${i + 1}: formato no soportado (usa JPEG, PNG o WebP)`); continue }

    try {
      const crudo = await procesarImagen(buffer, mime, PROMPT_UNO)
      // ⚠ NORMALIZADO AQUÍ, no en cada pantalla. El prompt pide «cedula» sin
      // tilde y el modelo devuelve «cédula» a menudo; las pantallas hacían
      // `d['cédula'] || d.cedula` a mano campo por campo, y `WizardCartulina`
      // solo miraba la versión sin tilde — o sea que ahí la cédula se perdía.
      resultados.push(normalizarCliente(crudo ?? {}))
    } catch (e) {
      erroresFotos.push(`Foto ${i + 1}: ${e.message}`)
    }
  }

  if (!resultados.length) {
    trackEvent({
      organizationId: orgId, userId: session.user.id,
      evento: 'cartulina_leida', pagina: '/api/herramientas/leer-cartulina',
      metadata: { ok: false, via: 'una', motivo: 'ilegible', fotos: fotos.length, errores: erroresFotos.slice(0, 3), ms: Date.now() - arranque },
    })
    return NextResponse.json({
      error: erroresFotos.length
        ? erroresFotos.join('. ')
        : 'No pudimos leer la foto. Intenta con mejor iluminación y más cerca.',
    }, { status: 422 })
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { cartulinasHoy: usadasHoy + resultados.length, cartulinasFecha: new Date() },
  }).catch(() => {})

  const datos = resultados.length === 1 ? resultados[0] : fusionar(resultados)

  trackEvent({
    organizationId: orgId, userId: session.user.id,
    evento: 'cartulina_leida', pagina: '/api/herramientas/leer-cartulina',
    metadata: {
      ok: true, via: 'una', fotos: fotos.length, leidas: resultados.length,
      fallidas: erroresFotos.length, ms: Date.now() - arranque,
      // Si el lector saca el nombre pero no el monto, la pantalla siguiente
      // queda a medias y el usuario tiene que escribirlo igual.
      conNombre: !!datos.nombre, conMonto: datos.montoPrestado != null,
    },
  })

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
