'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCabecera } from '@/components/armazon/Armazon'
import HojaInferior from '@/components/cf/HojaInferior'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import MoneyInput from '@/components/ui/MoneyInput'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { SkeletonCard } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import { CuentaSocio } from '@/components/pantallas/Socios'
import { formatMoney } from '@/lib/i18n'
import { useCountry } from '@/hooks/useCountry'
import { RegistrarAcciones } from '@/components/acciones/AccionesProvider'
import QueNecesitas from '@/components/acciones/QueNecesitas'

export default function SocioDetallePage() {
  const { id } = useParams()
  const router = useRouter()
  const { esOwner, loading: authLoading } = useAuth()
  const { country } = useCountry()
  const fmt = (v) => formatMoney(v, country)

  const [socio, setSocio] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [confirmEliminarSocio, setConfirmEliminarSocio] = useState(false)
  // El menú «⋯» de la cabecera.
  const [menuAbierto, setMenuAbierto] = useState(false)

  // ── LAS ACCIONES DEL SOCIO VIVEN EN EL «⋯», NO EN UNA TARJETA ────────────
  // Estaban en una caja redondeada al final de la pantalla, pegada a la de los
  // botones. El dueño lo fotografió: «hay dos cajas, una cuadrada y una
  // redondeada, todo eso está pegado ahí, eso está muy mal». Y T45-03 no dibuja
  // ninguna caja de acciones.
  //
  // Decidido: al menú de los tres puntos, que es donde se esperan las acciones
  // destructivas. NO se borran — desactivar y eliminar un socio son cosas que
  // el dueño necesita poder hacer.
  //
  // ⚠ `useMemo` NO es opcional: `acciones` es JSX y cambia de identidad en cada
  // render, así que sin memoizar re-registraría la cabecera en bucle. Lo avisa
  // la propia documentación de `useCabecera`.
  //
  // ⚠ Y va AQUÍ, antes de cualquier `return` temprano. Un hook después de un
  // return condicional es el React #310 que ya tiró una pantalla entera de este
  // proyecto: se ve bien en el código y revienta al abrirla.
  const acciones = useMemo(() => (
    <button
      type="button"
      onClick={() => setMenuAbierto(true)}
      aria-label="Más acciones"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, borderRadius: 999, flex: 'none',
        background: 'transparent', border: 0, cursor: 'pointer',
        color: 'var(--cf-ink)',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
      </svg>
    </button>
  ), [])
  useCabecera({ titulo: socio?.nombre || 'Socio', acciones })
  const [loadingEliminar, setLoadingEliminar] = useState(false)

  const [modalAporte, setModalAporte] = useState(false)
  const [tipoAporte, setTipoAporte] = useState('aporte')
  const [montoAporte, setMontoAporte] = useState('')
  const [notaAporte, setNotaAporte] = useState('')
  const [fechaAporte, setFechaAporte] = useState('')
  const [loadingAporte, setLoadingAporte] = useState(false)

  const [editando, setEditando] = useState(false)
  const [formEdit, setFormEdit] = useState({})
  const [loadingEdit, setLoadingEdit] = useState(false)

  const [confirmEliminar, setConfirmEliminar] = useState(null)

  const [anioLiquidacion, setAnioLiquidacion] = useState(new Date().getFullYear())

  const cargar = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const res = await fetch(`/api/socios/${id}`)
      if (!res.ok) throw new Error('Error al cargar socio')
      setSocio(await res.json())
    } catch (e) {
      setError('No se pudo cargar el socio.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  const registrarAporte = async () => {
    if (!montoAporte || Number(montoAporte) <= 0) return
    setLoadingAporte(true)
    try {
      const res = await fetch(`/api/socios/${id}/aportes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto: Number(montoAporte), nota: notaAporte, tipo: tipoAporte, ...(fechaAporte && { fecha: fechaAporte }) }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Error')
      }
      setModalAporte(false)
      setMontoAporte('')
      setNotaAporte('')
      setFechaAporte('')
      setTipoAporte('aporte')
      cargar()
    } catch (e) {
      alert(e.message)
    } finally {
      setLoadingAporte(false)
    }
  }

  const eliminarAporte = async (aporteId) => {
    try {
      const res = await fetch(`/api/socios/${id}/aportes?aporteId=${aporteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      setConfirmEliminar(null)
      cargar()
    } catch (e) {
      alert(e.message)
    }
  }

  const guardarEdicion = async () => {
    setLoadingEdit(true)
    try {
      const res = await fetch(`/api/socios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formEdit),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
      setEditando(false)
      cargar()
    } catch (e) {
      alert(e.message)
    } finally {
      setLoadingEdit(false)
    }
  }

  const eliminarSocio = async () => {
    setLoadingEliminar(true)
    try {
      const res = await fetch(`/api/socios/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Error al eliminar')
      router.push('/socios')
    } catch (e) {
      alert(e.message)
      setConfirmEliminarSocio(false)
    } finally {
      setLoadingEliminar(false)
    }
  }

  const toggleActivo = async () => {
    try {
      const res = await fetch(`/api/socios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !socio.activo }),
      })
      if (!res.ok) throw new Error('Error')
      cargar()
    } catch (e) {
      alert(e.message)
    }
  }

  if (authLoading) return null

  if (!esOwner) {
    return <div className="p-4 text-center" style={{ color: 'var(--cf-ink-3)' }}>No tienes acceso.</div>
  }

  if (loading) {
    return <div className="space-y-3 pb-28"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
  }

  if (error || !socio) {
    return (
      <div className="pb-28">
        <div
          className="cf-card-shadow rounded-[20px] p-6 text-center"
          style={{ background: 'color-mix(in srgb, var(--cf-red-dark) 8%, var(--cf-card))', border: '1px solid color-mix(in srgb, var(--cf-red-dark) 30%, transparent)' }}
        >
          <p className="font-semibold mb-2" style={{ color: 'var(--cf-red-dark)' }}>{error || 'Socio no encontrado'}</p>
          <div className="flex items-center justify-center gap-4 mt-3">
            <button onClick={cargar} className="text-sm underline" style={{ color: 'var(--cf-red-dark)' }}>Reintentar</button>
            <button onClick={() => router.back()} className="text-sm underline opacity-70" style={{ color: 'var(--cf-ink-3)' }}>Volver</button>
          </div>
        </div>
      </div>
    )
  }

  const prestamosConInteresAnio = socio.prestamos
    .map((p) => ({ ...p, interesAnio: p.interesesPorAnio?.[anioLiquidacion] || 0 }))
    .filter((p) => p.interesAnio > 0)
  const interesesAnio = prestamosConInteresAnio.reduce((acc, p) => acc + p.interesAnio, 0)
  const aportesAnio = (socio.aportes || []).filter(a => a.tipo !== 'retiro' && new Date(a.fecha).getFullYear() === anioLiquidacion).reduce((a, b) => a + b.monto, 0)
  const retirosAnio = (socio.aportes || []).filter(a => a.tipo === 'retiro' && new Date(a.fecha).getFullYear() === anioLiquidacion).reduce((a, b) => a + b.monto, 0)
  const roiAnio = aportesAnio > 0 ? Math.round((interesesAnio / aportesAnio) * 100) : (socio.totalAportes > 0 ? Math.round((interesesAnio / socio.totalAportes) * 100) : 0)

  const capitalEnCalle = socio.prestamos.reduce((acc, p) => acc + (p.montoPrestado ?? 0), 0)

  // ── T45-03 · La cuenta del socio ──
  //
  // Fuera la tarjeta de crédito con «Balance neto». LA RELACIÓN CON UN SOCIO ES
  // UNA DEUDA, NO UN BALANCE: «balance neto» junta lo que puso y lo que se le ha
  // dado en un solo número y esconde justo el que hay que mirar antes de que lo
  // pregunte. Ahora van las cuatro cifras separadas.
  //
  // «Le debes» todavía no se puede calcular: falta el tipo de movimiento
  // «reparto» (PENDIENTE-BACKEND en lib/adaptadores/socios.js). Hasta que exista,
  // la cifra héroe es LO QUE PUSO —que es un hecho— y no un cero inventado que se
  // leería como «no le debo nada».
  const movimientos = (socio.aportes ?? []).map((a) => ({
    id: a.id,
    tipo: a.tipo === 'retiro' ? 'pago' : 'aporte',
    concepto: a.tipo === 'retiro' ? 'Le pagaste' : 'Puso',
    detalle: [
      new Date(a.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
      a.nota,
    ].filter(Boolean).join(' · '),
    monto: fmt(a.monto),
  }))

  const enMora = socio.prestamos.filter((p) => (p.diasMora ?? 0) > 0)
    .reduce((acc, p) => acc + (p.montoPrestado ?? 0), 0)

  /* ══ LO QUE SE PUEDE HACER CON ESTE SOCIO ================================
   *
   * «Aporte» y «retiro» son las palabras del sistema. Las de la gente son
   * «metió plata», «le devolví» y «cuánto le debo». El menú de los tres puntos
   * —editar y eliminar— ni siquiera dice que existe hasta que se pulsa.
   *
   * ⚠ No se registra «repartir ganancias»: el reparto por préstamo se retiró en
   * julio y hoy solo queda el reparto por % del capital, que se ve, no se
   * ejecuta. Ofrecer un botón para algo que ya no se hace es peor que nada. */
  const accionesSocio = [
    { id: 'socio-aporte', label: 'Registrar que puso plata', pista: 'Un aporte al capital',
      sinonimos: ['aporte', 'metio plata', 'puso plata', 'agrego capital', 'aporto',
        'entrego plata', 'nuevo aporte'],
      ejecutar: () => { setTipoAporte('aporte'); setModalAporte(true) } },
    { id: 'socio-retiro', label: 'Registrar que le devolví plata', pista: 'Un retiro del socio',
      sinonimos: ['retiro', 'le devolvi', 'le pague', 'saco plata', 'le entregue',
        'devolucion', 'le di plata'],
      ejecutar: () => { setTipoAporte('retiro'); setModalAporte(true) } },
    { id: 'socio-editar', label: 'Editar los datos del socio', pista: 'Nombre, teléfono, porcentaje',
      sinonimos: ['editar', 'corregir', 'cambiar el nombre', 'cambiar el porcentaje',
        'cambiar el telefono'],
      ejecutar: () => { setMenuAbierto(false); setEditando(true) } },
    { id: 'socio-eliminar', label: 'Eliminar el socio', pista: 'No se puede deshacer',
      sinonimos: ['eliminar', 'borrar socio', 'quitar socio', 'se salio'],
      ejecutar: () => { setMenuAbierto(false); setConfirmEliminarSocio(true) } },
  ]

  return (
    <div style={{ height: '100%', minHeight: 0 }}>
      <CuentaSocio
        leDebesEtiqueta="Su capital hoy"
        leDebes={fmt(Math.max(0, socio.totalAportes - (socio.totalRetiros || 0)))}
        puso={fmt(socio.totalAportes)}
        haGanado={fmt(socio.interesesCobrados)}
        leHasDado={fmt(socio.totalRetiros || 0)}
        prestamos={socio.prestamos.length}
        montoEnCalle={fmt(capitalEnCalle)}
        montoEnMora={fmt(enMora)}
        movimientos={movimientos}
        onBorrarMovimiento={(m) => setConfirmEliminar(m.id)}
        onVerPrestamos={() => router.push(`/prestamos?socio=${socio.id}`)}
        onMandarCuenta={() => {
          // Se abre WhatsApp con el texto: el socio NO entra a la app, y sin esto
          // tiene que llamar al dueño cada vez que quiere saber cómo va.
          const t = [
            `Hola ${socio.nombre}, tu cuenta al día de hoy:`,
            `Pusiste ${fmt(socio.totalAportes)}.`,
            `Has ganado ${fmt(socio.interesesCobrados)} en intereses.`,
            `Te he dado ${fmt(socio.totalRetiros || 0)}.`,
            `Tu plata está en ${socio.prestamos.length} préstamos, ${fmt(capitalEnCalle)} en la calle.`,
          ].join('\n')
          const tel = String(socio.telefono ?? '').replace(/\D/g, '')
          const num = tel.length > 10 ? tel : `57${tel}`
          window.open(tel.length >= 7
            ? `https://wa.me/${num}?text=${encodeURIComponent(t)}`
            : `https://wa.me/?text=${encodeURIComponent(t)}`, '_blank')
        }}
        onPagar={() => { setTipoAporte('retiro'); setModalAporte(true) }}
      >
      <div className="pb-24 space-y-4">
      {/* Acciones (fuera del hero) */}
      <div className="flex justify-end">
        <Button
          variant="secondary"
          onClick={() => { setFormEdit({ nombre: socio.nombre, cedula: socio.cedula || '', telefono: socio.telefono || '', notas: socio.notas || '' }); setEditando(true) }}
        >
          Editar
        </Button>
      </div>

      {/* Liquidacion anual */}
      <div
        className="cf-card-shadow rounded-[20px] p-4"
        style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--cf-ink)' }}>
            Liquidacion {anioLiquidacion}
          </h2>
          <div className="flex gap-1">
            <button
              onClick={() => setAnioLiquidacion((a) => a - 1)}
              className="w-7 h-7 rounded-[8px] flex items-center justify-center text-[13px]"
              style={{ background: 'var(--cf-fill)', color: 'var(--cf-ink-3)' }}
            >
              {'<'}
            </button>
            <button
              onClick={() => setAnioLiquidacion((a) => a + 1)}
              className="w-7 h-7 rounded-[8px] flex items-center justify-center text-[13px]"
              style={{ background: 'var(--cf-fill)', color: 'var(--cf-ink-3)' }}
            >
              {'>'}
            </button>
          </div>
        </div>

        {prestamosConInteresAnio.length === 0 && !aportesAnio && !retirosAnio ? (
          <p className="text-[13px]" style={{ color: 'var(--cf-ink-3)' }}>Sin movimientos en {anioLiquidacion}</p>
        ) : (
          <>
            {prestamosConInteresAnio.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--cf-border)' }}>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium truncate" style={{ color: 'var(--cf-ink)' }}>
                    {p.clienteNombre}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>
                    {fmt(p.montoPrestado)} al {p.tasaInteres}%
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--cf-green-dark)' }}>
                    {fmt(p.interesAnio)}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>
                    {p.estado === 'activo' ? 'Activo' : 'Completado'}
                  </p>
                </div>
              </div>
            ))}

            {(aportesAnio > 0 || retirosAnio > 0) && (
              <div className="pt-2 mt-1 space-y-1" style={{ borderTop: '1px dashed var(--cf-border)' }}>
                {aportesAnio > 0 && (
                  <div className="flex justify-between text-[12px]">
                    <span style={{ color: 'var(--cf-ink-3)' }}>Aportes en {anioLiquidacion}</span>
                    <span className="font-medium" style={{ color: 'var(--cf-gold)' }}>+{fmt(aportesAnio)}</span>
                  </div>
                )}
                {retirosAnio > 0 && (
                  <div className="flex justify-between text-[12px]">
                    <span style={{ color: 'var(--cf-ink-3)' }}>Retiros en {anioLiquidacion}</span>
                    <span className="font-medium" style={{ color: 'var(--cf-red-dark)' }}>-{fmt(retirosAnio)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="pt-3 mt-1 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold" style={{ color: 'var(--cf-ink)' }}>Intereses {anioLiquidacion}</p>
                <p className="text-[16px] font-bold" style={{ color: 'var(--cf-green-dark)' }}>{fmt(interesesAnio)}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[12px]" style={{ color: 'var(--cf-ink-3)' }}>Rendimiento (ROI)</p>
                <p className="text-[13px] font-semibold" style={{ color: roiAnio > 0 ? 'var(--cf-green-dark)' : 'var(--cf-ink-3)' }}>{roiAnio}%</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Prestamos del socio */}
      <div
        className="cf-card-shadow rounded-[20px] p-4"
        style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}
      >
        <h2 className="text-[14px] font-semibold mb-3" style={{ color: 'var(--cf-ink)' }}>
          Prestamos ({socio.prestamos.length})
        </h2>
        {socio.prestamos.length === 0 ? (
          <EmptyState
            pose="busca"
            titulo="Sin prestamos asociados"
            hint="Al crear un prestamo puedes asignar este socio como responsable."
            size={64}
          />
        ) : (
          <div className="space-y-2">
            {socio.prestamos.map((p) => (
              <div
                key={p.id}
                className="rounded-[12px] p-3"
                style={{ background: 'var(--cf-surface)', border: '1px solid var(--cf-border)' }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-medium" style={{ color: 'var(--cf-ink)' }}>
                    {p.clienteNombre}
                  </p>
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                    style={{
                      background: p.estado === 'activo'
                        ? 'color-mix(in srgb, var(--cf-green-dark) 12%, transparent)'
                        : 'color-mix(in srgb, var(--cf-ink-3) 12%, transparent)',
                      color: p.estado === 'activo' ? 'var(--cf-green-dark)' : 'var(--cf-ink-3)',
                    }}
                  >
                    {p.estado}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <p className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>Capital</p>
                    <p className="text-[12px] font-medium" style={{ color: 'var(--cf-ink)' }}>{fmt(p.montoPrestado)}</p>
                  </div>
                  <div>
                    <p className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>Cobrado</p>
                    <p className="text-[12px] font-medium" style={{ color: 'var(--cf-ink)' }}>{fmt(p.totalPagado)}</p>
                  </div>
                  <div>
                    <p className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>Intereses</p>
                    <p className="text-[12px] font-medium" style={{ color: 'var(--cf-green-dark)' }}>{fmt(p.interesesCobrados)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* El bloque «Movimientos» viejo sale: lo cubre «Su cuenta» de arriba, con
          la misma información y el mismo borrar. Dejar los dos sería enseñar la
          lista de aportes dos veces en la misma pantalla.

          Lo que SÍ se queda es registrar un aporte, que no estaba en la lámina y
          es la mitad del trabajo con un socio. «Pagarle» ya está en la barra. */}
      <div className="flex justify-end">
        <Button onClick={() => { setTipoAporte('aporte'); setModalAporte(true) }}>
          Registrar aporte
        </Button>
      </div>

      {socio.notas && (
        <div
          className="cf-card-shadow rounded-[20px] p-4"
          style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}
        >
          <h2 className="text-[14px] font-semibold mb-2" style={{ color: 'var(--cf-ink)' }}>Notas</h2>
          <p className="text-[13px] whitespace-pre-wrap" style={{ color: 'var(--cf-ink-3)' }}>{socio.notas}</p>
        </div>
      )}

      </div>
      </CuentaSocio>

      {/* Debajo de la cuenta: aqui se viene a MIRAR cuanto puso y cuanto se le
          debe. La caja va donde termina de leerse eso, no tapandolo. */}
      <div style={{ padding: '4px 16px 20px' }}>
        <RegistrarAcciones clave="socio" acciones={accionesSocio} />
        <QueNecesitas ejemplos={['metio plata', 'le devolvi', 'editar']} />
      </div>

      {/* Modal registrar aporte/retiro */}
      <Modal open={modalAporte} onClose={() => setModalAporte(false)} title={tipoAporte === 'retiro' ? 'Registrar retiro' : 'Registrar aporte'}>
        <div className="space-y-4">
          {tipoAporte === 'retiro' && (
            <p className="text-[12px] px-3 py-2 rounded-[12px]" style={{ background: 'color-mix(in srgb, var(--cf-gold-dark) 10%, transparent)', color: 'var(--cf-gold-dark)' }}>
              El retiro se restara del capital disponible del negocio.
            </p>
          )}
          <MoneyInput
            label={tipoAporte === 'retiro' ? 'Monto del retiro' : 'Monto del aporte'}
            value={montoAporte}
            onChange={(e) => setMontoAporte(e.target.value)}
          />
          <Input
            label="Fecha"
            type="date"
            value={fechaAporte}
            onChange={(e) => setFechaAporte(e.target.value)}
          />
          <Input
            label="Nota (opcional)"
            value={notaAporte}
            onChange={(e) => setNotaAporte(e.target.value)}
            placeholder={tipoAporte === 'retiro' ? 'Ej: Retiro de utilidades julio' : 'Ej: Aporte de julio'}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalAporte(false)} className="flex-1">Cancelar</Button>
            <Button onClick={registrarAporte} loading={loadingAporte} className="flex-1">
              {tipoAporte === 'retiro' ? 'Registrar retiro' : 'Registrar aporte'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal editar socio */}
      <Modal open={editando} onClose={() => setEditando(false)} title="Editar socio">
        <div className="space-y-4">
          <Input label="Nombre" value={formEdit.nombre || ''} onChange={(e) => setFormEdit((f) => ({ ...f, nombre: e.target.value }))} />
          <Input label="Cédula" value={formEdit.cedula || ''} onChange={(e) => setFormEdit((f) => ({ ...f, cedula: e.target.value }))} />
          <Input label="Teléfono" value={formEdit.telefono || ''} onChange={(e) => setFormEdit((f) => ({ ...f, telefono: e.target.value }))} />
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: 'var(--cf-ink-3)' }}>Notas</label>
            <textarea
              value={formEdit.notas || ''}
              onChange={(e) => setFormEdit((f) => ({ ...f, notas: e.target.value }))}
              rows={3}
              className="px-3 py-2 rounded-[12px] text-sm resize-none"
              style={{ background: 'var(--cf-surface)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink)' }}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEditando(false)} className="flex-1">Cancelar</Button>
            <Button onClick={guardarEdicion} loading={loadingEdit} className="flex-1">Guardar</Button>
          </div>
        </div>
      </Modal>

      {/* La caja «Acciones» que había aquí se fue al «⋯» de la cabecera. Ver la
          nota junto a `acciones`, arriba. Las dos funciones son las mismas:
          `toggleActivo` y `confirmEliminarSocio` no se han tocado. */}
      <HojaInferior
        abierta={menuAbierto}
        onCerrar={() => setMenuAbierto(false)}
        titulo={socio.nombre}
        subtitulo="¿Qué quieres hacer con este socio?"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0 8px' }}>
          <button
            type="button"
            onClick={() => { setMenuAbierto(false); toggleActivo() }}
            style={{
              display: 'flex', alignItems: 'center', width: '100%',
              height: 52, padding: '0 16px', borderRadius: 14, border: 0, cursor: 'pointer',
              fontSize: 15, fontWeight: 600, textAlign: 'left',
              background: socio.activo
                ? 'color-mix(in srgb, var(--cf-gold-dark) 10%, transparent)'
                : 'color-mix(in srgb, var(--cf-green-dark) 10%, transparent)',
              color: socio.activo ? 'var(--cf-gold-dark)' : 'var(--cf-green-dark)',
            }}
          >
            {socio.activo ? 'Desactivar socio' : 'Reactivar socio'}
          </button>
          {/* Eliminar va SEPARADA y en rojo: es la única de las dos que no se
              puede deshacer. Sigue pasando por su confirmación. */}
          <button
            type="button"
            onClick={() => { setMenuAbierto(false); setConfirmEliminarSocio(true) }}
            style={{
              display: 'flex', alignItems: 'center', width: '100%',
              height: 52, padding: '0 16px', borderRadius: 14, border: 0, cursor: 'pointer',
              fontSize: 15, fontWeight: 600, textAlign: 'left',
              background: 'color-mix(in srgb, var(--cf-red-dark) 10%, transparent)',
              color: 'var(--cf-red-dark)',
            }}
          >
            Eliminar socio
          </button>
        </div>
      </HojaInferior>

      {/* Confirmar eliminar aporte */}
      <ConfirmModal
        open={!!confirmEliminar}
        onClose={() => setConfirmEliminar(null)}
        title="Eliminar aporte"
        message="Esta accion no se puede deshacer."
        confirmLabel="Eliminar"
        color="danger"
        onConfirm={() => eliminarAporte(confirmEliminar)}
      />

      {/* Confirmar eliminar socio */}
      <ConfirmModal
        open={confirmEliminarSocio}
        onClose={() => setConfirmEliminarSocio(false)}
        title="Eliminar socio"
        message={`Se eliminara a ${socio.nombre} y todos sus aportes. Los prestamos asociados quedaran sin socio. Esta accion no se puede deshacer.`}
        confirmLabel="Eliminar"
        color="danger"
        loading={loadingEliminar}
        onConfirm={eliminarSocio}
      />
    </div>
  )
}
