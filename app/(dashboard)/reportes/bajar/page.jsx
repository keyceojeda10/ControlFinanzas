'use client'

// ── T33-02 · Bajar información ──
//
// Estas tres tarjetas vivían al FINAL de `/reportes`, después de 3.700 píxeles
// de scroll y de siete secciones más. Aquí tienen su pantalla, que es lo que
// dice la lámina y lo que tiene sentido: bajar un Excel para el contador no es
// «mirar cómo va el negocio», es otra tarea.
//
// Lo que se conserva íntegro son las tres llamadas al servidor —el PDF del
// listado, el PDF del resumen y los cuatro Excel—, que funcionaban y no son
// diseño.

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCabecera } from '@/components/armazon/Armazon'
import { BajarInformacion } from '@/components/pantallas/Bajar'
import { PilaEsqueletos } from '@/components/cf/primitivos2'
import { formatMoney } from '@/lib/i18n'

/** Primer y último día del mes en curso, que es el período por defecto. */
function mesActual() {
  const hoy = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const y = hoy.getFullYear()
  const m = hoy.getMonth()
  const ultimo = new Date(y, m + 1, 0).getDate()
  return { desde: `${y}-${p(m + 1)}-01`, hasta: `${y}-${p(m + 1)}-${p(ultimo)}` }
}

/** Trae el archivo del servidor. Es igual para los tres. */
async function pedirArchivo(url, nombre, tipo) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('no se pudo generar')
  const blob = await res.blob()
  return new File([blob], nombre, { type: tipo || blob.type })
}

/** Lo baja al telefono. */
function guardar(archivo) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(archivo)
  a.download = archivo.name
  a.click()
  URL.revokeObjectURL(a.href)
}

/**
 * ── MANDAR ES EL PUNTO DE LA LAMINA ──
 *
 * El destinatario de estos archivos casi siempre es el contador, por WhatsApp.
 * Bajarlo al telefono para luego buscarlo en la galeria y subirlo es un paso
 * que sobra, asi que aqui se comparte directo con la hoja del sistema — la
 * misma que sale al compartir una foto — y WhatsApp aparece en ella.
 *
 * `canShare({files})` no esta en todos lados: falta en Firefox de escritorio y
 * en algunos Android viejos. Donde no esta, se baja Y SE DICE, en vez de dejar
 * un boton que aparenta no hacer nada.
 */
async function compartir(archivo, titulo) {
  const datos = { files: [archivo], title: titulo, text: titulo }
  if (typeof navigator !== 'undefined' && navigator.canShare?.(datos)) {
    try {
      await navigator.share(datos)
      return 'compartido'
    } catch (e) {
      // Cancelar no es un fallo: se cerro la hoja a proposito.
      if (e?.name === 'AbortError') return 'cancelado'
    }
  }
  guardar(archivo)
  return 'bajado'
}

export default function BajarPage() {
  const router = useRouter()
  const { esOwner, loading: cargandoSesion } = useAuth()
  const { desde, hasta } = mesActual()

  const [rutas, setRutas] = useState([])
  const [conteos, setConteos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [ruta, setRuta] = useState('')
  const [orden, setOrden] = useState('mora')
  const [soloMora, setSoloMora] = useState(false)
  const [cuenta, setCuenta] = useState(null)

  const [bajandoListado, setBajandoListado] = useState(false)
  const [mandandoListado, setMandandoListado] = useState(false)
  const [bajandoResumen, setBajandoResumen] = useState(false)
  const [bajandoExcel, setBajandoExcel] = useState('')
  const [aviso, setAviso] = useState('')

  useCabecera({
    titulo: 'Bajar información',
    subtitulo: 'para el contador o para imprimir',
  })

  useEffect(() => {
    if (cargandoSesion || !esOwner) return
    let vivo = true
    ;(async () => {
      try {
        const [rc, rr, rb] = await Promise.all([
          fetch('/api/reportes/cartera'),
          fetch(`/api/reportes/resumen?desde=${desde}&hasta=${hasta}`),
          // Los cobradores van aparte: `resumen` no los cuenta. Si esta llamada
          // falla —está limitada por plan— el Excel de cobradores se queda sin
          // cifra, que es mejor que enseñar una inventada.
          fetch(`/api/reportes/cobradores?desde=${desde}&hasta=${hasta}`).catch(() => null),
        ])
        if (!vivo) return
        const cartera = rc.ok ? await rc.json() : []
        const resumen = rr.ok ? await rr.json() : null
        const cobradores = rb?.ok ? await rb.json() : null
        setRutas((Array.isArray(cartera) ? cartera : cartera?.rutas ?? [])
          .map((r) => ({ id: r.id, nombre: r.ruta ?? r.nombre })))
        // Cuántas filas trae cada Excel. La lámina lo pide: si dice 0, mejor
        // saberlo antes de abrirlo en el computador y encontrarlo vacío.
        setConteos({
          clientes: resumen?.clientes?.total ?? null,
          prestamos: resumen?.prestamos?.activos ?? null,
          pagos: resumen?.pagos?.cantidad ?? null,
          cobradores: Array.isArray(cobradores) ? cobradores.length : null,
        })
      } catch {
        if (vivo) setError('No se pudo cargar. Revisa la conexión.')
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [cargandoSesion, esOwner, desde, hasta])

  // La cuenta de «quién me debe», recalculada con cada cambio de filtro. Sale
  // del MISMO sitio que el PDF, así que no pueden decir cosas distintas.
  useEffect(() => {
    if (cargandoSesion || !esOwner) return
    let vivo = true
    const params = new URLSearchParams({ solo: 'cuenta', orden })
    if (ruta) params.set('rutaId', ruta)
    if (soloMora) params.set('soloMora', '1')
    setCuenta(null)
    ;(async () => {
      try {
        const res = await fetch(`/api/reportes/listado-cobros?${params}`)
        if (!vivo || !res.ok) return
        const d = await res.json()
        setCuenta(d)
      } catch { /* sin cuenta se puede bajar igual */ }
    })()
    return () => { vivo = false }
  }, [ruta, orden, soloMora, cargandoSesion, esOwner])

  const conAviso = useCallback(async (fn, poner) => {
    poner(true)
    setError('')
    setAviso('')
    try {
      const r = await fn()
      // Donde no se puede compartir se baja, y se dice: un boton «Mandar» que
      // guarda el archivo sin avisar parece que no hizo nada.
      if (r === 'bajado') {
        setAviso('Este aparato no puede compartir archivos. Se bajó — mándalo desde WhatsApp.')
      }
    } catch {
      setError('No se pudo generar el archivo.')
    } finally { poner(false) }
  }, [])

  if (cargandoSesion || cargando) {
    return <div className="pb-24"><PilaEsqueletos cuantos={3} alto={150} /></div>
  }

  if (!esOwner) {
    return (
      <p className="text-sm py-10 text-center" style={{ color: 'var(--cf-ink-3)' }}>
        Solo el dueño puede bajar la información del negocio.
      </p>
    )
  }

  const hoy = new Date().toISOString().slice(0, 10)
  const NOMBRE_LISTADO = `quien-me-debe-${hoy}.pdf`
  const NOMBRE_RESUMEN = `resumen-${desde}-a-${hasta}.pdf`

  // Los mismos filtros para bajar y para mandar. Si se construyen dos veces, un
  // dia uno lleva `soloMora` y el otro no, y el contador recibe otra cosa.
  const urlListado = () => {
    const p = new URLSearchParams({ orden })
    if (ruta) p.set('rutaId', ruta)
    if (soloMora) p.set('soloMora', '1')
    return `/api/reportes/listado-cobros?${p}`
  }
  const urlResumen = `/api/reportes/resumen-pdf?desde=${desde}&hasta=${hasta}`

  return (
    <div className="pb-24">
      {error && (
        <p className="text-sm mb-3" style={{ color: 'var(--cf-red-dark)' }}>{error}</p>
      )}
      {aviso && (
        <p className="text-[13px] mb-3 leading-relaxed" style={{ color: 'var(--cf-ink-2)' }}>{aviso}</p>
      )}

      <BajarInformacion
        quienDebe={{
          rutas,
          ruta, onRuta: setRuta,
          orden, onOrden: setOrden,
          soloMora, onSoloMora: setSoloMora,
          cuenta: cuenta
            ? cuenta.clientes === 0
              // Cero no es «van a salir 0 clientes»: es que no hay nada que
              // bajar, y decirlo así evita el PDF en blanco.
              ? 'Con este filtro no sale nadie'
              : `Van a salir ${cuenta.clientes} ${cuenta.clientes === 1 ? 'cliente' : 'clientes'} · ${formatMoney(cuenta.saldo)}`
            : null,
          bajando: bajandoListado,
          mandando: mandandoListado,
          onBajar: () => conAviso(
            async () => guardar(await pedirArchivo(urlListado(), NOMBRE_LISTADO, 'application/pdf')),
            setBajandoListado,
          ),
          onMandar: () => conAviso(
            async () => compartir(
              await pedirArchivo(urlListado(), NOMBRE_LISTADO, 'application/pdf'),
              'Quién me debe',
            ),
            setMandandoListado,
          ),
        }}
        comoMeFue={{
          bajando: bajandoResumen,
          onBajar: () => conAviso(
            async () => guardar(await pedirArchivo(urlResumen, NOMBRE_RESUMEN, 'application/pdf')),
            setBajandoResumen,
          ),
          onMandar: () => conAviso(
            async () => compartir(
              await pedirArchivo(urlResumen, NOMBRE_RESUMEN, 'application/pdf'), 'Cómo me fue'),
            setBajandoResumen,
          ),
        }}
        datos={[
          { tipo: 'clientes', nombre: 'Clientes' },
          { tipo: 'prestamos', nombre: 'Préstamos' },
          { tipo: 'pagos', nombre: 'Pagos' },
          { tipo: 'cobradores', nombre: 'Cobradores' },
        ].map((d) => ({
          ...d,
          filas: conteos?.[d.tipo] ?? null,
          bajando: bajandoExcel === d.tipo,
          onBajar: () => conAviso(
            async () => guardar(await pedirArchivo(
              `/api/reportes/exportar?tipo=${d.tipo}&desde=${desde}&hasta=${hasta}`,
              `control-finanzas-${d.tipo}-${desde}.xlsx`,
            )),
            (v) => setBajandoExcel(v ? d.tipo : ''),
          ),
        }))}
      />

      <button
        type="button"
        onClick={() => router.push('/reportes')}
        className="mt-4 w-full text-[13px] font-bold"
        style={{ color: 'var(--cf-gold-dark)' }}
      >
        Volver a reportes
      </button>
    </div>
  )
}
