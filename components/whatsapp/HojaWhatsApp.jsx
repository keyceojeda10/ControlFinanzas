'use client'

// components/whatsapp/HojaWhatsApp.jsx — T11-01, montada.
//
// ══ POR QUÉ UN ENVOLTORIO Y NO UNA SUSTITUCIÓN ═════════════════════════════
//
// `ModalWhatsAppTemplates` (491 líneas) no es solo una pantalla: es un motor.
// Tiene 14 plantillas con secciones que se encienden y se apagan, campos extra
// que el dueño añade, y sincronización con la base a través de
// `/api/plantillas-wa`. Sustituirlo a secas por `Plantillas` habría tirado todo
// eso a la basura para ganar una burbuja bonita.
//
// Así que conviven, y cada uno hace lo que hace bien:
//
//   · `Plantillas` (T11-01) es LO QUE SE VE al pulsar WhatsApp. Cuatro familias
//     en el orden del día del cobrador, el mensaje entero en una burbuja igual
//     a la de WhatsApp, y lo que puso el sistema RESALTADO — que es donde hay
//     que mirar si el nombre sale mal o la cuota no cuadra.
//   · «Editar las plantillas» abre el modal de siempre, con sus 14 plantillas,
//     sus secciones y sus extras. No se pierde nada; queda a un toque.
//
// El defecto que arregla es el de la lámina, y es de producto: hoy se pulsa
// «enviar resumen» y se abre WhatsApp con un mensaje que el cobrador NO HA
// LEÍDO, en el chat de alguien que le debe plata.

import { useState, useMemo } from 'react'
import { Plantillas } from '@/components/pantallas/Plantillas'
import { enlaceWhatsApp } from '@/lib/adaptadores/plantillas'
import {
  contextoMotor, plantillasDeFamilia, familiasConPlantillas, PLANTILLA_LIBRE,
} from '@/lib/adaptadores/plantillas-wa'
import { abrirWhatsApp } from '@/lib/whatsapp'
import { formatMoney } from '@/lib/i18n'
import ModalWhatsAppTemplates from '@/components/ui/ModalWhatsAppTemplates'

const fecha = (d) => (d
  ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
  : null)

export default function HojaWhatsApp({
  open, onClose, cliente, prestamo, orgNombre, ocultarSaldo,
  pago, organizationId, camposRecibo, preselectedTemplateId,
  pais = 'CO',
}) {
  const [familia, setFamilia] = useState('cobro')
  const [elegida, setElegida] = useState(null)
  // El motor de siempre, a un toque.
  //
  // Y DE ENTRADA cuando se viene de registrar un pago. Ese camino
  // —`RegistrarPago`— trae el pago y los campos del recibo, y el modal viejo
  // abre la plantilla de confirmación con el detalle completo. Las cuatro
  // familias de T11-01 son para ESCRIBIRLE al cliente, no para acusar recibo:
  // mandarlo aquí seria cambiarle el mensaje al que acaba de pagar.
  const [avanzado, setAvanzado] = useState(Boolean(pago || preselectedTemplateId))

  /* ══ EL CONTENIDO SALE DEL MOTOR DE SIEMPRE ══
     Aquí se armaban unas plantillas nuevas, escritas de cero, de UNA LÍNEA:
     «Hola X, hoy vence tu cuota de $366.667. Puedes pagar en efectivo o por
     transferencia». Mientras, el motor de 14 plantillas —con secciones que se
     encienden y apagan, campos extra y la configuración que el dueño ya había
     dejado guardada— quedaba escondido detrás de un enlace de 12px.

     Reportado con las palabras de los clientes: «el modal nuevo está
     prácticamente inservible, son mensajes vacíos sin ninguna información».
     La misma plantilla en el motor trae saludo, la línea de pago CON FECHA, el
     resumen con saldo y cuotas pendientes, cierre y firma.

     Es el patrón que este proyecto ya tiene documentado: el rediseño pierde
     funciones en silencio. La hoja se queda —leer el mensaje antes de mandarlo
     es lo que aporta— pero el texto lo pone el motor. */
  const ctx = useMemo(
    () => contextoMotor({ cliente, prestamo, orgNombre, ocultarSaldo, pago, camposRecibo }),
    [cliente, prestamo, orgNombre, ocultarSaldo, pago, camposRecibo],
  )

  const familias = useMemo(() => familiasConPlantillas(ctx, organizationId), [ctx, organizationId])

  /* La familia que se enseña al abrir. `familia` arranca en 'cobro', pero a un
     cliente muy atrasado `aplica()` puede dejar esa familia sin ninguna
     plantilla: la hoja abriría en blanco justo en el caso en que más falta hace
     escribirle. Si la elegida no tiene nada, manda la primera que sí. */
  const familiaViva = familias.some((f) => f.id === familia)
    ? familia
    : (familias[0]?.id ?? familia)

  const lista = useMemo(() => {
    const p = plantillasDeFamilia(familiaViva, ctx, organizationId)
    // «Mensaje libre» va siempre y al final: es la salida cuando ninguna
    // plantilla sirve, no una plantilla más.
    return [...p, PLANTILLA_LIBRE]
  }, [familiaViva, ctx, organizationId])


  if (!open) return null

  if (avanzado) {
    return (
      <ModalWhatsAppTemplates
        open
        onClose={() => { setAvanzado(false); onClose?.() }}
        cliente={cliente}
        prestamo={prestamo}
        orgNombre={orgNombre}
        ocultarSaldo={ocultarSaldo}
        pago={pago}
        organizationId={organizationId}
        camposRecibo={camposRecibo}
        preselectedTemplateId={preselectedTemplateId}
      />
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', flexDirection: 'column' }}>
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0, border: 0, cursor: 'pointer',
          // GRIS Y CON DESENFOQUE, no un negro translúcido. La franja del nombre
          // va ENCIMA de este velo con tinta oscura —así lo dibuja la lámina— y
          // sobre un velo negro esa tinta no se lee. Con el negro al 50% se veía
          // el teléfono del cliente pisado por las tarjetas de debajo.
          background: 'rgba(122,124,132,.62)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      />
      {/* ══ EN PC ES UN MODAL, NO UNA HOJA PEGADA A LA ESQUINA ══
          Esto era `marginTop: auto` + `display: flex` y nada más: en un teléfono
          sale bien —hoja anclada abajo, a todo el ancho— pero en un monitor la
          hoja no tiene ancho propio, así que se encogía contra el borde
          IZQUIERDO. Reportado: «no sale como modal flotante, sale a un costado,
          en la esquina superior izquierda, y se ve bastante raro».

          Desde `sm:` se centra y se le da ancho de modal, como el resto de la
          app. En móvil no cambia nada: sigue siendo la hoja de la lámina. */}
      <div
        className="relative flex mt-auto max-h-[92vh]
                   sm:m-auto sm:w-full sm:max-w-[460px] sm:max-h-[86vh]
                   sm:rounded-[var(--cf-r-sheet)] sm:overflow-hidden"
      >
        <Plantillas
          cliente={cliente?.nombre ?? 'Cliente'}
          // LO QUE DEBE Y CUÁNTO LLEVA ATRASADO, que es lo que decide QUÉ
          // plantilla usar. El teléfono no: ya se sabe a quién se le escribe.
          detalle={[
            prestamo?.saldoPendiente > 0 ? `Debe ${formatMoney(Math.round(prestamo.saldoPendiente), pais)}` : null,
            prestamo?.diasMora > 0 ? `${prestamo.diasMora} días de atraso` : null,
          ].filter(Boolean).join(' · ') || (cliente?.telefono ?? null)}
          familias={familias}
          // `familiaViva`, no `familia`: si la elegida se quedó sin plantillas
          // se está pintando otra, y marcar la pestaña vacía diría que la lista
          // de abajo es suya.
          familia={familiaViva}
          onFamilia={(f) => { setFamilia(f); setElegida(null) }}
          plantillas={lista}
          elegida={elegida ?? lista[0]?.id}
          onElegir={setElegida}
          telefono={cliente?.telefono ?? null}
          onEditarPlantillas={() => setAvanzado(true)}
          onCerrar={onClose}
          onAbrir={({ texto }) => {
            const enlace = enlaceWhatsApp(cliente?.telefono, texto)
            if (!enlace) return
            abrirWhatsApp(enlace)
            onClose?.()
          }}
        />
      </div>
    </div>
  )
}
