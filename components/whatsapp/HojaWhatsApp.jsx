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
import { FAMILIAS, PLANTILLAS, preparaPlantilla, enlaceWhatsApp } from '@/lib/adaptadores/plantillas'
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

  const datos = useMemo(() => ({
    nombre:   cliente?.nombre ?? null,
    negocio:  orgNombre ?? 'Control Finanzas',
    medio:    'transferencia',
    cuota:    prestamo?.cuotaDiaria > 0 ? formatMoney(Math.round(prestamo.cuotaDiaria), pais) : null,
    // `ocultarSaldo` es una preferencia del dueño y manda: hay quien no quiere
    // que el saldo viaje por WhatsApp.
    saldo:    !ocultarSaldo && prestamo?.saldoPendiente > 0
      ? formatMoney(Math.round(prestamo.saldoPendiente), pais) : null,
    atraso:   prestamo?.diasMora > 0
      ? `${prestamo.diasMora} ${prestamo.diasMora === 1 ? 'día' : 'días'} de atraso` : null,
    // `cuotasPagadas` no siempre viaja: la ruta manda el préstamo con
    // totalPagado y cuotaDiaria, y la ficha con el campo ya calculado. Si no
    // está, se deduce — sin esto la familia «Renovar» no se ofrecía nunca.
    cuotasPagadas: (() => {
      const n = prestamo?.cuotasPagadas ?? (prestamo?.cuotaDiaria > 0
        ? Math.floor((prestamo.totalPagado ?? 0) / prestamo.cuotaDiaria) : 0)
      return n > 0 ? `${n} ${n === 1 ? 'cuota pagada' : 'cuotas pagadas'}` : null
    })(),
    proximoCobro: fecha(prestamo?.proximoCobro),
    portal:   cliente?.portalActivo && cliente?.id ? `${window.location.origin}/portal` : null,
    // PENDIENTE: la familia «Acuerdo» necesita una fecha pactada que hoy no se
    // guarda en ningún sitio. Sin ella las dos plantillas salen con un hueco, y
    // por eso la familia no se ofrece — ver el filtro de abajo.
    fechaAcuerdo: null,
  }), [cliente, prestamo, orgNombre, ocultarSaldo, pais])

  const lista = useMemo(
    () => (PLANTILLAS[familia] ?? []).map((p) => preparaPlantilla(p, datos)),
    [familia, datos],
  )

  // Solo las familias que se pueden llenar. Una pestaña que al abrirse enseña
  // un mensaje con huecos es peor que una pestaña que no está.
  const familias = useMemo(() => FAMILIAS.filter((f) => {
    const hay = (PLANTILLAS[f.id] ?? []).filter((p) => !p.libre)
    return hay.some((p) => preparaPlantilla(p, datos)?.faltan.length === 0)
  }), [datos])

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
      <div style={{ position: 'relative', marginTop: 'auto', maxHeight: '92vh', display: 'flex' }}>
        <Plantillas
          cliente={cliente?.nombre ?? 'Cliente'}
          // LO QUE DEBE Y CUÁNTO LLEVA ATRASADO, que es lo que decide QUÉ
          // plantilla usar. El teléfono no: ya se sabe a quién se le escribe.
          detalle={[
            prestamo?.saldoPendiente > 0 ? `Debe ${formatMoney(Math.round(prestamo.saldoPendiente), pais)}` : null,
            prestamo?.diasMora > 0 ? `${prestamo.diasMora} días de atraso` : null,
          ].filter(Boolean).join(' · ') || (cliente?.telefono ?? null)}
          familias={familias}
          familia={familia}
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
