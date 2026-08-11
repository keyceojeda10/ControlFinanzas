'use client'
// components/TutorialesList.jsx — Lista interactiva de tutoriales con categorías

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { TUTORIALES, CATEGORIAS } from '@/lib/tutorialesData'
import { TextoGuia } from '@/components/tutoriales/ModalGuia'

/* ⚠ EL TRADUCTOR DE `*negrita*` VIVE EN `ModalGuia`, y esta lista lo importa
   de alli. Estaba escrito aqui dentro, y ahora la misma guia se lee por DOS
   caminos —esta pantalla y el modal de «¿Que necesitas hacer aqui?»—: dos
   copias del mismo interprete es como se acaba con dos formas de entender un
   asterisco. Es el fallo del comprobante, que se reporto dos dias seguidos. */

// ─── Lightbox ────────────────────────────────────────────────
function Lightbox({ src, alt, onClose }) {
  if (!src) return null
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center cursor-pointer"
      onClick={onClose}
    >
      <Image
        src={src}
        alt={alt}
        width={1600}
        height={1200}
        className="max-w-[90vw] max-h-[90vh] rounded-xl w-auto h-auto"
      />
    </div>
  )
}

// ─── Tutorial card ───────────────────────────────────────────
function TutorialCard({ tutorial, showCopyButton, onImageClick, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)

  /* ⚠ `useState(defaultOpen)` SOLO LEE AL MONTAR, y el `?t=` de la URL llega
     después, en un efecto: sin esto la tarjeta enlazada se quedaba plegada y el
     enlace no servía de nada. Se abre cuando pasa a true, y nunca se cierra
     sola: si volviera a cerrarse, cerrarla a mano no funcionaría. */
  useEffect(() => { if (defaultOpen) setOpen(true) }, [defaultOpen])
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(tutorial.text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [tutorial.text])

  return (
    <div className={`bg-[var(--cf-surface)] border rounded-[16px] overflow-hidden transition-colors ${open ? 'border-[var(--cf-border-strong)]' : 'border-[var(--cf-border)] hover:border-[var(--cf-border-strong)]'}`}>
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--cf-fill)] transition-colors"
      >
        <span className="flex-1 text-sm font-semibold text-[var(--cf-ink)] leading-snug">
          {tutorial.title}
        </span>
        <svg
          className={`w-4 h-4 text-[var(--cf-ink-3)] transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Body */}
      {open && (
        <div className="px-4 pb-4 pt-1">
          {/* ⚠ AQUÍ VIVÍA UN `<iframe>` DE YOUTUBE ──────────────────────────
             Los 13 videos son de marzo y enseñan la interfaz de antes del
             rediseño. El bot ya tenía escrita la regla de no mandárselos a
             nadie —«muestran una interfaz vieja»— pero dentro de la app se
             seguían reproduciendo, que es donde están los que YA pagan.

             El dueño lo zanjó: «hay que quitarlos y reemplazarlos por
             imágenes». Las imágenes ahora se rehacen con
             `scripts/capturar-tutoriales.mjs`, así que no vuelven a envejecer
             solas. Si algún día se regraban los videos, esto vuelve — pero con
             una fecha al lado. */}
          {/* Las capturas */}
          {tutorial.images.length > 0 && (
            <div className="flex gap-3 mb-4 overflow-x-auto pb-2">
              {tutorial.images.map((img) => (
                <div
                  key={img.src}
                  className="rounded-xl overflow-hidden border border-[var(--cf-border)] cursor-pointer hover:border-[var(--cf-gold)] transition-colors shrink-0 w-[160px] sm:w-[200px]"
                  onClick={() => onImageClick(img.src, img.caption)}
                >
                  <Image
                    src={img.src}
                    alt={img.caption}
                    width={400}
                    height={700}
                    className="w-full h-auto"
                  />
                  <p className="text-[10px] text-[var(--cf-ink-3)] text-center py-1.5 bg-[var(--cf-card)] truncate px-2">
                    {img.caption}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Text */}
          <div className="bg-[var(--cf-card)] border border-[var(--cf-border)] rounded-xl p-4 text-xs text-[var(--cf-ink)] whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">
            {showCopyButton ? tutorial.text : <TextoGuia texto={tutorial.text} />}
          </div>

          {/* ⚠ LA GUÍA TERMINA EN EL SITIO, NO EN OTRA FOTO.
              La regla, decidida con el dueño: si se puede hacer aquí, se hace;
              si hay que ir a otro sitio, se LLEVA. Leer cómo se renueva un
              préstamo y quedarse en la página de tutoriales obliga a recordar
              el camino; el botón lo ahorra.
              No todas lo tienen: instalar la app no lleva a ninguna pantalla
              nuestra —el botón que hay que tocar es del navegador— y ahí las
              imágenes SON la explicación. */}
          {tutorial.destino && (
            <a
              href={tutorial.destino.href}
              className="mt-3 flex items-center justify-center gap-2 h-12 rounded-[14px] font-bold text-[15px] transition-all"
              style={{ background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }}
            >
              {tutorial.destino.texto}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </a>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {/* El botón «Compartir video» se fue con el iframe: mandaba por
               WhatsApp un enlace de YouTube con la interfaz vieja. Queda
               «Copiar texto», que es lo que el prestamista de verdad reenvía. */}
            {showCopyButton && (
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--cf-surface)] border border-[var(--cf-border)] text-[var(--cf-ink-3)] text-xs font-semibold hover:text-[var(--cf-ink)] hover:border-[#444] transition-all active:scale-95"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copiar texto
              </button>
            )}
            {copied && (
              <span className="text-xs text-[var(--cf-green-dark)] font-medium animate-pulse">Copiado!</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Category section ────────────────────────────────────────
function CategorySection({ categoria, tutoriales, showCopyButton, onImageClick }) {
  return (
    <div id={`cat-${categoria.id}`} className="scroll-mt-4">
      <div className="flex items-center gap-2.5 mb-3 mt-2">
        <div className="w-2 h-2 rounded-full" style={{ background: categoria.color }} />
        <h2 className="text-sm font-bold text-[var(--cf-ink)]">{categoria.label}</h2>
        <span className="text-[10px] text-[var(--cf-ink-3)] bg-[var(--cf-surface)] px-2 py-0.5 rounded-full">
          {tutoriales.length}
        </span>
      </div>
      <div className="space-y-2.5">
        {tutoriales.map((t) => (
          <div key={t.id} id={`tut-${t.id}`}>
            <TutorialCard
              tutorial={t}
              showCopyButton={showCopyButton}
              onImageClick={onImageClick}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────
export default function TutorialesList({ showCopyButton = false }) {
  /* ⚠ `?t=<id>` ABRE ESA GUÍA. Sin esto no se podía ENLAZAR a un tutorial: el
     enlace abría la página y la tarjeta seguía plegada, porque `defaultOpen`
     dependía del filtro y no del enlace. Y sin enlace, el buscador solo podía
     decir «está en tutoriales», que es tanto como no decir nada.
     Se lee una sola vez: si se siguiera el parámetro, la tarjeta se volvería a
     abrir sola cada vez que el usuario la cierra.

     ⚠ Se lee del NAVEGADOR, no con `useSearchParams`: ese hook obliga a envolver
     el componente en un `<Suspense>` y, sin él, revienta el prerenderizado de
     `/admin/tutoriales`, que monta esta misma lista. Un parámetro opcional no
     justifica cambiarle el armazón a dos páginas. */
  const [pedido, setPedido] = useState(null)
  useEffect(() => {
    setPedido(new URLSearchParams(window.location.search).get('t'))
  }, [])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState(null)
  const [lightbox, setLightbox] = useState({ src: null, alt: '' })

  const filtered = TUTORIALES.filter((t) => {
    if (search.trim()) {
      const q = search.toLowerCase()
      return t.title.toLowerCase().includes(q) || t.text.toLowerCase().includes(q)
    }
    if (activeCategory) return t.categoria === activeCategory
    return true
  })

  // Group by category
  const grouped = CATEGORIAS.map((cat) => ({
    ...cat,
    tutoriales: filtered.filter((t) => t.categoria === cat.id),
  })).filter((g) => g.tutoriales.length > 0)

  const isFiltering = search.trim() || activeCategory

  return (
    <>
      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-4 h-4 text-[var(--cf-ink-3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setActiveCategory(null) }}
          placeholder="Buscar tutorial... (ej: préstamo, pago, ruta, offline)"
          className="w-full h-10 pl-10 pr-4 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-card)] text-sm text-[var(--cf-ink)] placeholder-[#555555] focus:outline-none focus:border-[var(--cf-gold)] transition-colors"
        />
      </div>

      {/* Category pills */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
        <button
          onClick={() => { setActiveCategory(null); setSearch('') }}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            !activeCategory && !search.trim()
              ? 'bg-[var(--cf-gold)] text-[var(--cf-ink)]'
              : 'bg-[var(--cf-surface)] text-[var(--cf-ink-3)] border border-[var(--cf-border)] hover:border-[#444]'
          }`}
        >
          Todos
        </button>
        {CATEGORIAS.map((cat) => (
          <button
            key={cat.id}
            onClick={() => { setActiveCategory(cat.id === activeCategory ? null : cat.id); setSearch('') }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeCategory === cat.id
                ? 'text-[var(--cf-ink)]'
                : 'bg-[var(--cf-surface)] text-[var(--cf-ink-3)] border border-[var(--cf-border)] hover:border-[#444]'
            }`}
            style={activeCategory === cat.id ? { backgroundColor: cat.color } : undefined}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <p className="text-sm text-[var(--cf-ink-3)] text-center py-8">
          No se encontraron tutoriales para &quot;{search}&quot;
        </p>
      )}

      {/* Tutorials grouped by category */}
      {!isFiltering ? (
        <div className="space-y-8">
          {grouped.map((group) => (
            <CategorySection
              key={group.id}
              categoria={group}
              tutoriales={group.tutoriales}
              showCopyButton={showCopyButton}
              onImageClick={(src, alt) => setLightbox({ src, alt })}
            />
          ))}
        </div>
      ) : (
        // Flat list when searching or filtering
        <div className="space-y-2.5">
          {filtered.map((t) => (
            <div key={t.id} id={`tut-${t.id}`}>
              <TutorialCard
                tutorial={t}
                showCopyButton={showCopyButton}
                onImageClick={(src, alt) => setLightbox({ src, alt })}
                /* ⚠ AQUÍ DECÍA `tutorial.id`, Y `tutorial` NO EXISTE EN ESTE
                   ÁMBITO: la variable del `map` es `t`. Un `ReferenceError` en
                   pleno render, así que la pantalla entera de tutoriales
                   reventaba —«tutorial is not defined» en los detalles
                   técnicos— y solo en la rama de búsqueda/filtro, que es
                   justo la que abre el enlace `?t=`.
                   Pasa build y pruebas sin chistar: aquí no hay TypeScript. */
                defaultOpen={filtered.length === 1 || t.id === pedido}
              />
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <Lightbox
        src={lightbox.src}
        alt={lightbox.alt}
        onClose={() => setLightbox({ src: null, alt: '' })}
      />
    </>
  )
}
