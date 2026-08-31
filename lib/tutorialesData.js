// lib/tutorialesData.js — Datos de tutoriales organizados por categorías
//
// ══ ⚠ ESTE ARCHIVO SE REESCRIBIÓ ENTERO EL 8 DE AGOSTO DE 2026 ═════════════
//
// Lo que había estaba muerto de viejo, y de dos formas a la vez:
//
//  · LAS IMÁGENES eran las 18 capturas del 14 de marzo. El rediseño empezó en
//    julio: la del panel enseñaba tema oscuro, seis tarjetas de colores y la
//    barra vieja. Hoy esa pantalla es fondo claro, un panel negro de «Recaudado
//    hoy» y la pastilla con el botón flotante. No sobrevivía ni un elemento.
//
//  · EL TEXTO mandaba a sitios que ya no existen. Medido: 15 de los 29
//    tutoriales nombraban «Cartera activa», «Cuota diaria total», «el botón
//    verde Registrar pago», «la pestaña…». Ninguna de esas cosas está.
//
//  · LOS 13 VIDEOS de YouTube enseñaban esa misma interfaz. El bot ya tenía la
//    regla escrita de no mandárselos a nadie —«muestran una interfaz vieja»—
//    pero dentro de la app se seguían enseñando, y tres correos de cobro
//    incrustaban el del pago, que es el flujo que MÁS cambió (pasarela
//    integrada, julio). Fuera todos: el dueño lo pidió así, «hay que quitarlos
//    y reemplazarlos por imágenes».
//
// ── CÓMO SE MANTIENE ESTO VIVO ─────────────────────────────────────────────
//
// Las imágenes NO se vuelven a tomar a mano. `scripts/capturar-tutoriales.mjs`
// las rehace las 26 contra un negocio de mentira. Después de cada rediseño:
// se corre el guion y se cotejan estos textos con `.auditoria/rotulos.json`,
// que trae los rótulos REALES de cada pantalla.
//
// ⚠ Los nombres de botón de aquí abajo salieron de ese volcado, no de memoria.
// Escribirlos de cabeza es exactamente como se llegó a «toca Cartera activa».
//
// ── EL FORMATO ES DE WHATSAPP A PROPÓSITO ──────────────────────────────────
//
// El emoji y el *negrita* no son adorno de la interfaz: cada tutorial tiene un
// botón de copiar para que el prestamista se lo PEGUE a su cliente o a su
// cobrador por WhatsApp. Ahí `*así*` se ve en negrita. Por eso esto no cae bajo
// la regla de «nada de emojis en la interfaz».

// ── `accion`: DÓNDE TERMINA LA GUÍA ────────────────────────────────────────
//
// «Dentro de ese mismo modal, que esté la explicación y que al final lo mande a
// renovar el préstamo.» Es el id —o la lista de ids— de la acción registrada
// por la pantalla (`useRegistrarAcciones`), y lo resuelve `accionDeGuia` en
// `lib/tutoriales/guias.js`.
//
// Lista cuando la misma guía termina en sitios distintos según dónde estés: el
// cierre de caja acaba en `ruta-caja` desde una ruta y en `caja-ajuste` desde
// la caja. Gana la primera disponible.
//
// `destino` sigue siendo el respaldo: un enlace normal para cuando la guía se
// lee desde una pantalla que no tiene esa acción.

import { PASOS_GUIA } from '@/lib/tutoriales/pasos'

export const CATEGORIAS = [
  { id: 'inicio', label: 'Primeros pasos', color: '#22c55e' },
  { id: 'clientes', label: 'Clientes y préstamos', color: '#3b82f6' },
  { id: 'cobro', label: 'Cobro y rutas', color: '#f59e0b' },
  { id: 'admin', label: 'Administracion', color: '#8b5cf6' },
  { id: 'extras', label: 'Extras', color: '#ec4899' },
]

export const TUTORIALES = [
  // ════════════════════════════════════════════
  // PRIMEROS PASOS
  // ════════════════════════════════════════════
  {
    id: 'registrarse',
    keywords: ['registrarme', 'crear cuenta', 'abrir cuenta', 'empezar'],
    categoria: 'inicio',
    title: 'Cómo registrarse en la plataforma',
    images: PASOS_GUIA['registrarse'] ?? [],
    text: `📱 *Cómo registrarse en Control Finanzas*

1. Entra a *app.control-finanzas.com*
2. Toca *"Crear cuenta gratis"*, debajo del botón de entrar
3. Pon tu nombre, tu correo y una contraseña
4. Toca *"Continuar"*
5. Abre tu correo y confirma la cuenta con el enlace que te llegó

💡 Usa un correo que revises seguido: ahí llegan los avisos del sistema.`,
  },
  {
    id: 'verificar-correo',
    keywords: ['verificar correo', 'no me llega el correo', 'confirmar email'],
    categoria: 'inicio',
    title: 'Cómo verificar tu correo electrónico',
    images: PASOS_GUIA['verificar-correo'] ?? [],
    text: `📧 *Cómo verificar tu correo*

Mientras no lo confirmes, arriba del panel te sale una franja que dice *"Falta verificar tu correo"* con un botón *"Verificar"*.

1. Abre el correo que te mandamos al registrarte
2. Toca el enlace de confirmación
3. Si no llegó, revisa *correo no deseado* o *spam*
4. También puedes tocar *"Verificar"* en esa franja para que te lo mandemos otra vez

💡 Sin el correo confirmado no te llegan los avisos de cobro ni los de tu plan.`,
  },
  {
    id: 'login',
    keywords: ['entrar', 'iniciar sesion', 'no puedo entrar'],
    categoria: 'inicio',
    title: 'Cómo iniciar sesión',
    images: PASOS_GUIA['login'] ?? [],
    text: `🔐 *Cómo entrar a tu cuenta*

1. Entra a *app.control-finanzas.com*
2. Pon tu correo y tu contraseña
3. Toca *"Entrar"*

💡 La sesión queda guardada en ese teléfono: no tienes que entrar cada día.

⚠️ Si entras desde un teléfono prestado, sal desde tu foto arriba a la derecha → *"Cerrar sesión"*.`,
  },
  {
    id: 'password',
    keywords: ['contraseña', 'clave', 'olvide la clave', 'recuperar contraseña'],
    categoria: 'inicio',
    title: 'Cómo recuperar tu contraseña',
    images: PASOS_GUIA['password'] ?? [],
    text: `🔑 *Si se te olvidó la contraseña*

1. En la pantalla de entrada, toca *"La olvidé"*, al lado de la contraseña
2. Pon el correo con el que te registraste
3. Te llega un enlace — dura 1 hora
4. Ábrelo y escribe la contraseña nueva dos veces

💡 Si no llega en 5 minutos, mira en spam. El enlace solo sirve una vez.`,
  },
  {
    id: 'dashboard',
    keywords: ['panel', 'inicio', 'que significa cada numero'],
    categoria: 'inicio',
    title: 'Cómo usar el panel principal',
    images: PASOS_GUIA['dashboard'] ?? [],
    text: `📊 *Qué te dice el panel*

Arriba, el recuadro negro contesta la pregunta del día:

• *RECAUDADO HOY* — cuánto llevas, y al lado *"de $X que toca cobrar"*
• *COBRADOS* — cuántas visitas van de las de hoy
• *TE FALTAN* — la plata que queda por recoger
• La tira de abajo son los *últimos 7 días*: la rayita es lo que tocaba cada día

Más abajo:

• *EN CAJA* — la plata que tienes ahora mismo
• *EN MORA* — cuántos clientes están atrasados
• *NECESITA TU ATENCIÓN* — lo que no puede esperar

💡 Toca *"Ver todo lo demás"* para el resto de las cifras, y *"Preguntar a Lucas"* para pedirle cuentas al asistente en español.`,
  },

  // ════════════════════════════════════════════
  // CLIENTES Y PRÉSTAMOS
  // ════════════════════════════════════════════
  {
    id: 'crear-cliente',
    keywords: ['agregar cliente', 'nuevo cliente', 'meter un cliente'],
    destino: { texto: 'Crear un cliente', href: '/clientes/nuevo' },
    categoria: 'clientes',
    title: 'Cómo crear un cliente nuevo',
    images: PASOS_GUIA['crear-cliente'] ?? [],
    text: `👤 *Cómo crear un cliente*

1. Abre *Clientes* en la barra de abajo
2. Toca el botón *+* de abajo a la derecha
3. Llena lo que sepas:
   • *Nombre* — lo único obligatorio
   • Cédula, teléfono, dirección
   • *Ruta* — para que aparezca en el recorrido
4. Toca *"Guardar"*

💡 *La cédula no es obligatoria.* Si no la tienes a mano, déjala vacía y el sistema pone una temporal. La pones después.

💡 Puedes tomarle *foto* al cliente o buscarla en la *galería* desde el mismo formulario.`,
  },
  {
    id: 'editar-cliente',
    accion: 'cli-editar',
    keywords: ['editar cliente', 'corregir cliente', 'cambiar telefono'],
    categoria: 'clientes',
    title: 'Cómo editar un cliente',
    images: PASOS_GUIA['editar-cliente'] ?? [],
    text: `✏️ *Cómo cambiarle los datos a un cliente*

1. Abre *Clientes* y toca el que quieres
2. Toca *"Editar"*
3. Cambia lo que necesites y guarda

Desde esa misma ficha puedes además:

• *Fijar ubicación (GPS)* — para que el cobrador la encuentre
• *Reagendar visita* — mover el cobro de hoy a otro día
• *Tope de préstamo* — cuánto es lo máximo que le prestas
• *QR* — para cobrarle escaneando

💡 Cambiarle la *ruta* lo mueve de recorrido de una vez.`,
  },
  {
    id: 'eliminar-cliente',
    accion: 'cli-eliminar',
    keywords: ['borrar cliente', 'eliminar cliente', 'quitar cliente'],
    categoria: 'clientes',
    title: 'Cómo inactivar o eliminar un cliente',
    images: PASOS_GUIA['eliminar-cliente'] ?? [],
    text: `🗑️ *Inactivar o eliminar*

Abre el cliente y baja hasta el final de la ficha.

*INACTIVAR* — se sale de las listas y de la ruta, pero *se guarda todo su historial*. Es lo que se usa cuando dejó de pedir pero puede volver.

*ELIMINAR* — lo borra de verdad. Solo se puede si *no tiene préstamos*.

💡 Si tiene un préstamo abierto, primero cierra el préstamo (o muévelo a perdidos) y después decides qué hacer con el cliente.

⚠️ Eliminar no se puede deshacer. Ante la duda, *inactiva*.`,
  },
  {
    id: 'crear-prestamo',
    keywords: ['prestar', 'nuevo prestamo', 'hacer un credito', 'sin interes'],
    destino: { texto: 'Crear un préstamo', href: '/prestamos/nuevo' },
    categoria: 'clientes',
    title: 'Cómo crear un préstamo',
    images: PASOS_GUIA['crear-prestamo'] ?? [],
    text: `💰 *Cómo crear un préstamo*

Toca el botón *+* de la barra de abajo, o entra a *Préstamos → "Nuevo préstamo"*. Son 3 pasos:

*1. A quién.* Busca el cliente por nombre o cédula. Si es nuevo, créalo ahí mismo.

*2. Cuánto y cómo.*
   • *Monto* que le entregas
   • *Tasa de interés*
   • *Frecuencia*: diario, semanal, quincenal o mensual
   • *Plazo* — cuántas cuotas

*3. Revisa.* El sistema te muestra la cuota y el total a pagar antes de guardar.

💡 La cuenta la hace el sistema. Tú pones el monto y la tasa; la cuota sale sola.

💡 Si te presta plata un socio o sale de una cuenta distinta, escógela en el paso 2.`,
  },
  {
    id: 'registrar-pago',
    accion: 'prestamo-pagar',
    keywords: ['cobrar', 'registrar pago', 'me pago', 'abono'],
    destino: { texto: 'Ir a préstamos', href: '/prestamos' },
    categoria: 'clientes',
    title: 'Cómo registrar un pago',
    images: PASOS_GUIA['registrar-pago'] ?? [],
    text: `✅ *Cómo registrar un cobro*

*Lo más rápido* — desde *Cobrar hoy*: cada cliente trae su botón *"Cobrar"*. Un toque y listo.

*Desde el préstamo*: ábrelo y toca *"Pagar ahora"*, que ya trae la cuota puesta.

En los dos casos puedes:

• Cambiar el monto si pagó de más o de menos
• Elegir si fue *efectivo* o *transferencia* (y por cuál cuenta)
• Mandar el comprobante por *WhatsApp*

💡 El sistema descuenta solo y calcula lo que queda debiendo.

⚠️ ¿Pagó de más para bajar la deuda? Eso no es un cobro normal: mira *"Cómo hacer un abono a capital"*.`,
  },
  {
    id: 'abono-capital',
    accion: 'prestamo-abonos',
    keywords: ['abono a capital', 'abonar al capital', 'bajar la deuda'],
    categoria: 'clientes',
    title: 'Cómo hacer un abono a capital',
    images: PASOS_GUIA['abono-capital'] ?? [],
    text: `🏦 *Abono a capital*

Es cuando el cliente da plata *de más* para bajar la deuda, no para pagar la cuota del día.

1. Abre el préstamo
2. Toca *"Abonos"*
3. Pon el monto y guarda

*La diferencia importa:* un cobro normal se reparte primero al interés. Un abono a capital baja *el capital* directo, así que el cliente termina pagando menos interés.

💡 Después del abono, el sistema recalcula lo que falta.`,
  },
  {
    id: 'recargo-descuento',
    accion: ['prestamo-recargo', 'prestamo-descuento'],
    keywords: ['recargo', 'multa', 'descuento', 'rebaja', 'perdonar'],
    categoria: 'clientes',
    title: 'Cómo aplicar recargos y descuentos',
    images: PASOS_GUIA['recargo-descuento'] ?? [],
    text: `⚖️ *Recargo por mora y descuento*

1. Abre el préstamo
2. Toca *"Gestión"*
3. En *CAMBIA LO QUE SE COBRA*:
   • *Recargo por mora* — le sube lo que debe
   • *Descuento* — le baja lo que debe

💡 El recargo *sube el total a pagar*; no cambia el plazo ni la cuota. El cliente sigue pagando lo mismo cada vez, solo que por más tiempo.

💡 En esa misma hoja está *"Modificar el plazo"* si lo que quieres es darle más cuotas.`,
  },

  // ════════════════════════════════════════════
  // COBRO Y RUTAS
  // ════════════════════════════════════════════
  /* ══ LA GESTIÓN DEL PRÉSTAMO — LAS QUE NADIE ENCUENTRA ═══════════════════
   *
   * De las ~20 acciones del préstamo solo tres tenían guía. Estas cinco son las
   * que llegan por WhatsApp, y las cinco viven detrás del mismo chip.
   *
   * ⚠ UNA SOLA FOTO CADA UNA, Y A PROPÓSITO: la del menú «Gestión». Lo único
   * que hay que aprender es DÓNDE VIVEN; lo demás se hace, no se lee. Por eso
   * cada una acaba en `destino`, que lleva al sitio en vez de en otra foto.
   *
   * La regla, decidida con el dueño: si se puede hacer aquí, se hace; si hay
   * que ir a otro sitio, se lleva; la imagen es para lo que tiene que hacer
   * OTRO (el cobrador, a quien se le reenvía) o lo que no es la app. */
  {
    id: 'renovar-prestamo',
    accion: 'prestamo-renovar',
    categoria: 'clientes',
    title: 'Cómo renovarle el préstamo a un cliente',
    keywords: ['renovar', 'renovacion', 'volver a prestar', 'prestarle mas', 'refinanciar',
      'cartulina nueva', 'nuevo prestamo al mismo'],
    destino: { texto: 'Elegir el préstamo', href: '/prestamos' },
    images: PASOS_GUIA['renovar-prestamo'] ?? [],
    text: `🔄 *Renovarle el préstamo a un cliente*

Es prestarle otra vez cuando todavía debe. El préstamo viejo se cierra y el saldo pasa al nuevo.

*Cómo se hace:*
• Abre el préstamo del cliente
• Toca *"Gestión"* y luego *"Renovar el préstamo"*
• Escribe el *TOTAL del nuevo préstamo*, no lo que le vas a entregar

⚠️ El total INCLUYE lo que ya debe. Si debe $800.000 y quieres darle $500.000 más, el total es $1.300.000. La app te dice cuánto le entregas.

💡 Atajo: dentro del préstamo, escribe *"renovar"* en «¿Qué necesitas hacer aquí?» y se abre directo.`,
  },
  {
    id: 'cambiar-modo-cobro',
    accion: 'prestamo-cambiar-modo',
    categoria: 'clientes',
    title: 'Cómo cambiarle el modo de cobro a un préstamo',
    keywords: ['cambiar el modo', 'modo de interes', 'modo de cobro', 'modo banco',
      'interes sobre saldos', 'globo', 'solo interes', 'pasar a cuotas', 'ya no quiere globo'],
    destino: { texto: 'Elegir el préstamo', href: '/prestamos' },
    images: PASOS_GUIA['cambiar-modo-cobro'] ?? [],
    text: `🔀 *Cambiarle el modo de cobro a un préstamo*

Es para cuando el cliente cambia de forma de pagar. Por ejemplo: venía en *Globo* —pagando solo los intereses— y ahora quiere pagar cuota e interés a la vez, como en el banco.

*Cómo se hace:*
• Abre el préstamo y toca *"Gestión"*
• Toca *"Cambiar el modo de cobro"*. A la derecha te dice en cuál está hoy
• Elige el modo nuevo y confirma

⚠️ No se cambia encima del préstamo viejo: se cierra ése y se abre uno nuevo con *el mismo capital*. No sale ni entra un peso, y el préstamo anterior queda guardado con todos sus pagos, enlazado desde el nuevo.

💡 El porcentaje NO significa lo mismo en cada modo. La pantalla te dice, debajo de cada uno, si ese % es por mes, por cada cobro o de todo el préstamo. Míralo antes de confirmar.

💡 Atajo: dentro del préstamo, escribe *"modo banco"* o *"cambiar el modo"* en «¿Qué necesitas hacer aquí?» y se abre directo.`,
  },
  {
    id: 'gestionar-pagos',
    accion: 'prestamo-historial',
    categoria: 'cobro',
    title: 'Cómo ver, compartir o borrar un pago',
    keywords: ['historial', 'pagos hechos', 'compartir el recibo', 'mandar el recibo',
      'borrar un pago', 'anular pago', 'corregir la fecha de un pago', 'estado de cuenta',
      'quitar un pago mal hecho', 'recibo en imagen'],
    destino: { texto: 'Elegir el préstamo', href: '/prestamos' },
    images: PASOS_GUIA['gestionar-pagos'] ?? [],
    text: `🧾 *Ver, compartir o borrar un pago*

Todos los pagos de un préstamo están en un solo sitio, y desde ahí se corrige el que quedó mal.

*Cómo se hace:*
• Abre el préstamo y toca *"Pagos"*
• Cada pago trae sus botones: compartir, cambiar la fecha y borrarlo

*Compartir el recibo de un pago:*
• Toca *"Compartir"* en ese pago
• *"Mandar el recibo como imagen"* abre el compartir del teléfono: WhatsApp, Telegram, correo o guardarlo
• Si el cliente tiene número, también sale mandarlo directo por WhatsApp
• Y *"Imprimir"*, para el recibo en papel

*Si un pago quedó mal:*
• El botón del calendario cambia la fecha
• La papelera lo borra, y el saldo del préstamo se recalcula solo

⚠️ Borrar un pago devuelve la plata al saldo del cliente. Si el cobrador ya la entregó, el borrado le va a descuadrar la caja del día: revisa antes de borrar.

💡 Atajo: escribe *"compartir el recibo"* o *"borrar un pago"* en «¿Qué necesitas hacer aquí?».`,
  },
  {
    id: 'editar-prestamo',
    accion: 'prestamo-editar',
    categoria: 'clientes',
    title: 'Cómo corregir un préstamo mal registrado',
    keywords: ['editar', 'corregir', 'me equivoque', 'cambiar el monto', 'cambiar el interes',
      'esta mal el prestamo', 'puse mal la cifra', 'cambiar la fecha del prestamo',
      'cambiar el plazo', 'dia de cobro', 'proximo cobro', 'dias sin cobro'],
    destino: { texto: 'Elegir el préstamo', href: '/prestamos' },
    images: PASOS_GUIA['editar-prestamo'] ?? [],
    text: `✏️ *Corregir un préstamo mal registrado*

Si al crearlo pusiste una cifra equivocada, no hace falta borrarlo y volver a empezar.

*Cómo se hace:*
• Abre el préstamo y toca *"Gestión"*
• Toca *"Editar el préstamo"*
• Cambia lo que estaba mal y guarda

Las cuentas se rehacen solas: la cuota, el total a pagar y lo que le falta se recalculan con los datos nuevos.

⚠️ *Depende de si ya le cobraste.* Mientras el préstamo NO tenga cobros puedes cambiarlo todo. En cuanto hay uno, el monto y el interés quedan bloqueados y la pantalla te lo dice: cambiarlos recalcularía la deuda hacia atrás y la inflaría. La fecha de inicio sí se puede mover.

*En esa misma hoja de "Gestión" están, cada una en su fila:*
• *Modificar el plazo* — más tiempo o menos, para bajar o subir la cuota
• *Día de cobro* — cambiar de diario a semanal, o el día de la semana
• *Próximo cobro* — correr la fecha del siguiente cobro
• *Días sin cobro* — los domingos o festivos que no se cobran

*Si ya hay cobros y aun así hay que renegociar*, no es por aquí: en esa misma hoja de "Gestión" están *"Modificar el plazo"* (baja o sube la cuota), *"Descuento"* (perdonarle una parte) y *"Cambiar el modo de cobro"* (que pague de otra forma).

💡 Atajo: dentro del préstamo, escribe *"me equivoqué"* en «¿Qué necesitas hacer aquí?».`,
  },
  {
    id: 'eliminar-prestamo',
    accion: 'prestamo-eliminar',
    categoria: 'clientes',
    title: 'Cómo borrar un préstamo que nunca debió existir',
    keywords: ['eliminar', 'borrar', 'borrar el prestamo', 'eliminar el prestamo',
      'quitar el prestamo', 'deshacer el prestamo', 'que no aparezca', 'sacarlo de la lista',
      'me equivoque al crearlo', 'prestamo repetido'],
    destino: { texto: 'Elegir el préstamo', href: '/prestamos' },
    images: PASOS_GUIA['eliminar-prestamo'] ?? [],
    text: `🗑️ *Borrar un préstamo que nunca debió existir*

Es para el préstamo que se creó por error: el repetido, o el que quedó con una cifra imposible. No es para el cliente que no pagó.

*Cómo se hace:*
• Abre el préstamo y toca *"Gestión"*
• Abajo del todo, en rojo, *"Eliminar el préstamo"*
• La pantalla te dice qué se lleva por delante antes de confirmar

⚠️ *Borrar no es esconder.* Desaparece del cliente y de los informes, se borran también sus cobros, y no se puede deshacer.

*Y la plata:* si el préstamo salió HOY, el capital vuelve a como estaba. Si salió otro día, ese día ya se cuadró y el capital no sube: si el cliente devolvió el dinero, regístralo como un cobro antes de quitarlo. La pantalla te lo avisa cuando es el caso.

*Cuándo NO borrar:*
• El cliente no va a pagar → *"Mover a perdidos"*
• Se acordó no cobrarlo pero quieres el rastro → *"Cancelar el préstamo"*
• Solo un cobro quedó mal → bórralo desde *"Pagos"*, no el préstamo entero

💡 Atajo: escribe *"borrar el préstamo"* en «¿Qué necesitas hacer aquí?».`,
  },
  {
    id: 'cancelar-prestamo',
    accion: 'prestamo-cancelar',
    categoria: 'clientes',
    title: 'Cómo cancelar un préstamo mal hecho',
    /* ⚠ «BORRAR» Y «ELIMINAR» SE FUERON DE AQUÍ, igual que ya se habían ido de
       `SINONIMOS_GESTION`. Estaban en esta guía de cuando eliminar no tenía la
       suya, y son OTRA cosa: cancelar deja el préstamo a la vista con sus
       cobros; eliminar lo quita y devuelve la caja. Con las dos aquí, quien
       escribía «borrar el préstamo» aterrizaba en cancelar — que es el caso de
       soporte que ya costó una vez. «Me equivoqué» tampoco: eso es corregir. */
    keywords: ['cancelar', 'anular prestamo', 'deshacer', 'nunca se le presto',
      'dejarlo sin efecto', 'dejarlo en nada'],
    destino: { texto: 'Elegir el préstamo', href: '/prestamos' },
    images: PASOS_GUIA['cancelar-prestamo'] ?? [],
    text: `🚫 *Cancelar un préstamo*

Es para el préstamo que NUNCA debió existir: te equivocaste al crearlo, o el cliente no recibió la plata.

*Cómo se hace:*
• Abre el préstamo
• Toca *"Gestión"* y baja hasta *"Cancelar el préstamo"*
• Elige si el capital vuelve a tu caja o no

⚠️ NO es lo mismo que dar por perdido. Cancelar dice "esto nunca pasó"; perdido dice "se prestó y no me pagaron". Si ya te pagó algo, no canceles: eso borra un movimiento que sí ocurrió.

💡 Solo el dueño puede cancelar.`,
  },
  {
    id: 'cerrar-anticipado',
    accion: 'prestamo-anticipado',
    categoria: 'clientes',
    title: 'Cómo cerrar un préstamo si paga todo hoy',
    keywords: ['cerrar anticipado', 'liquidar', 'pagar todo', 'saldar', 'cuanto para salir',
      'si paga todo hoy', 'cancelar la deuda'],
    destino: { texto: 'Elegir el préstamo', href: '/prestamos' },
    images: PASOS_GUIA['cerrar-anticipado'] ?? [],
    text: `✅ *Cerrar un préstamo antes de tiempo*

Cuando el cliente quiere salir de la deuda de una vez. La app calcula cuánto es y le perdona el interés que aún no se ha causado.

*Cómo se hace:*
• Abre el préstamo
• Toca *"Gestión"* → *"Cerrar anticipado"*
• Ahí sale el monto exacto; si lo paga, el préstamo queda completado

💡 La cifra ya viene calculada: no la saques a mano.`,
  },
  {
    id: 'modificar-plazo',
    accion: 'prestamo-plazo',
    categoria: 'clientes',
    title: 'Cómo bajarle la cuota o darle más tiempo',
    keywords: ['plazo', 'mas tiempo', 'alargar', 'bajar la cuota', 'cambiar la cuota',
      'mas cuotas', 'no me puede pagar tanto'],
    destino: { texto: 'Elegir el préstamo', href: '/prestamos' },
    images: PASOS_GUIA['modificar-plazo'] ?? [],
    text: `📅 *Darle más tiempo o bajarle la cuota*

Cuando el cliente no puede con la cuota, alargar el plazo suele recuperar más plata que ponerle un recargo.

*Cómo se hace:*
• Abre el préstamo
• Toca *"Gestión"* → *"Modificar el plazo"*
• Sube los días o las cuotas: la cuota baja sola

⚠️ Esto NO cambia lo que te debe en total. Cambia en cuántas veces te lo paga.

💡 Si lleva más de 15 días sin pagar, la app misma te sugiere esto antes que el recargo.`,
  },
  {
    id: 'dar-por-perdido',
    accion: ['prestamo-perdidos', 'prestamo-recuperar'],
    categoria: 'clientes',
    title: 'Cómo dar un préstamo por perdido (clavo)',
    keywords: ['clavo', 'perdido', 'incobrable', 'no me va a pagar', 'castigar',
      'dar de baja', 'sacar de perdidos'],
    destino: { texto: 'Ver los perdidos', href: '/clavos' },
    images: PASOS_GUIA['dar-por-perdido'] ?? [],
    text: `💀 *Dar un préstamo por perdido*

Es reconocer que esa plata no vuelve. El préstamo deja de contar en tus números del día y no te ensucia la mora.

*Cómo se hace:*
• Abre el préstamo
• Toca *"Gestión"* → *"Mover a perdidos"*

*Si después paga:* entra normal y cuenta como recuperación. Y puedes sacarlo de perdidos desde el mismo sitio.

⚠️ No es cancelar. Aquí la plata SÍ salió: por eso sigue restando de tu capital.`,
  },
  {
    id: 'crear-ruta',
    keywords: ['crear ruta', 'nueva ruta', 'armar ruta'],
    destino: { texto: 'Ir a Rutas', href: '/rutas' },
    categoria: 'cobro',
    title: 'Cómo crear una ruta',
    images: PASOS_GUIA['crear-ruta'] ?? [],
    text: `🗺️ *Cómo crear una ruta*

1. Abre *Rutas* en la barra de abajo
2. Toca el botón *+* de arriba a la derecha
3. Ponle nombre (el barrio o el sector: *Bolivariana*, *Ruta sur*)
4. Asígnale un cobrador — o déjala sin asignar y lo haces después con *"Asignar"*
5. Guarda

💡 Una ruta sin cobrador sale marcada en la lista para que no se te pase.

💡 El orden de las rutas lo cambias con *"Ordenar"*.`,
  },
  {
    id: 'enrutar-desenrutar',
    accion: ['ruta-agregar', 'ruta-quitar'],
    keywords: ['enrutar', 'desenrutar', 'meter cliente a una ruta', 'sacar de la ruta', 'cambiar de ruta'],
    destino: { texto: 'Ir a Rutas', href: '/rutas' },
    categoria: 'cobro',
    title: 'Cómo meter y sacar clientes de una ruta',
    images: PASOS_GUIA['enrutar-desenrutar'] ?? [],
    text: `📍 *Meter y sacar clientes de una ruta*

*Para meter:* abre la ruta y toca *"Agregar cliente"*. Sale la lista y escoges.

*Para sacar:* en la ficha del cliente, *"Editar"* → cambia la ruta o déjala vacía.

💡 Un cliente está en *una sola* ruta a la vez. Cambiarle la ruta lo mueve; no hay que sacarlo primero.

💡 Desde la ruta también puedes *"Imprimir hoja"* y llevar el recorrido en papel.`,
  },
  {
    id: 'reordenar-ruta',
    accion: 'ruta-ordenar',
    keywords: ['ordenar la ruta', 'cambiar el orden', 'reordenar'],
    destino: { texto: 'Ir a Rutas', href: '/rutas' },
    categoria: 'cobro',
    title: 'Cómo cambiar el orden del recorrido',
    images: PASOS_GUIA['reordenar-ruta'] ?? [],
    text: `🔀 *Cómo poner los clientes en el orden en que los visitas*

1. Abre la ruta
2. Toca *"Reordenar recorrido"*
3. Arrastra cada cliente a su puesto
4. Guarda

💡 En el teléfono también puedes *dejar el dedo apretado* sobre una tarjeta y moverla, sin entrar a reordenar.

💡 Ese orden es el que ve el cobrador cuando toca *"Empezar recorrido"*: ponlos como quedan de camino, no por orden alfabético.`,
  },
  {
    id: 'recorrer-ruta',
    accion: 'ruta-empezar',
    keywords: ['recorrido', 'empezar ruta', 'salir a cobrar'],
    destino: { texto: 'Ir a Cobrar hoy', href: '/cobros-hoy' },
    categoria: 'cobro',
    title: 'Cómo recorrer una ruta de cobro',
    images: PASOS_GUIA['recorrer-ruta'] ?? [],
    text: `🚶 *El día de cobro*

1. Abre *Cobrar hoy* en la barra de abajo — ahí está todo lo del día, de todas las rutas
2. O entra a la ruta y toca *"Empezar recorrido"* para ir en orden
3. En cada cliente toca *"Cobrar"*
4. Al final del día, *"Registrar cierre"*

Cada renglón te dice el número de la lista, la cuota de hoy, el atraso y lo que debe.

💡 Con *"Filtros"* dejas ver solo los que faltan, o solo los que están en mora.

💡 Si no vas a pasar por alguien, *reagenda la visita* desde su ficha en vez de dejarlo sin cobrar.`,
  },
  {
    id: 'crear-cobrador',
    accion: 'cob-nuevo',
    keywords: ['crear cobrador', 'agregar cobrador', 'meter un empleado'],
    destino: { texto: 'Ir a Cobradores', href: '/cobradores' },
    categoria: 'cobro',
    title: 'Cómo crear un cobrador',
    images: PASOS_GUIA['crear-cobrador'] ?? [],
    text: `👥 *Cómo darle acceso a un cobrador*

1. Toca *"Más"* en la barra de abajo y entra a *Cobradores*
2. Toca *"Crear cobrador"*
3. Pon nombre, correo y una contraseña
4. Márcale los permisos (mira el tutorial de permisos)
5. Guarda y pásale el correo y la clave

💡 El cobrador entra por la misma dirección que tú, con su propio usuario.

💡 En *"Ver el ranking"* comparas cuánto recogió cada uno.`,
  },
  {
    id: 'permisos-cobrador',
    accion: 'cobr-editar',
    keywords: ['permisos', 'restringir', 'que no vea', 'limitar al cobrador', 'que no pueda borrar'],
    destino: { texto: 'Ir a Cobradores', href: '/cobradores' },
    categoria: 'cobro',
    title: 'Cómo configurar los permisos de un cobrador',
    images: PASOS_GUIA['permisos-cobrador'] ?? [],
    text: `🔒 *Qué puede y qué no puede hacer un cobrador*

Entra a *Cobradores*, abre el cobrador y mira sus permisos. Los enciendes y apagas uno por uno:

• Crear clientes
• Crear préstamos
• Editar clientes
• Aplicar descuentos y liquidaciones
• Ver el saldo de la caja
• Registrar gastos
• Gestionar rutas

💡 Lo normal es dejarle *cobrar* y poco más: sin descuentos y sin ver el saldo de la caja.

💡 Los cambios entran cuando el cobrador vuelva a abrir la app.`,
  },

  // ════════════════════════════════════════════
  // ADMINISTRACIÓN
  // ════════════════════════════════════════════
  {
    id: 'cierre-caja',
    accion: ['ruta-caja', 'caja-ajuste'],
    keywords: ['cierre de caja', 'cuadrar', 'cerrar el dia', 'cuadre'],
    destino: { texto: 'Ir a Caja', href: '/caja' },
    categoria: 'admin',
    title: 'Cómo hacer el cierre de caja',
    images: PASOS_GUIA['cierre-caja'] ?? [],
    text: `🧾 *El cierre del día*

Abre *Caja* (está en *"Más"*). El día se lee de arriba abajo:

• *Con lo que amaneciste*
• *Lo que entró* — los cobros
• *Lo que prestaste* — los desembolsos
• *Gastos*
• Y abajo, lo que *debería* haber

Al terminar el recorrido toca *"Cerrar el día"*, cuenta la plata y escribe lo que hay de verdad. Si no cuadra, el sistema te dice de cuánto es la diferencia.

💡 *"Registrar gasto"* es para la gasolina, el almuerzo, lo que salga.

💡 En *"Historial de cierres"* quedan todos los días anteriores.`,
  },
  {
    id: 'capital',
    accion: ['capital-inicial', 'capital-meter'],
    keywords: ['capital', 'meter plata', 'sacar plata', 'cuanto tengo'],
    destino: { texto: 'Ir a Capital', href: '/capital' },
    categoria: 'admin',
    title: 'Cómo usar el control de Capital',
    images: PASOS_GUIA['capital'] ?? [],
    text: `💵 *Capital: cuánta plata tienes puesta*

Entra por *"Más" → Mi plata → Capital*.

Si es la primera vez, toca *"Registrar capital inicial"* y pon con cuánta plata arrancaste. Sin eso, el sistema no sabe de dónde salió lo que prestaste y el saldo sale en negativo.

Después:

• *"Registrar movimiento"* — cuando metes o sacas plata del negocio
• *"Cuadrar el saldo"* — cuando lo que dice el sistema no es lo que tienes

💡 El capital *no es* la caja. La caja es la plata de hoy; el capital es todo lo que tienes puesto en el negocio, incluida la que está en la calle.`,
  },
  {
    id: 'socios',
    accion: 'soc-nuevo',
    keywords: ['socio', 'socios', 'repartir ganancias'],
    destino: { texto: 'Ir a Socios', href: '/socios' },
    categoria: 'admin',
    title: 'Cómo manejar socios e inversionistas',
    images: PASOS_GUIA['socios'] ?? [],
    text: `🤝 *Socios*

Entra por *"Más" → Socios* y toca *"Registrar el primero"*.

De cada socio guardas cuánto puso y qué porcentaje le toca. El sistema reparte la ganancia por ese porcentaje.

💡 Sirve para saber *de quién es* la plata que está en la calle y cuánto le corresponde a cada uno, sin sacar la cuenta a mano.`,
  },
  {
    id: 'medios-pago',
    accion: 'caja-cuentas',
    keywords: ['nequi', 'transferencia', 'medios de pago', 'cuentas'],
    categoria: 'admin',
    title: 'Cómo ver la plata por cuenta (efectivo, Nequi…)',
    images: PASOS_GUIA['medios-pago'] ?? [],
    text: `🏧 *En qué cuenta está tu plata*

Abre *Caja* y toca *"Cuentas"*. Ahí ves cuánto tienes en efectivo y cuánto en cada cuenta (Nequi, Daviplata, el banco).

Para que eso cuadre, al registrar un cobro elige si fue *efectivo* o *transferencia*, y por cuál cuenta entró.

💡 Los desembolsos y los gastos se cuentan como efectivo salvo que digas otra cosa.

💡 *"Por ruta"* te separa la caja de cada cobrador.`,
  },
  {
    id: 'reportes',
    keywords: ['reportes', 'informe', 'descargar pdf', 'excel'],
    destino: { texto: 'Ir a Reportes', href: '/reportes' },
    categoria: 'admin',
    title: 'Cómo ver los reportes',
    images: PASOS_GUIA['reportes'] ?? [],
    text: `📈 *Reportes*

Entra por *"Más" → Reportes*. Arriba escoges el periodo: *Hoy*, *Últimos 7d*, *Últimos 30d*, *Este mes*.

Ahí ves lo recaudado, lo prestado, los gastos y la ganancia del periodo.

💡 *Ganancia no es lo recaudado.* La ganancia es el interés cobrado menos los gastos: la plata que te devuelven de lo que prestaste no es ganancia, es tu misma plata volviendo.

💡 Con *"Imprimir"* sacas el reporte en papel o en PDF.`,
  },
  {
    id: 'plan',
    keywords: ['plan', 'pagar la suscripcion', 'cambiar de plan', 'precio'],
    destino: { texto: 'Ver los planes', href: '/configuracion/plan' },
    categoria: 'admin',
    title: 'Cómo pagar o cambiar tu plan',
    images: PASOS_GUIA['plan'] ?? [],
    text: `💳 *Cómo pagar tu plan*

1. Entra a *Configuración → Plan y pagos*
2. Toca *"Cambiar de plan"*, o *"Cambiar de plan"* si quieres otro
3. Paga con *PSE, tarjeta o Nequi* — sin salir de la app
4. El plan queda activo enseguida

En esa pantalla ves también cuánto llevas usado: clientes, usuarios y rutas de los que trae tu plan.

💡 Si te pasas del tope de clientes, el sistema te avisa antes de bloquear nada.`,
  },
  {
    id: 'configuracion',
    keywords: ['configuracion', 'ajustes', 'cambiar el nombre del negocio'],
    destino: { texto: 'Ir a Configuración', href: '/configuracion' },
    categoria: 'admin',
    title: 'Cómo configurar tu negocio',
    images: PASOS_GUIA['configuracion'] ?? [],
    text: `⚙️ *Configuración*

Entra por *"Más" → Configuración*. Está partida por temas:

• *Tu negocio* — nombre, país y moneda
• *Cómo prestas* — tu tasa, tu frecuencia y los días que no cobras. Esto es lo que sale puesto por defecto en cada préstamo nuevo
• *Plan y pagos*
• *Portal del cliente*
• *Avisos por WhatsApp*
• *Seguridad* y *Tus datos*

💡 Dejar bien *"Cómo prestas"* te ahorra tocarlo en cada préstamo.`,
  },
  {
    id: 'soporte',
    keywords: ['soporte', 'ayuda', 'hablar con alguien', 'reportar un problema'],
    destino: { texto: 'Escribir a soporte', href: '/soporte/nuevo' },
    categoria: 'admin',
    title: 'Cómo pedir ayuda',
    images: PASOS_GUIA['soporte'] ?? [],
    text: `🎫 *Cómo pedirnos ayuda*

1. Entra por *"Más" → Soporte*
2. Toca el botón para crear uno nuevo
3. Escoge el *tipo de solicitud*
4. Pon el asunto y cuéntanos qué pasa
5. Puedes adjuntar hasta *3 capturas de pantalla*
6. Si quieres que te llamemos, marca *"Nuevo ticket"*
7. Toca *"Enviar ticket"*

💡 La captura de pantalla es lo que más rápido nos deja ver el problema.`,
  },

  // ════════════════════════════════════════════
  // EXTRAS
  // ════════════════════════════════════════════
  {
    id: 'offline',
    /* ⚠ «cobrar sin internet» ENTERO, no solo «sin internet». Al añadir la
       guía de cambiar el modo de COBRO, la frase «como cobro sin internet» se
       la llevaba ella: comparten la palabra «cobro» y el emparejador puntúa por
       proporción de palabras acertadas. La frase como se pregunta desempata. */
    keywords: ['instalar', 'instalar aplicacion', 'descargar app', 'sin internet', 'offline',
      'sin señal', 'poner en el celular', 'cobrar sin internet', 'cobro sin internet',
      'cobrar sin señal'],
    categoria: 'extras',
    title: 'Cómo instalar la app y cobrar sin internet',
    images: PASOS_GUIA['offline'] ?? [],
    text: `📲 *Instalar la app y trabajar sin señal*

*Para instalarla:*
• En Android: abre la página en Chrome y acepta *"Instalar app"*, o entra al menú del navegador → *"Agregar a pantalla de inicio"*
• En iPhone: en Safari, el botón de compartir → *"Agregar a inicio"*

*Sin señal:* puedes seguir cobrando. Los cobros se guardan en el teléfono y suben solos cuando vuelva el internet. Arriba te sale un aviso de que estás sin conexión.

💡 Instalada abre más rápido y no se pierde entre las pestañas del navegador.

⚠️ No cierres la app hasta que se haya sincronizado, o los cobros se quedan esperando en ese teléfono.`,
  },
  {
    id: 'referidos',
    keywords: ['referidos', 'invitar', 'meses gratis'],
    destino: { texto: 'Ir a Referidos', href: '/configuracion?tab=referidos' },
    categoria: 'extras',
    title: 'Cómo invitar personas y ganar meses gratis',
    images: PASOS_GUIA['referidos'] ?? [],
    text: `🎁 *Referidos*

1. Entra a *Configuración* y busca *Referidos*
2. Ahí está tu enlace — cópialo
3. Mándaselo a otro prestamista por WhatsApp
4. Cuando esa persona pague su primer plan, te ganas tiempo gratis

💡 Puedes invitar a los que quieras: no hay tope.

💡 En esa misma pantalla ves quiénes se registraron con tu enlace y quiénes ya pagaron.`,
  },
  {
    id: 'portal-cliente',
    accion: 'cli-qr',
    keywords: ['portal', 'que el cliente vea', 'link para el cliente'],
    categoria: 'extras',
    title: 'Portal del cliente: que vea sus pagos desde el celular',
    images: PASOS_GUIA['portal-cliente'] ?? [],
    text: `🔗 *El portal del cliente*

Tu cliente puede ver su propio préstamo desde su teléfono, sin llamarte.

1. Abre el cliente
2. Toca *"Activar portal"*
3. Se le arma un PIN — pásaselo junto con el enlace

Él entra con su *número de teléfono* y ese PIN, y ve:

• Cuánto debe
• Cuándo es el próximo pago
• Todo lo que ha pagado

💡 Solo ve *lo suyo*. No ve nada de tu negocio ni de los demás clientes.

💡 Lo apagas cuando quieras desde la misma ficha.`,
  },
]
