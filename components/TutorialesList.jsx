'use client'
// components/TutorialesList.jsx — Lista interactiva de tutoriales (reutilizable)

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { TUTORIALES } from '@/lib/tutorialesData'

// ─── Parse WhatsApp formatting to React elements ─────────────
// Converts *bold* → <strong>, keeps line breaks, removes raw WhatsApp symbols
function parseWhatsAppText(text) {
  return text.split('\n').map((line, i) => {
    // Split line by *bold* markers and render accordingly
    const parts = []
    let remaining = line
    let key = 0
    while (remaining.length > 0) {
      const startIdx = remaining.indexOf('*')
      if (startIdx === -1) {
        parts.push(remaining)
        break
      }
      const endIdx = remaining.indexOf('*', startIdx + 1)
      if (endIdx === -1) {
        parts.push(remaining)
        break
      }
      // Text before the bold
      if (startIdx > 0) {
        parts.push(remaining.slice(0, startIdx))
      }
      // Bold text
      parts.push(<strong key={key++} className="text-white font-semibold">{remaining.slice(startIdx + 1, endIdx)}</strong>)
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
      <img src={src} alt={alt} className="max-w-[90vw] max-h-[90vh] rounded-xl" />
    </div>
  )
}

// ─── Tutorial card ───────────────────────────────────────────
function TutorialCard({ tutorial, index, showCopyButton, onImageClick }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(tutorial.text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [tutorial.text])

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] overflow-hidden transition-colors hover:border-[#3a3a3a]">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#222222] transition-colors"
      >
        <span className="w-8 h-8 rounded-[10px] bg-[rgba(245,197,24,0.12)] text-[#f5c518] flex items-center justify-center text-xs font-bold shrink-0">
          {index + 1}
        </span>
        <span className="flex-1 text-sm font-semibold text-white">
          {tutorial.emoji} {tutorial.title}
        </span>
        <svg
          className={`w-4 h-4 text-[#555555] transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Body */}
      {open && (
        <div className="px-4 pb-4 pt-1">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Images */}
            <div className="flex flex-col gap-3 sm:w-[200px] shrink-0">
              {tutorial.images.map((img) => (
                <div
                  key={img.src}
                  className="rounded-xl overflow-hidden border border-[#2a2a2a] cursor-pointer hover:border-[#f5c518] transition-colors"
                  onClick={() => onImageClick(img.src, img.caption)}
                >
                  <Image
                    src={img.src}
                    alt={img.caption}
                    width={400}
                    height={700}
                    className="w-full h-auto"
                  />
                  <p className="text-[10px] text-[#555555] text-center py-1.5 bg-[#111111]">
                    {img.caption}
                  </p>
                </div>
              ))}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-4 text-xs text-[#cccccc] whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">
                {showCopyButton ? tutorial.text : parseWhatsAppText(tutorial.text)}
              </div>

              {showCopyButton && (
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#25D366] text-white text-xs font-semibold hover:bg-[#1fb855] transition-all active:scale-95"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.612.616l4.529-1.474A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.232 0-4.299-.726-5.979-1.955l-.417-.306-2.688.875.864-2.643-.331-.434A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                    </svg>
                    Copiar para WhatsApp
                  </button>
                  {copied && (
                    <span className="text-xs text-[#22c55e] font-medium animate-pulse">✓ ¡Copiado!</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────
export default function TutorialesList({ showCopyButton = false }) {
  const [search, setSearch] = useState('')
  const [lightbox, setLightbox] = useState({ src: null, alt: '' })

  const filtered = TUTORIALES.filter((t) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return t.title.toLowerCase().includes(q) || t.text.toLowerCase().includes(q)
  })

  return (
    <>
      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555555]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar tutorial... (ej: préstamo, pago, ruta)"
          className="w-full h-10 pl-10 pr-4 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-white placeholder-[#555555] focus:outline-none focus:border-[#f5c518] transition-colors"
        />
      </div>



      {/* Tutorials */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-sm text-[#555555] text-center py-8">
            No se encontraron tutoriales para "{search}"
          </p>
        )}
        {filtered.map((t, i) => (
          <div key={t.id} id={`tut-${t.id}`}>
            <TutorialCard
              tutorial={t}
              index={TUTORIALES.indexOf(t)}
              showCopyButton={showCopyButton}
              onImageClick={(src, alt) => setLightbox({ src, alt })}
            />
          </div>
        ))}
      </div>

      {/* Lightbox */}
      <Lightbox
        src={lightbox.src}
        alt={lightbox.alt}
        onClose={() => setLightbox({ src: null, alt: '' })}
      />
    </>
  )
}
