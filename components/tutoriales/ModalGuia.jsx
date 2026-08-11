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
        {/* ══ EL PASO A PASO, EN VERTICAL Y NUMERADO ══════════════════════
            Esto era una TIRA HORIZONTAL de miniaturas de 150px, y el dueño la
            rebatió con lo que se ve:

              «solamente tienen una imagen, cuando se supone que es un paso a
               paso, son varias imágenes y tienen que ir subrayadas y señaladas
               todos los clics.»

            Medido: 28 de las 34 guías tenían UNA foto. Y a 150px el
            señalamiento —el aro rojo y su etiqueta— no se lee, así que la
            miniatura no enseñaba dónde tocar: había que ampliarla para
            enterarse, o sea leer la guía dos veces.

            Ahora cada paso es una fila: la instrucción arriba, con su número, y
            debajo la captura A TODO EL ANCHO del modal. Ocupa más y hay que
            desplazarse — y ese es el intercambio correcto: se lee de corrido,
            que es lo que hace quien está atascado. Ampliar sigue estando para
            el detalle fino. */}
        {guia.images?.length > 0 && (
          <ol style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 18 }}>
            {guia.images.map((img, i) => (
              <li key={img.src} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span aria-hidden style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22, minWidth: 22, borderRadius: 999, flex: 'none',
                    background: 'var(--cf-ink)', color: 'var(--cf-card)',
                    fontSize: 12, fontWeight: 800, marginTop: 1,
                  }}>{i + 1}</span>
                  <span style={{ fontSize: 14, lineHeight: 1.4, color: 'var(--cf-ink)', fontWeight: 600 }}>
                    {img.caption}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAmpliada(img)}
                  aria-label="Ver la captura grande"
                  style={{
                    display: 'block', width: '100%', padding: 0, borderRadius: 14,
                    overflow: 'hidden', cursor: 'zoom-in',
                    border: '1px solid var(--cf-border)', background: 'var(--cf-card)',
                  }}
                >
                  {/* 500×717 es el tamaño con que las saca el guión. Se declara
                      igual para que Next reserve el hueco exacto y la guía no
                      pegue un salto al cargar cada captura. */}
                  <Image src={img.src} alt={img.caption || ''} width={500} height={717}
                    className="w-full h-auto" />
                </button>
              </li>
            ))}
          </ol>
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
