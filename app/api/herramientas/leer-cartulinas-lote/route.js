// app/api/herramientas/leer-cartulinas-lote/route.js
//
// ══ EL LOTE ═══════════════════════════════════════════════════════════════
//
// «Que le tome las fotos, bam, bam, 10, 20, 50 fotos, y que ya el sistema le
// construya todos los clientes y todos los préstamos, con una pantalla donde
// después puedan editarlos uno a uno.»
//
// El endpoint de al lado (`leer-cartulina`) acepta hasta 5 fotos pero las
// FUSIONA en un solo cliente: está pensado para varias cartulinas de la misma
// persona. Nunca puede devolver más de uno. Este devuelve tantos como haya.
//
// ── LAS TRES FORMAS QUE HAY QUE SOPORTAR ──
// El dueño lo confirmó: sus clientes llevan los registros de las tres maneras.
//   (a) una cartulina por persona     → 1 foto = 1 cliente
//   (b) una hoja de cuaderno con lista → 1 foto = 30 clientes
//   (c) mezclado
// Por eso el modelo devuelve `tipo` además de los clientes: la pantalla no
// tiene por qué preguntárselo al usuario foto por foto.
//
// ── ⚠ UNA FOTO MALA NO TUMBA EL LOTE ──
// Alguien que sube veinte fotos del cuaderno va a colar una borrosa, una del
// dedo y una del techo. Si el lote fuera todo-o-nada, perdería las diecisiete
// buenas y volvería a empezar. Cada foto va por su cuenta y las que fallen se
// devuelven listadas con su número, para que sepa cuál repetir.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  PROMPT_LOTE, procesarImagen, normalizarCliente, semaforo, limiteDelDia,
} from '@/lib/cartulina'

/* Cuántas fotos entran de una vez. Treinta es un cuaderno entero; por encima
   la espera se hace larga y conviene partir en dos tandas. */
const MAX_FOTOS = 30
/* Cuántas se leen a la vez. Cuatro es el equilibrio entre no hacer esperar y
   no disparar el 429 de Google con nuestras propias peticiones. */
const A_LA_VEZ = 4
const MAX_MB = 10 * 1024 * 1024

/** JPEG, PNG o WebP mirando los primeros bytes, no la extensión. */
function tipoDeImagen(b) {
  if (b[0] === 0xFF && b[1] === 0xD8) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png'
  if (b[0] === 0x52 && b[3] === 0x57) return 'image/webp'
  return null
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

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
    return NextResponse.json({
      error: `Máximo ${MAX_FOTOS} fotos por tanda. Sube estas y luego las siguientes.`,
    }, { status: 400 })
  }

  if (usadasHoy + fotos.length > limite) {
    const restantes = Math.max(0, limite - usadasHoy)
    return NextResponse.json({
      error: restantes > 0
        ? `Te quedan ${restantes} lecturas por hoy. Sube ${restantes} y sigue mañana, o escribe el resto a mano.`
        : `Ya usaste tus ${limite} lecturas de hoy. Se renuevan a medianoche.`,
      codigo: 'LIMITE_ALCANZADO', limite, usadas: usadasHoy, restantes,
    }, { status: 429 })
  }

  /* ── Leer los bytes ANTES de repartir el trabajo ──
     `formData` da objetos perezosos: si se leyeran dentro de las tandas, la
     petición podría haberse cerrado ya y el buffer llegar vacío. */
  const preparadas = []
  const fallos = []
  for (let i = 0; i < fotos.length; i++) {
    const f = fotos[i]
    if (!f || typeof f.arrayBuffer !== 'function') { fallos.push({ foto: i + 1, error: 'formato inválido' }); continue }
    const buffer = Buffer.from(await f.arrayBuffer())
    if (buffer.length > MAX_MB) { fallos.push({ foto: i + 1, error: 'supera 10MB' }); continue }
    const mime = tipoDeImagen(buffer)
    if (!mime) { fallos.push({ foto: i + 1, error: 'no es JPEG, PNG ni WebP' }); continue }
    preparadas.push({ i, buffer, mime })
  }

  // ── Leerlas, de cuatro en cuatro ──
  const clientes = []
  const porFoto = []

  for (let inicio = 0; inicio < preparadas.length; inicio += A_LA_VEZ) {
    const tanda = preparadas.slice(inicio, inicio + A_LA_VEZ)
    await Promise.all(tanda.map(async ({ i, buffer, mime }) => {
      try {
        /* 2000px y 4096 tokens: una hoja de cuaderno con treinta renglones no
           cabe en los 1600/1024 de una cartulina suelta — los números de la
           última columna se pierden y la respuesta se corta a la mitad. */
        const json = await procesarImagen(buffer, mime, PROMPT_LOTE, { lado: 2000, maxTokens: 4096 })
        // El modelo a veces devuelve el array pelado en vez del objeto.
        const lista = Array.isArray(json) ? json : (json?.clientes ?? [])
        const tipo = Array.isArray(json) ? (lista.length > 1 ? 'lista' : 'cartulina') : (json?.tipo ?? 'cartulina')

        const leidos = lista
          .map(normalizarCliente)
          // Sin nombre NI monto no hay nada que revisar: es un renglón vacío
          // del cuaderno, no un cliente. Colarlo obliga a borrarlo a mano.
          .filter((c) => c.nombre || c.montoPrestado)
          .map((c) => ({ ...c, _foto: i + 1, _estado: semaforo(c) }))

        clientes.push(...leidos)
        porFoto.push({ foto: i + 1, tipo, encontrados: leidos.length })
      } catch (e) {
        fallos.push({ foto: i + 1, error: e.message })
      }
    }))
  }

  /* El contador cuenta FOTOS LEÍDAS, no clientes encontrados: lo que cuesta
     dinero es la llamada a Gemini. Una hoja con treinta clientes es una sola
     lectura, y esa es justamente la vía que queremos premiar. */
  const leidas = porFoto.length
  if (leidas > 0) {
    await prisma.organization.update({
      where: { id: orgId },
      data: { cartulinasHoy: usadasHoy + leidas, cartulinasFecha: new Date() },
    }).catch(() => {})
  }

  if (!clientes.length) {
    return NextResponse.json({
      error: fallos.length
        ? `No pudimos leer ninguna foto. ${fallos.map((f) => `Foto ${f.foto}: ${f.error}`).join('. ')}`
        : 'No encontramos ningún cliente en las fotos. Prueba con más luz y más cerca.',
      fallos,
    }, { status: 422 })
  }

  return NextResponse.json({
    ok: true,
    clientes,
    porFoto,
    fallos,
    uso: { usadas: usadasHoy + leidas, limite },
  })
}
