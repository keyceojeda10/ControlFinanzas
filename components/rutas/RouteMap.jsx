'use client'
// components/rutas/RouteMap.jsx — Mini-mapa de la ruta con pins y línea de recorrido

import { useEffect, useRef } from 'react'

let L = null
if (typeof window !== 'undefined') {
  L = require('leaflet')
  require('leaflet/dist/leaflet.css')
}

// Pin numerado
function createNumberedIcon(number) {
  if (!L) return null
  return L.divIcon({
    className: '',
    html: `<div style="
      width:26px;height:26px;
      background:#f5c518;
      border:2px solid #0a0a0a;
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-size:11px;font-weight:800;color:#0a0a0a;
      box-shadow:0 2px 6px rgba(0,0,0,0.4);
    ">${number}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

export default function RouteMap({ clientes, cobrosGeoHoy = [] }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)

  const conCoords = (clientes ?? []).filter((c) => c.latitud != null && c.longitud != null)

  useEffect(() => {
    if (!L || !mapRef.current) return
    if (conCoords.length === 0 && (cobrosGeoHoy?.length ?? 0) === 0) return

    // Limpiar mapa anterior
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)

    L.control.zoom({ position: 'topright' }).addTo(map)

    const bounds = []

    // Agregar markers numerados
    conCoords.forEach((c, i) => {
      const marker = L.marker([c.latitud, c.longitud], { icon: createNumberedIcon(i + 1) })
      marker.bindPopup(`<b style="color:#0a0a0a">${i + 1}. ${c.nombre}</b>${c.direccion ? `<br><span style="color:#666;font-size:11px">${c.direccion}</span>` : ''}`)
      marker.addTo(map)
      bounds.push([c.latitud, c.longitud])
    })

    // Pines de cobros del dia (MVP geo). Verde <=50m, naranja 50-200m, rojo >200m.
    ;(cobrosGeoHoy ?? []).forEach((p) => {
      if (p.latitud == null || p.longitud == null) return
      const d = p.distanciaMetros
      const color = d == null || d <= 50 ? '#22c55e' : d <= 200 ? '#f97316' : '#ef4444'
      L.circleMarker([p.latitud, p.longitud], {
        radius: 7,
        fillColor: color,
        color: '#0a0a0a',
        weight: 2,
        fillOpacity: 0.9,
      })
        .bindPopup(
          d == null
            ? `<span style="color:#0a0a0a">Cobro registrado (cliente sin ubicacion)</span>`
            : `<span style="color:#0a0a0a">Cobrado a <b>${d < 1000 ? d + 'm' : (d / 1000).toFixed(1) + 'km'}</b> del cliente</span>`,
        )
        .addTo(map)
      bounds.push([p.latitud, p.longitud])
    })

    // Dibujar línea de recorrido
    if (conCoords.length >= 2) {
      L.polyline(
        conCoords.map((c) => [c.latitud, c.longitud]),
        {
          color: 'var(--color-accent)',
          weight: 3,
          opacity: 0.7,
          dashArray: '8, 6',
        }
      ).addTo(map)
    }

    // Ajustar vista a los bounds
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 })
    }

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [clientes, cobrosGeoHoy]) // eslint-disable-line react-hooks/exhaustive-deps

  if (conCoords.length === 0 && (cobrosGeoHoy?.length ?? 0) === 0) {
    return (
      <div className="h-[200px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] flex items-center justify-center">
        <p className="text-xs text-[var(--color-text-muted)]">Sin clientes con ubicación para mostrar</p>
      </div>
    )
  }

  return (
    <div>
      <div
        ref={mapRef}
        className="w-full h-[250px] rounded-xl overflow-hidden border border-[var(--color-border)]"
        style={{ background: '#111111' }}
      />
      <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
        {conCoords.length} clientes con ubicacion
        {cobrosGeoHoy?.length > 0 && (
          <> • <span style={{ color: '#22c55e' }}>● </span>{cobrosGeoHoy.length} cobro{cobrosGeoHoy.length === 1 ? '' : 's'} de hoy</>
        )}
        {' • '}La linea muestra el orden de visita
      </p>
    </div>
  )
}
