'use client'
// components/tutoriales/ModalGuia.jsx — la guía, donde estás.
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El dueño, sobre lo que había:
//
//   «me manda al apartado de tutoriales. Y el apartado de tutoriales, aparte de
//    que no es lo que quiero, está roto. […] Yo quería que en un modal, ahí
//    mismo sin moverse para ningún otro lado. Que en el modal esté la
//    explicación y que al final lo mande a renovar el préstamo.»
//
// Las tres cosas que eso cambia, y ninguna es de estilo:
//
//  1 · NO SE SALE DE LA PANTALLA. Irse a `/tutoriales` a leer cómo se renueva
//      obliga a volver, acordarse del camino y buscarlo otra vez. Y peor: el
//      préstamo que se estaba mirando se pierde por el camino.
//  2 · LA GUÍA TERMINA EN LA ACCIÓN. El botón del pie ejecuta la acción de esta
//      misma pantalla —abre la hoja de renovar— en vez de dejar al lector con
//      la explicación y el problema intactos.
//  3 · EL PIE ES PIE, no el final de un texto largo. En el `footer` del modal
//      se queda pegado abajo mientras se lee, así que la salida está a la vista
//      desde el primer renglón.

import { useState } from 'react'
import Image from 'next/image'
import { Modal } from '@/components/ui/Modal'
import { useAcciones, ejecutarAccion } from '@/components/acciones/AccionesProvider'
import { accionDeGuia } from '@/lib/tutoriales/guias'

/* El texto de las guías está escrito en formato de WhatsApp —`*así*`— a
   propósito: cada una tiene un botón de copiar para reenviársela al cobrador o
   al cliente. Aquí se traduce a negrita de verdad.

   ⚠ Vive en este archivo y `TutorialesList` lo importa de aquí. Estaba escrito
   dentro de la lista, y copiarlo era garantizar que un día uno de los dos
   entendiera el asterisco de otra forma. */
export function TextoGuia({ texto = '' }) {
  const renglones = texto.split('\n')
  return renglones.map((linea, i) => {
    const partes = []
    let resto = linea
    let k = 0
    while (resto.length > 0) {
      const abre = resto.indexOf('*')
      if (abre === -1) { partes.push(resto); break }
      const cierra = resto.indexOf('*', abre + 1)
      if (cierra === -1) { partes.push(resto); break }
      if (abre > 0) partes.push(resto.slice(0, abre))
      partes.push(
        <strong key={k++} className="font-semibold" style={{ color: 'var(--cf-ink)' }}>
          {resto.slice(abre + 1, cierra)}
        </strong>,
      )
      resto = resto.slice(cierra + 1)
    }
    return <span key={i}>{partes}{i < renglones.length - 1 && '\n'}</span>
  })
}

/* La captura a pantalla completa. Las de las guías son de teléfono, así que
   dentro del modal salen a 150px y los señalamientos no se leen. */
function Ampliada({ src, alt, onClose }) {
  if (!src) return null
  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/90 cursor-zoom-out"
      onClick={onClose}
      role="button"
      aria-label="Cerrar la captura"
    >
      <Image src={src} alt={alt || ''} width={1600} height={1200}
        className="max-w-[92vw] max-h-[92vh] w-auto h-auto rounded-xl" />
    </div>
  )
}

export default function ModalGuia({ guia, onClose }) {
  const acciones = useAcciones()
  const [ampliada, setAmpliada] = useState(null)
  if (!guia) return null

  const accion = accionDeGuia(guia, acciones)

  /* ⚠ SE CIERRA ANTES DE EJECUTAR. Las acciones abren sus propios modales, y
     dos capas de modal encima no dejan ver el de abajo pero sí se llevan el
     foco y el `overflow:hidden` del cuerpo: al cerrar el de arriba, el de abajo
     queda con la página bloqueada. */
  const irALaAccion = () => {
    onClose?.()
    setTimeout(() => ejecutarAccion(accion), 60)
  }

  const pie = accion ? (
    <button
      type="button"
      onClick={irALaAccion}
      className="w-full h-12 rounded-[14px] font-bold text-[15px] inline-flex items-center justify-center gap-2"
      style={{ background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', cursor: 'pointer', border: 0 }}
    >
      {accion.label}
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  ) : guia.destino ? (
    /* El respaldo: la guía se está leyendo desde una pantalla que no tiene esa
       acción —«cómo renovar» leído desde la caja—, así que se LLEVA al sitio.
       No todas lo tienen: instalar la app no lleva a ninguna pantalla nuestra,
       el botón que hay que tocar es del navegador. */
    <a
      href={guia.destino.href}
      className="w-full h-12 rounded-[14px] font-bold text-[15px] inline-flex items-center justify-center gap-2"
      style={{ background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }}
    >
      {guia.destino.texto}
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </a>
  ) : null

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={guia.title}
        subtitle="Guía paso a paso"
        size="md"
        footer={pie}
      >
        {guia.images?.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-2 mb-4">
            {guia.images.map((img) => (
              <button
                key={img.src}
                type="button"
                onClick={() => setAmpliada(img)}
                className="shrink-0 w-[150px] rounded-xl overflow-hidden text-left"
                style={{ border: '1px solid var(--cf-border)', background: 'var(--cf-card)', cursor: 'zoom-in' }}
              >
                <Image src={img.src} alt={img.caption || ''} width={400} height={700}
                  className="w-full h-auto" />
                <span className="block text-[10px] text-center py-1.5 px-2"
                  style={{ color: 'var(--cf-ink-3)' }}>
                  {img.caption}
                </span>
              </button>
            ))}
          </div>
        )}

        <div
          className="rounded-xl p-4 text-[13px] whitespace-pre-wrap leading-relaxed"
          style={{ background: 'var(--cf-surface)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink-2)' }}
        >
          <TextoGuia texto={guia.text} />
        </div>
      </Modal>

      <Ampliada src={ampliada?.src} alt={ampliada?.caption} onClose={() => setAmpliada(null)} />
    </>
  )
}
