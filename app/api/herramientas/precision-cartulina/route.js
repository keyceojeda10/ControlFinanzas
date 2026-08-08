// app/api/herramientas/precision-cartulina/route.js
//
// ══ QUE EL SISTEMA MIDA SU PROPIA PRECISIÓN ═══════════════════════════════
//
// Esto existe porque **no se pudo medir el OCR antes de construirlo**: no había
// fotos reales de cartulinas con qué probarlo. Lo honesto no era asumir que
// funciona, era hacer que se mida solo con los primeros usuarios de verdad.
//
// Cada vez que alguien crea clientes desde un lote de fotos se anota, campo por
// campo, qué trajo la IA y qué quedó guardado. De ahí sale la tabla que hoy no
// existe:
//
//   nombre     92 % acierta · 6 % corregido · 2 % lo escribió el usuario
//   monto      78 % · 19 % · 3 %
//   tasa       31 % · … ← si sale así, el prompt no sirve para la tasa y se quita
//
// Con esa tabla se decide si el OCR merece más trabajo o si hay que cambiar de
// estrategia, en vez de discutirlo a ojo.
//
// ⚠ NO SE GUARDA NADA DEL CLIENTE FINAL. Ni el nombre, ni la cédula, ni el
// teléfono, ni el monto. Solo el VEREDICTO por campo —acertó, se corrigió, no
// vino— porque para saber si el OCR sirve no hace falta guardar la deuda de
// nadie. La foto tampoco se guarda: se procesa y se descarta.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logActividad } from '@/lib/activity-log'

const CAMPOS = ['nombre', 'cedula', 'telefono', 'direccion', 'montoPrestado', 'tasaInteres', 'frecuencia', 'diasPlazo']

/** Normaliza para comparar: la IA trae «1.500.000» y el campo guarda 1500000. */
const comparable = (v) => {
  if (v == null || v === '') return null
  if (typeof v === 'number') return String(v)
  return String(v).trim().toLowerCase().replace(/[.\s-]/g, '')
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const filas = Array.isArray(body?.filas) ? body.filas.slice(0, 500) : []
  if (!filas.length) return NextResponse.json({ ok: true, filas: 0 })

  // { nombre: { acerto, corregido, ausente }, … }
  const tabla = {}
  for (const campo of CAMPOS) tabla[campo] = { acerto: 0, corregido: 0, ausente: 0 }

  for (const fila of filas) {
    for (const campo of CAMPOS) {
      const ia = comparable(fila?.ia?.[campo])
      const fin = comparable(fila?.final?.[campo])
      if (ia == null) {
        // La IA no lo trajo. Solo cuenta como «ausente» si el dato existía de
        // verdad: si al final tampoco hay nada, no había nada que leer y
        // apuntárselo en contra sería mentir sobre su precisión.
        if (fin != null) tabla[campo].ausente++
      } else if (ia === fin) {
        tabla[campo].acerto++
      } else {
        tabla[campo].corregido++
      }
    }
  }

  logActividad({
    session,
    accion: 'ocr_precision',
    entidadTipo: 'cliente',
    detalle: JSON.stringify({ filas: filas.length, tabla }),
  })

  return NextResponse.json({ ok: true, filas: filas.length })
}
