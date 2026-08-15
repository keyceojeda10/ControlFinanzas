'use client'

// components/onboarding/wizard/WizardExcel.jsx — la vía «Un Excel o CSV».
//
// Trae la revisión DENTRO del asistente. Antes esta opción sacaba a la persona
// a /carga-masiva a mitad del flujo, y quien sale de un flujo de tres minutos
// para aterrizar en otra pantalla no vuelve.
//
// El archivo se lee en el teléfono, no se sube: mientras no se confirme, la
// cartera de nadie sale del dispositivo.

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { leerExcel } from '@/lib/importar/excel'
import { aCargaMasiva } from '@/lib/importar/aCargaMasiva'
import { adaptarRevision } from '@/lib/adaptadores/revision'
import RevisionCarga from '@/components/pantallas/RevisionCarga'
import { useCountry } from '@/hooks/useCountry'
import { ACCEPT_TABLA, AVISO_HOJA_DE_GOOGLE } from '@/lib/archivos-tabla'

export default function WizardExcel({ onComplete, onSkip }) {
  const { formatMoney } = useCountry()
  const [lectura, setLectura] = useState(null)
  const [enMiles, setEnMiles] = useState(null)   // null = todavía no ha contestado
  const [error, setError] = useState('')
  const [creando, setCreando] = useState(false)

  // LO QUE LA PERSONA CORRIGE A MANO, por índice de fila y campo.
  //
  // Esto no existía: la revisión enseñaba un campo para escribir la cédula que
  // faltaba, y lo que se importaba salía de la lectura del archivo. O sea que se
  // escribía el dato, se pulsaba «crear los N clientes» y el cliente entraba sin
  // él — en la pantalla que es «la clave, porque ahí es donde se abandona».
  const [correcciones, setCorrecciones] = useState({})

  const corregir = (indice, campo, valor) => {
    setCorrecciones((c) => ({ ...c, [`${indice}.${campo}`]: valor }))
  }

  const elegirArchivo = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const hoja = wb.Sheets[wb.SheetNames[0]]
      const r = leerExcel(XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: '' }))
      if (r.error) { setError(r.error); return }
      if (!r.filas.length) { setError('El archivo no tiene filas que pueda leer'); return }
      setLectura(r)
      // Si no hay sospecha de escala, no hay nada que preguntar.
      setEnMiles(r.escala?.sospecha ? null : false)
    } catch {
      setError('No pude abrir el archivo. ¿Es un Excel o un CSV?')
    }
  }

  // La escala se aplica AQUÍ y no en el lector, porque hasta que la persona no
  // contesta no sabemos cuál es. El lector propone; esto dispone.
  const filasEscaladas = () => {
    if (!lectura) return []
    if (enMiles !== false) return lectura.filas
    // Contestó «son pesos»: se deshace el ×1000 que el lector había propuesto.
    const f = lectura.escala?.factor ?? 1
    if (f === 1) return lectura.filas
    return lectura.filas.map((x) => ({
      ...x,
      capital: x.capital == null ? null : x.capital / f,
      cuota: x.cuota == null ? null : x.cuota / f,
      saldo: x.saldo == null ? null : x.saldo / f,
    }))
  }

  const puesto = (i, campo) => String(correcciones[`${i}.${campo}`] ?? '').trim()

  // LO QUE SE IMPORTA lleva las correcciones aplicadas y sin el reparo: el dato ya
  // está, así que ya no falta nada.
  const filasCorregidas = () => filasEscaladas().map((f, i) => {
    const resueltos = (f.reparos ?? []).map((r) => r.campo).filter((c) => puesto(i, c) !== '')
    if (!resueltos.length) return f
    const nuevo = { ...f }
    for (const campo of resueltos) nuevo[campo] = puesto(i, campo)
    nuevo.reparos = (f.reparos ?? []).filter((r) => !resueltos.includes(r.campo))
    return nuevo
  })

  // LO QUE SE MUESTRA conserva los reparos, aunque ya estén escritos. Si se
  // quitaran, la tarjeta se cerraría en la primera tecla y el campo desaparecería
  // mientras la persona escribe. El adaptador ve las filas tal cual salieron del
  // archivo; lo que cambia con la corrección es solo el estado de la fila.
  const vista = lectura
    ? adaptarRevision({ ...lectura, filas: filasEscaladas() }, (n) => formatMoney(n))
    : null

  const filasParaRevisar = (vista?.filas ?? []).map((f, i) => {
    const reparos = (f.reparos ?? []).map((r) => ({ ...r, valor: correcciones[`${i}.${r.campo}`] ?? '' }))
    const resuelta = reparos.length > 0 && reparos.every((r) => String(r.valor).trim() !== '')
    return {
      ...f,
      reparos,
      // Corregida del todo: el punto pasa a verde y la línea deja de decir que
      // falta algo. Es el único acuse de recibo que tiene esta pantalla.
      revisar: f.revisar && !resuelta,
      contexto: resuelta ? 'Corregido a mano' : f.contexto,
    }
  })

  const crear = async () => {
    setCreando(true)
    setError('')
    try {
      const hoy = new Date().toISOString().slice(0, 10)
      const { filas, descartadas } = aCargaMasiva(filasCorregidas(), {
        // La semilla evita que dos importaciones seguidas choquen contra el
        // índice único (organizationId, cedula) con los mismos marcadores.
        semilla: Math.random().toString(36).slice(2, 6),
        hoy,
      })
      if (!filas.length) { setError('No hay ninguna fila que se pueda importar'); return }

      const res = await fetch('/api/carga-masiva/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filas }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'No pude importar el archivo'); return }

      // Lo que la pantalla «Listo» necesita para decir la verdad: la cartera
      // que entró y lo que quedó a medias. Los reparos que ya se calcularon en
      // la revisión se reusan tal cual — recontarlos allí sería otra ocasión de
      // que las dos pantallas no coincidan.
      onComplete?.({
        clientesCreados: data.resumen?.exitosos ?? filas.length,
        prestamosCreados: data.prestamosCreados ?? filas.length,
        cartera: filas.reduce((t, x) => t + (x.montoPrestado ?? 0), 0),
        faltantes: [...vista.deColumna, ...vista.porFila].map((r) => ({ texto: r.texto })),
        descartadas,
      })
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setCreando(false)
    }
  }

  if (!lectura) {
    return (
      <div className="max-w-lg mx-auto flex flex-col" style={{ gap: 18 }}>
        <div>
          <h2 style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 22, fontWeight: 600, letterSpacing: '-.02em',
            color: 'var(--cf-ink)', margin: 0, lineHeight: 1.2,
          }}>
            Sube el archivo que ya tengas
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--cf-ink-2)', marginTop: 6, lineHeight: 1.45 }}>
            Excel o CSV. Lo leo aquí en tu teléfono y te enseño lo que encontré
            antes de crear nada.
          </p>
        </div>

        {error && <p style={{ fontSize: 13, color: 'var(--cf-red-darker)', margin: 0 }}>{error}</p>}

        <label style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 8, padding: '30px 20px', cursor: 'pointer', textAlign: 'center',
          borderRadius: 'var(--cf-r-card)', background: 'var(--cf-card)',
          border: '1px dashed var(--cf-border-strong)',
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)"
            strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
            <path d="M14 3v5h5M8.5 12.5h7M8.5 16h7M12 12.5V16" />
          </svg>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--cf-ink)' }}>
            Elegir el archivo
          </span>
          <input type="file" accept={ACCEPT_TABLA} onChange={elegirArchivo} style={{ display: 'none' }} />
        </label>

        {/* ⚠ EL SELECTOR DE ANDROID NO PUEDE ELEGIR UNA HOJA DE GOOGLE.
            No es un archivo con bytes, es un documento del servicio: hay que
            exportarlo. Ningún `accept` lo arregla, así que se dice aquí —sin
            esto la persona ve su archivo en la lista, lo toca, no pasa nada, y
            concluye que la app no sirve—. */}
        <p style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--cf-ink-3)', margin: 0, textAlign: 'center' }}>
          {AVISO_HOJA_DE_GOOGLE}
        </p>

        <button type="button" onClick={onSkip} style={{
          alignSelf: 'center', background: 'none', border: 0, cursor: 'pointer',
          fontSize: 13, color: 'var(--cf-ink-3)', textDecoration: 'underline', textUnderlineOffset: 3,
        }}>
          Empezar con la cartera vacía
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      {error && (
        <p style={{ fontSize: 13, color: 'var(--cf-red-darker)', margin: '0 0 12px' }}>{error}</p>
      )}
      <RevisionCarga
        titulo={vista.titulo}
        detalle={vista.detalle}
        filas={filasParaRevisar}
        total={vista.total}
        cartera={vista.cartera}
        deColumna={vista.deColumna}
        // Contestada la pregunta, la franja se retira: ya no hay decisión que tomar.
        escala={enMiles === null ? vista.escala : null}
        onConfirmarEscala={setEnMiles}
        onCorregir={corregir}
        onCrear={crear}
        creando={creando}
      />
    </div>
  )
}
