'use client'
// app/estilo/procesando — banco de pruebas de la pantalla «estoy en eso».
// Sin sesión y sin datos: simula una operación que tarda lo que se elija, para
// ver la pantalla en un teléfono de verdad sin registrar nada.
import { useState } from 'react'
import { conPantalla, GUIONES } from '@/components/cf/Procesando'

const ESPERAS = [400, 1500, 3000, 5000]

// Fuera del componente: mide lo que tarda la pantalla en irse.
async function medir(guion, espera) {
  const desde = Date.now()
  await conPantalla(guion, () => new Promise((r) => setTimeout(r, espera)))
  return Date.now() - desde
}

export default function PruebaProcesando() {
  const [espera, setEspera] = useState(3000)
  const [ultimo, setUltimo] = useState(null)

  const probar = async (guion) => {
    const total = await medir(guion, espera)
    setUltimo(`${guion}: el servidor tardó ${espera} ms y la pantalla se fue a los ${total} ms`)
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--cf-surface)', color: 'var(--cf-ink)', padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 520, margin: '0 auto' }}>
      <h1 className="cf-fig" style={{ fontSize: 26, letterSpacing: '-.03em' }}>Pantalla de proceso</h1>
      <p style={{ fontSize: 14, color: 'var(--cf-ink-3)', lineHeight: 1.5 }}>
        Elige cuánto tarda «el servidor» y toca una operación. Aquí no se registra nada.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {ESPERAS.map((ms) => (
          <button key={ms} type="button" onClick={() => setEspera(ms)} style={{
            height: 38, padding: '0 14px', borderRadius: 12, cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 700,
            background: espera === ms ? 'var(--cf-ink)' : 'var(--cf-card)', color: espera === ms ? 'var(--cf-card)' : 'var(--cf-ink-2)',
            border: '1px solid var(--cf-border)',
          }}>{ms / 1000} s</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Object.keys(GUIONES).map((g) => (
          <button key={g} type="button" onClick={() => probar(g)} style={{
            height: 52, borderRadius: 14, cursor: 'pointer', font: 'inherit', fontSize: 15, fontWeight: 700, textAlign: 'left', padding: '0 18px',
            background: 'var(--cf-card)', color: 'var(--cf-ink)', border: '1px solid var(--cf-border)',
          }}>{GUIONES[g].pasos[0]}</button>
        ))}
      </div>
      {ultimo && <p className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{ultimo}</p>}
    </main>
  )
}
