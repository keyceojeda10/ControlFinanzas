'use client'

// components/pantallas/config/TuNegocio.jsx — sección «Tu negocio».
//
// Construido mirando la lámina: dos filas. Arriba, nombre del negocio y
// WhatsApp. Abajo, país y moneda, formato de los montos, y el tema en un
// selector de tres —Claro · Oscuro · Auto—.
//
// Sin botón «Guardar», igual que «Cómo prestas»: son ajustes que no crean nada.
// El estado va en la línea del título, que es donde se mira.

import { useCallback, useEffect, useRef, useState } from 'react'

const ROTULO = {
  display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
  textTransform: 'uppercase', color: 'var(--cf-ink-3)', marginBottom: 6,
}

const CONTROL = {
  height: 46, padding: '0 13px', borderRadius: 'var(--cf-r-control)',
  background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
  outline: 'none', fontSize: 15, color: 'var(--cf-ink)', width: '100%',
}

export default function TuNegocio({ inicial = {}, paises = [], tema, onTema, onGuardar, enlacePais }) {
  const [nombre, setNombre] = useState(inicial.nombre ?? '')
  const [telefono, setTelefono] = useState(inicial.telefono ?? '')
  // La lámina no dibuja «Ciudad», pero el formulario anterior SÍ la tenía y la
  // mandaba en el mismo PATCH. Sin esto, montar esta sección borra un dato que
  // hoy se puede escribir —y en silencio, porque nada falla: simplemente deja
  // de viajar—. La lámina enseña la sección, no autoriza a perder un campo.
  const [ciudad, setCiudad] = useState(inicial.ciudad ?? '')
  const [estado, setEstado] = useState(null)
  const primera = useRef(true)
  const t = useRef(null)

  const guardar = useCallback(async (campos) => {
    setEstado('guardando')
    try {
      const res = await fetch('/api/configuracion/organizacion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campos),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setEstado(data.error ?? 'No se pudo guardar'); return }
      setEstado('guardado')
      onGuardar?.(data.org)
    } catch { setEstado('Error de conexión') }
  }, [onGuardar])

  useEffect(() => {
    if (primera.current) { primera.current = false; return }
    clearTimeout(t.current)
    // Más espera que en los desplegables: aquí se ESCRIBE, y guardar en cada
    // tecla manda medio nombre del negocio al servidor.
    t.current = setTimeout(() => guardar({
      nombre: nombre.trim(), telefono: telefono.trim(), ciudad: ciudad.trim(),
    }), 800)
    return () => clearTimeout(t.current)
  }, [nombre, telefono, ciudad, guardar])

  useEffect(() => {
    if (estado !== 'guardado') return
    const x = setTimeout(() => setEstado(null), 2400)
    return () => clearTimeout(x)
  }, [estado])

  const problema = estado && estado !== 'guardando' && estado !== 'guardado'

  return (
    <section style={{
      padding: '20px 22px', borderRadius: 'var(--cf-r-card)',
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 14, marginBottom: 15,
      }}>
        <span style={{ ...ROTULO, marginBottom: 0 }}>Tu negocio</span>
        <span style={{ fontSize: 12.5, color: 'var(--cf-ink-3)' }}>
          {estado === 'guardando' ? 'Guardando…'
            : estado === 'guardado' ? <span style={{ color: 'var(--cf-green-dark)', fontWeight: 700 }}>Guardado</span>
            : problema ? <span style={{ color: 'var(--cf-red-darker)', fontWeight: 700 }}>{estado}</span>
            : null}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
        <label>
          <span style={ROTULO}>Nombre del negocio</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={CONTROL} />
        </label>
        <label>
          <span style={ROTULO}>WhatsApp</span>
          <input
            type="text" inputMode="tel"
            value={telefono} onChange={(e) => setTelefono(e.target.value)}
            style={CONTROL}
          />
        </label>
        <label>
          <span style={ROTULO}>Ciudad</span>
          <input
            value={ciudad} onChange={(e) => setCiudad(e.target.value)}
            placeholder="Ej: Bogotá" style={CONTROL}
          />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginTop: 14 }}>
        <label>
          <span style={ROTULO}>País y moneda</span>
          {/* NO se edita aquí. Cambiar el país cambia la moneda de toda la
              cartera, y eso no puede pasar por tocar un desplegable sin más:
              se pide por soporte. Se enseña para que se pueda comprobar. */}
          <div style={{ ...CONTROL, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, color: 'var(--cf-ink-2)' }}>
            <span>{inicial.paisNombre ?? '—'}</span>
            {/* La salida tiene que estar A LA VISTA. Decir «se pide por soporte»
                sin dar por dónde deja al dueño sin camino: el formulario
                anterior sí llevaba el enlace y perderlo convierte un dato
                cambiable en uno atascado. */}
            {enlacePais && (
              <a
                href={enlacePais} target="_blank" rel="noopener noreferrer"
                style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 8,
                  whiteSpace: 'nowrap', color: 'var(--cf-gold)',
                  background: 'color-mix(in srgb, var(--cf-gold) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--cf-gold) 25%, transparent)',
                }}
              >
                Cambiar
              </a>
            )}
          </div>
        </label>

        <label>
          <span style={ROTULO}>Formato de los montos</span>
          <div style={{ ...CONTROL, display: 'flex', alignItems: 'center' }} className="cf-fig">
            {inicial.ejemploMonto ?? '—'}
          </div>
        </label>

        <div>
          <span style={ROTULO}>Tema</span>
          {/* Tres opciones, no un interruptor: «Auto» no es un estado
              intermedio entre claro y oscuro, es una tercera decisión. */}
          <div style={{
            display: 'flex', gap: 4, padding: 4, borderRadius: 'var(--cf-r-control)',
            background: 'var(--cf-fill)', border: '1px solid var(--cf-border)',
          }}>
            {[{ id: 'light', n: 'Claro' }, { id: 'dark', n: 'Oscuro' }, { id: 'system', n: 'Auto' }].map((o) => {
              const puesto = tema === o.id
              return (
                <button key={o.id} type="button" onClick={() => onTema?.(o.id)} style={{
                  flex: 1, height: 36, borderRadius: 9, border: 0, cursor: 'pointer',
                  fontSize: 13.5, fontWeight: puesto ? 700 : 600,
                  background: puesto ? 'var(--cf-card)' : 'transparent',
                  color: puesto ? 'var(--cf-ink)' : 'var(--cf-ink-3)',
                  boxShadow: puesto ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
                }}>
                  {o.n}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
