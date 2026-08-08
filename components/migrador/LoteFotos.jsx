'use client'

// components/migrador/LoteFotos.jsx — el cuaderno entero, de una sentada.
//
// ══ POR QUÉ EXISTE ════════════════════════════════════════════════════════
//
// Medido contra producción: de 429 negocios, **226 cargaron su cartera a mano a
// uno o dos clientes por minuto**, y el 73 % se quedó en cinco clientes o menos.
// De los que pasan de 21 clientes paga la mitad; de los que se quedan en cinco,
// el 1 %. Y no es que no entiendan la app: 202 cargaron su primer cliente en la
// primera hora y después se pararon. **El muro es pasar el cuaderno.**
//
// El OCR que había lee hasta 5 fotos pero las FUSIONA en un solo cliente. Aquí
// cada foto trae los que traiga —una cartulina trae uno, una hoja de cuaderno
// trae treinta— y todos caen en una lista que se revisa de una pasada.
//
// ══ DÓNDE ESTÁ EL VALOR (y no es el OCR) ══════════════════════════════════
//
// No sabemos qué tan bien lee: no había fotos reales para medirlo antes de
// construir. Así que esto está diseñado para que **un OCR mediocre siga
// sirviendo**: con un 60 % de acierto se ahorra el 60 % del tecleo, siempre que
// corregir un campo cueste un toque y no una reescritura. De ahí:
//
//   · el semáforo por fila, para saber a cuáles hay que mirar
//   · el filtro «solo las que hay que revisar»
//   · y lo que el OCR NUNCA va a acertar —tasa, modo de interés, ruta— se pone
//     UNA vez arriba y aplica a todas
//
// ══ ⚠ POR QUÉ NO USA `/api/carga-masiva/importar` ═════════════════════════
//
// Sería el reuso obvio: ya crea clientes y préstamos en bloque, con límites de
// plan, movimiento de capital y transacción por cliente. Pero **fuerza
// `modoInteres: 'fijo'`** (`route.js`:175). En este sistema el mismo «20 %»
// significa cosas distintas según el modo —hasta 6,6 veces de diferencia— así
// que importar la cartera de un negocio que trabaja sobre saldo la crearía
// entera mal, sin un solo error a la vista.
//
// Se crea por `/api/clientes` + `/api/prestamos`, que es el camino que ya usa
// este mismo migrador de uno en uno y que sí respeta el modo y arma la tabla de
// amortización. Cuesta dos peticiones por cliente; a cambio, la plata queda
// bien.

import { useState, useRef, useCallback } from 'react'
import { BotonPrimario, Chip, EtiquetaCampo, Pastilla } from '@/components/cf/primitivos'
import MoneyInput from '@/components/ui/MoneyInput'
import { formatMoney } from '@/lib/i18n'

const FRECUENCIAS = [
  { key: 'diario', label: 'Diario' },
  { key: 'semanal', label: 'Semanal' },
  { key: 'quincenal', label: 'Quincenal' },
  { key: 'mensual', label: 'Mensual' },
]
const DIAS_POR_PERIODO = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }
const PLAZO_DEFAULT = { diario: 30, semanal: 8, quincenal: 4, mensual: 2 }

const COLOR = {
  verde: 'var(--cf-green)',
  ambar: 'var(--cf-gold)',
  rojo: 'var(--cf-red)',
}
const ROTULO = { verde: 'Lista', ambar: 'Revisar', rojo: 'Falta lo básico' }

/* ══ ⚠ LO QUE DE VERDAD SE VA A GUARDAR, EN UNA SOLA FUNCIÓN ══════════════
 *
 * Esto empezó siendo tres cálculos sueltos —uno en el semáforo, otro en el
 * texto de la fila y otro al guardar— y se separaron en el peor sitio posible.
 *
 * El fallo, cazado corriendo el lote entero contra el espejo: el OCR devuelve
 * `tasa: ''` cuando no la encuentra en la foto, y `''` NO es `null`. Así que
 * `f.tasa ?? base.tasa` daba `''` —el `??` solo cae al defecto con null o
 * undefined— y `Number('')` es 0. El texto de la fila usaba `||`, así que decía
 * «diario 20 %»… y al guardar se creaban los siete préstamos AL 0 % DE INTERÉS.
 *
 * La pantalla mostraba una cosa y guardaba otra. Sobre una cartera de veinte
 * millones eso son cuatro millones de interés que desaparecen sin un error a la
 * vista, y no se descubre hasta que no cuadra la plata meses después.
 *
 * Ahora hay UN resolvedor y lo usan los tres. Si mañana se añade un campo con
 * defecto, entra aquí y los tres lo heredan.
 */
function efectivo(f, base) {
  const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null }
  const frecuencia = f.frecuencia || base.frecuencia
  return {
    nombre: f.nombre?.trim() ?? '',
    monto: num(f.monto),
    // `||` y no `??`: el campo vacío del formulario es '' y tiene que caer al
    // valor de arriba, igual que si no viniera.
    tasa: num(f.tasa) ?? num(base.tasa),
    frecuencia,
    plazoUnidades: num(f.plazoUnidades) ?? PLAZO_DEFAULT[frecuencia],
  }
}

/* El semáforo se recalcula EN EL NAVEGADOR cada vez que se edita una fila, no
   solo cuando llega del servidor: si no, corregir el monto de una fila roja la
   dejaría roja y el usuario no sabría que ya está bien. Misma regla que
   `semaforo()` en `lib/cartulina.js`; se repite aquí porque esa vive en el
   servidor y esto corre mientras se teclea. */
function estadoDe(f, base) {
  const e = efectivo(f, base)
  if (!e.nombre || !e.monto) return 'rojo'
  /* ⚠ ÁMBAR SOLO POR LO QUE NO SE PUEDE RESOLVER. La tasa y el plazo ahora
     SIEMPRE tienen valor —el de arriba o el del defecto— así que marcarlos en
     ámbar sería pedir revisar algo que ya está decidido. Lo que sí merece una
     mirada es que el OCR no leyera la frecuencia ni el plazo de ESA fila: son
     los dos que cambian cuánto se le cobra. */
  if (!f.frecuencia || !(Number(f.plazoUnidades) > 0)) return 'ambar'
  return 'verde'
}

export default function LoteFotos({ rutas = [], onListo, onSalir }) {
  const inputRef = useRef(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const [filas, setFilas] = useState([])
  const [aviso, setAviso] = useState(null)   // { porFoto, fallos, uso }
  const [soloRevisar, setSoloRevisar] = useState(false)
  const [abierta, setAbierta] = useState(null)
  const [creando, setCreando] = useState(null)  // { hechos, total, fallos: [] }

  /* ── LO QUE SE PONE UNA VEZ ──
     El OCR no va a leer nunca en qué modo de interés trabaja el negocio ni a
     qué ruta va la cartera: no está escrito en la cartulina. Pedirlo por fila
     serían treinta veces la misma respuesta. */
  const [base, setBase] = useState({ tasa: '20', frecuencia: 'diario', modoInteres: 'fijo', rutaId: '' })

  const subir = useCallback(async (e) => {
    const archivos = Array.from(e.target.files ?? [])
    if (inputRef.current) inputRef.current.value = ''
    if (!archivos.length) return
    setSubiendo(true); setError('')

    const fd = new FormData()
    archivos.forEach((f) => fd.append('fotos', f))
    try {
      const res = await fetch('/api/herramientas/leer-cartulinas-lote', { method: 'POST', body: fd })
      /* ⚠ EL `json()` VA APARTE DEL `fetch`, y no es cosmético: si la respuesta
         no es JSON —un 504 del proxy, un HTML de error, un cuerpo vacío porque
         se cortó la subida— `res.json()` lanza DENTRO del mismo `try` y el
         `catch` de abajo lo contaba como «sin conexión». Me lo comí probando en
         el espejo: la petición llegaba y respondía, y la pantalla decía que no
         había internet. Un mensaje que miente sobre la causa hace perder la
         tarde. */
      let json = null
      try { json = await res.json() } catch {
        setError(res.status === 413
          ? 'Las fotos pesan demasiado juntas. Prueba con menos de una vez.'
          : `El servidor respondió algo que no entendemos (${res.status}). Vuelve a intentarlo.`)
        setSubiendo(false); return
      }
      if (!res.ok) { setError(json?.error ?? 'No pudimos leer las fotos'); setSubiendo(false); return }

      const nuevas = (json.clientes ?? []).map((c, i) => ({
        _id: `${Date.now()}-${i}`,
        _foto: c._foto,
        nombre: c.nombre ?? '',
        cedula: c.cedula ?? '',
        telefono: c.telefono ?? '',
        direccion: c.direccion ?? '',
        monto: c.montoPrestado ?? '',
        // El default se aplica al pintar, no al guardar: así, si el usuario
        // cambia la tasa de arriba, las filas que el OCR no leyó la siguen.
        tasa: c.tasaInteres ?? '',
        frecuencia: c.frecuencia ?? '',
        plazoUnidades: c.diasPlazo && c.frecuencia
          ? Math.max(1, Math.round(c.diasPlazo / (DIAS_POR_PERIODO[c.frecuencia] || 1)))
          : '',
        fechaInicio: c.fechaInicio ?? '',
        // El estado en que va: lo que el OCR haya podido leer de las cuotas
        // tachadas, o el saldo que el prestamista se sabe de memoria.
        yaAbonado: c.montoPagadoHasta ?? '',
        saldoPendiente: c.saldoPendiente ?? '',
        _ia: c,   // lo que trajo la IA, tal cual, para la telemetría
      }))
      // Se ACUMULAN: se sube el cuaderno por tandas, no de una sola vez.
      setFilas((prev) => [...prev, ...nuevas])
      setAviso({ porFoto: json.porFoto ?? [], fallos: json.fallos ?? [], uso: json.uso })
    } catch (e) {
      // Aquí sí es la red: el `fetch` ni llegó.
      setError(`No se pudo enviar: ${e?.message ?? 'sin conexión'}. Prueba con menos fotos.`)
    } finally {
      setSubiendo(false)
    }
  }, [])

  const editar = (id, campo, valor) =>
    setFilas((prev) => prev.map((f) => (f._id === id ? { ...f, [campo]: valor } : f)))
  const quitar = (id) => setFilas((prev) => prev.filter((f) => f._id !== id))

  const conEstado = filas.map((f) => ({ ...f, _estado: estadoDe(f, base) }))
  const cuenta = {
    verde: conEstado.filter((f) => f._estado === 'verde').length,
    ambar: conEstado.filter((f) => f._estado === 'ambar').length,
    rojo: conEstado.filter((f) => f._estado === 'rojo').length,
  }
  const visibles = soloRevisar ? conEstado.filter((f) => f._estado !== 'verde') : conEstado
  const creables = conEstado.filter((f) => f._estado !== 'rojo')

  /* ── CREAR ──
     De tres en tres. En serie, treinta clientes son sesenta viajes seguidos y
     el teléfono parece colgado; todos a la vez, el servidor recibe sesenta
     peticiones de golpe. Y va contando: quien sube su cuaderno entero necesita
     ver que avanza. */
  const crear = async () => {
    setCreando({ hechos: 0, total: creables.length, fallos: [] })
    const fallos = []
    let hechos = 0
    const creados = []

    const A_LA_VEZ = 3
    for (let i = 0; i < creables.length; i += A_LA_VEZ) {
      const tanda = creables.slice(i, i + A_LA_VEZ)
      await Promise.all(tanda.map(async (f) => {
        try {
          const { monto, tasa, frecuencia, plazoUnidades: plazo } = efectivo(f, base)
          const diasPlazo = plazo * (DIAS_POR_PERIODO[frecuencia] || 1)

          const resC = await fetch('/api/clientes', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nombre: f.nombre.trim(),
              // Sin cédula el API la rechaza, y la cartulina casi nunca la
              // trae: 1.683 clientes de producción ya viven con este marcador.
              cedula: f.cedula?.trim() || `SIN-${Date.now()}${Math.floor(Math.random() * 1000)}`,
              telefono: f.telefono?.trim() || '',
              ...(f.direccion?.trim() && { direccion: f.direccion.trim() }),
              ...(base.rutaId && { rutaId: base.rutaId }),
            }),
          })
          const dataC = await resC.json()
          if (!resC.ok) throw new Error(dataC.error || 'no se pudo crear el cliente')

          const resP = await fetch('/api/prestamos', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clienteId: dataC.id,
              montoPrestado: monto,
              tasaInteres: tasa,
              diasPlazo,
              fechaInicio: f.fechaInicio || new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10),
              frecuencia,
              modoInteres: base.modoInteres,
              ...(Number(f.yaAbonado) > 0 && { yaAbonado: Number(f.yaAbonado) }),
            }),
          })
          const dataP = await resP.json()
          if (!resP.ok) throw new Error(dataP.error || 'cliente creado pero falló el préstamo')

          /* Se devuelve la ficha ENTERA, no solo los ids: la pantalla de
             `/migrador` pinta un resumen de cartera con el capital y el total a
             cobrar, y para eso necesita el monto, la tasa y el plazo de cada
             uno. Devolver solo el id la obligaría a volver a pedirlos. */
          creados.push({
            nombre: f.nombre.trim(),
            cedula: f.cedula?.trim() ?? '',
            telefono: f.telefono?.trim() ?? '',
            direccion: f.direccion?.trim() ?? '',
            monto, tasa,
            frecuencia, plazoUnidades: plazo,
            modoInteres: base.modoInteres,
            fechaInicio: f.fechaInicio || new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10),
            diasSinCobro: [],
            clienteId: dataC.id, prestamoId: dataP.id,
          })
        } catch (e) {
          fallos.push({ nombre: f.nombre || '(sin nombre)', error: e.message })
        }
        hechos++
        setCreando({ hechos, total: creables.length, fallos: [...fallos] })
      }))
    }

    // ── Telemetría: qué trajo la IA y qué quedó guardado ──
    // No hay forma de saber si el OCR acierta sin fotos de prueba; esto lo
    // averigua solo, con los primeros usuarios reales.
    fetch('/api/herramientas/precision-cartulina', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filas: creables.map((f) => ({
          ia: f._ia,
          final: {
            nombre: f.nombre, cedula: f.cedula, telefono: f.telefono, direccion: f.direccion,
            montoPrestado: efectivo(f, base).monto,
            tasaInteres: efectivo(f, base).tasa,
            frecuencia: efectivo(f, base).frecuencia,
            diasPlazo: efectivo(f, base).plazoUnidades,
          },
        })),
      }),
    }).catch(() => {})

    setCreando(null)
    setFilas(fallos.length ? conEstado.filter((f) => fallos.some((x) => x.nombre === f.nombre)) : [])
    onListo?.({ creados, fallos })
  }

  // ══ VACÍO: todavía no ha subido nada ══
  if (!filas.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <input ref={inputRef} type="file" accept="image/*" multiple capture="environment"
          onChange={subir} style={{ display: 'none' }} />

        <div style={{
          padding: '22px 18px', borderRadius: 'var(--cf-r-card)',
          background: 'var(--cf-gold-tint-2)', border: '1px solid var(--cf-gold-border)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--cf-ink)' }}>
            Tómale foto a todo el cuaderno
          </span>
          <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--cf-ink-2)' }}>
            Hasta 30 fotos de una vez. Sirve una cartulina por cliente y también
            una hoja con la lista de todos: leemos lo que haya en cada foto y te
            lo dejamos en una lista para que revises antes de guardar.
          </span>
        </div>

        {error && (
          <div style={{
            padding: '12px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.4,
            background: 'var(--cf-red-pill-bg)', border: '1px solid var(--cf-red-pill-border)',
            color: 'var(--cf-red-dark)',
          }}>{error}</div>
        )}

        <BotonPrimario onClick={() => inputRef.current?.click()} disabled={subiendo}>
          {subiendo ? 'Leyendo las fotos…' : 'Elegir las fotos'}
        </BotonPrimario>

        {subiendo && (
          <span style={{ fontSize: 12, color: 'var(--cf-ink-3)', textAlign: 'center' }}>
            Puede tardar un minuto. No cierres la pantalla.
          </span>
        )}

        {onSalir && (
          <button type="button" onClick={onSalir} style={{
            background: 'none', border: 0, cursor: 'pointer', font: 'inherit',
            fontSize: 13, fontWeight: 700, color: 'var(--cf-ink-3)', padding: 8,
          }}>Prefiero escribirlos a mano</button>
        )}
      </div>
    )
  }

  // ══ LA REVISIÓN ══
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 96 }}>
      <input ref={inputRef} type="file" accept="image/*" multiple capture="environment"
        onChange={subir} style={{ display: 'none' }} />

      {/* Lo que se pone UNA vez y vale para todas */}
      <div style={{
        padding: 14, borderRadius: 'var(--cf-r-card)', background: 'var(--cf-card)',
        border: '1px solid var(--cf-border)', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cf-ink)' }}>
          Vale para todos estos préstamos
        </span>
        <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--cf-ink-3)' }}>
          Esto no está escrito en la cartulina, así que se pone aquí una vez. Si
          alguno va distinto, lo cambias en su fila.
        </span>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ flex: '1 1 120px', minWidth: 0 }}>
            <EtiquetaCampo>Interés</EtiquetaCampo>
            <input
              type="text" inputMode="decimal" value={base.tasa}
              onChange={(e) => setBase((b) => ({ ...b, tasa: e.target.value.replace(/[^\d.,]/g, '') }))}
              style={{
                width: '100%', height: 46, padding: '0 12px', borderRadius: 'var(--cf-r-control)',
                border: '1px solid var(--cf-border-strong)', background: 'var(--cf-card)',
                color: 'var(--cf-ink)', font: 'inherit', fontSize: 15, fontWeight: 700,
              }} />
          </label>
          <label style={{ flex: '2 1 180px', minWidth: 0 }}>
            <EtiquetaCampo>Cada cuánto se cobra</EtiquetaCampo>
            <select
              value={base.frecuencia}
              onChange={(e) => setBase((b) => ({ ...b, frecuencia: e.target.value }))}
              style={{
                width: '100%', height: 46, padding: '0 12px', borderRadius: 'var(--cf-r-control)',
                border: '1px solid var(--cf-border-strong)', background: 'var(--cf-card)',
                color: 'var(--cf-ink)', font: 'inherit', fontSize: 15, fontWeight: 700,
              }}>
              {FRECUENCIAS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </label>
        </div>

        {rutas.length > 0 && (
          <label>
            <EtiquetaCampo>A qué ruta van</EtiquetaCampo>
            <select
              value={base.rutaId}
              onChange={(e) => setBase((b) => ({ ...b, rutaId: e.target.value }))}
              style={{
                width: '100%', height: 46, padding: '0 12px', borderRadius: 'var(--cf-r-control)',
                border: '1px solid var(--cf-border-strong)', background: 'var(--cf-card)',
                color: 'var(--cf-ink)', font: 'inherit', fontSize: 15, fontWeight: 700,
              }}>
              <option value="">Sin ruta por ahora</option>
              {rutas.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </label>
        )}
      </div>

      {/* El recuento y el filtro */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip activo={!soloRevisar} onClick={() => setSoloRevisar(false)} conteo={filas.length}>Todos</Chip>
        <Chip activo={soloRevisar} onClick={() => setSoloRevisar(true)} conteo={cuenta.ambar + cuenta.rojo}>
          Hay que revisar
        </Chip>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={subiendo}
          style={{
            marginLeft: 'auto', height: 36, padding: '0 12px', cursor: 'pointer',
            borderRadius: 'var(--cf-r-pill)', background: 'var(--cf-card)',
            border: '1px solid var(--cf-border-strong)', font: 'inherit',
            fontSize: 12, fontWeight: 700, color: 'var(--cf-ink-2)',
          }}>
          {subiendo ? 'Leyendo…' : '+ Más fotos'}
        </button>
      </div>

      {aviso?.fallos?.length > 0 && (
        <div style={{
          padding: '11px 13px', borderRadius: 12, fontSize: 12, lineHeight: 1.45,
          background: 'var(--cf-gold-bg)', border: '1px solid var(--cf-gold-border)',
          color: 'var(--cf-gold-text-2)',
        }}>
          {aviso.fallos.length === 1 ? 'Una foto no se pudo leer' : `${aviso.fallos.length} fotos no se pudieron leer`}
          {' '}({aviso.fallos.map((f) => `#${f.foto}`).join(', ')}). Vuelve a tomarlas con más luz.
        </div>
      )}

      {error && (
        <div style={{
          padding: '12px 14px', borderRadius: 12, fontSize: 13,
          background: 'var(--cf-red-pill-bg)', border: '1px solid var(--cf-red-pill-border)',
          color: 'var(--cf-red-dark)',
        }}>{error}</div>
      )}

      {/* Las filas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibles.map((f) => (
          <Fila
            key={f._id} f={f} base={base} rutas={rutas}
            abierta={abierta === f._id}
            onAbrir={() => setAbierta(abierta === f._id ? null : f._id)}
            onEditar={(campo, valor) => editar(f._id, campo, valor)}
            onQuitar={() => quitar(f._id)}
          />
        ))}
      </div>

      {/* El pie, fijo: es la acción por la que se abrió esta pantalla */}
      <div style={{
        position: 'fixed', left: 0, right: 0,
        bottom: 'calc(var(--cf-nav-inset, 0px) + env(safe-area-inset-bottom, 0px))',
        padding: '12px 16px 14px', background: 'var(--cf-card)',
        borderTop: '1px solid var(--cf-border)', zIndex: 20,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {cuenta.rojo > 0 && (
          <span style={{ fontSize: 12, color: 'var(--cf-ink-3)', textAlign: 'center' }}>
            {cuenta.rojo === 1 ? 'Una fila' : `${cuenta.rojo} filas`} sin nombre o sin monto se {cuenta.rojo === 1 ? 'queda' : 'quedan'} fuera
          </span>
        )}
        <BotonPrimario onClick={crear} disabled={!creables.length || !!creando}>
          {creando
            ? `Creando… ${creando.hechos} de ${creando.total}`
            : `Crear ${creables.length} cliente${creables.length === 1 ? '' : 's'}`}
        </BotonPrimario>
      </div>
    </div>
  )
}

/* ══ UNA FILA ══
   Cerrada enseña lo que decide si hay que abrirla: el semáforo, el nombre y el
   monto. Abierta, todo lo demás. Con treinta filas, una tarjeta completa cada
   una es una pantalla de scroll infinito donde no se distingue cuál falta. */
function Fila({ f, base, onAbrir, abierta, onEditar, onQuitar }) {
  const color = COLOR[f._estado]
  const campo = {
    width: '100%', height: 44, padding: '0 11px', borderRadius: 'var(--cf-r-pill)',
    border: '1px solid var(--cf-border-strong)', background: 'var(--cf-card)',
    color: 'var(--cf-ink)', font: 'inherit', fontSize: 14,
  }

  return (
    <div style={{
      borderRadius: 'var(--cf-r-card)', background: 'var(--cf-card)',
      border: '1px solid var(--cf-border)', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px' }}>
        <span aria-hidden style={{
          width: 9, height: 9, minWidth: 9, borderRadius: 999, flex: 'none', background: color,
        }} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <input
            value={f.nombre} placeholder="¿Cómo se llama?"
            onChange={(e) => onEditar('nombre', e.target.value)}
            style={{
              border: 0, background: 'none', padding: 0, font: 'inherit',
              fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)', minWidth: 0, width: '100%',
            }} />
          <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>
            {/* Del mismo resolvedor que el guardado: si la fila dice una cosa
                y se guarda otra, nadie lo nota hasta que no cuadra la plata. */}
            {f._estado === 'rojo' ? ROTULO.rojo
              : `${formatMoney(efectivo(f, base).monto ?? 0)} · ${efectivo(f, base).frecuencia} ${efectivo(f, base).tasa}%`}
            {f._foto ? ` · foto ${f._foto}` : ''}
          </span>
        </div>
        {f._estado !== 'verde' && <Pastilla tono={f._estado === 'rojo' ? 'mora' : 'atraso'}>{ROTULO[f._estado]}</Pastilla>}
        <button type="button" onClick={onAbrir} aria-label={abierta ? 'Cerrar' : 'Abrir'}
          style={{ background: 'none', border: 0, cursor: 'pointer', padding: 4, flex: 'none' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)"
            strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: abierta ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {abierta && (
        <div style={{
          padding: '4px 13px 13px', display: 'flex', flexDirection: 'column', gap: 10,
          borderTop: '1px solid var(--cf-border-soft)',
        }}>
          <label>
            <EtiquetaCampo>Cuánto le prestaste</EtiquetaCampo>
            {/* ⚠ `MoneyInput` devuelve un EVENTO, no el valor —`onChange({target:{value}})`—
                y pone su propio `style`: pasarle uno lo pisa entero y se lleva
                por delante el fondo y el borde. Se usa tal cual porque es el
                campo que sabe del MODO ABREVIADO: con él encendido se escribe
                «40» y son $40.000, y un `<input>` propio se lo lleva por
                delante en silencio. Ya pasó dos veces. */}
            <MoneyInput value={String(f.monto ?? '')} onChange={(e) => onEditar('monto', e.target.value)} />
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ flex: 1, minWidth: 0 }}>
              <EtiquetaCampo>Interés</EtiquetaCampo>
              <input type="text" inputMode="decimal" value={f.tasa ?? ''} placeholder={String(base.tasa)}
                onChange={(e) => onEditar('tasa', e.target.value.replace(/[^\d.,]/g, ''))} style={campo} />
            </label>
            <label style={{ flex: 1, minWidth: 0 }}>
              <EtiquetaCampo>Cuántos cobros</EtiquetaCampo>
              <input type="text" inputMode="numeric" value={f.plazoUnidades ?? ''}
                placeholder={String(PLAZO_DEFAULT[f.frecuencia || base.frecuencia])}
                onChange={(e) => onEditar('plazoUnidades', e.target.value.replace(/\D/g, ''))} style={campo} />
            </label>
          </div>

          <label>
            <EtiquetaCampo>Cada cuánto</EtiquetaCampo>
            <select value={f.frecuencia || base.frecuencia}
              onChange={(e) => onEditar('frecuencia', e.target.value)} style={campo}>
              {FRECUENCIAS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
            </select>
          </label>

          {/* ── EN QUÉ PUNTO VA ──
              El dato que decide si la migración sirve: un préstamo a medias
              importado como nuevo le debe al prestamista todo lo ya cobrado.
              El OCR lo intenta con las cuotas tachadas; si no, el prestamista
              se sabe de memoria cuánto lleva abonado. */}
          <label>
            <EtiquetaCampo>¿Ya te ha abonado algo?</EtiquetaCampo>
            <MoneyInput value={String(f.yaAbonado ?? '')} onChange={(e) => onEditar('yaAbonado', e.target.value)} />
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ flex: 1, minWidth: 0 }}>
              <EtiquetaCampo>Cédula</EtiquetaCampo>
              <input value={f.cedula ?? ''} placeholder="Si no la tienes, déjala vacía"
                onChange={(e) => onEditar('cedula', e.target.value)} style={campo} />
            </label>
            <label style={{ flex: 1, minWidth: 0 }}>
              <EtiquetaCampo>Teléfono</EtiquetaCampo>
              <input value={f.telefono ?? ''} inputMode="numeric"
                onChange={(e) => onEditar('telefono', e.target.value)} style={campo} />
            </label>
          </div>

          <label>
            <EtiquetaCampo>Dónde vive</EtiquetaCampo>
            <input value={f.direccion ?? ''} onChange={(e) => onEditar('direccion', e.target.value)} style={campo} />
          </label>

          <button type="button" onClick={onQuitar} style={{
            alignSelf: 'flex-start', background: 'none', border: 0, cursor: 'pointer',
            font: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--cf-red-dark)', padding: '6px 0',
          }}>Quitar de la lista</button>
        </div>
      )}
    </div>
  )
}
