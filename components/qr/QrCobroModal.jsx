'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useCountry } from '@/hooks/useCountry'
import RegistrarPago from '@/components/prestamos/RegistrarPago'

export default function QrCobroModal({ open, onClose, clienteId }) {
  const { formatMoney } = useCountry()
  const [cliente, setCliente] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pagoOpen, setPagoOpen] = useState(false)
  const [prestamoSel, setPrestamoSel] = useState(null)

  useEffect(() => {
    if (!open || !clienteId) {
      setCliente(null)
      setError(null)
      setPrestamoSel(null)
      setPagoOpen(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/clientes/${clienteId}`)
      .then(r => {
        if (!r.ok) throw new Error('Cliente no encontrado')
        return r.json()
      })
      .then(data => {
        if (!cancelled) {
          setCliente(data)
          setLoading(false)
          const activos = data.prestamos?.filter(p => p.estado === 'activo') ?? []
          if (activos.length === 1) {
            setPrestamoSel(activos[0])
            setPagoOpen(true)
          }
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [open, clienteId])

  if (!open) return null

  const activos = cliente?.prestamos?.filter(p => p.estado === 'activo') ?? []

  const handleCobrar = (prestamo) => {
    setPrestamoSel(prestamo)
    setPagoOpen(true)
  }

  const handlePagoSuccess = () => {
    setPagoOpen(false)
    setPrestamoSel(null)
    fetch(`/api/clientes/${clienteId}`)
      .then(r => r.json())
      .then(data => setCliente(data))
      .catch(() => {})
  }

  const handleClose = () => {
    setPagoOpen(false)
    setPrestamoSel(null)
    onClose()
  }

  if (loading) {
    return (
      <Modal open={open} onClose={handleClose} title="Cargando..." size="sm">
        <div className="flex flex-col items-center gap-4 py-8">
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }}
          />
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Buscando cliente...
          </p>
        </div>
      </Modal>
    )
  }

  if (error) {
    return (
      <Modal open={open} onClose={handleClose} title="Error" size="sm">
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
            <svg className="w-7 h-7" style={{ color: '#ef4444' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
        </div>
      </Modal>
    )
  }

  if (!cliente) return null

  return (
    <>
      <Modal open={open && !pagoOpen} onClose={handleClose} title={cliente.nombre} size="md">
        <div className="flex flex-col gap-4">
          {/* Ficha del cliente */}
          <div
            className="rounded-xl p-3 flex flex-col gap-1.5"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            {cliente.cedula && (
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
                </svg>
                <span style={{ color: 'var(--color-text-secondary)' }}>{cliente.cedula}</span>
              </div>
            )}
            {cliente.telefono && (
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                <a href={`tel:${cliente.telefono}`} style={{ color: 'var(--color-text-secondary)' }}>{cliente.telefono}</a>
              </div>
            )}
            {cliente.direccion && (
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z" />
                </svg>
                <span style={{ color: 'var(--color-text-secondary)' }}>{cliente.direccion}</span>
              </div>
            )}
            {cliente.ruta?.nombre && (
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m0 0l3-3m-3 3l-3-3m9-1.5V15m0 0l3-3m-3 3l-3-3" />
                </svg>
                <span style={{ color: 'var(--color-text-secondary)' }}>Ruta: {cliente.ruta.nombre}</span>
              </div>
            )}
          </div>

          {/* Prestamos activos */}
          {activos.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Este cliente no tiene prestamos activos
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
                {activos.length === 1 ? '1 prestamo activo' : `${activos.length} prestamos activos`}
              </p>
              {activos.map(p => {
                const saldo = p.saldoPendiente ?? (p.totalAPagar - (p.totalPagado || 0))
                const cuota = p.cuotaDiaria || 0
                const mora = p.diasMora || 0
                const pct = p.porcentajePagado ?? (p.totalAPagar ? Math.round(((p.totalPagado || 0) / p.totalAPagar) * 100) : 0)

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleCobrar(p)}
                    className="w-full rounded-xl p-3 text-left transition-all active:scale-[0.98]"
                    style={{
                      background: mora > 0 ? 'rgba(239,68,68,0.06)' : 'var(--color-surface)',
                      border: `1px solid ${mora > 0 ? 'rgba(239,68,68,0.2)' : 'var(--color-border)'}`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                          {formatMoney(cuota)}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>/ cuota</span>
                      </div>
                      {mora > 0 && (
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                        >
                          {mora}d mora
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      <span>Saldo: {formatMoney(saldo)}</span>
                      <span>Prestado: {formatMoney(p.montoPrestado)}</span>
                    </div>

                    {/* Barra de progreso */}
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          background: mora > 0 ? '#ef4444' : 'var(--color-accent)',
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{pct}% pagado</span>
                      <span
                        className="text-xs font-medium flex items-center gap-1"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        Cobrar
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </Modal>

      {prestamoSel && (
        <RegistrarPago
          prestamoId={prestamoSel.id}
          cuotaDiaria={prestamoSel.cuotaDiaria}
          saldoPendiente={prestamoSel.saldoPendiente ?? (prestamoSel.totalAPagar - (prestamoSel.totalPagado || 0))}
          open={pagoOpen}
          onClose={() => {
            setPagoOpen(false)
            setPrestamoSel(null)
          }}
          onSuccess={handlePagoSuccess}
          cliente={{ nombre: cliente.nombre, telefono: cliente.telefono }}
          prestamo={prestamoSel}
        />
      )}
    </>
  )
}
