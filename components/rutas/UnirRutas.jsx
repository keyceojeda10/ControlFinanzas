'use client'
/* LA HOJA «UNIR CON OTRA RUTA». El cuerpo vive en `Gestion.jsx` (`UnirRuta`)
 * con el resto de hojas que mueven plata; aquí va su estado y el envío.
 *
 * Las cifras que enseña las da el servidor (`GET /api/rutas/[id]/unir`), con
 * la misma cuenta que usa al unir (lib/rutas/fusionar.js): lo que se ve es lo
 * que queda, salvo que entre un cobro entre medias.
 */
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import HojaInferior, { salirDeHojaHacia } from '@/components/cf/HojaInferior'
import { UnirRuta, PieGestion } from '@/components/pantallas/Gestion'

export default function UnirRutas({ abierta, onCerrar, onVolver, ruta, formatMoney }) {
  const router = useRouter()
  const [rutas, setRutas] = useState([])
  const [destinoId, setDestinoId] = useState(null)
  const [vista, setVista] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [cobradorId, setCobradorId] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  /* Al abrir se empieza en blanco: elegir la ruta destino es una decisión, no
     algo que deba venir puesto. */
  useEffect(() => {
    if (!abierta || !ruta?.id) return
    setDestinoId(null); setVista(null); setError(''); setCobradorId(null)
    let vivo = true
    fetch('/api/rutas')
      .then((r) => (r.ok ? r.json() : []))
      .then((lista) => {
        if (!vivo || !Array.isArray(lista)) return
        setRutas(lista
          .filter((r) => r.id !== ruta.id)
          .map((r) => ({ id: r.id, nombre: r.nombre, cobrador: r.cobrador?.nombre ?? null, clientes: r.cantidadClientes ?? 0 })))
      })
      .catch(() => {})
    return () => { vivo = false }
  }, [abierta, ruta?.id])

  useEffect(() => {
    if (!destinoId) { setVista(null); setError(''); return }
    if (!ruta?.id) return
    let vivo = true
    setVista(null); setCargando(true); setError('')
    fetch(`/api/rutas/${ruta.id}/unir?destino=${encodeURIComponent(destinoId)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!vivo) return
        if (!r.ok) { setError(d.error || 'No se pudo calcular la unión'); return }
        setVista(d)
        /* Viene puesto el que ya cobra la ruta destino. */
        setCobradorId(d.destino?.cobrador?.id ?? null)
      })
      .catch(() => vivo && setError('Sin conexión.'))
      .finally(() => vivo && setCargando(false))
    return () => { vivo = false }
  }, [destinoId, ruta?.id])

  /* Solo los dos que ya cobran estas rutas, y «nadie»: elegir a un tercero es
     cambiar de cobrador, y eso ya se hace desde el lápiz de la ruta. */
  const cobradores = useMemo(() => {
    if (!vista) return []
    const lista = []
    if (vista.destino.cobrador) lista.push({ id: vista.destino.cobrador.id, nombre: vista.destino.cobrador.nombre, nota: `Ya cobra ${vista.destino.nombre}` })
    if (vista.origen.cobrador && vista.origen.cobrador.id !== vista.destino.cobrador?.id) {
      lista.push({ id: vista.origen.cobrador.id, nombre: vista.origen.cobrador.nombre, nota: `Cobraba ${vista.origen.nombre}` })
    }
    lista.push({ id: null, nombre: 'Sin cobrador', nota: 'La ruta queda sin nadie asignado' })
    return lista
  }, [vista])

  /* El bloqueo de cambiar de cobrador depende de a quién se elija: lo decide
     la pantalla con lo que dijo el servidor, y el servidor lo vuelve a mirar. */
  const cambiaCobrador = vista && (cobradorId ?? null) !== (vista.destino.cobrador?.id ?? null)
  const bloqueo = vista ? (vista.bloqueo || (cambiaCobrador ? vista.bloqueoSiCambia : null)) : null

  /* En los negocios donde el cobrador carga el capital de la ruta en efectivo,
     unir es también pasar esos billetes de mano: se dice quién a quién. */
  const entrega = useMemo(() => {
    if (!vista?.capitalEsEfectivo || !vista.origen.capital) return null
    const de = vista.origen.cobrador
    const para = cobradores.find((c) => (c.id ?? null) === (cobradorId ?? null))
    if (de && para?.id === de.id) return null
    const monto = formatMoney(Math.abs(vista.origen.capital))
    const recibe = para?.id ? para.nombre : 'ti'
    return de
      ? `${de.nombre} lleva en efectivo el capital de ${vista.origen.nombre}: tiene que entregarle ${monto} a ${recibe}.`
      : `El capital de ${vista.origen.nombre} (${monto}) pasa a ${vista.destino.nombre}: quien la cobre lo lleva desde hoy.`
  }, [vista, cobradores, cobradorId, formatMoney])

  async function unir() {
    if (!vista) return
    setEnviando(true)
    setError('')
    try {
      const res = await fetch(`/api/rutas/${ruta.id}/unir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinoId, cobradorId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'No se pudo unir. Intenta de nuevo.'); return }
      /* A la ruta que queda: esta ya está archivada.
         ⚠ `salirDeHojaHacia`, NO `onCerrar()` + `router.push`: la hoja retira su
         entrada del historial con un `back()` diferido que aborta la navegación
         (ver la nota en `HojaInferior.jsx`). */
      onCerrar?.()
      salirDeHojaHacia(router, `/rutas/${data.destino.id}`)
    } catch {
      setError('Sin conexión. No se unió nada: intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <HojaInferior
      abierta={abierta}
      onCerrar={onCerrar}
      onVolver={onVolver}
      titulo="Unir con otra ruta"
      subtitulo={ruta?.nombre}
      accion={
        <PieGestion
          onCancelar={onCerrar}
          onAceptar={unir}
          textoAceptar={vista ? `Unir con ${vista.destino.nombre}` : 'Unir'}
          deslizar
          deshabilitado={!vista || Boolean(bloqueo) || enviando}
          aceptando={enviando}
          error={error}
        />
      }
    >
      <UnirRuta
        origen={ruta?.nombre ?? ''}
        rutas={rutas}
        destinoId={destinoId}
        onDestino={setDestinoId}
        cargando={cargando}
        vista={vista}
        cobradores={cobradores}
        cobradorId={cobradorId}
        onCobrador={setCobradorId}
        bloqueo={bloqueo}
        entrega={entrega}
        formatMoney={formatMoney}
      />
    </HojaInferior>
  )
}
