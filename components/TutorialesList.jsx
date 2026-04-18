'use client'
// components/TutorialesList.jsx — Lista interactiva de tutoriales con categorías

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { TUTORIALES, CATEGORIAS } from '@/lib/tutorialesData'

// ─── Parse WhatsApp formatting to React elements ─────────────
function parseWhatsAppText(text) {
  return text.split('\n').map((line, i) => {
    const parts = []
    let remaining = line
    let key = 0
    while (remaining.length > 0) {
      const startIdx = remaining.indexOf('*')
      if (startIdx === -1) { parts.push(remaining); break }
      const endIdx = remaining.indexOf('*', startIdx + 1)
      if (endIdx === -1) { parts.push(remaining); break }
      if (startIdx > 0) parts.push(remaining.slice(0, startIdx))
      parts.push(<strong key={key++} className="text-[var(--color-text-primary)] font-semibold">{remaining.slice(startIdx + 1, endIdx)}</strong>)
      remaining = remaining.slice(endIdx + 1)
    }
    return (
      <span key={i}>
        {parts}
        {i < text.split('\n').length - 1 && '\n'}
      </span>
    )
  })
}

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
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(tutorial.text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [tutorial.text])

  return (
    <div className={`bg-[var(--color-bg-surface)] border rounded-[16px] overflow-hidden transition-colors ${open ? 'border-[var(--color-border-hover)]' : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)]'}`}>
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--color-bg-hover)] transition-colors"
      >
        <span className="flex-1 text-sm font-semibold text-[var(--color-text-primary)] leading-snug">
          {tutorial.title}
        </span>
        <svg
          className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Body */}
      {open && (
        <div className="px-4 pb-4 pt-1">
          {/* Video embed */}
          {tutorial.videoId && (
            <div className="relative w-full rounded-xl overflow-hidden border border-[var(--color-border)] mb-4" style={{ paddingBottom: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${tutorial.videoId}`}
                title={tutorial.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {/* Images (solo si no hay video) */}
          {!tutorial.videoId && tutorial.images.length > 0 && (
            <div className="flex gap-3 mb-4 overflow-x-auto pb-2">
              {tutorial.images.map((img) => (
                <div
                  key={img.src}
                  className="rounded-xl overflow-hidden border border-[var(--color-border)] cursor-pointer hover:border-[#f5c518] transition-colors shrink-0 w-[160px] sm:w-[200px]"
                  onClick={() => onImageClick(img.src, img.caption)}
                >
                  <Image
                    src={img.src}
                    alt={img.caption}
                    width={400}
                    height={700}
                    className="w-full h-auto"
                  />
                  <p className="text-[10px] text-[var(--color-text-muted)] text-center py-1.5 bg-[var(--color-bg-card)] truncate px-2">
                    {img.caption}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Text */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4 text-xs text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">
            {showCopyButton ? tutorial.text : parseWhatsAppText(tutorial.text)}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {/* Share video via WhatsApp */}
            {tutorial.videoId && (
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${tutorial.title}\nhttps://www.youtube.com/watch?v=${tutorial.videoId}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#25D366] text-[var(--color-text-primary)] text-xs font-semibold hover:bg-[#1fb855] transition-all active:scale-95"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.612.616l4.529-1.474A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.232 0-4.299-.726-5.979-1.955l-.417-.306-2.688.875.864-2.643-.331-.434A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                </svg>
                Compartir video
              </a>
            )}
            {showCopyButton && (
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] text-xs font-semibold hover:text-[var(--color-text-primary)] hover:border-[#444] transition-all active:scale-95"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copiar texto
              </button>
            )}
            {copied && (
              <span className="text-xs text-[var(--color-success)] font-medium animate-pulse">Copiado!</span>
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
        <h2 className="text-sm font-bold text-[var(--color-text-primary)]">{categoria.label}</h2>
        <span className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-surface)] px-2 py-0.5 rounded-full">
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
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setActiveCategory(null) }}
          placeholder="Buscar tutorial... (ej: prestamo, pago, ruta, offline)"
          className="w-full h-10 pl-10 pr-4 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] placeholder-[#555555] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
        />
      </div>

      {/* Category pills */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
        <button
          onClick={() => { setActiveCategory(null); setSearch('') }}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            !activeCategory && !search.trim()
              ? 'bg-[var(--color-accent)] text-[#1a1a2e]'
              : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:border-[#444]'
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
                ? 'text-[#0a0a0a]'
                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:border-[#444]'
            }`}
            style={activeCategory === cat.id ? { backgroundColor: cat.color } : undefined}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
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
                defaultOpen={filtered.length === 1}
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
