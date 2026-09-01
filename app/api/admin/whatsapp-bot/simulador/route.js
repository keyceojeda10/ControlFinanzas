// app/api/admin/whatsapp-bot/simulador/route.js — probar el bot sin gastar un
// mensaje ni tocar un lead de verdad.
//
// ══ POR QUÉ ════════════════════════════════════════════════════════════════
//
// Hasta ahora la única forma de ver qué contesta el bot era esperar a que
// alguien le escribiera. Así no se ajusta un guion: se ajusta escribiéndole,
// leyendo lo que sale, cambiando una frase y volviendo a escribir.
//
// ══ LO QUE ESTO NO HACE, Y ES LO IMPORTANTE ════════════════════════════════
//
// **No manda nada por WhatsApp.** No se importa el emisor: aquí no hay forma de
// que salga un mensaje a un teléfono real ni por accidente.
//
// **No toca ningún lead.** El lead es un objeto en memoria con un `id` que no
// existe en la base. El único sitio donde el agente escribiría —marcar el lead
// como registrado— ya va dentro de un `try/catch` que se traga el fallo, así
// que no queda rastro.
//
// **No tiene su propia copia del guion.** Llama a `decidirDesdeAnuncio()` y a
// `responder()`, exactamente las mismas funciones que corren en el webhook. Un
// simulador con su propia copia sería peor que no tenerlo: se ajusta contra él,
// se despliega, y en WhatsApp sale otra cosa.
//
// ⚠ El modo «bot de siempre» SÍ llama al modelo y eso cuesta dinero de verdad
// (céntimos por turno). Es el precio de probar lo que de verdad va a contestar.

import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { decidirDesdeAnuncio } from '@/lib/bot/flujo-anuncio'
import { esBotonDeCartera, respuestaDeBoton as respuestaDeCartera,
         mensajeBienvenida, BOTONES_CARTERA } from '@/lib/bot/cartera-post-registro'

/* Un teléfono que no es de nadie: el prefijo 999 no existe en Colombia. Si
   algún día esto acabara mandando algo, no llegaría a una persona. */
const TELEFONO_FICTICIO = '999000000000'

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { modo = 'anuncio', texto = '', botonId = null, historial = [], registrado = false } =
    await req.json().catch(() => ({}))

  const turnos = Array.isArray(historial) ? historial : []
  const yaHablamos = turnos.filter((t) => t.rol === 'bot').length

  /* ── El momento post-registro se prueba aparte: en la vida real lo dispara el
     registro, no un mensaje. Aquí lo lanza el botón «Simular que se registró». */
  if (modo === 'registro') {
    return NextResponse.json({
      respuestas: [{
        texto: mensajeBienvenida(session.user.name?.split(' ')[0] || ''),
        botones: BOTONES_CARTERA,
      }],
      via: 'post-registro',
    })
  }

  if (botonId && esBotonDeCartera(botonId)) {
    const r = respuestaDeCartera(botonId)
    return NextResponse.json({
      respuestas: [{ texto: r.texto, botones: r.botones ?? [] }],
      via: 'post-registro',
      aviso: r.avisar ? 'se avisaría a un humano' : null,
    })
  }

  /* ── El bot de los anuncios ─────────────────────────────────────────────── */
  if (modo === 'anuncio') {
    const salida = await decidirDesdeAnuncio({ botonId, texto, yaHablamos, registrado })
    if (salida) {
      return NextResponse.json({
        respuestas: [{ texto: salida.texto, botones: salida.botones ?? [] }],
        via: 'flujo de anuncios (sin modelo)',
        aviso: salida.avisar ? `se avisaría a un humano: ${salida.avisar}` : null,
      })
    }
    /* Sin respuesta preparada cae al modelo, igual que en producción. */
  }

  /* ── El bot de siempre, o el texto libre del de anuncios ─────────────────
     `responder()` no manda nada: devuelve la decisión y el webhook es quien
     envía. Por eso se puede llamar desde aquí tal cual. */
  let responder
  try {
    ({ responder } = await import('@/lib/bot-v2/agente'))
  } catch (e) {
    return NextResponse.json({ error: `No pude cargar el agente: ${e.message}` }, { status: 500 })
  }

  const lead = {
    id: 'simulador-no-existe',
    nombre: 'Simulador',
    telefono: TELEFONO_FICTICIO,
    estado: registrado ? 'registrado' : 'interesado',
    organizationId: registrado ? (session.user.organizationId ?? null) : null,
    temperatura: 50,
    botActivo: true,
    anuncioId: modo === 'anuncio' ? 'simulador' : null,
    desdeAnuncioWa: modo === 'anuncio',
  }

  const historialAgente = turnos.map((t) => ({
    rol: t.rol,
    texto: t.texto,
    tipoMensaje: 'chat',
    createdAt: new Date(),
  }))

  let decision
  try {
    decision = await responder(lead, historialAgente, { texto, tipoMensaje: 'chat' })
  } catch (e) {
    console.error('[simulador-bot]', e.message)
    return NextResponse.json({ error: `El agente falló: ${e.message}` }, { status: 500 })
  }

  if (!decision) {
    return NextResponse.json({
      respuestas: [],
      via: 'el bot decidió no contestar (mensaje automático o vacío)',
    })
  }

  return NextResponse.json({
    respuestas: [{ texto: decision.mensaje, botones: [] }],
    via: `modelo${decision.usage?.modelo ? ` · ${decision.usage.modelo}` : ''}`,
    temperatura: decision.temperatura,
    aviso: decision.escalar ? `se avisaría a un humano: ${decision.motivo || 'escalar'}` : null,
    costoUsd: decision.usage?.costoUsd ?? 0,
  })
}
