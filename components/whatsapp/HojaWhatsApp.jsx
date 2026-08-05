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

import { useState, useMemo, useEffect } from 'react'
import { Plantillas } from '@/components/pantallas/Plantillas'
import { enlaceWhatsApp } from '@/lib/adaptadores/plantillas'
import {
  contextoMotor, plantillasDeFamilia, familiasConPlantillas, PLANTILLA_LIBRE, familiaDe,
} from '@/lib/adaptadores/plantillas-wa'
import { abrirWhatsApp } from '@/lib/whatsapp'
import PanelSecciones from '@/components/whatsapp/PanelSecciones'
import {
  PLANTILLAS as MOTOR, cargarConfigPlantillas, guardarConfigPlantillas,
  sincronizarPlantillasDesdeDB, generarTextoPlantilla,
} from '@/lib/whatsapp-plantillas'
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
  /* En qué familia abre. 'cobro' es lo normal —escribirle a quien debe—, pero
     cuando viene un pago la hoja es un RECIBO: abrir en «Cobro» le pediría la
     cuota a quien acaba de pagarla. */
  const [familia, setFamilia] = useState(pago ? 'pago' : 'cobro')
  const [elegida, setElegida] = useState(null)

  /* El `useState` de arriba solo lee su valor la PRIMERA vez, y la hoja se
     monta con la ficha —`open` decide si se ve, no si existe—: cuando el pago
     llega después, la familia ya se quedó en 'cobro'. Es exactamente lo que le
     pasó al mensaje de crédito aprobado, que abría con el recordatorio de
     pago. Con el efecto reacciona al cambio en vez de quedarse con lo que
     había al montarse. */
  useEffect(() => {
    if (pago) { setFamilia('pago'); setElegida(null) }
  }, [pago])
  /* ══ LA PLANTILLA PEDIDA POSICIONA LA HOJA, NO ABRE EL MODAL VIEJO ══
     `preselectedTemplateId` encendía el modo avanzado, o sea la pantalla que el
     dueño quiere retirar: «el modal anterior no debería de existir ya». Y lo
     hacía por un motivo entendible —la hoja no sabía abrirse en una plantilla
     concreta— que ya no se sostiene: `familiaDe` dice en qué pestaña vive, así
     que se abre ahí y con ella marcada.

     Es el caso de «crédito aprobado» al crear un préstamo, que es donde el
     dueño lo seguía viendo: «sigue saliendo el modal viejo».

     ⚠ VA EN UN EFECTO, no en el valor inicial de `useState`. La hoja se monta
     SIEMPRE con la ficha —`open` decide si se VE, no si existe—, así que el
     primer render ocurre con `preselectedTemplateId` en `null`. Al crear un
     préstamo la ficha lo pone DESPUÉS, y con `useState` se quedaba con lo que
     había al montarse: por eso el cliente veía «recordatorio de pago» donde
     esperaba «crédito aprobado». */
  useEffect(() => {
    if (!preselectedTemplateId) return
    const f = familiaDe(preselectedTemplateId)
    if (f) setFamilia(f)
    setElegida(preselectedTemplateId)
  }, [preselectedTemplateId])

  // El motor de siempre, a un toque. Ya no se abre de entrada por ningún
  // camino: se llega solo por «Editar las plantillas», que es su sitio.
  const [avanzado, setAvanzado] = useState(false)
  // Qué plantilla abrir en el panel completo. Al pulsar «Personalizar este
  // mensaje» se abre CON LA QUE SE ESTÁ MIRANDO, no en una lista donde hay que
  // volver a buscarla.
  const [paraEditar, setParaEditar] = useState(null)

  /* ══ LA PERSONALIZACIÓN, AQUÍ DENTRO ══
     «Personalizar este mensaje» mandaba al modal viejo. El dueño: «esa no es la
     idea; todas esas opciones deben estar en el nuevo modal, el viejo no
     debería existir ya». Así que el panel de secciones, el texto editable, el
     guardar y el copiar viven ahora en esta hoja. */
  const [personalizando, setPersonalizando] = useState(false)
  const [seccionesActivas, setSeccionesActivas] = useState(new Set())
  const [extras, setExtras] = useState([])
  const [textoEditado, setTextoEditado] = useState(null)   // null = sin tocar
  const [guardado, setGuardado] = useState(false)
  const [copiado, setCopiado] = useState(false)
  // La configuración guardada del dueño. Se sincroniza con la base al abrir:
  // sin esto, sus ajustes de otro dispositivo no se verían aquí.
  const [config, setConfig] = useState(() => cargarConfigPlantillas(organizationId))
  useEffect(() => {
    if (!open) return
    setConfig(cargarConfigPlantillas(organizationId))
    sincronizarPlantillasDesdeDB(organizationId).then(setConfig).catch(() => {})
  }, [open, organizationId])

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

  /* CUÁL SE ESTÁ MIRANDO DE VERDAD.
     `elegida` arranca en `null` y la hoja pinta como marcada la PRIMERA de la
     familia. Mirando solo `elegida`, al abrir no había plantilla del motor —y
     sin ella no salía el botón de personalizar—: la hoja enseñaba una marcada y
     por dentro creía que no había ninguna.

     ⚠ El id se saca de `plantillasDeFamilia`, NO de `lista`: `lista` ya usa el
     texto vivo, que sale de estas secciones. Derivarlo de ahí es un ciclo
     —`Cannot access before initialization`— y el build lo cazó al prerenderizar. */
  const idMirando = useMemo(() => {
    if (elegida) return elegida
    return plantillasDeFamilia(familiaViva, ctx, organizationId)[0]?.id ?? null
  }, [elegida, familiaViva, ctx, organizationId])

  const plantillaMotor = useMemo(
    () => MOTOR.find((t) => t.id === idMirando) ?? null, [idMirando])

  const secciones = useMemo(() => {
    if (!plantillaMotor?.getSecciones) return null
    try { return plantillaMotor.getSecciones(ctx) } catch { return null }
  }, [plantillaMotor, ctx])

  /* (nota original)
     `elegida` arranca en `null` y la hoja pinta como marcada la PRIMERA de la
     lista. Si aquí se mirara solo `elegida`, al abrir no habría plantilla del
     motor —y sin ella no salía el botón de personalizar—: la hoja enseñaba una
     marcada y por dentro creía que no había ninguna.
     Se calcula abajo, cuando `lista` ya existe. */



  /* Al cambiar de plantilla se cargan SUS secciones guardadas y se olvida lo
     editado a mano: el texto tecleado para «recordatorio» no tiene sentido
     dentro de «aviso de mora». */
  useEffect(() => {
    setTextoEditado(null)
    setGuardado(false)
    setCopiado(false)
    if (!plantillaMotor?.getSecciones) {
      setSeccionesActivas(new Set()); setExtras([]); return
    }
    const guardadas = config?.[plantillaMotor.id]
    if (guardadas && Array.isArray(guardadas.secciones)) {
      setSeccionesActivas(new Set(guardadas.secciones))
      setExtras(guardadas.extras || [])
      return
    }
    try {
      const secs = plantillaMotor.getSecciones(ctx)
      setSeccionesActivas(new Set(secs.filter((x) => x.default || x.locked).map((x) => x.key)))
    } catch { setSeccionesActivas(new Set()) }
    setExtras([])
  }, [plantillaMotor, ctx, config])

  /* El texto que se ve y se manda, con las secciones que estén encendidas.
     Se arma igual que en el modal de siempre para que los dos digan LO MISMO:
     si dijeran cosas distintas, el dueño no sabría cuál se envía. */
  const textoConSecciones = useMemo(() => {
    if (!plantillaMotor?.getSecciones) return null
    try {
      const secs = plantillaMotor.getSecciones(ctx)
      let t = secs.filter((x) => x.locked || seccionesActivas.has(x.key)).map((x) => x.texto).join('').trim()
      if (extras.length > 0) {
        const firma = orgNombre ? `_${orgNombre}_` : '_Control Finanzas_'
        const bloque = extras.map((e) => `${e.nombre}: ${e.valor}`).join('\n')
        const i = t.lastIndexOf(firma)
        // Los campos propios van ANTES de la firma, no detrás: la firma cierra
        // el mensaje y lo que va después parece añadido por error.
        t = i > 0 ? `${t.slice(0, i)}${bloque}\n\n${t.slice(i)}` : `${t}\n${bloque}`
      }
      return t
    } catch { return null }
  }, [plantillaMotor, ctx, seccionesActivas, extras, orgNombre])

  /* ⚠ `PanelSecciones` LLAMA CON LA CLAVE, no con el Set nuevo.
     Pasarle `setSeccionesActivas` directo guardaría la cadena «resumen» donde
     debe haber un Set: el estado quedaría roto EN SILENCIO —sin error, sin
     aviso— y a partir de ahí ninguna sección respondería. Se copia el
     manejador del modal de siempre. */
  const alternarSeccion = (clave) => {
    setSeccionesActivas((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(clave)) nuevo.delete(clave)
      else nuevo.add(clave)
      return nuevo
    })
    // Lo editado a mano se descarta al tocar una sección: si no, se apagaría el
    // resumen y el texto seguiría enseñándolo.
    setTextoEditado(null)
    setGuardado(false)
  }

  const guardarSecciones = () => {
    if (!plantillaMotor) return
    const nueva = { ...config, [plantillaMotor.id]: { secciones: [...seccionesActivas], extras } }
    guardarConfigPlantillas(organizationId, nueva)
    setConfig(nueva)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2500)
  }

  /* El texto tal cual lo genera la plantilla, sin pasar por las secciones.
     Para las 7 que no las tienen es el ÚNICO texto que existe, y sin él no hay
     nada que editar. Se saca de la lista sin el texto vivo —si lo mirara,
     dependería de sí mismo— y por eso se calcula aquí y no dentro de `lista`. */
  const textoDePlantilla = useMemo(() => {
    const p = plantillasDeFamilia(familiaViva, ctx, organizationId)
    return p.find((x) => x.id === idMirando)?.texto ?? null
  }, [familiaViva, ctx, organizationId, idMirando])

  const lista = useMemo(() => {
    const p = plantillasDeFamilia(familiaViva, ctx, organizationId)
    // La marcada se pinta con el texto VIVO: lo que sale de las secciones
    // encendidas, o lo que se haya escrito a mano encima. Si no, se apagaría
    // una sección y la burbuja seguiría enseñando el mensaje completo.
    const conVivo = p.map((x) => {
      if (x.id !== idMirando) return x
      const t = textoEditado ?? textoConSecciones
      if (t == null) return x
      return { ...x, texto: t, trozos: [{ texto: t, dato: false }] }
    })
    // «Mensaje libre» va siempre y al final: es la salida cuando ninguna
    // plantilla sirve, no una plantilla más.
    return [...conVivo, PLANTILLA_LIBRE]
  }, [familiaViva, ctx, organizationId, idMirando, textoEditado, textoConSecciones])



  if (!open) return null

  if (avanzado) {
    return (
      <ModalWhatsAppTemplates
        open
        onClose={() => { setAvanzado(false); setParaEditar(null); onClose?.() }}
        cliente={cliente}
        prestamo={prestamo}
        orgNombre={orgNombre}
        ocultarSaldo={ocultarSaldo}
        pago={pago}
        organizationId={organizationId}
        camposRecibo={camposRecibo}
        preselectedTemplateId={paraEditar ?? preselectedTemplateId}
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
      {/* ⚠ `w-full` SIN PREFIJO, o la hoja se encoge con su contenido.
          Estaba como `sm:w-full`: en escritorio bien, pero EN MÓVIL SIN ANCHO.
          Este div es hijo de un contenedor `flex-col`, así que su ancho lo
          decidía lo que hubiera dentro. Medido en el navegador: al elegir
          «mensaje libre» —una tarjeta corta— pasaba de 393px a 294 en móvil y
          de 424 a 293 en PC, recostándose a un lado. Reportado dos veces.
          (Lo atribuí antes al `box-sizing` del textarea y luego a la hoja. Las
          dos veces me equivoqué: la medida decía otra cosa y no la miré hasta
          recorrer la cadena de anchos entera desde el contenido hacia arriba.) */}
      <div
        className="relative flex w-full mt-auto max-h-[92vh]
                   sm:m-auto sm:max-w-[460px] sm:max-h-[86vh]
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
          // ══ LA PERSONALIZACIÓN, DENTRO ══
          personalizando={personalizando}
          // ⚠ NO se ata a que haya secciones. 7 de las 14 plantillas tienen
          // `getSecciones: null` a propósito —«visita» y «comprobante», las dos
          // de COBRO, son mensajes cortos sin partes que apagar—, y atarlo a
          // eso dejaba la familia que más se usa SIN forma de editar el texto:
          // se abría la hoja y no había «Personalizar» por ningún lado.
          // El editor de texto funciona siempre; el panel de secciones es lo
          // único que depende de que la plantilla las tenga.
          onPersonalizar={() => setPersonalizando((v) => !v)}
          panelSecciones={secciones && personalizando ? (
            <PanelSecciones
              secciones={secciones}
              activas={seccionesActivas}
              onChange={alternarSeccion}
              guardado={guardado}
              onGuardar={guardarSecciones}
              extras={extras}
              onExtrasChange={(nuevos) => { setExtras(nuevos); setTextoEditado(null); setGuardado(false) }}
            />
          ) : null}
          // ⚠ EL TERCER RESPALDO NO SOBRA: es el que salva a las 7 plantillas
          // sin secciones. `textoConSecciones` devuelve `null` cuando no hay
          // `getSecciones`, y con `textoEditable` nulo la tarjeta escondía la
          // burbuja SIN poner el editor en su sitio: se pulsaba «Personalizar»
          // y el mensaje DESAPARECÍA. El botón decía «Listo» sobre un hueco.
          // Lo enseñó la captura del espejo; ninguna medida lo vio.
          textoEditable={textoEditado ?? textoConSecciones ?? textoDePlantilla}
          onTextoEditable={setTextoEditado}
          copiado={copiado}
          onCopiar={() => {
            const t = textoEditado ?? textoConSecciones
            if (!t) return
            navigator.clipboard?.writeText(t).then(() => {
              setCopiado(true)
              setTimeout(() => setCopiado(false), 2000)
            }).catch(() => {})
          }}
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
