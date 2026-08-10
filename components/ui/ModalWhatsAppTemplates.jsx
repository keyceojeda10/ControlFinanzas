'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { formatearTelefono, abrirWhatsApp } from '@/lib/whatsapp'
import {
  PLANTILLAS,
  cargarConfigPlantillas,
  guardarConfigPlantillas,
  sincronizarPlantillasDesdeDB,
} from '@/lib/whatsapp-plantillas'
// El panel vive ahora en su propio archivo: lo usan ESTE modal y la hoja nueva.
// Estaba definido aqui dentro, y por eso la hoja no podia ofrecerlo.
import PanelSecciones from '@/components/whatsapp/PanelSecciones'


export default function ModalWhatsAppTemplates({
  open, onClose, cliente, prestamo, orgNombre, ocultarSaldo,
  pago, organizationId, camposRecibo,
  preselectedTemplateId,
}) {
  const [selectedId, setSelectedId] = useState(null)
  const [textoEditable, setTextoEditable] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [seccionesActivas, setSeccionesActivas] = useState(new Set())
  const [showSecciones, setShowSecciones] = useState(false)
  const [extras, setExtras] = useState([])

  const tel = formatearTelefono(cliente?.telefono)

  const [allConfig, setAllConfig] = useState(() => cargarConfigPlantillas(organizationId))

  useEffect(() => {
    if (!open) return
    setAllConfig(cargarConfigPlantillas(organizationId))
    sincronizarPlantillasDesdeDB(organizationId).then(setAllConfig)
  }, [open, organizationId])

  const ctx = useMemo(() => ({
    cliente, prestamo, pago, orgNombre, ocultarSaldo, camposRecibo,
  }), [cliente, prestamo, pago, orgNombre, ocultarSaldo, camposRecibo])

  const aplicables = useMemo(() => {
    return PLANTILLAS.filter(t => {
      try { return t.aplica({ cliente, prestamo, pago }) } catch { return false }
    })
  }, [cliente, prestamo, pago])

  const selectedTemplate = useMemo(() => PLANTILLAS.find(t => t.id === selectedId), [selectedId])

  const seccionesActuales = useMemo(() => {
    if (!selectedTemplate?.getSecciones) return null
    try { return selectedTemplate.getSecciones(ctx) } catch { return null }
  }, [selectedTemplate, ctx])

  const generarTextoConSecciones = useCallback((template, secActivas, extrasLocal) => {
    if (!template) return ''
    if (template.getSecciones) {
      try {
        const secs = template.getSecciones(ctx)
        let texto = secs
          .filter(s => s.locked || secActivas.has(s.key))
          .map(s => s.texto)
          .join('')
          .trim()
        if (Array.isArray(extrasLocal) && extrasLocal.length > 0) {
          const extraText = extrasLocal.map(e => `\u{1f4cb} ${e.nombre}: ${e.valor}`).join('\n')
          // El software no firma cobros. Ver `lib/whatsapp-plantillas.js`.
  const orgFirma = orgNombre ? `_${orgNombre}_` : ''
          const firmaIdx = texto.lastIndexOf(orgFirma)
          if (firmaIdx > 0) {
            texto = texto.slice(0, firmaIdx) + extraText + '\n\n' + texto.slice(firmaIdx)
          } else {
            texto += '\n' + extraText
          }
        }
        return texto
      } catch { return '' }
    }
    if (template.generar) {
      try { return template.generar(ctx) } catch { return '' }
    }
    return ''
  }, [ctx, orgNombre])

  const initSeccionesForTemplate = useCallback((templateId) => {
    const tmpl = PLANTILLAS.find(t => t.id === templateId)
    if (!tmpl?.getSecciones) return { secs: new Set(), extras: [] }
    const saved = allConfig[templateId]
    if (saved && typeof saved === 'object' && Array.isArray(saved.secciones)) {
      return { secs: new Set(saved.secciones), extras: saved.extras || [] }
    }
    if (saved && Array.isArray(saved)) {
      return { secs: new Set(saved), extras: [] }
    }
    try {
      const secs = tmpl.getSecciones(ctx)
      return { secs: new Set(secs.filter(s => s.default || s.locked).map(s => s.key)), extras: [] }
    } catch {
      return { secs: new Set(), extras: [] }
    }
  }, [allConfig, ctx])

  useEffect(() => {
    if (!open) {
      setSelectedId(null)
      setTextoEditable('')
      setCopiado(false)
      setGuardado(false)
      setShowSecciones(false)
      setExtras([])
      return
    }
    const sugerido = preselectedTemplateId
      ? aplicables.find(t => t.id === preselectedTemplateId) || aplicables.find(t => t.id !== 'libre') || aplicables[0]
      : aplicables.find(t => t.id !== 'libre') || aplicables[0]
    if (sugerido) {
      setSelectedId(sugerido.id)
      const { secs, extras: ex } = initSeccionesForTemplate(sugerido.id)
      setSeccionesActivas(secs)
      setExtras(ex)
      setTextoEditable(generarTextoConSecciones(sugerido, secs, ex))
      setShowSecciones(!!sugerido.getSecciones)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleSelect = (template) => {
    setSelectedId(template.id)
    setGuardado(false)
    const { secs, extras: ex } = initSeccionesForTemplate(template.id)
    setSeccionesActivas(secs)
    setExtras(ex)
    setTextoEditable(generarTextoConSecciones(template, secs, ex))
    setShowSecciones(!!template.getSecciones)
  }

  const handleToggleSeccion = (key) => {
    setSeccionesActivas(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      const tmpl = PLANTILLAS.find(t => t.id === selectedId)
      if (tmpl) setTextoEditable(generarTextoConSecciones(tmpl, next, extras))
      return next
    })
    setGuardado(false)
  }

  const handleExtrasChange = (newExtras) => {
    setExtras(newExtras)
    setGuardado(false)
    const tmpl = PLANTILLAS.find(t => t.id === selectedId)
    if (tmpl) setTextoEditable(generarTextoConSecciones(tmpl, seccionesActivas, newExtras))
  }

  const handleGuardar = () => {
    if (!selectedId) return
    const newConfig = { ...allConfig, [selectedId]: { secciones: [...seccionesActivas], extras } }
    guardarConfigPlantillas(organizationId, newConfig)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2500)
  }

  const handleEnviar = () => {
    if (!tel || !textoEditable.trim()) return
    const url = `https://wa.me/${tel}?text=${encodeURIComponent(textoEditable)}`
    abrirWhatsApp(url)
    onClose?.()
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Enviar WhatsApp a ${cliente?.nombre || 'cliente'}`}
      footer={
        <div className="flex gap-2 w-full">
          <Button variant="secondary" onClick={onClose} className="flex-shrink-0">
            Cancelar
          </Button>
          <button
            onClick={handleEnviar}
            disabled={!tel || !textoEditable.trim()}
            className="flex-1 h-10 rounded-[12px] text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: '#25D366', color: '#fff' }}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            Enviar por WhatsApp
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {!tel && (
          <div className="rounded-[10px] px-3 py-2.5 text-[12px]" style={{ background: 'var(--cf-gold-tint)', color: 'var(--cf-gold-dark)', border: '1px solid color-mix(in srgb, var(--cf-gold-dark) 30%, transparent)' }}>
            Este cliente no tiene un telefono valido registrado.
          </div>
        )}

        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[.07em] mb-2" style={{ color: 'var(--cf-ink-3)' }}>
            Elige una plantilla
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {aplicables.map(t => {
              const active = selectedId === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelect(t)}
                  className="rounded-[10px] px-2.5 py-2 text-left transition-all"
                  style={{
                    background: active ? `color-mix(in srgb, ${t.color} 18%, transparent)` : 'var(--cf-card)',
                    border: `1px solid ${active ? t.color : 'var(--cf-border)'}`,
                    boxShadow: active ? `0 0 0 1px ${t.color}, 0 4px 12px color-mix(in srgb, ${t.color} 20%, transparent)` : 'none',
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[14px]">{t.icon}</span>
                    <span className="text-[11px] font-semibold truncate" style={{ color: active ? t.color : 'var(--cf-ink)' }}>{t.label}</span>
                  </div>
                  <p className="text-[11px] leading-tight" style={{ color: 'var(--cf-ink-3)' }}>{t.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {seccionesActuales && seccionesActuales.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowSecciones(v => !v)}
              className="flex items-center gap-1.5 w-full text-left mb-2"
            >
              <svg
                className="w-3 h-3 transition-transform"
                style={{ transform: showSecciones ? 'rotate(90deg)' : 'rotate(0)', color: 'var(--cf-ink-3)' }}
                fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-[10px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--cf-ink-3)' }}>
                Personalizar secciones
              </span>
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--cf-gold) 12%, transparent)', color: 'var(--cf-gold)' }}>
                {seccionesActuales.filter(s => !s.locked && seccionesActivas.has(s.key)).length}/{seccionesActuales.filter(s => !s.locked).length}
              </span>
            </button>

            {showSecciones && (
              <PanelSecciones
                secciones={seccionesActuales}
                activas={seccionesActivas}
                onChange={handleToggleSeccion}
                guardado={guardado}
                onGuardar={handleGuardar}
                extras={extras}
                onExtrasChange={handleExtrasChange}
              />
            )}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--cf-ink-3)' }}>
              Mensaje (puedes editarlo)
            </p>
            <div className="flex items-center gap-2">
              <p className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>
                {textoEditable.length} caracteres
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(textoEditable)
                    setCopiado(true)
                    setTimeout(() => setCopiado(false), 2000)
                  } catch {}
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] font-medium transition-all"
                style={{
                  background: copiado ? 'color-mix(in srgb, var(--cf-green-dark) 15%, transparent)' : 'var(--cf-card)',
                  color: copiado ? 'var(--cf-green-dark)' : 'var(--cf-ink-3)',
                  border: `1px solid ${copiado ? 'var(--cf-green-dark)' : 'var(--cf-border)'}`,
                }}
              >
                {copiado ? (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                )}
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
          <textarea
            value={textoEditable}
            onChange={(e) => setTextoEditable(e.target.value)}
            rows={10}
            className="w-full rounded-[10px] px-3 py-2.5 text-[13px] font-mono resize-y focus:outline-none focus:ring-2"
            style={{
              background: 'var(--cf-card)',
              border: '1px solid var(--cf-border)',
              color: 'var(--cf-ink)',
              minHeight: '180px',
            }}
            placeholder="Escribe tu mensaje..."
          />
        </div>
      </div>
    </Modal>
  )
}
