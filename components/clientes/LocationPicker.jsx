'use client'
// components/clientes/LocationPicker.jsx — Selector de ubicación con 3 modos

import { useState, useEffect, useRef, useCallback } from 'react'

// Leaflet se importa dinámicamente para evitar SSR issues
let L = null
if (typeof window !== 'undefined') {
  L = require('leaflet')
  require('leaflet/dist/leaflet.css')
}

// ─── Pin icon personalizado ──────────────────────────────
const createIcon = () => {
  if (!L) return null
  return L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;
      background:#f5c518;
      border:3px solid #0a0a0a;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
    "><div style="
      width:10px;height:10px;
      background:#0a0a0a;
      border-radius:50%;
      position:absolute;
      top:50%;left:50%;
      transform:translate(-50%,-50%) rotate(45deg);
    "></div></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  })
}

// ─── Componente de mapa ──────────────────────────────────
function MiniMap({ lat, lng, onLocationChange }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => {
    if (!L || !mapRef.current || mapInstanceRef.current) return

    const defaultLat = lat || 4.624
    const defaultLng = lng || -74.063

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([defaultLat, defaultLng], lat ? 16 : 6)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)

    L.control.zoom({ position: 'topright' }).addTo(map)

    if (lat && lng) {
      const marker = L.marker([lat, lng], { draggable: true, icon: createIcon() }).addTo(map)
      marker.on('dragend', () => {
        const pos = marker.getLatLng()
        onLocationChange(pos.lat, pos.lng)
      })
      markerRef.current = marker
    }

    map.on('click', (e) => {
      const { lat: newLat, lng: newLng } = e.latlng
      if (markerRef.current) {
        markerRef.current.setLatLng([newLat, newLng])
      } else {
        const marker = L.marker([newLat, newLng], { draggable: true, icon: createIcon() }).addTo(map)
        marker.on('dragend', () => {
          const pos = marker.getLatLng()
          onLocationChange(pos.lat, pos.lng)
        })
        markerRef.current = marker
      }
      onLocationChange(newLat, newLng)
    })

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Actualizar marcador cuando cambian las coords desde fuera
  useEffect(() => {
    if (!mapInstanceRef.current || !L) return
    if (lat && lng) {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      } else {
        const marker = L.marker([lat, lng], { draggable: true, icon: createIcon() }).addTo(mapInstanceRef.current)
        marker.on('dragend', () => {
          const pos = marker.getLatLng()
          onLocationChange(pos.lat, pos.lng)
        })
        markerRef.current = marker
      }
      mapInstanceRef.current.setView([lat, lng], 16)
    } else if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }
  }, [lat, lng]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={mapRef}
      className="w-full h-[200px] rounded-xl overflow-hidden border border-[#2a2a2a]"
      style={{ background: '#111111' }}
    />
  )
}

// ─── LocationPicker principal ────────────────────────────
export default function LocationPicker({ latitud, longitud, onLocationChange }) {
  const [showMap, setShowMap] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState('')

  const hasLocation = latitud != null && longitud != null

  const handleGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Tu navegador no soporta geolocalización')
      return
    }
    setGpsLoading(true)
    setGpsError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onLocationChange(pos.coords.latitude, pos.coords.longitude)
        setGpsLoading(false)
        setShowMap(true)
      },
      (err) => {
        setGpsLoading(false)
        if (err.code === 1) setGpsError('Permiso de ubicación denegado')
        else if (err.code === 2) setGpsError('Ubicación no disponible')
        else setGpsError('No se pudo obtener la ubicación')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [onLocationChange])

  const handleClear = () => {
    onLocationChange(null, null)
    setShowMap(false)
  }

  return (
    <div className="space-y-2">
      {/* Botones de acción */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleGPS}
          disabled={gpsLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[rgba(245,197,24,0.1)] border border-[rgba(245,197,24,0.2)] text-[#f5c518] text-xs font-medium hover:bg-[rgba(245,197,24,0.15)] transition-all disabled:opacity-50 active:scale-95"
        >
          {gpsLoading ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Obteniendo...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Mi ubicación
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setShowMap((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#1a1a1a] border border-[#2a2a2a] text-[#888888] text-xs font-medium hover:text-white hover:border-[#3a3a3a] transition-all active:scale-95"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          {showMap ? 'Ocultar mapa' : 'Seleccionar en mapa'}
        </button>

        {hasLocation && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[10px] text-[#888888] text-xs hover:text-[#ef4444] transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Quitar
          </button>
        )}
      </div>

      {/* Indicador de ubicación capturada */}
      {hasLocation && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-[10px] bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.15)]">
          <svg className="w-3.5 h-3.5 text-[#22c55e] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
          <span className="text-[11px] text-[#22c55e] font-medium">
            Ubicación capturada — {latitud.toFixed(5)}, {longitud.toFixed(5)}
          </span>
        </div>
      )}

      {/* Error GPS */}
      {gpsError && (
        <p className="text-[11px] text-[#ef4444]">{gpsError}</p>
      )}

      {/* Mapa */}
      {showMap && (
        <div className="relative">
          <MiniMap lat={latitud} lng={longitud} onLocationChange={onLocationChange} />
          <p className="text-[10px] text-[#555555] mt-1">Toca el mapa para poner el pin o arrástralo para ajustar</p>
        </div>
      )}
    </div>
  )
}
