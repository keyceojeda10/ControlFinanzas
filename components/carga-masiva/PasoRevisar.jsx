'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { formatCOP } from '@/lib/calculos'

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
  const [rutaId, setRutaId] = useState('')
  const [nuevaRuta, setNuevaRuta] = useState('')
  const [crearNueva, setCrearNueva] = useState(false)
  const [expandida, setExpandida] = useState(null)
  const [soloErrores, setSoloErrores] = useState(false)

  const filasVisibles = soloErrores
    ? filas.filter(f => f.estado === 'error')
    : filas

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
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-[12px] px-3 py-2.5 text-center">
          <p className="text-[10px] text-[#888888]">Filas</p>
          <p className="text-lg font-bold text-white">{resumen.totalFilas}</p>
        </div>
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-[12px] px-3 py-2.5 text-center">
          <p className="text-[10px] text-[#888888]">Validas</p>
          <p className="text-lg font-bold text-[#22c55e]">{resumen.filasValidas}</p>
        </div>
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-[12px] px-3 py-2.5 text-center">
          <p className="text-[10px] text-[#888888]">Errores</p>
          <p className="text-lg font-bold text-[#ef4444]">{resumen.filasConError}</p>
        </div>
      </div>

      {/* Detalle */}
      <div className="bg-[#161b27] border border-[#2a2a2a] rounded-[14px] p-4 space-y-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-[#888888]">Clientes unicos</span>
            <span className="text-white font-medium">{resumen.clientesUnicos}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#888888]">Clientes nuevos</span>
            <span className="text-white font-medium">{resumen.clientesNuevos}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#888888]">Prestamos</span>
            <span className="text-white font-medium">{resumen.prestamosDinero}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#888888]">Mercancias</span>
            <span className="text-white font-medium">{resumen.prestamosMercancia}</span>
          </div>
          <div className="flex justify-between col-span-2">
            <span className="text-[#888888]">Monto total</span>
            <span className="text-[#f5c518] font-bold font-mono-display">{formatCOP(resumen.montoTotalDesembolso)}</span>
          </div>
        </div>

        {resumen.excedePlan && (
          <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-xs rounded-[10px] px-3 py-2 mt-2">
            Excedes el limite de tu plan ({resumen.limiteClientes} clientes).
            Tienes {resumen.clientesActuales}, necesitas {resumen.clientesNuevos} nuevos.
            Espacio disponible: {resumen.espacioDisponible}.
          </div>
        )}
      </div>

      {/* Asignar ruta */}
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-[14px] p-4 space-y-3">
        <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide">Asignar a ruta (opcional)</p>
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
            className="w-full h-10 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#0a0a0a] text-sm text-white focus:outline-none focus:border-[#f5c518]"
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
              className="w-full h-10 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#0a0a0a] text-sm text-white placeholder-[#555555] focus:outline-none focus:border-[#f5c518]"
            />
          )}
        </div>
      </div>

      {/* Filtro errores */}
      {resumen.filasConError > 0 && (
        <button
          onClick={() => setSoloErrores(v => !v)}
          className="text-xs text-[#888888] hover:text-[#ef4444] transition-colors"
        >
          {soloErrores ? 'Mostrar todas las filas' : `Mostrar solo ${resumen.filasConError} con errores`}
        </button>
      )}

      {/* Lista de filas (cards mobile-first) */}
      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
        {filasVisibles.map((fila) => (
          <div
            key={fila.indice}
            className="bg-[#111111] border border-[#2a2a2a] rounded-[12px] px-3 py-2.5 cursor-pointer hover:border-[#3a3a3a] transition-colors"
            onClick={() => setExpandida(expandida === fila.indice ? null : fila.indice)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] text-[#555555] w-5 shrink-0">#{fila.indice + 1}</span>
                <p className="text-sm text-white truncate">{fila.datos.nombre || '—'}</p>
                <span className="text-[10px] text-[#666666] shrink-0">{fila.datos.cedula}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {fila.datos.tienePrestamo && (
                  <span className="text-[10px] text-[#888888]">
                    {fila.datos.tipo === 'mercancia' ? 'Merc.' : 'Prest.'}
                  </span>
                )}
                <Badge variant={ESTADO_COLORS[fila.estado]}>{ESTADO_LABELS[fila.estado]}</Badge>
              </div>
            </div>

            {expandida === fila.indice && (
              <div className="mt-2 pt-2 border-t border-[#2a2a2a] space-y-1.5">
                {fila.errores.map((e, i) => (
                  <p key={i} className="text-[10px] text-[#ef4444] flex items-start gap-1">
                    <span className="shrink-0">x</span> {e}
                  </p>
                ))}
                {fila.advertencias.map((a, i) => (
                  <p key={i} className="text-[10px] text-[#f59e0b] flex items-start gap-1">
                    <span className="shrink-0">!</span> {a}
                  </p>
                ))}
                {fila.datos.tienePrestamo && fila.calculado && (
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <div>
                      <p className="text-[8px] text-[#666666]">Monto</p>
                      <p className="text-[10px] text-white font-mono-display">{formatCOP(fila.datos.montoPrestado)}</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-[#666666]">Cuota</p>
                      <p className="text-[10px] text-white font-mono-display">{formatCOP(fila.calculado.cuotaDiaria)}</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-[#666666]">Total</p>
                      <p className="text-[10px] text-[#f5c518] font-mono-display">{formatCOP(fila.calculado.totalAPagar)}</p>
                    </div>
                  </div>
                )}
                {fila.datos.telefono && (
                  <p className="text-[10px] text-[#666666]">Tel: {fila.datos.telefono}</p>
                )}
                {fila.datos.direccion && (
                  <p className="text-[10px] text-[#666666]">Dir: {fila.datos.direccion}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Acciones */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onVolver}
          className="flex-1 h-11 rounded-[12px] bg-[#1f1f1f] border border-[#2a2a2a] text-white text-sm font-medium transition-colors hover:bg-[#2a2a2a]"
        >
          Volver
        </button>
        <button
          onClick={handleConfirmar}
          disabled={resumen.filasValidas === 0 || resumen.excedePlan}
          className="flex-1 h-11 rounded-[12px] bg-[#f5c518] hover:bg-[#f0b800] text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Importar {resumen.filasValidas} filas
        </button>
      </div>
    </div>
  )
}
