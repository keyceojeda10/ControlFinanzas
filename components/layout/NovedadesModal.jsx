'use client'
// components/layout/NovedadesModal.jsx
// Muestra UNA vez por versión las novedades del sistema. Persiste la última
// versión vista en localStorage (cf:novedades:visto). Sin backend.
//
// ── T34-02 · LO QUE CAMBIA ─────────────────────────────────────────────────
//
// El panel era una lista de siete novedades con la misma jerarquía, y esa es
// justo la queja de la lámina: «siete novedades con la misma jerarquía no se
// leen: se cierran». `Novedades` pinta la PRIMERA en carbón, con lo que hace y
// por qué sirve, y las demás en una línea.
//
// Y arreglaba un fallo de contraste real: los títulos iban en `text-[white]`
// sobre `var(--cf-card)`, que en el tema claro es una tarjeta BLANCA. Era texto
// blanco sobre blanco — invisible salvo en oscuro.
//
// El componente trae su propio armazón de hoja (asa, título, X y bordes
// superiores), así que aquí solo queda el fondo y la lógica de versión.

import { useEffect, useState } from 'react'
import { NOVEDADES, NOVEDADES_VERSION, novedadVigente } from '@/lib/novedades'
import { Novedades } from '@/components/pantallas/Cargando'

const LS_KEY = 'cf:novedades:visto'

export default function NovedadesModal() {
  const [abierto, setAbierto] = useState(false)
  const [destacada, setDestacada] = useState(0)

  useEffect(() => {
    try {
      const visto = Number(localStorage.getItem(LS_KEY) || 0)
      if (NOVEDADES_VERSION <= visto) return

      /* ⚠ Y QUE LA NOVEDAD SIGA SIENDO NUEVA.
         Antes bastaba con que la versión fuera mayor que la vista, así que la
         del 18 de julio llevaba un mes abriéndose sola encima del panel — y a
         quien se registró después le salía como novedad algo que para él era
         simplemente cómo es la app. Ver `novedadVigente` en lib/novedades.js. */
      if (!novedadVigente(NOVEDADES[0])) {
        // Caducada: se da por vista EN SILENCIO. Ni se abre ahora ni se queda
        // esperando a saltar cuando a alguien se le ocurra limpiar el navegador.
        localStorage.setItem(LS_KEY, String(NOVEDADES_VERSION))
        return
      }

      // pequeño delay para no competir con el render inicial / otros modales
      const t = setTimeout(() => setAbierto(true), 600)
      return () => clearTimeout(t)
    } catch {}
  }, [])

  const cerrar = () => {
    try { localStorage.setItem(LS_KEY, String(NOVEDADES_VERSION)) } catch {}
    setAbierto(false)
  }

  // ── ESCAPE LO CIERRA ──
  //
  // No lo hacía, y es un `role="dialog" aria-modal="true"` que ocupa la pantalla
  // entera con z-1100: mientras está puesto se come TODOS los clics de debajo.
  // Tiene dos salidas —el fondo y «Entendido»— pero ninguna por teclado, así que
  // quien navegue con teclado se queda encerrado, y en escritorio el reflejo es
  // pulsar Escape antes que buscar el botón.
  //
  // Salió intentando automatizar un clic sobre la pantalla de cobrar hoy: el
  // modal bloqueaba la prueba igual que bloquea a quien entra.
  useEffect(() => {
    if (!abierto) return
    const alPulsar = (e) => { if (e.key === 'Escape') cerrar() }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [abierto])

  if (!abierto) return null

  const entrada = NOVEDADES[0]
  if (!entrada?.items?.length) return null

  // Cuál se explica. La lámina destaca una y deja las demás en una línea, pero
  // los renglones llevan flecha: si no llevan a ningún sitio, la flecha miente.
  // Tocarlos la SUBE al bloque de carbón, así que las seis se pueden leer sin
  // salir de la hoja.
  const primera = entrada.items[destacada] ?? entrada.items[0]
  const otras = entrada.items.map((it, i) => ({ ...it, i })).filter((it) => it.i !== destacada)

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Novedades del sistema"
    >
      {/* Backdrop */}
      <button
        aria-label="Cerrar"
        onClick={cerrar}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        style={{ animation: 'cf-nov-fade 180ms ease-out' }}
      />

      <div
        className="relative w-full sm:max-w-md max-h-[88dvh]"
        style={{ animation: 'cf-nov-up 260ms cubic-bezier(0.22,1,0.36,1)' }}
      >
        <Novedades
          titulo="¡Tenemos novedades!"
          detalle={entrada.fecha
            ? `Versión del ${new Date(`${entrada.fecha}T05:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}`
            : 'Esto es lo nuevo en Control Finanzas'}
          onCerrar={cerrar}
          destacada={{
            etiqueta: 'Lo más útil',
            titulo: primera.titulo,
            texto: primera.texto,
            // No hay un sitio al que llevar desde aquí: las novedades del
            // registro no traen destino. La acción es enterarse y seguir.
            accion: 'Entendido',
          }}
          onActivar={cerrar}
          restoTitulo={otras.length === 1 ? 'Y una más' : `Las otras ${otras.length}, en una línea`}
          resto={otras.map((it) => ({ id: `nov-${it.i}`, texto: it.titulo, i: it.i }))}
          onNovedad={(n) => setDestacada(n.i)}
        />
      </div>

      <style jsx global>{`
        @keyframes cf-nov-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cf-nov-up { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
        @media (prefers-reduced-motion: reduce) {
          .fixed [style*="cf-nov-up"], .fixed [style*="cf-nov-fade"] { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
