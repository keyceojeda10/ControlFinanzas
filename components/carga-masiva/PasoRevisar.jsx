'use client'

import { useState, useMemo } from 'react'
import { useCountry } from '@/hooks/useCountry'
import { Badge } from '@/components/ui/Badge'

const ESTADO_COLORS = {
  valido: 'green',
  advertencia: 'yellow',
  error: 'red',
}
const ESTADO_LABELS = {
  valido: 'OK',
  advertencia: 'Aviso',
  error: 'Error',
}

export default function PasoRevisar({ filas, resumen, rutas, onConfirmar, onVolver }) {
  const { formatMoney } = useCountry()
  const [rutaId, setRutaId] = useState('')
  const [nuevaRuta, setNuevaRuta] = useState('')
  const [crearNueva, setCrearNueva] = useState(false)
  const [expandido, setExpandido] = useState(null)
  const [soloErrores, setSoloErrores] = useState(false)

  const clientesAgrupados = useMemo(() => {
    const mapa = new Map()
    for (const fila of filas) {
      const key = fila.datos.cedula || fila.datos.nombre || `fila-${fila.indice}`
      if (!mapa.has(key)) {
        mapa.set(key, {
          nombre: fila.datos.nombre,
          cedula: fila.datos.cedula,
          telefono: fila.datos.telefono,
          direccion: fila.datos.direccion,
          prestamos: [],
          errores: [],
          advertencias: [],
          peorEstado: 'valido',
        })
      }
      const grupo = mapa.get(key)
      if (fila.datos.nombre && !grupo.nombre) grupo.nombre = fila.datos.nombre
      if (fila.datos.telefono && !grupo.telefono) grupo.telefono = fila.datos.telefono
      if (fila.datos.direccion && !grupo.direccion) grupo.direccion = fila.datos.direccion

      if (fila.datos.tienePrestamo) {
        grupo.prestamos.push({
          monto: fila.datos.montoPrestado,
          tasa: fila.datos.tasaInteres,
          cuotas: fila.datos.diasPlazo,
          frecuencia: fila.datos.frecuencia,
          fecha: fila.datos.fechaInicio,
          abonado: fila.datos.abonadoHasta,
          calculado: fila.calculado,
          tipo: fila.datos.tipo,
        })
      }
      grupo.errores.push(...fila.errores)
      grupo.advertencias.push(...fila.advertencias)
      if (fila.estado === 'error') grupo.peorEstado = 'error'
      else if (fila.estado === 'advertencia' && grupo.peorEstado !== 'error') grupo.peorEstado = 'advertencia'
    }
    return [...mapa.entries()].map(([key, g]) => ({ key, ...g }))
  }, [filas])

  const clientesVisibles = soloErrores
    ? clientesAgrupados.filter(c => c.peorEstado === 'error')
    : clientesAgrupados

  const conPrestamos = clientesAgrupados.filter(c => c.prestamos.length > 0).length
  const sinPrestamos = clientesAgrupados.filter(c => c.prestamos.length === 0).length

  const handleConfirmar = () => {
    const validas = filas.filter(f => f.estado !== 'error')
    if (validas.length === 0) return
    onConfirmar({
      filas: validas,
      rutaId: crearNueva ? null : (rutaId || null),
      crearRuta: crearNueva ? nuevaRuta.trim() : null,
    })
  }

  return (
    <div className="space-y-4">
      {/* Resumen principal — grande y notorio */}
      <div className="bg-[var(--cf-card)] border border-[var(--cf-border)] rounded-[16px] p-5">
        <div className="flex items-center justify-center gap-6 mb-4">
          <div className="text-center">
            <p className="text-[32px] font-bold text-[var(--cf-ink)] leading-none">{resumen.clientesUnicos}</p>
            <p className="text-xs text-[var(--cf-ink-3)] mt-1">clientes</p>
          </div>
          <div className="w-px h-10 bg-[var(--cf-border)]" />
          <div className="text-center">
            <p className="text-[32px] font-bold text-[var(--cf-gold)] leading-none">{resumen.totalPrestamos}</p>
            <p className="text-xs text-[var(--cf-ink-3)] mt-1">prestamos</p>
          </div>
          <div className="w-px h-10 bg-[var(--cf-border)]" />
          <div className="text-center">
            <p className="text-[32px] font-bold text-[var(--cf-ink)] leading-none font-mono-display">{formatMoney(resumen.montoTotalDesembolso)}</p>
            <p className="text-xs text-[var(--cf-ink-3)] mt-1">capital total</p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-[var(--cf-ink-3)]">
          <span>{conPrestamos} con prestamos</span>
          {sinPrestamos > 0 && <span>{sinPrestamos} solo datos</span>}
          {resumen.clientesNuevos > 0 && (
            <span className="text-[var(--cf-green-dark)]">{resumen.clientesNuevos} nuevos</span>
          )}
          {resumen.clientesExistentes > 0 && (
            <span>{resumen.clientesExistentes} ya existen</span>
          )}
          {resumen.filasConError > 0 && (
            <span className="text-[var(--cf-red-dark)]">{resumen.filasConError} con errores</span>
          )}
        </div>
      </div>

      {resumen.excedePlan && (
        <div className="bg-[var(--cf-red-pill-bg)] border border-[color-mix(in_srgb,var(--cf-red-dark)_30%,transparent)] text-[var(--cf-red-dark)] text-xs rounded-[12px] px-4 py-3">
          Excedes el limite de tu plan ({resumen.limiteClientes} clientes).
          Tienes {resumen.clientesActuales}, necesitas {resumen.clientesNuevos} nuevos.
          Espacio disponible: {resumen.espacioDisponible}.
        </div>
      )}

      {/* Asignar ruta */}
      <div className="bg-[var(--cf-card)] border border-[var(--cf-border)] rounded-[12px] p-4 space-y-3">
        <p className="text-[10px] font-semibold text-[var(--cf-ink-3)] uppercase tracking-wide">Asignar a ruta (opcional)</p>
        <div className="flex flex-col gap-2">
          <select
            value={crearNueva ? '__nueva__' : rutaId}
            onChange={(e) => {
              if (e.target.value === '__nueva__') {
                setCrearNueva(true)
                setRutaId('')
              } else {
                setCrearNueva(false)
                setRutaId(e.target.value)
              }
            }}
            className="w-full h-10 px-3 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-surface)] text-sm text-[var(--cf-ink)] focus:outline-none focus:border-[var(--cf-gold)]"
          >
            <option value="">Sin ruta</option>
            {rutas.map(r => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
            <option value="__nueva__">+ Crear ruta nueva</option>
          </select>
          {crearNueva && (
            <input
              value={nuevaRuta}
              onChange={(e) => setNuevaRuta(e.target.value)}
              placeholder="Nombre de la nueva ruta"
              className="w-full h-10 px-3 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-surface)] text-sm text-[var(--cf-ink)] placeholder-[#555555] focus:outline-none focus:border-[var(--cf-gold)]"
            />
          )}
        </div>
      </div>

      {/* Filtro errores */}
      {resumen.filasConError > 0 && (
        <button
          onClick={() => setSoloErrores(v => !v)}
          className="text-xs text-[var(--cf-ink-3)] hover:text-[var(--cf-red-dark)] transition-colors"
        >
          {soloErrores ? 'Mostrar todos los clientes' : `Mostrar solo ${resumen.filasConError} con errores`}
        </button>
      )}

      {/* Lista de clientes agrupados */}
      <div className="space-y-2 max-h-[55vh] overflow-y-auto">
        {clientesVisibles.map((cliente) => {
          const isExpanded = expandido === cliente.key
          return (
            <div
              key={cliente.key}
              className="bg-[var(--cf-card)] border border-[var(--cf-border)] rounded-[12px] overflow-hidden"
            >
              {/* Cabecera del cliente */}
              <div
                className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-[var(--cf-fill)] transition-colors"
                onClick={() => setExpandido(isExpanded ? null : cliente.key)}
              >
                <div className="w-8 h-8 rounded-full bg-[rgba(245,197,24,0.12)] flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-[var(--cf-gold)]">
                    {(cliente.nombre || '?').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--cf-ink)] truncate">
                      {cliente.nombre || '—'}
                    </p>
                    {cliente.cedula && (
                      <span className="text-[10px] text-[var(--cf-ink-3)] shrink-0">{cliente.cedula}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {cliente.prestamos.length > 0 ? (
                      <span className="text-[10px] text-[var(--cf-ink-3)]">
                        {cliente.prestamos.length} prestamo{cliente.prestamos.length !== 1 ? 's' : ''}
                        {' • '}
                        {formatMoney(cliente.prestamos.reduce((s, p) => s + p.monto, 0))}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[var(--cf-ink-3)]">Solo datos del cliente</span>
                    )}
                  </div>
                </div>
                <Badge variant={ESTADO_COLORS[cliente.peorEstado]}>{ESTADO_LABELS[cliente.peorEstado]}</Badge>
                <svg
                  className={['w-4 h-4 text-[var(--cf-ink-3)] transition-transform shrink-0', isExpanded ? 'rotate-180' : ''].join(' ')}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Detalle expandido */}
              {isExpanded && (
                <div className="border-t border-[var(--cf-border)] px-3 py-3 space-y-3">
                  {/* Info del cliente */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--cf-ink-3)]">
                    {cliente.telefono && <span>Tel: {cliente.telefono}</span>}
                    {cliente.direccion && <span>Dir: {cliente.direccion}</span>}
                  </div>

                  {/* Errores y advertencias */}
                  {cliente.errores.length > 0 && (
                    <div className="space-y-1">
                      {cliente.errores.map((e, i) => (
                        <p key={i} className="text-[10px] text-[var(--cf-red-dark)] flex items-start gap-1">
                          <svg className="w-3 h-3 shrink-0 mt-px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          {e}
                        </p>
                      ))}
                    </div>
                  )}
                  {cliente.advertencias.length > 0 && (
                    <div className="space-y-1">
                      {cliente.advertencias.map((a, i) => (
                        <p key={i} className="text-[10px] text-[var(--cf-gold-dark)] flex items-start gap-1">
                          <svg className="w-3 h-3 shrink-0 mt-px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                          </svg>
                          {a}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Tabla de prestamos del cliente */}
                  {cliente.prestamos.length > 0 && (
                    <div className="overflow-x-auto rounded-[8px] border border-[var(--cf-border)]">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="bg-[var(--cf-surface)]">
                            <th className="px-2 py-1.5 text-left text-[var(--cf-ink-3)] font-semibold">Capital</th>
                            <th className="px-2 py-1.5 text-left text-[var(--cf-ink-3)] font-semibold">Interes</th>
                            <th className="px-2 py-1.5 text-left text-[var(--cf-ink-3)] font-semibold">Cuotas</th>
                            <th className="px-2 py-1.5 text-left text-[var(--cf-ink-3)] font-semibold">Freq</th>
                            <th className="px-2 py-1.5 text-left text-[var(--cf-ink-3)] font-semibold">Total</th>
                            {cliente.prestamos.some(p => p.abonado > 0) && (
                              <th className="px-2 py-1.5 text-left text-[var(--cf-ink-3)] font-semibold">Abonado</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {cliente.prestamos.map((p, i) => (
                            <tr key={i} className="border-t border-[var(--cf-border)]">
                              <td className="px-2 py-1.5 text-[var(--cf-ink)] font-mono-display whitespace-nowrap">
                                {formatMoney(p.monto)}
                              </td>
                              <td className="px-2 py-1.5 text-[var(--cf-ink-3)] whitespace-nowrap">{p.tasa}%</td>
                              <td className="px-2 py-1.5 text-[var(--cf-ink)] whitespace-nowrap">{p.cuotas}</td>
                              <td className="px-2 py-1.5 text-[var(--cf-ink-3)] whitespace-nowrap capitalize">{p.frecuencia}</td>
                              <td className="px-2 py-1.5 text-[var(--cf-gold)] font-mono-display font-semibold whitespace-nowrap">
                                {p.calculado ? formatMoney(p.calculado.totalAPagar) : '—'}
                              </td>
                              {cliente.prestamos.some(pp => pp.abonado > 0) && (
                                <td className="px-2 py-1.5 text-[var(--cf-green-dark)] font-mono-display whitespace-nowrap">
                                  {p.abonado > 0 ? formatMoney(p.abonado) : '—'}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Acciones */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onVolver}
          className="flex-1 h-11 rounded-[12px] bg-[var(--cf-card)] border border-[var(--cf-border)] text-[var(--cf-ink)] text-sm font-medium transition-colors hover:bg-[var(--cf-fill)]"
        >
          Volver
        </button>
        <button
          onClick={handleConfirmar}
          disabled={resumen.filasValidas === 0 || resumen.excedePlan}
          className="flex-1 h-11 rounded-[12px] bg-[var(--cf-gold)] hover:bg-[var(--cf-gold-dark)] text-[var(--cf-ink)] text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Importar {resumen.clientesUnicos} clientes
        </button>
      </div>
    </div>
  )
}
