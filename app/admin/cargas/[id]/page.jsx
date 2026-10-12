'use client'
// app/admin/cargas/[id]/page.jsx — revisar y aprobar una carga con asesor.
//
// Las filas que leyó el sistema (área de espera), editables, con el archivo
// original al lado: se toca una fila y se ve la foto o el PDF del que salió.
// «Aprobar e importar» guarda lo corregido y lo carga con el MISMO importador
// de la carga masiva. No se puede aprobar con filas en error ni si excede el plan.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { formatMoney } from '@/lib/i18n'
import { Checkbox } from '@/components/ui/Checkbox'

const COLUMNAS = [
  { k: 'nombre', t: 'Nombre', w: 170 },
  { k: 'cedula', t: 'Cédula', w: 110 },
  { k: 'telefono', t: 'Teléfono', w: 110 },
  { k: 'direccion', t: 'Dirección', w: 150 },
  { k: 'montoPrestado', t: 'Prestado', w: 100, num: true },
  { k: 'tasaInteres', t: 'Tasa %', w: 64, num: true },
  { k: 'numeroCuotas', t: 'Cuotas', w: 64, num: true },
  { k: 'diasPlazo', t: 'Días', w: 64, num: true },
  { k: 'frecuencia', t: 'Cada', w: 100, opciones: ['', 'diario', 'semanal', 'quincenal', 'mensual'] },
  { k: 'fechaInicio', t: 'Inicio', w: 104 },
  { k: 'abonadoHasta', t: 'Abonado', w: 96, num: true },
  { k: 'saldoActual', t: 'Saldo', w: 96, num: true },
]
const ESTADO_FILA = {
  valido: 'var(--cf-green-dark)', advertencia: 'var(--cf-gold-dark)', error: 'var(--cf-red-dark)', repetido: 'var(--cf-ink-3)',
}
const NOMBRE_ESTADO = { valido: 'Bien', advertencia: 'Con aviso', error: 'Falta algo', repetido: 'Ya estaba' }
const celda = { padding: '4px 4px', borderTop: '1px solid var(--cf-border)', verticalAlign: 'top' }
const campo = {
  width: '100%', height: 32, borderRadius: 8, border: '1px solid var(--cf-border)', background: 'var(--cf-surface)',
  color: 'var(--cf-ink)', fontSize: 13, padding: '0 6px', font: 'inherit',
}
const boton = (primario) => ({
  height: 40, padding: '0 16px', borderRadius: 13, font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  border: primario ? 0 : '1px solid var(--cf-border)',
  background: primario ? 'var(--cf-gold)' : 'var(--cf-card)', color: primario ? 'var(--cf-gold-ink)' : 'var(--cf-ink)',
})
const etiqueta = { fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }

export default function RevisarCarga() {
  const { id } = useParams()
  const router = useRouter()
  const [d, setD] = useState(null)
  const [filas, setFilas] = useState([])
  const [sucio, setSucio] = useState(false)
  const [archivo, setArchivo] = useState(1)
  const [soloDudosas, setSoloDudosas] = useState(false)
  const [relleno, setRelleno] = useState({ tasaInteres: '', frecuencia: '' })
  const [ruta, setRuta] = useState('')
  const [domingos, setDomingos] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState('')
  const [mensaje, setMensaje] = useState(null) // { tipo: 'ok'|'error', texto }

  const cargar = () => fetch(`/api/admin/cargas/${id}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('No se pudo abrir la carga'))))
    .then((j) => {
      setD(j)
      setFilas(j.solicitud.filas)
      setSucio(false)
      setDomingos(j.solicitud.resumen?.sinDomingosSugerido === true)
      if (j.solicitud.archivos[0]) setArchivo((a) => (j.solicitud.archivos.some((x) => x.n === a) ? a : j.solicitud.archivos[0].n))
    })
    .catch((e) => setMensaje({ tipo: 'error', texto: e.message }))
  useEffect(() => { cargar() }, [id])

  const editar = (i, k, v) => { setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, [k]: v } : f))); setSucio(true) }
  const quitar = (i) => { setFilas((fs) => fs.filter((_, j) => j !== i)); setSucio(true) }
  const agregar = () => { setFilas((fs) => [...fs, { nombre: '', _archivo: archivo, _dudas: ['Agregada a mano'] }]); setSucio(true); setSoloDudosas(false) }
  const rellenar = () => {
    setFilas((fs) => fs.map((f) => ({
      ...f,
      ...(relleno.tasaInteres !== '' && (f.tasaInteres == null || f.tasaInteres === '') ? { tasaInteres: relleno.tasaInteres } : {}),
      ...(relleno.frecuencia && !f.frecuencia ? { frecuencia: relleno.frecuencia } : {}),
    })))
    setSucio(true)
  }

  /* Una petición que se corta (red, tiempo) no puede dejar el botón en
     «Importando…» para siempre: se dice, y se recarga para ver cómo quedó. */
  const pedir = async (opciones) => {
    try {
      const r = await fetch(`/api/admin/cargas/${id}`, { ...opciones, headers: { 'Content-Type': 'application/json' } })
      return { r, j: await r.json().catch(() => ({})) }
    } catch {
      return { r: { ok: false }, j: { error: 'Se cortó la conexión antes de la respuesta. Recarga para ver si quedó hecho antes de repetirlo.' } }
    }
  }

  const guardar = async () => {
    setOcupado('guardar'); setMensaje(null)
    const { r, j } = await pedir({ method: 'PATCH', body: JSON.stringify({ filas }) })
    setOcupado('')
    if (!r.ok) { setMensaje({ tipo: 'error', texto: j.error || 'No se pudo guardar' }); return false }
    setFilas(j.filas); setD((x) => ({ ...x, solicitud: { ...x.solicitud, filas: j.filas, resumen: j.resumen } })); setSucio(false)
    return true
  }

  const accion = async (cuerpo, etiquetaOk) => {
    if (cuerpo.accion === 'aprobar' && sucio && !(await guardar())) return
    setOcupado(cuerpo.accion); setMensaje(null)
    const { r, j } = await pedir({ method: 'POST', body: JSON.stringify(cuerpo) })
    setOcupado('')
    if (!r.ok) { setMensaje({ tipo: 'error', texto: j.error || 'No se pudo' }); cargar(); return }
    setMensaje({ tipo: 'ok', texto: etiquetaOk(j) })
    cargar()
  }

  const visibles = useMemo(() => filas.map((f, i) => ({ f, i }))
    .filter(({ f }) => !soloDudosas || f._estado === 'error' || f._estado === 'advertencia' || (f._dudas?.length ?? 0) > 0), [filas, soloDudosas])

  if (!d) return <div style={{ padding: 16, fontSize: 13, color: mensaje ? 'var(--cf-red-dark)' : 'var(--cf-ink-3)' }}>{mensaje?.texto ?? 'Abriendo…'}</div>

  const s = d.solicitud
  const r = s.resumen ?? {}
  const abierta = s.estado === 'en_revision'
  const a = s.archivos.find((x) => x.n === archivo)
  const urlArchivo = a ? `/api/admin/cargas/${id}/archivo/${a.n}` : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.02em', margin: 0, color: 'var(--cf-ink)' }}>{d.negocio.nombre}</h1>
          <p style={{ fontSize: 12, color: 'var(--cf-ink-3)', margin: '4px 0 0' }}>
            {d.dueno?.nombre} · {d.dueno?.telefono || 'sin teléfono'} · {d.dueno?.email} · plan {d.negocio.plan} · ya tiene {d.negocio.clientes} clientes · estado: <b>{s.estado}</b>
          </p>
          {s.nota && <p style={{ fontSize: 13, color: 'var(--cf-ink)', margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>Nota del cliente: {s.nota}</p>}
        </div>
        <Link href="/admin/cargas" style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>Todas las cargas</Link>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--cf-ink-2)' }} className="cf-fig">
        <span>{r.filas ?? 0} filas</span>
        <span>{r.aCrear ?? 0} a crear</span>
        <span>{formatMoney(r.prestado ?? 0)} prestado</span>
        <span>{formatMoney(r.enLaCalle ?? 0)} en la calle</span>
        <span style={{ color: r.dudosas ? 'var(--cf-gold-dark)' : undefined }}>{r.dudosas ?? 0} dudosas</span>
        <span style={{ color: r.conError ? 'var(--cf-red-dark)' : undefined }}>{r.conError ?? 0} con error</span>
        {r.excedePlan && <span style={{ color: 'var(--cf-red-dark)', fontWeight: 700 }}>Excede el plan</span>}
      </div>
      {(r.fallos?.length > 0 || s.errorLectura) && (
        <div style={{ fontSize: 13, color: 'var(--cf-red-dark)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {s.errorLectura && <span>Error de lectura: {s.errorLectura}</span>}
          {r.fallos?.map((f) => <span key={f}>{f}</span>)}
        </div>
      )}
      {mensaje && <p role="status" style={{ fontSize: 13, margin: 0, color: mensaje.tipo === 'ok' ? 'var(--cf-green-dark)' : 'var(--cf-red-dark)' }}>{mensaje.texto}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 420px)', gap: 16, alignItems: 'start' }} className="cf-revision-carga">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          {abierta && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Checkbox checked={soloDudosas} onChange={setSoloDudosas} label="Solo las que hay que mirar" />
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>Rellenar vacías:</span>
              <input aria-label="Tasa para las vacías" placeholder="Tasa %" value={relleno.tasaInteres} onChange={(e) => setRelleno((x) => ({ ...x, tasaInteres: e.target.value }))} style={{ ...campo, width: 72 }} />
              <select aria-label="Frecuencia para las vacías" value={relleno.frecuencia} onChange={(e) => setRelleno((x) => ({ ...x, frecuencia: e.target.value }))} style={{ ...campo, width: 110 }}>
                {['', 'diario', 'semanal', 'quincenal', 'mensual'].map((o) => <option key={o} value={o}>{o || 'Cada…'}</option>)}
              </select>
              <button type="button" onClick={rellenar} style={boton(false)}>Rellenar</button>
              <button type="button" onClick={agregar} style={boton(false)}>Agregar fila</button>
              <button type="button" onClick={guardar} disabled={!sucio || !!ocupado} style={{ ...boton(false), opacity: sucio ? 1 : 0.5 }}>
                {ocupado === 'guardar' ? 'Guardando…' : 'Guardar y validar'}
              </button>
            </div>
          )}

          <div style={{ overflowX: 'auto', background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderRadius: 12 }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: 1400 }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th style={{ ...etiqueta, padding: '8px 6px' }}>Arch.</th>
                  {/* Lo que hay que mirar va primero: con la foto al lado, la tabla
                      no cabe entera y lo de la derecha queda fuera de vista. */}
                  <th style={{ ...etiqueta, padding: '8px 6px', minWidth: 200 }}>Qué mirar</th>
                  {COLUMNAS.map((c) => <th key={c.k} style={{ ...etiqueta, padding: '8px 4px', width: c.w }}>{c.t}</th>)}
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibles.map(({ f, i }) => (
                  <tr key={i} onClick={() => f._archivo && setArchivo(f._archivo)}
                    style={{ background: f._archivo === archivo ? 'color-mix(in srgb, var(--cf-gold) 8%, transparent)' : undefined }}>
                    <td style={{ ...celda, padding: '10px 6px', color: 'var(--cf-ink-3)', whiteSpace: 'nowrap' }}>
                      {f._archivo ?? '—'}{f._hoja ? ` · ${f._hoja}` : ''}
                    </td>
                    <td style={{ ...celda, padding: '6px', fontSize: 12, lineHeight: 1.4, minWidth: 200, maxWidth: 260 }}>
                      <span style={{ fontWeight: 700, color: ESTADO_FILA[f._estado] ?? 'var(--cf-ink-3)' }}>{NOMBRE_ESTADO[f._estado] ?? 'Sin validar'}</span>
                      {[...(f._errores ?? [])].map((t) => <span key={t} style={{ display: 'block', color: 'var(--cf-red-dark)' }}>{t}</span>)}
                      {[...(f._dudas ?? []), ...(f._avisos ?? [])].map((t) => <span key={t} style={{ display: 'block', color: 'var(--cf-ink-2)' }}>{t}</span>)}
                    </td>
                    {COLUMNAS.map((c) => (
                      <td key={c.k} style={{ ...celda, width: c.w }}>
                        {c.opciones ? (
                          <select disabled={!abierta} value={f[c.k] ?? ''} onChange={(e) => editar(i, c.k, e.target.value)} style={campo} aria-label={c.t}>
                            {c.opciones.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
                          </select>
                        ) : (
                          <input disabled={!abierta} value={f[c.k] ?? ''} onChange={(e) => editar(i, c.k, e.target.value)} aria-label={c.t}
                            inputMode={c.num ? 'decimal' : undefined} style={{ ...campo, textAlign: c.num ? 'right' : 'left' }} />
                        )}
                      </td>
                    ))}
                    <td style={celda}>
                      {abierta && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); quitar(i) }} aria-label={`Quitar la fila de ${f.nombre || 'sin nombre'}`} style={{
                          width: 32, height: 32, borderRadius: 8, border: 0, background: 'transparent', color: 'var(--cf-ink-3)', cursor: 'pointer',
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {visibles.length === 0 && (
                  <tr><td colSpan={COLUMNAS.length + 3} style={{ padding: 16, color: 'var(--cf-ink-3)' }}>{filas.length ? 'Nada que mirar: todas las filas están bien.' : 'El sistema no sacó filas. Agrégalas a mano mirando el original.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {abierta && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderRadius: 12 }}>
              <span style={etiqueta}>Aprobar</span>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input list="rutas-carga" value={ruta} onChange={(e) => setRuta(e.target.value)} placeholder="Ruta (opcional): existente o nueva" style={{ ...campo, width: 260, height: 40 }} aria-label="Ruta" />
                <datalist id="rutas-carga">{d.rutas.map((x) => <option key={x.id} value={x.nombre} />)}</datalist>
                <Checkbox checked={domingos} onChange={setDomingos} label="No cobra los domingos" />
                <span style={{ flex: 1 }} />
                <button type="button" disabled={!!ocupado || (r.conError ?? 0) > 0 || r.excedePlan}
                  onClick={() => accion({ accion: 'aprobar', ruta, noCobrarDomingos: domingos }, (j) => `Cargada: ${j.resultado.clientesCreados} clientes, ${j.resultado.prestamosCreados} préstamos, ${formatMoney(j.enLaCalle)} en la calle.${j.whatsapp ? ' Se le avisó por WhatsApp.' : ' El WhatsApp no salió: avísale tú.'}`)}
                  style={{ ...boton(true), opacity: (r.conError ?? 0) > 0 || r.excedePlan ? 0.5 : 1 }}>
                  {ocupado === 'aprobar' ? 'Importando…' : `Aprobar e importar ${r.aCrear ?? 0}`}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo del rechazo (se guarda, no se le manda)" style={{ ...campo, flex: 1, minWidth: 220, height: 40 }} aria-label="Motivo del rechazo" />
                <button type="button" disabled={!!ocupado || !motivo.trim()} onClick={() => accion({ accion: 'rechazar', motivo }, () => 'Rechazada.')} style={{ ...boton(false), color: 'var(--cf-red-dark)', opacity: motivo.trim() ? 1 : 0.5 }}>
                  Rechazar
                </button>
              </div>
            </section>
          )}
          {s.estado === 'aprobada' && r.importado && (
            <p style={{ fontSize: 13, color: 'var(--cf-green-dark)' }}>
              Cargada el {new Date(s.aprobada).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}: {r.importado.clientesCreados} clientes, {r.importado.prestamosCreados} préstamos, {formatMoney(r.importado.enLaCalle)} en la calle{r.importado.ruta ? ` · ruta ${r.importado.ruta}` : ''}.
            </p>
          )}
        </div>

        <aside style={{ position: 'sticky', top: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {s.archivos.map((x) => (
              <button key={x.n} type="button" onClick={() => setArchivo(x.n)} title={x.nombre} style={{
                height: 32, padding: '0 10px', borderRadius: 11, font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${x.n === archivo ? 'var(--cf-gold-border)' : 'var(--cf-border)'}`,
                background: x.n === archivo ? 'var(--cf-gold-tint)' : 'var(--cf-card)', color: 'var(--cf-ink)',
              }}>{x.n} · {x.tipo}{x.fallos?.length ? ' ·  !' : ''}</button>
            ))}
          </div>
          {a && (
            <div style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderRadius: 12, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--cf-ink-2)', overflowWrap: 'anywhere' }}>{a.nombre} · {a.filas ?? 0} filas · {a.origen}</span>
              {a.fallos?.map((t) => <span key={t} style={{ fontSize: 12, color: 'var(--cf-red-dark)' }}>{t}</span>)}
              {a.tipo === 'imagen' && (
                <a href={urlArchivo} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urlArchivo} alt={`Archivo ${a.n}`} style={{ width: '100%', borderRadius: 8, display: 'block' }} />
                </a>
              )}
              {a.tipo === 'pdf' && <iframe src={urlArchivo} title={`Archivo ${a.n}`} style={{ width: '100%', height: '75vh', border: 0, borderRadius: 8 }} />}
              {a.tipo === 'excel' && <a href={urlArchivo} style={{ fontSize: 13, fontWeight: 600, color: 'var(--cf-gold-dark)' }}>Descargar el Excel original</a>}
            </div>
          )}
        </aside>
      </div>
      <style>{`@media (max-width: 1000px) { .cf-revision-carga { grid-template-columns: minmax(0, 1fr) !important; } }`}</style>
      {s.estado !== 'en_revision' && s.estado !== 'aprobada' && s.estado !== 'rechazada' && (
        <button type="button" onClick={() => router.refresh() || cargar()} style={boton(false)}>Actualizar ({s.estado})</button>
      )}
    </div>
  )
}
