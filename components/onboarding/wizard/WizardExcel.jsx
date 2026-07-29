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

export default function WizardExcel({ onComplete, onSkip }) {
  const { formatMoney } = useCountry()
  const [lectura, setLectura] = useState(null)
  const [enMiles, setEnMiles] = useState(null)   // null = todavía no ha contestado
  const [error, setError] = useState('')
  const [creando, setCreando] = useState(false)

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

  const vista = lectura
    ? adaptarRevision({ ...lectura, filas: filasEscaladas() }, (n) => formatMoney(n))
    : null

  const crear = async () => {
    setCreando(true)
    setError('')
    try {
      const hoy = new Date().toISOString().slice(0, 10)
      const { filas, descartadas } = aCargaMasiva(filasEscaladas(), {
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
          <input type="file" accept=".xlsx,.xls,.csv" onChange={elegirArchivo} style={{ display: 'none' }} />
        </label>

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
        filas={vista.filas}
        total={vista.total}
        cartera={vista.cartera}
        deColumna={vista.deColumna}
        // Contestada la pregunta, la franja se retira: ya no hay decisión que tomar.
        escala={enMiles === null ? vista.escala : null}
        onConfirmarEscala={setEnMiles}
        onCrear={crear}
        creando={creando}
      />
    </div>
  )
}
