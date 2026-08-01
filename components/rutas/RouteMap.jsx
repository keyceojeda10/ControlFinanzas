'use client'

import { useEffect, useRef } from 'react'

let L = null
if (typeof window !== 'undefined') {
  L = require('leaflet')
  require('leaflet/dist/leaflet.css')
}

function createNumberedIcon(number) {
  if (!L) return null
  return L.divIcon({
    className: '',
    html: `<div style="
      width:26px;height:26px;
      background:var(--cf-gold);
      border:2px solid var(--cf-ink);
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-size:11px;font-weight:800;color:#3a2900;
      box-shadow:0 2px 6px rgba(0,0,0,0.4);
    ">${number}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

function createCobradorIcon(nombre, estaActivo, esReciente) {
  if (!L) return null
  const bgColor = estaActivo || esReciente ? 'var(--cf-gold)' : 'var(--cf-ink-3)'
  const borderColor = estaActivo || esReciente ? 'var(--cf-ink)' : 'var(--cf-ink-2)'
  const pulseRing = estaActivo
    ? `<div style="
        position:absolute;inset:-6px;
        border:2px solid ${bgColor};
        border-radius:50%;
        animation:cf-pulse 2s ease-out infinite;
        pointer-events:none;
      "></div>`
    : ''

  return L.divIcon({
    className: '',
    html: `<div style="
      position:relative;
      width:38px;height:38px;
    ">
      ${pulseRing}
      <div style="
        position:absolute;inset:0;
        width:38px;height:38px;
        background:${bgColor};
        border:3px solid ${borderColor};
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        font-size:15px;font-weight:900;color:#3a2900;
        box-shadow:0 3px 10px rgba(0,0,0,0.5);
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3a2900" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0z"/>
        </svg>
      </div>
    </div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  })
}

function tiempoDesde(fecha) {
  if (!fecha) return null
  const mins = Math.round((Date.now() - new Date(fecha).getTime()) / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `Hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  return `Hace ${hrs}h ${mins % 60}m`
}

export default function RouteMap({ clientes, cobrosGeoHoy = [], cobrador, trail = [] }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const cobradorMarkerRef = useRef(null)
  const trailLayerRef = useRef(null)

  const conCoords = (clientes ?? []).filter((c) => c.latitud != null && c.longitud != null)
  const cobradorConCoords = cobrador?.latitud != null && cobrador?.longitud != null

  useEffect(() => {
    if (!L || !mapRef.current) return
    if (conCoords.length === 0 && (cobrosGeoHoy?.length ?? 0) === 0 && !cobradorConCoords) return

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
      cobradorMarkerRef.current = null
      trailLayerRef.current = null
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

    conCoords.forEach((c, i) => {
      const marker = L.marker([c.latitud, c.longitud], { icon: createNumberedIcon(i + 1) })
      marker.bindPopup(`<b style="color:var(--cf-ink)">${i + 1}. ${c.nombre}</b>${c.direccion ? `<br><span style="color:var(--cf-ink-2);font-size:11px">${c.direccion}</span>` : ''}`)
      marker.addTo(map)
      bounds.push([c.latitud, c.longitud])
    })

    ;(cobrosGeoHoy ?? []).forEach((p) => {
      if (p.latitud == null || p.longitud == null) return
      const d = p.distanciaMetros
      const color = d == null || d <= 50 ? 'var(--cf-green-dark)' : d <= 200 ? 'var(--cf-gold-dark)' : 'var(--cf-red-dark)'
      L.circleMarker([p.latitud, p.longitud], {
        radius: 7,
        fillColor: color,
        color: 'var(--cf-ink)',
        weight: 2,
        fillOpacity: 0.9,
      })
        .bindPopup(
          d == null
            ? `<span style="color:var(--cf-ink)">Cobro registrado (cliente sin ubicacion)</span>`
            : `<span style="color:var(--cf-ink)">Cobrado a <b>${d < 1000 ? d + 'm' : (d / 1000).toFixed(1) + 'km'}</b> del cliente</span>`,
        )
        .addTo(map)
      bounds.push([p.latitud, p.longitud])
    })

    if (cobradorConCoords) {
      const minsDesde = cobrador.ubicacionUpdatedAt
        ? (Date.now() - new Date(cobrador.ubicacionUpdatedAt).getTime()) / 60000
        : Infinity
      const activo = minsDesde < 5
      const reciente = minsDesde >= 5 && minsDesde < 10

      const marker = L.marker([cobrador.latitud, cobrador.longitud], {
        icon: createCobradorIcon(cobrador.nombre, activo, reciente),
        zIndexOffset: 1000,
      })

      const estadoLabel = activo ? 'En linea' : reciente ? 'Reciente' : 'Desconectado'
      const estadoColor = activo ? 'var(--cf-green-dark)' : reciente ? 'var(--cf-gold)' : 'var(--cf-ink-3)'
      marker.bindPopup(`
        <div style="min-width:120px">
          <b style="color:var(--cf-ink);font-size:13px">${cobrador.nombre}</b>
          <br><span style="color:${estadoColor};font-size:11px;font-weight:600">${estadoLabel}</span>
          ${cobrador.ubicacionUpdatedAt ? `<br><span style="color:var(--cf-ink-3);font-size:10px">${tiempoDesde(cobrador.ubicacionUpdatedAt)}</span>` : ''}
        </div>
      `)
      marker.addTo(map)
      cobradorMarkerRef.current = marker
      bounds.push([cobrador.latitud, cobrador.longitud])
    }

    if (trail.length >= 2) {
      const trailLine = L.polyline(
        trail.map((p) => [p.latitud, p.longitud]),
        { color: 'var(--cf-gold)', weight: 3, opacity: 0.6, lineJoin: 'round', lineCap: 'round' }
      )
      trailLine.addTo(map)
      trailLayerRef.current = trailLine

      if (trail.length >= 1) {
        const start = trail[0]
        L.circleMarker([start.latitud, start.longitud], {
          radius: 5, fillColor: 'var(--cf-green-dark)', color: 'var(--cf-ink)', weight: 2, fillOpacity: 0.9,
        }).bindPopup(`<span style="color:var(--cf-ink);font-size:11px">Inicio del recorrido</span>`).addTo(map)
      }
    }

    if (conCoords.length >= 2) {
      L.polyline(
        conCoords.map((c) => [c.latitud, c.longitud]),
        { color: 'var(--cf-ink-2)', weight: 2, opacity: 0.4, dashArray: '6, 8' }
      ).addTo(map)
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 })
    }

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
      cobradorMarkerRef.current = null
      trailLayerRef.current = null
    }
  }, [clientes, cobrosGeoHoy]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapInstanceRef.current) return

    if (trailLayerRef.current) {
      mapInstanceRef.current.removeLayer(trailLayerRef.current)
      trailLayerRef.current = null
    }
    if (trail.length >= 2) {
      const trailLine = L.polyline(
        trail.map((p) => [p.latitud, p.longitud]),
        { color: 'var(--cf-gold)', weight: 3, opacity: 0.6, lineJoin: 'round', lineCap: 'round' }
      )
      trailLine.addTo(mapInstanceRef.current)
      trailLayerRef.current = trailLine
    }
  }, [trail])

  useEffect(() => {
    if (!cobradorMarkerRef.current || !cobrador?.latitud || !cobrador?.longitud) return
    cobradorMarkerRef.current.setLatLng([cobrador.latitud, cobrador.longitud])

    const minsDesde = cobrador.ubicacionUpdatedAt
      ? (Date.now() - new Date(cobrador.ubicacionUpdatedAt).getTime()) / 60000
      : Infinity
    const activo = minsDesde < 5
    const reciente = minsDesde >= 5 && minsDesde < 10
    cobradorMarkerRef.current.setIcon(createCobradorIcon(cobrador.nombre, activo, reciente))

    const estadoLabel = activo ? 'En linea' : reciente ? 'Reciente' : 'Desconectado'
    const estadoColor = activo ? 'var(--cf-green-dark)' : reciente ? 'var(--cf-gold)' : 'var(--cf-ink-3)'
    cobradorMarkerRef.current.setPopupContent(`
      <div style="min-width:120px">
        <b style="color:var(--cf-ink);font-size:13px">${cobrador.nombre}</b>
        <br><span style="color:${estadoColor};font-size:11px;font-weight:600">${estadoLabel}</span>
        ${cobrador.ubicacionUpdatedAt ? `<br><span style="color:var(--cf-ink-3);font-size:10px">${tiempoDesde(cobrador.ubicacionUpdatedAt)}</span>` : ''}
      </div>
    `)
  }, [cobrador?.latitud, cobrador?.longitud, cobrador?.ubicacionUpdatedAt])

  if (conCoords.length === 0 && (cobrosGeoHoy?.length ?? 0) === 0 && !cobradorConCoords) {
    return (
      <div className="h-[200px] rounded-xl border border-[var(--cf-border)] bg-[var(--cf-card)] flex items-center justify-center">
        <p className="text-xs text-[var(--cf-ink-3)]">Sin clientes con ubicacion para mostrar</p>
      </div>
    )
  }

  return (
    <div>
      <div
        ref={mapRef}
        className="w-full h-[300px] rounded-xl overflow-hidden border border-[var(--cf-border)]"
        style={{ background: 'var(--cf-ink)' }}
      />
      <p className="text-[10px] text-[var(--cf-ink-3)] mt-1">
        {conCoords.length} clientes con ubicacion
        {cobrosGeoHoy?.length > 0 && (
          <> · <span style={{ color: 'var(--cf-green-dark)' }}>●</span> {cobrosGeoHoy.length} cobro{cobrosGeoHoy.length === 1 ? '' : 's'} de hoy</>
        )}
        {cobradorConCoords && (
          <> · <span style={{ color: 'var(--cf-gold)' }}>●</span> Cobrador en vivo</>
        )}
        {trail.length >= 2 && (
          <> · <span style={{ color: 'var(--cf-gold)' }}>―</span> Recorrido del dia</>
        )}
      </p>

      <style jsx global>{`
        @keyframes cf-pulse {
          0% { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
