// scripts/pasos-tutoriales.mjs — QUÉ se fotografía de cada guía, paso a paso.
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El dueño, viendo una guía en el modal nuevo:
//
//   «la mayoría solo tienen una imagen, cuando se supone que es un paso a paso,
//    son varias imágenes y tienen que ir subrayadas y señaladas todos los clics
//    en las opciones que tiene que ir presionando el usuario.»
//
// Medido: **28 de las 34 guías tenían UNA sola imagen**, y casi ninguna con
// señalamiento. Una foto de la pantalla no es un paso a paso — enseña dónde
// acabas, no por dónde pasas.
//
// ── LA REGLA DE UN PASO ────────────────────────────────────────────────────
//
// Un paso = una pantalla + EL CLIC QUE HAY QUE DAR, señalado. Si un paso no
// tiene nada que señalar, o no es un paso o le sobra la foto.
//
// ── ⚠ LOS RÓTULOS NO SE ESCRIBEN DE MEMORIA ────────────────────────────────
//
// Salen de `.auditoria/rotulos.json`, que los vuelca de las pantallas de
// verdad. Escribirlos de cabeza es exactamente como se llegó a «toca Cartera
// activa», un botón que llevaba meses sin existir en 15 de los 29 tutoriales.
//
// ── CAMPOS ─────────────────────────────────────────────────────────────────
//
//   pie       lo que se lee debajo de la captura. Es LA INSTRUCCIÓN del paso.
//   en        'prestamo' | 'cliente' | 'ruta' | una dirección literal
//   sinSesion la pantalla se ve sin haber entrado (login, registro…)
//   toques    botones que hay que pulsar ANTES de disparar, en orden. Se
//             emparejan por «empieza por», que aguanta que el botón lleve una
//             cifra pegada («Empezar recorrido · 4»).
//   senal     qué rodear: `rotulo` (texto del botón) o `selector`, más el
//             `texto` de la etiqueta. El número lo pone el guion: es el del
//             paso, y así la foto y el pie dicen lo mismo.

export const PASOS = [
  /* ── PRIMEROS PASOS ─────────────────────────────────────────────────── */
  { id: 'registrarse', pasos: [
    { pie: 'En la pantalla de entrada, toca «Crear cuenta gratis»', en: '/login', sinSesion: true,
      senal: { rotulo: 'Crear cuenta gratis', texto: 'Empieza por aquí' } },
    { pie: 'Pon tu nombre, tu correo y una contraseña, y toca «Continuar»', en: '/registro', sinSesion: true,
      senal: { rotulo: 'Continuar', texto: 'Con esto queda creada' } },
  ] },

  { id: 'verificar-correo', pasos: [
    { pie: 'Abre el correo que te mandamos y copia el código de 6 dígitos', en: '/verificar-email', sinSesion: true,
      senal: { selector: 'input[placeholder*="dígitos"]', texto: 'El código llega a tu correo' } },
    { pie: 'Toca «Verificar» y tu cuenta queda lista', en: '/verificar-email', sinSesion: true,
      senal: { rotulo: 'Verificar', texto: 'Y ya puedes entrar' } },
  ] },

  { id: 'login', pasos: [
    { pie: 'Escribe el correo con el que te registraste y tu contraseña', en: '/login', sinSesion: true,
      senal: { selector: 'input[placeholder*="correo"]', texto: 'Tu correo' } },
    { pie: 'Toca «Entrar». Si es tu teléfono, deja marcado que te recuerde', en: '/login', sinSesion: true,
      senal: { rotulo: 'Entrar', texto: 'Entra al panel' } },
  ] },

  { id: 'password', pasos: [
    { pie: 'En la entrada, toca «La olvidé»', en: '/login', sinSesion: true,
      senal: { rotulo: 'La olvidé', texto: 'Está junto a la contraseña' } },
    { pie: 'Pon tu correo y toca «Enviar enlace». Te llega un correo para cambiarla',
      en: '/forgot-password', sinSesion: true,
      senal: { rotulo: 'Enviar enlace', texto: 'Revisa también el correo no deseado' } },
  ] },

  { id: 'dashboard', pasos: [
    /* Sin señalamiento a propósito: el paso es MIRAR el panel, no tocar nada.
       Un aro sobre un botón cualquiera solo para tener aro es ruido. */
    { pie: 'Arriba, el panel negro: lo recaudado hoy y lo que falta por cobrar', en: '/dashboard' },
    { pie: 'Abajo, «Ver todo lo demás» abre el resto de herramientas', en: '/dashboard',
      senal: { rotulo: 'Ver todo lo demás', texto: 'Capital, gastos, reportes, socios…' } },
  ] },

  /* ── CLIENTES Y PRÉSTAMOS ───────────────────────────────────────────── */
  { id: 'crear-cliente', pasos: [
    /* ⚠ En el teléfono NO hay un botón que diga «Nuevo cliente»: es el «+»
       flotante de abajo a la derecha. Señalar el rótulo de escritorio mandaba
       a buscar algo que en el móvil no existe. */
    { pie: 'En «Clientes», toca el botón + de abajo', en: '/clientes',
      senal: { rotulo: 'Crear', texto: 'Aquí se crea todo', desde: 'arriba' } },
    { pie: 'Puedes escribirlo a mano o tomarle foto a la hoja del cuaderno',
      en: '/clientes/nuevo', senal: { rotulo: 'Crear manual', texto: 'Empieza por aquí' } },
    { pie: 'Nombre y teléfono son lo único obligatorio', en: '/clientes/nuevo',
      toques: ['Crear manual'], senal: { selector: 'input', texto: 'El nombre va primero' } },
  ] },

  { id: 'editar-cliente', pasos: [
    { pie: 'Abre el cliente y busca «Editar»', en: 'cliente',
      senal: { rotulo: 'Editar', texto: 'Nombre, cédula, teléfono, dirección' } },
    { pie: 'Cambia lo que necesites y guarda. Los préstamos no se tocan',
      en: 'cliente', toques: ['Editar'] },
  ] },

  { id: 'eliminar-cliente', pasos: [
    { pie: '«Inactivar» lo esconde de las listas, pero no borra nada', en: 'cliente',
      senal: { rotulo: 'Inactivar', texto: 'Dejar de cobrarle sin perder su historia' } },
    { pie: '«Eliminar» sí lo borra, y solo se puede si no tiene préstamos', en: 'cliente',
      senal: { rotulo: 'Eliminar', texto: 'Esto no se deshace' } },
  ] },

  { id: 'crear-prestamo', pasos: [
    { pie: 'En «Préstamos», toca el botón + de abajo', en: '/prestamos',
      senal: { rotulo: 'Crear', texto: 'Prestarle a alguien', desde: 'arriba' } },
    { pie: 'Primero eliges a quién le prestas', en: '/prestamos/nuevo',
      senal: { rotulo: 'Continuar', texto: 'Elige el cliente y sigue' } },
    { pie: 'Después el monto, el interés y cada cuánto le cobras', en: '/prestamos/nuevo',
      /* ⚠ POR NOMBRE, NO POR INICIAL. Decía `toques: ['A']` —la letra del avatar
         del primer cliente de la vitrina vieja— y con la vitrina rehecha no hay
         ninguno que empiece por A en esa lista, así que el paso se quedaba sin
         captura. Steven Olmos es el cliente de la vitrina; la ficha del selector
         empieza por la letra del avatar, de ahí la S pegada. */
      toques: ['SSteven Olmos'], senal: { rotulo: 'Continuar', texto: 'La app calcula la cuota sola' } },
  ] },

  { id: 'registrar-pago', pasos: [
    { pie: 'Abre el préstamo. El botón grande ya trae la cuota de hoy', en: 'prestamo',
      senal: { rotulo: 'Pagar ahora', texto: 'Lo que toca cobrar hoy' } },
    { pie: 'Confirma el monto y en qué te pagó, y listo', en: 'prestamo',
      toques: ['Pagar ahora'] },
  ] },

  { id: 'abono-capital', pasos: [
    { pie: 'En el préstamo, toca «Abonos»', en: 'prestamo',
      senal: { rotulo: 'Abonos', texto: 'Los atajos de cobro' } },
    { pie: 'Ahí está el abono a capital: baja la deuda, no la cuota', en: 'prestamo',
      toques: ['Abonos'] },
  ] },

  { id: 'recargo-descuento', pasos: [
    { pie: 'En el préstamo, toca «Gestión»', en: 'prestamo',
      senal: { rotulo: 'Gestión', texto: 'Aquí está todo lo que cambia el préstamo' } },
    { pie: 'Arriba del todo: «Recargo por mora» y «Descuento»', en: 'prestamo',
      toques: ['Gestión'], senal: { rotulo: 'Recargo por mora', texto: 'El recargo sube la deuda' } },
    { pie: 'Escribe cuánto y por qué. Queda anotado en el historial', en: 'prestamo',
      toques: ['Gestión', 'Recargo por mora'] },
  ] },

  { id: 'renovar-prestamo', pasos: [
    { pie: 'Abre el préstamo del cliente y toca «Gestión»', en: 'prestamo',
      senal: { rotulo: 'Gestión', texto: 'Renovar vive aquí dentro' } },
    { pie: 'Busca «Renovar el préstamo»', en: 'prestamo',
      toques: ['Gestión'], senal: { rotulo: 'Renovar el préstamo', texto: 'Cierra el viejo y abre uno nuevo' } },
    { pie: 'Escribe el TOTAL del nuevo préstamo, no lo que le vas a entregar',
      en: 'prestamo', toques: ['Gestión', 'Renovar el préstamo'] },
  ] },

  /* ── LAS DOS DEL 31 AGO 2026 ──────────────────────────────────────────
     Funciones nuevas de ese día. El dueño: «si hay que crear los pequeños
     tutoriales que van ligados a esas funciones, como son nuevas, hay que
     hacerlas». Sin guía, una función nueva solo la usa quien ya sabe que
     existe. */
  { id: 'cambiar-modo-cobro', pasos: [
    { pie: 'Abre el préstamo del cliente y toca «Gestión»', en: 'prestamo',
      senal: { rotulo: 'Gestión', texto: 'El modo de cobro se cambia aquí dentro' } },
    { pie: 'Busca «Cambiar el modo de cobro». A la derecha dice en cuál está hoy', en: 'prestamo',
      toques: ['Gestión'], senal: { rotulo: 'Cambiar el modo de cobro', texto: 'Dice el modo de ahora' } },
    { pie: 'El capital pasa solo. Elige el modo nuevo y confirma: no sale ni entra dinero',
      en: 'prestamo', toques: ['Gestión', 'Cambiar el modo de cobro'] },
  ] },

  { id: 'gestionar-pagos', pasos: [
    { pie: 'Dentro del préstamo, toca «Pagos»', en: 'prestamo',
      senal: { rotulo: 'Pagos', texto: 'Ver, compartir, corregir o borrar' } },
    { pie: 'Cada pago trae sus botones: compartir, cambiar la fecha y borrarlo', en: 'prestamo',
      toques: ['Pagos'], senal: { rotulo: 'Compartir', texto: 'Manda el recibo de ESE pago' } },
    { pie: 'En «Compartir» sale mandar el recibo como imagen, por WhatsApp o imprimirlo',
      en: 'prestamo', toques: ['Pagos', 'Compartir'] },
  ] },

  { id: 'cancelar-prestamo', pasos: [
    { pie: 'Abre el préstamo y toca «Gestión»', en: 'prestamo',
      senal: { rotulo: 'Gestión', texto: 'Al final de la lista' } },
    { pie: '«Cancelar el préstamo» está abajo, en rojo', en: 'prestamo',
      toques: ['Gestión'], senal: { rotulo: 'Cancelar el préstamo', texto: 'Es para el que nunca debió existir' } },
    { pie: 'Confirma. El préstamo desaparece con todos sus pagos', en: 'prestamo',
      toques: ['Gestión', 'Cancelar el préstamo'] },
  ] },

  { id: 'cerrar-anticipado', pasos: [
    { pie: 'Abre el préstamo y toca «Gestión»', en: 'prestamo',
      senal: { rotulo: 'Gestión', texto: 'El cierre anticipado está dentro' } },
    { pie: '«Cerrar anticipado» te dice cuánto le queda si paga todo hoy', en: 'prestamo',
      toques: ['Gestión'], senal: { rotulo: 'Cerrar anticipado', texto: 'Le perdona el interés que falta' } },
    { pie: 'Revisa la cifra y confirma', en: 'prestamo',
      toques: ['Gestión', 'Cerrar anticipado'] },
  ] },

  { id: 'modificar-plazo', pasos: [
    { pie: 'Abre el préstamo y toca «Gestión»', en: 'prestamo',
      senal: { rotulo: 'Gestión', texto: 'El plazo se cambia aquí' } },
    { pie: 'Toca «Modificar el plazo»', en: 'prestamo',
      toques: ['Gestión'], senal: { rotulo: 'Modificar el plazo', texto: 'Más tiempo = cuota más baja' } },
    { pie: 'Sube las cuotas y la cuota baja sola. La deuda no cambia', en: 'prestamo',
      toques: ['Gestión', 'Modificar el plazo'] },
  ] },

  { id: 'dar-por-perdido', pasos: [
    { pie: 'Abre el préstamo y toca «Gestión»', en: 'prestamo',
      senal: { rotulo: 'Gestión', texto: 'Lo de dar por perdido está aquí' } },
    { pie: 'Toca «Mover a perdidos»', en: 'prestamo',
      toques: ['Gestión'], senal: { rotulo: 'Mover a perdidos', texto: 'Sale de la cartera, no de la app' } },
    { pie: 'Si vuelve a pagar, desde el mismo menú lo sacas de perdidos', en: 'prestamo',
      toques: ['Gestión', 'Mover a perdidos'] },
  ] },

  /* ── COBRO Y RUTAS ──────────────────────────────────────────────────── */
  { id: 'crear-ruta', pasos: [
    /* ⚠ LA GUÍA ENTERA VA EN LA VITRINA DE CERO, que es su contexto: explica
       cómo crear una ruta, y en la llena ya hay una. El rótulo también cambia
       con el estado —«Crear primera ruta» cuando no hay ninguna— y el paso 2
       fallaba buscando «Nueva ruta», que solo existe cuando ya tienes rutas. */
    { pie: 'Entra a «Rutas» y toca el botón de ruta nueva', en: '/rutas', vitrina: 'vacia',
      senal: { rotulo: 'Crear primera ruta', texto: 'Una ruta es un cobrador y su recorrido' } },
    { pie: 'Ponle nombre, elige quién la cobra y qué clientes lleva',
      en: '/rutas', vitrina: 'vacia', toques: ['Crear primera ruta'] },
  ] },

  { id: 'enrutar-desenrutar', pasos: [
    /* ⚠ En el teléfono el botón dice «+ Agregar», no «Agregar cliente»: ése es
       el de escritorio y va oculto. Los rótulos se cotejan con lo que SE VE. */
    { pie: 'Abre la ruta y toca «+ Agregar»', en: 'ruta',
      senal: { rotulo: '+ Agregar', texto: 'Mete clientes a esta ruta' } },
    { pie: 'Marca los que quieras. Si ya están en otra ruta, la app te avisa',
      en: 'ruta', toques: ['+ Agregar'] },
  ] },

  { id: 'reordenar-ruta', pasos: [
    { pie: 'Dentro de la ruta, toca «Ordenar»', en: 'ruta',
      senal: { rotulo: 'Ordenar', texto: 'El orden del recorrido' } },
    { pie: 'Arrastra las paradas. Así es como te salen los cobros cada día',
      en: 'ruta', toques: ['Ordenar'] },
  ] },

  { id: 'recorrer-ruta', pasos: [
    { pie: 'Abre la ruta y toca «Empezar recorrido»', en: 'ruta',
      senal: { rotulo: 'Empezar recorrido', texto: 'Te lleva de una casa a la siguiente' } },
    { pie: 'Cada parada lleva su cuota, su atraso y el botón de cobrar', en: 'ruta',
      senal: { rotulo: 'Cobrar', texto: 'También puedes cobrar desde la lista' } },
    { pie: 'Al terminar, «Registrar cierre» cuadra lo que entregas', en: 'ruta',
      senal: { rotulo: 'Registrar cierre', texto: 'El cierre del día' } },
  ] },

  { id: 'crear-cobrador', pasos: [
    { pie: 'Entra a «Cobradores» y toca «Crear cobrador»', en: '/cobradores',
      senal: { rotulo: 'Crear cobrador', texto: 'Le creas usuario y clave' } },
    { pie: 'Con esos datos entra él desde su propio teléfono', en: '/cobradores/nuevo' },
  ] },

  { id: 'permisos-cobrador', pasos: [
    { pie: 'Entra a «Cobradores» y abre el suyo', en: '/cobradores',
      senal: { rotulo: 'Ver el ranking', texto: 'Y aquí comparas cómo van' } },
    { pie: 'En su ficha decides qué puede ver y qué puede hacer', en: 'cobrador' },
  ] },

  { id: 'cierre-caja', pasos: [
    { pie: 'Entra a «Caja». Arriba está el día de hoy', en: '/caja',
      senal: { rotulo: 'Registrar gasto', texto: 'Los gastos también salen de aquí' } },
    { pie: 'Al terminar el día, «Cerrar el día» cuadra lo que hay en efectivo',
      en: '/caja', senal: { rotulo: 'Cerrar el día', texto: 'Compara lo esperado con lo real' } },
    { pie: 'Si algo no cuadra, «Ajustar saldo» deja la diferencia anotada',
      en: '/caja', senal: { rotulo: 'Ajustar saldo', texto: 'Con su motivo' } },
  ] },

  /* ── ADMINISTRACIÓN ─────────────────────────────────────────────────── */
  { id: 'capital', pasos: [
    { pie: 'Entra a «Mi plata». Es el fondo del que sale todo', en: '/capital',
      senal: { rotulo: 'Registrar movimiento', texto: 'Meter o sacar plata' } },
    /* ⚠ ESTE PASO VA EN LA VITRINA DE CERO. «Registrar capital inicial» solo
       sale cuando el capital NO está configurado, y en cuanto hay un préstamo
       el desembolso ya lo configura: en la vitrina llena ese botón no existe y
       el paso se quedaba sin captura. Es exactamente la pantalla de primera
       vez que la guía quiere enseñar. */
    { pie: 'Si es la primera vez, registra el capital con el que arrancaste',
      en: '/capital', vitrina: 'vacia',
      senal: { rotulo: 'Registrar capital inicial', texto: 'Sin esto el saldo sale negativo' } },
  ] },

  { id: 'socios', pasos: [
    { pie: 'Entra a «Socios». Aquí va quién más pone plata', en: '/socios',
      senal: { rotulo: 'Registrar el primero', texto: 'Empieza por uno' } },
    { pie: 'A cada socio le anotas lo que mete y lo que le devuelves', en: '/socios/nuevo' },
  ] },

  { id: 'medios-pago', pasos: [
    { pie: 'En «Caja», la pestaña «Cuentas»', en: '/caja',
      senal: { rotulo: 'Cuentas', texto: 'Efectivo, Nequi, banco…' } },
    { pie: 'Te dice cuánta plata hay en cada sitio', en: '/caja', toques: ['Cuentas'] },
  ] },

  { id: 'reportes', pasos: [
    { pie: 'Entra a «Reportes» y elige el periodo', en: '/reportes',
      senal: { rotulo: 'Este mes', texto: 'Hoy, este mes, 7 o 30 días' } },
    { pie: '«Imprimir» te lo saca en PDF para guardarlo o mandarlo', en: '/reportes',
      senal: { rotulo: 'Imprimir', texto: 'Se guarda como PDF' } },
  ] },

  { id: 'plan', pasos: [
    { pie: 'En «Configuración», entra a «Plan y pagos»', en: '/configuracion',
      senal: { rotulo: 'Plan y pagos', texto: 'Tu plan y tus facturas' } },
    { pie: '«Cambiar de plan» te muestra los planes y lo que incluye cada uno',
      en: '/configuracion/plan', senal: { rotulo: 'Cambiar de plan', texto: 'Se paga con tarjeta o PSE' } },
  ] },

  { id: 'configuracion', pasos: [
    { pie: 'Entra a «Configuración». «Tu negocio» es el nombre y el país',
      en: '/configuracion', senal: { rotulo: 'Tu negocio', texto: 'Nombre, país y moneda' } },
    { pie: '«Cómo prestas» deja fijos el interés y la frecuencia que más usas',
      en: '/configuracion', senal: { rotulo: 'Cómo prestas', texto: 'Se aplica a cada préstamo nuevo' } },
  ] },

  { id: 'soporte', pasos: [
    { pie: 'Entra a «Soporte» y toca «Nuevo ticket»', en: '/soporte',
      senal: { rotulo: 'Nuevo ticket', texto: 'Te contestamos por aquí' } },
    { pie: 'Cuenta qué pasó y adjunta capturas: se resuelve mucho más rápido',
      en: '/soporte/nuevo', senal: { rotulo: 'Enviar ticket', texto: 'Hasta 3 capturas' } },
  ] },

  /* ── EXTRAS ─────────────────────────────────────────────────────────── */
  { id: 'offline', pasos: [
    { pie: 'Instalada se ve como una app más y abre mucho más rápido', en: '/dashboard' },
    { pie: 'Sin señal puedes seguir cobrando: se guarda y sube solo al volver',
      en: '/cobros-hoy', senal: { rotulo: 'Cobrar', texto: 'Funciona igual sin internet' } },
  ] },

  { id: 'referidos', pasos: [
    { pie: 'En «Más», al final, está tu enlace para invitar', en: '/mas',
      senal: { rotulo: 'Configuración', texto: 'Los referidos están en tu cuenta' } },
    { pie: 'Por cada persona que se quede pagando, ganas meses gratis',
      en: '/configuracion', senal: { rotulo: 'Tus datos', texto: 'Tu enlace vive aquí' } },
  ] },

  { id: 'portal-cliente', pasos: [
    { pie: 'Abre el cliente y toca «Activar portal»', en: 'cliente',
      senal: { rotulo: 'Activar portal', texto: 'Le das un PIN' } },
    { pie: 'Con su teléfono y ese PIN ve su deuda, sus pagos y lo que le falta',
      en: 'cliente', toques: ['Activar portal'] },
  ] },
]
