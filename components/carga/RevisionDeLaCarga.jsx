'use client'

/* ── LO QUE LEÍMOS, PARA QUE EL DUEÑO LO REVISE Y LO CARGUE ──────────────────
 *
 * Plan «La carga de cartera la revisa y la carga el dueño» (22 nov 2026). Ya no
 * hay un asesor que la deje cargada en 24 horas: la app lee las fotos, el Excel
 * o el PDF y el dueño ve aquí lo que salió, lo completa en el mismo lote de
 * siempre (`LoteFotos`) y lo carga él. Si se atasca, pide ayuda y le llega a
 * Carlos (`/api/carga-asesor/ayuda`).
 *
 * ⚠ CADA PRÉSTAMO CREADO SE APUNTA EN LA SOLICITUD (`apuntar`). Si no se puede,
 *   el error SUBE a `LoteFotos`, que deja la fila con su préstamo para
 *   reintentar solo el apunte. Tragarse el error aquí haría que la fila
 *   volviera a salir al entrar y el préstamo se creara dos veces.
 *
 * ⚠ «TERMINAR» CON FILAS PENDIENTES NO ES UN ERROR: el servidor contesta 200 con
 *   `{ ok: false, quedan }`. Se lee `ok`, no el código.
 *
 * ⚠ LO QUE VA DESPUÉS DE `LoteFotos` QUEDA DEBAJO DE SU PIE FIJO. Por eso
 *   «Necesito ayuda» y los avisos van ARRIBA del lote.
 */

import { useState, useRef } from 'react'
import LoteFotos, { estadoDe, baseDeArranque } from '@/components/migrador/LoteFotos'
import { Tarjeta, Aviso, BotonPrimario, BotonSecundario, EtiquetaCampo } from '@/components/cf/primitivos'
import { invalidarCachePorPrefijo } from '@/lib/offline'
import { MOTIVO_CLARO } from '@/lib/carga-asesor/al-lote'

const etiqueta = { fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }
const MAX_MOTIVOS = 3

/** Las cifras de arriba: cuántos se leyeron y cuántos ya se pueden crear, con
    el MISMO semáforo que usa el lote (`estadoDe`, 'verde' = listo). */
export function veredictoDe(revision) {
  const filas = Array.isArray(revision?.filas) ? revision.filas : []
  const base = baseDeArranque(true, revision?.base)
  const listos = filas.filter((f) => estadoDe(f, base) === 'verde').length
  return { leidos: filas.length, listos, revisar: filas.length - listos }
}

/** Lo que el lector dejó dicho de un archivo, en palabras del dueño. Un fallo
    técnico («No se pudo leer: …» lleva el mensaje del error tal cual) no sale. */
export function motivoParaElDueno(m) {
  const t = String(m ?? '')
  if (/^No se pudo leer/i.test(t)) return 'No pudimos leer este archivo'
  return MOTIVO_CLARO[t] ?? t
}

export const A_MEDIAS = 'Primero toca Crear para terminar de guardar las filas que quedaron a medias'
export const CAMBIO_FUERA = 'Esta carga cambió desde otro teléfono o computador: ya no se puede crear desde aquí.'
const SIN_COMPROBAR = 'No pudimos comprobar tu carga. Revisa tu internet y toca Crear otra vez.'

/** Lo que contesta `GET /api/carga-asesor?solo=estado` antes de cada tanda de
    «Crear»: `true` si la carga sigue con el dueño (la misma solicitud, en
    `en_revision`), o el texto de por qué se para. */
export function sigueConElDueno(j, solicitudId) {
  const s = j?.solicitud
  return s && s.id === solicitudId && s.estado === 'en_revision' ? true : CAMBIO_FUERA
}

function IconoAyuda() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17h.01" />
    </svg>
  )
}

export default function RevisionDeLaCarga({ solicitud, revision, rutas = [], onCambio, subiendo = false, children }) {
  const [error, setError] = useState('')
  const [terminando, setTerminando] = useState(false)
  const [ayudaAbierta, setAyudaAbierta] = useState(false)
  const [nota, setNota] = useState('')
  const [pidiendo, setPidiendo] = useState(false)
  const [ayudaEnviada, setAyudaEnviada] = useState(false)
  const [creandoLote, setCreandoLote] = useState(false)
  /* ⚠ FILAS A MEDIAS: su préstamo ya existe y el apunte falló. Pedir ayuda así
     desmontaba el lote, el apunte no se reintentaba nunca y Carlos la importaba
     otra vez (final review, 23 nov 2026). Primero se terminan de guardar. */
  const [aMedias, setAMedias] = useState(0)
  const cambioFuera = useRef(false)

  /* Solo en `en_revision` se crea: en «ayuda» la tiene Carlos y mientras se lee
     las filas cambian (`bloqueada`). Y nunca sin las filas: sin ellas `LoteFotos`
     arrancaría como el migrador, con «diario» y «20 %». */
  const sePuedeMontar = !revision?.bloqueada && solicitud?.estado === 'en_revision' && Array.isArray(revision?.filas)
  /* ⚠ EL SERVIDOR SE BLOQUEA ANTES DE QUE LA PANTALLA SE ENTERE. Al subir más
     archivos o pedir ayuda, la carga pasa a «recibida» o «ayuda» al instante,
     pero el lote sigue montado hasta el refresco: en esa ventana «Crear» crearía
     préstamos que chocan con lo que se relee o con lo que importe Carlos. El
     lote se queda a la vista, pero sin crear ni quitar (`bloqueada`). */
  const congelada = subiendo || pidiendo || ayudaEnviada
  const puedeCargar = sePuedeMontar && !congelada
  const v = veredictoDe(revision)
  const problemas = Array.isArray(revision?.problemas) ? revision.problemas : []
  const creadas = Array.isArray(revision?.creadas) ? revision.creadas : []

  const enlaceArchivo = (n) => `/api/carga-asesor/archivo/${n}?solicitudId=${encodeURIComponent(solicitud.id)}`
  const tipoArchivo = (n) => (solicitud?.archivos ?? []).find((a) => a.n === n)?.tipo

  const apuntar = async (fila, { clienteId, prestamoId }) => {
    const r = await fetch('/api/carga-asesor/cargada', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solicitudId: solicitud.id, filaId: fila._id, clienteId, prestamoId }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || 'No se pudo apuntar')
  }

  /* ⚠ ANTES DE CADA TANDA, ¿SIGUE CONMIGO? Desde otro teléfono pudo pedir ayuda:
     esta pantalla seguiría creando lo que Carlos va a importar. */
  const antesDeCrear = async () => {
    try {
      const r = await fetch('/api/carga-asesor?solo=estado', { cache: 'no-store' })
      if (!r.ok) return SIN_COMPROBAR
      const sigue = sigueConElDueno(await r.json().catch(() => null), solicitud.id)
      if (sigue !== true) cambioFuera.current = true
      return sigue
    } catch {
      return SIN_COMPROBAR
    }
  }

  const terminar = async (quitadas = []) => {
    setTerminando(true)
    setError('')
    try {
      const r = await fetch('/api/carga-asesor/cargada', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solicitudId: solicitud.id, terminar: true, quitadas }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok && j.ok) {
        invalidarCachePorPrefijo('clientes:').catch(() => {})
        await onCambio?.()
        return
      }
      // Quedan filas (200, ok:false) o la tiene Carlos (409): se vuelve a mirar.
      if (r.ok || r.status === 409) { await onCambio?.(); return }
      setError(j.error || 'No pudimos terminar la carga. Intenta de nuevo.')
    } catch {
      setError('No se pudo conectar. Revisa tu internet e intenta de nuevo.')
    } finally {
      setTerminando(false)
    }
  }

  const listo = ({ creados, quedanFilas, quitadas } = {}) => {
    if (creados?.length) invalidarCachePorPrefijo('clientes:').catch(() => {})
    if (quedanFilas) {
      // La carga cambió en otro lado: se dice aquí arriba (el lote se va al refrescar) y se refresca.
      if (cambioFuera.current) {
        cambioFuera.current = false
        setError(CAMBIO_FUERA)
        onCambio?.()
        return
      }
      // Las que no se crearon se quedan en el lote con su motivo; arriba, las cifras al día.
      if (creados?.length) onCambio?.()
      return
    }
    terminar(quitadas ?? [])
  }

  const pedirAyuda = async () => {
    if (aMedias > 0) { setError(A_MEDIAS); return }
    setPidiendo(true)
    setError('')
    try {
      const r = await fetch('/api/carga-asesor/ayuda', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solicitudId: solicitud.id, nota: nota.trim() }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError(j.error || 'No pudimos pedir la ayuda. Intenta de nuevo.'); return }
      setAyudaEnviada(true)
      await onCambio?.()
    } catch {
      setError('No se pudo conectar. Revisa tu internet e intenta de nuevo.')
    } finally {
      setPidiendo(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {v.leidos > 0 && (
        <Tarjeta>
          <span style={etiqueta}>Lo que leímos</span>
          <span className="cf-fig" style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1, color: 'var(--cf-ink)' }}>{v.leidos} {v.leidos === 1 ? 'cliente leído' : 'clientes leídos'}</span>
          <span className="cf-num" style={{ fontSize: 14, color: 'var(--cf-ink-2)', lineHeight: 1.45 }}>
            {v.listos} {v.listos === 1 ? 'listo' : 'listos'} · {v.revisar} {v.revisar === 1 ? 'necesita algo' : 'necesitan algo'}
          </span>
          <span style={{ fontSize: 13, color: 'var(--cf-ink-3)', lineHeight: 1.45 }}>
            Abre los que necesitan algo, complétalos y toca Crear. Nada entra a tu cartera hasta que lo crees.
          </span>
        </Tarjeta>
      )}

      {v.leidos === 0 && sePuedeMontar && creadas.length === 0 && (
        <Tarjeta>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--cf-ink)', lineHeight: 1.4 }}>
            No encontramos clientes para cargar
          </span>
          <span style={{ fontSize: 13, color: 'var(--cf-ink-2)', lineHeight: 1.5 }}>
            Mira abajo qué pasó con cada archivo. Puedes subir otro o pedir ayuda.
          </span>
        </Tarjeta>
      )}

      {v.leidos === 0 && sePuedeMontar && creadas.length > 0 && (
        <Tarjeta>
          <span className="cf-num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--cf-ink)', lineHeight: 1.4 }}>
            Ya creaste {creadas.length} {creadas.length === 1 ? 'préstamo' : 'préstamos'} de esta carga
          </span>
          <span style={{ fontSize: 13, color: 'var(--cf-ink-2)', lineHeight: 1.5 }}>No queda nada por revisar.</span>
          <BotonPrimario onClick={() => terminar([])} disabled={terminando || !puedeCargar}>
            {terminando ? 'Terminando…' : 'Terminar la carga'}
          </BotonPrimario>
        </Tarjeta>
      )}

      {revision?.errorLectura && (
        <Aviso tono="neutro">No pudimos leer todo. Si falta algo, pide ayuda.</Aviso>
      )}

      {revision?.excedePlan && revision.espacio != null && (
        <Aviso tono="ambar">
          {revision.espacio === 1 ? 'Tu plan deja 1 cliente más' : `Tu plan deja ${revision.espacio} clientes más`}. Leímos {v.leidos}: los que pasen de ahí no se van a poder crear.
        </Aviso>
      )}

      {problemas.length > 0 && (
        <Tarjeta>
          <span style={etiqueta}>Archivos con algo que mirar</span>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {problemas.map((p) => {
              const motivos = (p.motivos ?? []).map(motivoParaElDueno)
              return (
                <li key={p.n} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <a href={enlaceArchivo(p.n)} target="_blank" rel="noopener" style={{ fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)', overflowWrap: 'anywhere' }}>
                    {p.nombre || `Archivo ${p.n}`}
                  </a>
                  {p.sinFilas && (
                    <span style={{ fontSize: 13, color: 'var(--cf-ink-2)', lineHeight: 1.45 }}>
                      No encontramos clientes en este archivo.{' '}
                      <a href="/api/carga-masiva/plantilla" style={{ fontWeight: 700, color: 'var(--cf-gold-dark)' }}>Usa la plantilla</a>
                    </span>
                  )}
                  {motivos.slice(0, MAX_MOTIVOS).map((m, i) => (
                    <span key={i} style={{ fontSize: 13, color: 'var(--cf-ink-2)', lineHeight: 1.45, overflowWrap: 'anywhere' }}>{m}</span>
                  ))}
                  {motivos.length > MAX_MOTIVOS && (
                    <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>Y {motivos.length - MAX_MOTIVOS} más</span>
                  )}
                </li>
              )
            })}
          </ul>
        </Tarjeta>
      )}

      {solicitud?.estado === 'en_revision' && !ayudaEnviada && (
        <Tarjeta>
          {!ayudaAbierta ? (
            <>
              <BotonSecundario onClick={() => setAyudaAbierta(true)} disabled={creandoLote || aMedias > 0}>
                <IconoAyuda /><span>Necesito ayuda</span>
              </BotonSecundario>
              {aMedias > 0 && (
                <span style={{ fontSize: 13, color: 'var(--cf-ink-2)', lineHeight: 1.45 }}>{A_MEDIAS}</span>
              )}
            </>
          ) : (
            <>
              <span style={{ fontSize: 14, color: 'var(--cf-ink-2)', lineHeight: 1.45 }}>
                Carlos mira tu carga y te avisa cuando esté. Mientras tanto no podrás crear desde aquí.
              </span>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <EtiquetaCampo>¿En qué te quedaste? (opcional)</EtiquetaCampo>
                <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3} maxLength={1000}
                  placeholder="Por ejemplo: no sé qué poner en el interés"
                  style={{ borderRadius: 14, border: '1px solid var(--cf-border)', background: 'var(--cf-surface)', color: 'var(--cf-ink)', padding: 12, font: 'inherit', fontSize: 16, resize: 'vertical' }} />
              </label>
              {aMedias > 0 && (
                <span style={{ fontSize: 13, color: 'var(--cf-ink-2)', lineHeight: 1.45 }}>{A_MEDIAS}</span>
              )}
              <BotonSecundario onClick={pedirAyuda} disabled={pidiendo || creandoLote || aMedias > 0}>
                {pidiendo ? 'Enviando…' : 'Pedir ayuda'}
              </BotonSecundario>
              <BotonSecundario cancelar onClick={() => setAyudaAbierta(false)} disabled={pidiendo}>Cancelar</BotonSecundario>
            </>
          )}
        </Tarjeta>
      )}

      {error && <span role="alert" style={{ fontSize: 13, color: 'var(--cf-red-dark)', lineHeight: 1.45 }}>{error}</span>}

      {ayudaEnviada && (
        <Aviso tono="neutro">Pediste ayuda. Carlos la está revisando y te avisamos cuando esté.</Aviso>
      )}

      {/* Mientras el lote crea no se sube nada: la carga cambiaría a mitad. */}
      {!creandoLote && children}

      {sePuedeMontar && revision.filas.length > 0 && (
        <LoteFotos
          rutas={rutas}
          filasIniciales={revision.filas}
          creadas={revision.creadas ?? []}
          baseInicial={revision.base}
          claveLote={`carga:${solicitud.id}`}
          solicitudId={solicitud.id}
          enlaceArchivo={enlaceArchivo}
          tipoArchivo={tipoArchivo}
          sinSubir
          onCreada={apuntar}
          onQuitadas={terminar}
          onListo={listo}
          bloqueada={!puedeCargar}
          onCreando={setCreandoLote}
          onPendientesDeApuntar={setAMedias}
          antesDeCrear={antesDeCrear}
        />
      )}
    </div>
  )
}
