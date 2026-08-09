'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { nombreDocumento } from '@/lib/documento'
import { Firma } from '@/components/pantallas/Pagare'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { formatMoney, getLocale, formatFechaCorta } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'

/* Alto 38 y radio 14: los del sistema. Iban a 32 y 8 —por debajo del área que
   necesita un dedo— y con `text-[11px]`, que en una fila de tres botones deja
   «Comprobante» casi ilegible. */
const BASE_BOTON = {
  height: 38, borderRadius: 'var(--cf-r-control)',
  font: 'inherit', fontSize: 12, fontWeight: 700,
  /* ⚠ RELLENO 4, NO 8. Con 8 los tres rellenos se comen 48px de los 222 que
     hay en un teléfono de 360, y los TRES botones salían recortados —no solo
     «Comprobante»—: el texto pide 236 y solo cabían 222. Con 4 quedan 254
     contra 236, y ya sobra. */
  cursor: 'pointer', minWidth: 0, paddingInline: 4,
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  /* ⚠ `1 1 auto`, NO `flex-1`. Con `flex-1` (base 0) los tres se reparten el
     ancho en TERCIOS IGUALES, y no necesitan lo mismo: «Pagaré» pide 61px y
     «Comprobante» 100. En un teléfono de 360 —el Android corriente— al tercero
     le tocaban 88 y perdía 12px de letra por la derecha.

     ⚠⚠ Y NO LO CAZA `scrollWidth > clientWidth`: el contenido va centrado, se
     recorta por los dos lados y `scrollWidth` sigue igual. Decía «no se corta»
     en las tres anchuras. Hay que medir el texto con un `Range` contra el hueco
     que deja el icono. Con la base en `auto` cada uno arranca de lo que pide y
     solo se reparte lo que sobra. */
  flex: '1 1 auto',
}
const SECUNDARIO = {
  ...BASE_BOTON,
  background: 'var(--cf-card)',
  border: '1px solid var(--cf-border-strong)',
  color: 'var(--cf-ink-2)',
}


// ── ⚠ ESTAS FECHAS SE LEEN EN UTC, NO EN LA ZONA DEL TELÉFONO ─────────────
//
// Un prestamista lo reportó con el comprobante en la mano: «me dice que termina
// el 30 de julio» cuando en la base termina el **31**.
//
// La causa: era `toLocaleDateString('es-CO', ...)` SIN `timeZone`, así que
// usaba la del TELÉFONO. Y `fechaInicio`/`fechaFin` NO son instantes: son
// FECHAS DE CALENDARIO que el sistema calcula en UTC (`fechaDePeriodo` usa
// `setUTCDate` y `Date.UTC`). Un `2026-07-31T00:00:00Z` leído desde Bogotá
// —UTC−5— cae el 30 a las 19:00, y se imprimía un día antes.
//
// ⚠ FORZAR `America/Bogota` NO LO ARREGLA: da el mismo 30. Lo probé, y la
// prueba `fecha-fin-comprobante` lo dejó por escrito. Para una fecha de
// calendario guardada en UTC, la única lectura correcta es **en UTC**.
//
// El tamaño del fallo, medido en producción: `fechaFin` está a las 00:00Z en
// **7.418 de 8.696 préstamos (85%)**, mientras que `fechaInicio` está a las
// 05:00Z en el 100%. Por eso él veía bien el inicio y mal el fin.
//
// `'es-CO'` no fijaba nada: el locale es el idioma, no el huso. Eso es lo que
// hace el fallo invisible leyendo el código. Ver [[fechas_un_solo_calendario]].
function formatFecha(d, pais = 'co') {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(getLocale(pais), {
    day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'UTC',
  })
}

const FREQ_LABEL = { diario: 'Diario', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' }

async function generarComprobante(prestamo, pais = 'co', tz = null) {
  const p = prestamo
  const cliente = p.cliente || {}
  const pagos = (p.pagos || []).filter(x => !['recargo', 'descuento'].includes(x.tipo))
  const completado = p.estado === 'completado'

  const w = 800
  const lineH = 28

  // Load firma image first so we know its height
  let firmaImg = null
  if (p.firmaUrl) {
    try {
      firmaImg = await new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = p.firmaUrl
      })
    } catch {}
  }

  const pagosToShow = pagos.slice(0, 50)
  const headerH = 280
  const desgH = 8 * lineH + 40
  const pagosH = pagosToShow.length > 0 ? 60 + pagosToShow.length * lineH + (pagos.length > 50 ? lineH : 0) : 0
  const firmaDrawH = firmaImg ? 150 : 40
  const totalH = headerH + desgH + pagosH + firmaDrawH + 100

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = totalH
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, totalH)

  let y = 40

  // Title
  ctx.fillStyle = '#15161A'
  ctx.font = 'bold 22px system-ui, sans-serif'
  ctx.fillText('Comprobante de préstamo', 40, y += 30)

  if (completado) {
    ctx.fillStyle = '#16a34a'
    ctx.font = 'bold 16px system-ui, sans-serif'
    ctx.fillText('CANCELADO', w - 160, y)
  }

  y += 15
  ctx.strokeStyle = '#e5e5e5'
  ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w - 40, y); ctx.stroke()

  // Client data
  y += 30
  ctx.fillStyle = '#666666'
  ctx.font = '13px system-ui, sans-serif'
  ctx.fillText('DATOS DEL CLIENTE', 40, y)

  ctx.fillStyle = '#15161A'
  ctx.font = '15px system-ui, sans-serif'
  y += 26; ctx.fillText(`Nombre: ${cliente.nombre || '—'}`, 40, y)
  y += 24; ctx.fillText(`${nombreDocumento()}: ${cliente.cedula && !cliente.cedula.startsWith('SIN-') ? cliente.cedula : '—'}`, 40, y)
  y += 24; ctx.fillText(`Teléfono: ${cliente.telefono || '—'}`, 40, y)

  y += 20
  ctx.strokeStyle = '#e5e5e5'
  ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w - 40, y); ctx.stroke()

  // Loan details
  y += 25
  ctx.fillStyle = '#666666'
  ctx.font = '13px system-ui, sans-serif'
  ctx.fillText('DESGLOSE DEL PRESTAMO', 40, y)

  const rows = [
    ['Monto prestado', formatMoney(p.montoPrestado)],
    ['Total a pagar', formatMoney(p.totalAPagar)],
    ['Cuota', formatMoney(p.cuotaDiaria)],
    ['Frecuencia', FREQ_LABEL[p.frecuencia] || p.frecuencia],
    ['Fecha inicio', formatFecha(p.fechaInicio, pais)],
    ['Fecha fin', formatFecha(p.fechaFin, pais)],
    ['Total pagado', formatMoney(p.totalPagado ?? 0)],
    ['Saldo pendiente', formatMoney(p.saldoPendiente ?? 0)],
  ]

  y += 8
  rows.forEach(([label, value]) => {
    y += lineH
    ctx.fillStyle = '#555555'
    ctx.font = '14px system-ui, sans-serif'
    ctx.fillText(label, 40, y)
    ctx.fillStyle = '#15161A'
    ctx.font = 'bold 14px system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(value, w - 40, y)
    ctx.textAlign = 'left'
  })

  // Pagos
  if (pagosToShow.length > 0) {
    y += 30
    ctx.strokeStyle = '#e5e5e5'
    ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w - 40, y); ctx.stroke()
    y += 25
    ctx.fillStyle = '#666666'
    ctx.font = '13px system-ui, sans-serif'
    ctx.fillText(`HISTORIAL DE PAGOS (${pagos.length})`, 40, y)

    y += 8
    pagosToShow.forEach((pago) => {
      y += lineH
      ctx.fillStyle = '#555555'
      ctx.font = '13px system-ui, sans-serif'
      // ⚠ EL PAGO NO ES UNA FECHA DE CALENDARIO, es un INSTANTE: se
      // guarda con la hora real del cobro (97% a horas variadas). Ese sí va
      // en la zona del negocio — leerlo en UTC pondría un cobro de las 7 de
      // la noche en el día siguiente.
      ctx.fillText(formatFechaCorta(pago.fechaPago, pais, tz), 40, y)
      ctx.fillStyle = '#15161A'
      ctx.font = 'bold 13px system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(formatMoney(pago.montoPagado), w - 40, y)
      ctx.textAlign = 'left'
    })
    if (pagos.length > 50) {
      y += lineH
      ctx.fillStyle = '#999999'
      ctx.font = 'italic 12px system-ui, sans-serif'
      ctx.fillText(`... y ${pagos.length - 50} pagos mas`, 40, y)
    }
  }

  // Firma
  y += 30
  ctx.strokeStyle = '#e5e5e5'
  ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w - 40, y); ctx.stroke()
  y += 25
  ctx.fillStyle = '#666666'
  ctx.font = '13px system-ui, sans-serif'
  ctx.fillText('FIRMA DEL CLIENTE', 40, y)

  if (firmaImg) {
    const firmaW = 300
    const fH = (firmaImg.height / firmaImg.width) * firmaW
    y += 15
    ctx.strokeStyle = '#e5e5e5'
    ctx.strokeRect(38, y - 2, firmaW + 4, fH + 4)
    ctx.drawImage(firmaImg, 40, y, firmaW, fH)
  } else {
    y += 20
    ctx.fillStyle = '#999999'
    ctx.font = 'italic 13px system-ui, sans-serif'
    ctx.fillText('Sin firma', 40, y)
  }

  return canvas
}

export default function FirmaDigital({ prestamo, onSave }) {
  // El pais y la zona salen de la sesion: sin ellos el comprobante se
  // formatea con la zona del TELEFONO y resta un dia (ver `formatFecha`).
  const { country: paisSesion, timezone: tzSesion } = useAuth()
  const prestamoId = prestamo?.id
  const firmaUrl = prestamo?.firmaUrl

  const [modalFirmar, setModalFirmar] = useState(false)
  // QUE ESTA FIRMANDO. Va en la cabecera del recuadro, en una linea: recibio
  // tanto, devuelve tanto, en tantas cuotas. Un pagare que no dice las cifras
  // encima de la firma no zanja nada despues.
  const resumenFirma = [
    prestamo?.montoPrestado > 0 ? `Recibió ${formatMoney(prestamo.montoPrestado)}` : null,
    prestamo?.totalAPagar > 0 ? `devuelve ${formatMoney(prestamo.totalAPagar)}` : null,
    prestamo?.cuotaDiaria > 0 ? `cuota ${formatMoney(prestamo.cuotaDiaria)}` : null,
  ].filter(Boolean).join(' · ')
  /* Desde cuándo falta. Sin esta fecha, «falta la firma» no dice si es de hoy
     o de hace tres meses — y eso es lo que decide si urge.

     ⚠ EN UTC, y usando `formatFecha` de este mismo archivo. `fechaInicio` es
     una FECHA DE CALENDARIO guardada en UTC, no un instante: leerla en la zona
     del teléfono resta un día. Está demostrado arriba con el caso del
     comprobante —«me dice que termina el 30» cuando en la base era el 31— y con
     su prueba. Mi primera versión de esta línea usaba `America/Bogota`, que es
     exactamente lo que ese aviso dice que NO arregla nada. */
  const desdeCuando = (prestamo?.fechaInicio || prestamo?.createdAt)
    ? formatFecha(prestamo.fechaInicio || prestamo.createdAt, paisSesion)
    : null

  const [modalVer, setModalVer] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasStrokes, setHasStrokes] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [descargandoPagare, setDescargandoPagare] = useState(false)
  const canvasRef = useRef(null)
  const isDrawing = useRef(false)
  const lastPoint = useRef(null)

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.5
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#15161A'
  }, [])

  useEffect(() => {
    if (modalFirmar) {
      setTimeout(setupCanvas, 50)
      setHasStrokes(false)
    }
  }, [modalFirmar, setupCanvas])

  const getPoint = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches?.[0]
    return {
      x: (touch?.clientX ?? e.clientX) - rect.left,
      y: (touch?.clientY ?? e.clientY) - rect.top,
    }
  }

  const startDraw = (e) => { e.preventDefault(); isDrawing.current = true; lastPoint.current = getPoint(e) }
  const draw = (e) => {
    if (!isDrawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const point = getPoint(e)
    ctx.beginPath()
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    lastPoint.current = point
    if (!hasStrokes) setHasStrokes(true)
  }
  const endDraw = () => { isDrawing.current = false; lastPoint.current = null }

  const limpiar = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasStrokes(false)
  }

  const guardar = async () => {
    const canvas = canvasRef.current
    if (!canvas || !hasStrokes) return
    setSaving(true)
    try {
      const firma = canvas.toDataURL('image/png')
      const res = await fetch(`/api/prestamos/${prestamoId}/firma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firma }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      onSave?.(data.firmaUrl)
      setModalFirmar(false)
    } catch {
      alert('Error al guardar la firma')
    } finally {
      setSaving(false)
    }
  }

  const descargarPagare = async () => {
    if (!prestamoId) return
    setDescargandoPagare(true)
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}/pagare`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `pagare-${prestamo.cliente?.nombre?.replace(/\s+/g, '-') || prestamoId}.pdf`
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Error al generar el pagare')
    } finally {
      setDescargandoPagare(false)
    }
  }

  const descargarComprobante = async () => {
    if (!prestamo) return
    setDescargando(true)
    try {
      const canvas = await generarComprobante(prestamo, paisSesion, tzSesion)
      const link = document.createElement('a')
      link.download = `comprobante-prestamo-${prestamo.cliente?.nombre?.replace(/\s+/g, '-') || prestamoId}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch {
      alert('Error al generar comprobante')
    } finally {
      setDescargando(false)
    }
  }

  /* ══ ⚠ ESTA TARJETA ERA LA ÚLTIMA CON EL DISEÑO VIEJO ══════════════════════
   *
   * El dueño la señaló: «es lo único dentro de esa sección de préstamos que
   * está utilizando el diseño anterior». Y tenía razón por tres motivos que solo
   * se ven midiendo, no mirando:
   *
   *  1. ⚠ DOS DE LOS TRES BOTONES ERAN INVISIBLES. Iban con
   *     `background: rgba(255,255,255,0.06)` — blanco al 6 % — que es un resto
   *     del tema OSCURO. Sobre la tarjeta blanca del tema claro no se ve nada:
   *     «Modificar» y «Comprobante» parecían texto suelto, no botones. Por eso
   *     la tarjeta se leía distinta según hubiera firma o no: firmada, el botón
   *     principal también pasaba a ese fondo fantasma y quedaban los tres.
   *  2. RADIOS FUERA DE ESCALA: 12 en la tarjeta y 8/10 dentro. El sistema usa
   *     `--cf-r-card` (18) y `--cf-r-control` (14).
   *  3. BOTONES DE 32px de alto. El dedo necesita 44, y el resto de la pantalla
   *     usa 38-46.
   *
   * Lo que SÍ se conserva es el tinte verde cuando está firmada: eso no era el
   * diseño viejo, es que un pagaré firmado y uno sin firmar son dos estados
   * distintos y la tarjeta hace bien en decirlo.
   */
  return (
    <>
      {/* Card visible */}
      <div
        className="w-full border overflow-hidden"
        style={{
          borderRadius: 'var(--cf-r-card)',
          background: firmaUrl
            ? 'color-mix(in srgb, var(--cf-green-dark) 5%, var(--cf-card))'
            : 'var(--cf-card)',
          borderColor: firmaUrl
            ? 'color-mix(in srgb, var(--cf-green-dark) 20%, var(--cf-border))'
            : 'var(--cf-border)',
        }}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 flex items-center gap-3">
          <div className="w-9 h-9 flex items-center justify-center shrink-0"
            style={{
              borderRadius: 'var(--cf-r-icon)',
              background: firmaUrl ? 'color-mix(in srgb, var(--cf-green-dark) 15%, transparent)' : 'var(--cf-fill)',
            }}
          >
            <svg className="w-4 h-4" style={{ color: firmaUrl ? 'var(--cf-green-dark)' : 'var(--cf-ink-3)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
            </svg>
          </div>
          {/* ══ E02 · SI FALTA LA FIRMA, ES UN PENDIENTE ══════════════════
              Decía «Firma del cliente» y debajo «Sin firma» en gris, las dos
              cosas del mismo color y peso. Un pagaré sin firmar no es un dato
              que falte: es algo que hay que hacer, y con esa letra gris se leía
              como una casilla vacía más.
              Firmado, se queda como estaba: ahí sí es un dato. */}
          <div className="flex-1 min-w-0">
            {firmaUrl ? (
              <p className="text-[10px] font-bold uppercase tracking-[.06em]" style={{ color: 'var(--cf-ink-3)' }}>Firma del cliente</p>
            ) : (
              <>
                {/* 13.5 no está en la escala: los tamaños del sistema no llevan coma. */}
                <p className="text-[14px] font-bold" style={{ color: 'var(--cf-ink)' }}>
                  Falta la firma del pagaré
                </p>
                {desdeCuando && (
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>
                    sin firma desde el {desdeCuando}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Firma visible */}
        {firmaUrl && (
          <button
            type="button"
            onClick={() => setModalVer(true)}
            className="w-full px-4 pb-3"
          >
            <div className="overflow-hidden w-full border" style={{ borderRadius: 'var(--cf-r-control)', background: '#ffffff', borderColor: 'var(--cf-border)', height: 88 }}>
              <img src={firmaUrl} alt="Firma" className="h-full w-auto object-contain mx-auto" />
            </div>
          </button>
        )}

        {/* ── Botones ──
            `secundario` es el estilo de verdad del sistema: papel con borde. El
            `rgba(255,255,255,0.06)` que había es blanco sobre blanco. */}
        <div className="px-4 pb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setModalFirmar(true)}
            className="flex items-center justify-center gap-1 transition-colors"
            style={firmaUrl ? { ...SECUNDARIO } : {
              // Sin firma es LA acción de esta tarjeta, no una más de tres.
              ...BASE_BOTON,
              background: 'var(--cf-gold)',
              border: '1px solid transparent',
              color: 'var(--cf-gold-ink)',
              fontWeight: 700,
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
            </svg>
            {firmaUrl ? 'Modificar' : 'Firmar ahora'}
          </button>
          <button
            type="button"
            onClick={descargarPagare}
            disabled={descargandoPagare}
            className="flex items-center justify-center gap-1 transition-colors"
            style={{
              ...BASE_BOTON,
              background: 'var(--cf-gold-tint)',
              border: '1px solid var(--cf-gold-border)',
              // `--cf-gold-text`, no `--cf-gold`: el dorado puro sobre su propio
              // tinte no llega al contraste que se lee bajo sol.
              color: 'var(--cf-gold-text)',
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            {descargandoPagare ? 'Generando...' : 'Pagaré'}
          </button>
          <button
            type="button"
            onClick={descargarComprobante}
            disabled={descargando}
            className="flex items-center justify-center gap-1 transition-colors"
            style={SECUNDARIO}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {descargando ? 'Generando...' : 'Comprobante'}
          </button>
        </div>
      </div>

      {/* Modal ver firma ampliada */}
      <Modal open={modalVer} onClose={() => setModalVer(false)} title="Firma del cliente">
        {firmaUrl && (
          <div className="overflow-hidden border" style={{ borderRadius: 'var(--cf-r-control)', background: '#ffffff', borderColor: 'var(--cf-border)' }}>
            <img src={firmaUrl} alt="Firma" className="w-full object-contain" style={{ maxHeight: 300 }} />
          </div>
        )}
      </Modal>

      {/* Modal firmar/re-firmar */}
      {/* -- T18-02, MONTADA --
          El recuadro era un cuadro blanco con «Firmar aqui» en gris y dos
          botones iguales debajo. `Firma` le pone lo que un papel tiene y una
          caja no: LA LINEA sobre la que se firma, el rotulo «Firma del
          cliente», y la fecha y la hora al lado — que es lo que convierte un
          garabato en algo fechado.

          Y el titular dice el nombre: «Firma aqui, Steven Olmos». Se lo enseña
          el cobrador al cliente, y un «Firma del cliente» generico no confirma
          a quien se le esta pidiendo.

          El `canvas` va por la ranura `children`: el trazo que dibuja la lamina
          es de mentira, aqui la firma es de verdad. */}
      {/* `padding={false}`: `Firma` trae su propio `14px 20px 16px`, y con el
          del modal encima el lienzo quedaba estrecho y el titulo corrido. */}
      <Modal open={modalFirmar} onClose={() => setModalFirmar(false)} padding={false}>
        <div style={{ height: 'min(70vh, 460px)' }}>
          <Firma
            nombre={prestamo?.cliente?.nombre ?? 'aquí'}
            resumen={resumenFirma}
            fecha={new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
            hora={new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}
            onBorrar={limpiar}
            onListo={guardar}
            guardando={saving}
            puedeGuardar={hasStrokes}
          >
            <canvas
              ref={canvasRef}
              className="touch-none"
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                cursor: 'crosshair', background: 'transparent',
              }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </Firma>
        </div>
      </Modal>
    </>
  )
}
