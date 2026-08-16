// lib/novedades.js — Registro de novedades del sistema ("Qué hay de nuevo").
//
// Cómo agregar una novedad nueva:
//  1. Sube NOVEDADES_VERSION en 1.
//  2. Agrega un objeto AL INICIO del array NOVEDADES con esa misma versión
//     y con la FECHA del día que se publica.
// El modal se le muestra UNA vez a cada usuario cuando la versión supera la
// última que vio (guardada en localStorage). No requiere backend.
//
// ══ UNA NOVEDAD CADUCA ══════════════════════════════════════════════════════
//
// Reportado por el dueño el 15 ago 2026:
//
//   «El último banner de novedades es de hace mucho tiempo y todavía sigue
//    saliendo como si fuera una novedad. Y eso lo que hace es estorbar. No es
//    una novedad, ya pasó hace mucho tiempo.»
//
// Tenía razón y la causa era que la condición NO MIRABA LA FECHA: bastaba con
// que la versión fuera mayor que la última vista. La del 18 de julio llevaba
// **un mes** abriéndose sola encima del panel a cualquiera que no la hubiera
// cerrado —y a todo el que se registrara desde entonces, para quien esa
// «novedad» era simplemente cómo es la app—.
//
// Se nota, además, en sitio ajeno: la hoja tapaba la pantalla en las capturas
// automáticas y había que cerrarla a mano en cada una.
//
// A partir de aquí una novedad solo se abre dentro de su ventana. Pasada, se
// marca como vista en silencio: ni se abre ahora ni se queda esperando para
// abrirse la semana que viene.
export const DIAS_QUE_DURA_UNA_NOVEDAD = 2

/* La fecha se lee con el convenio de la app —el día arranca a las 05:00Z, que
   es medianoche en Bogotá— para que no dependa del huso del teléfono. */
export function novedadVigente(entrada, ahora = new Date()) {
  if (!entrada?.fecha) return false          // sin fecha no se puede fechar: no se abre
  const publicada = new Date(`${entrada.fecha}T05:00:00.000Z`)
  if (isNaN(publicada.getTime())) return false
  const dias = (ahora - publicada) / 86400000
  // El futuro tampoco: una fecha adelantada por error la dejaría abierta días.
  return dias >= 0 && dias < DIAS_QUE_DURA_UNA_NOVEDAD
}

export const NOVEDADES_VERSION = 27

export const NOVEDADES = [
  {
    version: 27,
    fecha: '2026-07-18',
    titulo: 'Novedades',
    items: [
      {
        icon: 'link',
        titulo: 'Portal de clientes',
        texto: 'Tus clientes ahora pueden ver sus propios préstamos desde un enlace. Entran con su número de teléfono y un PIN que tú defines. Ven el próximo pago, el historial y el progreso del préstamo. Puedes activar o desactivar el acceso desde el perfil de cada cliente.',
      },
      {
        icon: 'chart',
        titulo: 'Analíticas de negocio',
        texto: 'Nuevo dashboard con métricas clave: ROI, ganancia neta, proyección de ingresos y alertas de mora con nombres. Incluye ranking de cobradores y un PDF descargable con todo el resumen.',
      },
      {
        icon: 'dollar',
        titulo: 'Reportes de rentabilidad',
        texto: 'Nuevo reporte que desglosa cuánto es interés y cuánto es capital en tu recaudo. Muestra la utilidad real por mes y el ROI por ruta para que sepas dónde rinde más tu plata.',
      },
      {
        icon: 'pen',
        titulo: 'Campos personalizables en recibos',
        texto: 'Configura qué campos aparecen en el comprobante de pago: cédula, teléfono, dirección, saldo pendiente y más. Puedes definir campos por defecto o personalizarlos por cliente.',
      },
      {
        icon: 'dollar',
        titulo: 'Pasarela de pago integrada',
        texto: 'Ahora puedes pagar tu suscripción directamente desde la app con PSE, tarjeta de crédito o Nequi. Sin salir de Control Finanzas.',
      },
      {
        icon: 'document',
        titulo: 'Listado de cobros en PDF',
        texto: 'Genera un PDF con el listado completo de cobros del día, con filtros por ruta, estado de cada cliente, cuota, saldo y datos de amortización. Ideal para imprimir y entregar al cobrador.',
      },
    ],
  },
  {
    version: 26,
    fecha: '2026-07-12',
    titulo: 'Novedades',
    items: [
      {
        icon: 'dollar',
        titulo: 'Medios de pago configurables',
        texto: 'Ahora puedes registrar cobros por Nequi, Daviplata, Bancolombia u otro medio de transferencia. Al cobrar, elige entre Efectivo o Transferencia y selecciona la plataforma. El sistema recuerda el ultimo metodo usado para ir mas rapido.',
      },
      {
        icon: 'chart',
        titulo: 'Desglose por metodo en Caja',
        texto: 'La Caja ahora muestra cuanto se recaudo en efectivo y cuanto por cada plataforma de transferencia. Asi puedes saber exactamente donde esta tu plata.',
      },
      {
        icon: 'sparkles',
        titulo: 'Configura tus medios de pago',
        texto: 'En Configuracion puedes agregar o eliminar los medios de transferencia disponibles para tu equipo. Por defecto vienen Nequi, Daviplata y Bancolombia, pero puedes personalizarlos.',
      },
    ],
  },
  {
    version: 25,
    fecha: '2026-07-11',
    titulo: 'Novedades',
    items: [
      {
        icon: 'document',
        titulo: 'Reporte del dia',
        texto: 'Genera un reporte completo del dia directamente desde Caja. Selecciona una ruta, varias o todas. Muestra recaudado, esperado, pagos, clientes que no pagaron y gastos. Puedes imprimirlo o compartirlo por WhatsApp. Disponible desde el plan Crecimiento.',
      },
      {
        icon: 'shield',
        titulo: 'Ocultar capital a cobradores',
        texto: 'Nuevo permiso por cobrador: si desactivas "Ver capital y cartera", el cobrador no puede ver el capital ni de su ruta ni de ninguna otra. Su caja, movimientos y cobros siguen funcionando normal. Configura desde Cobradores al editar cada uno.',
      },
      {
        icon: 'refresh',
        titulo: 'Reinicio de cuenta',
        texto: 'Borra todos los datos de tu cuenta y empieza de cero. Antes de reiniciar, el sistema descarga un backup completo en JSON por si necesitas recuperar algo. Requiere doble confirmacion. Lo encuentras en Configuracion.',
      },
      {
        icon: 'printer',
        titulo: 'Reportes rediseñados',
        texto: 'El Resumen PDF y la Hoja de Ruta imprimible ahora tienen un diseño mas profesional: tarjetas de resumen con bordes, tablas con filas alternadas, badges de eficiencia por cobrador y mejor espaciado para lectura en papel.',
      },
    ],
  },
  {
    version: 24,
    fecha: '2026-07-09',
    titulo: 'Novedades',
    items: [
      {
        icon: 'refresh',
        titulo: 'Modo decreciente dinámico',
        texto: 'Nuevo modo de interés que recalcula las cuotas futuras según lo que realmente pague el cliente. Si paga menos, el saldo sube y el interés futuro se ajusta. Si paga más, baja más rápido. Ideal para préstamos donde el cliente no siempre paga la cuota completa.',
      },
      {
        icon: 'shield',
        titulo: 'Permisos de visibilidad mejorados',
        texto: 'Los permisos "Ver saldo en caja" y "Ver capital de su ruta" ahora funcionan de forma independiente. Puedes controlar exactamente qué información financiera ve cada cobrador desde sus permisos individuales.',
      },
    ],
  },
  {
    version: 23,
    fecha: '2026-07-08',
    titulo: 'Novedades',
    items: [
      {
        icon: 'check',
        titulo: 'Aprobación de préstamos',
        texto: 'El administrador ahora puede exigir que cada préstamo del cobrador pase por su aprobación antes de desembolsarse. Activa la opción en Configuración y recibe una notificación push cada vez que un cobrador solicite un préstamo. Aprueba o rechaza con un toque.',
      },
      {
        icon: 'document',
        titulo: 'Pagaré digital en PDF',
        texto: 'Genera un pagaré legal con todos los datos del préstamo, cláusulas, tabla resumen y la firma del cliente. Descárgalo como PDF desde el detalle de cualquier préstamo que tenga firma digital.',
      },
      {
        icon: 'chart',
        titulo: 'Ranking de cobradores',
        texto: 'Nuevo scorecard que califica a cada cobrador en recaudo, puntualidad, mora y pruebas de visita. Ve quién rinde más y quién necesita atención. Disponible en Reportes para administradores.',
      },
      {
        icon: 'camera',
        titulo: 'Prueba digital de visita',
        texto: 'Los cobradores ahora pueden tomar una foto con GPS y hora exacta al visitar a cada cliente. El administrador ve las pruebas en el detalle del cobro y en el ranking. Ideal para verificar que la ruta se cumplió.',
      },
    ],
  },
  {
    version: 22,
    fecha: '2026-07-06',
    titulo: 'Novedades',
    items: [
      {
        icon: 'search',
        titulo: 'Buscador dentro de la ruta',
        texto: 'Ahora puedes buscar clientes por nombre o cédula directamente dentro de la ruta. Aparece automáticamente cuando tienes 6 o más clientes. Ideal para rutas largas.',
      },
      {
        icon: 'dollar',
        titulo: 'Préstamo rápido desde la ruta',
        texto: 'Los clientes que ya terminaron de pagar su préstamo ahora tienen un botón "Prestar" en su tarjeta dentro de la ruta. Te lleva directo al formulario con el cliente preseleccionado.',
      },
      {
        icon: 'calculator',
        titulo: 'Cuotas extra programadas',
        texto: 'Programa abonos extraordinarios en meses específicos al crear un préstamo. El sistema recalcula automáticamente la cuota regular para que el cliente pague menos cada mes. Funciona con todos los modos de interés.',
      },
      {
        icon: 'chart',
        titulo: 'Reporte mensual de cobros',
        texto: 'Nuevo reporte en la sección de Reportes que muestra todos los clientes y cuánto deben pagar en un mes dado, agrupados por ruta. Incluye vista imprimible. Disponible desde el plan Crecimiento.',
      },
    ],
  },
  {
    version: 21,
    fecha: '2026-07-05',
    titulo: 'Novedades',
    items: [
      {
        icon: 'location',
        titulo: 'GPS del cobrador en vivo',
        texto: 'Ahora puedes ver en tiempo real dónde está tu cobrador mientras hace la ruta. Entra a cualquier ruta con cobrador asignado y el mapa se abre automáticamente mostrando su ubicación con un punto dorado pulsante. Se actualiza cada 20 segundos.',
      },
      {
        icon: 'route',
        titulo: 'Recorrido del día',
        texto: 'Además de la ubicación en vivo, el mapa muestra el recorrido completo que ha hecho el cobrador durante el día como una línea dorada. Así puedes verificar que pasó por todos los puntos de la ruta.',
      },
      {
        icon: 'document',
        titulo: 'Resumen mensual en PDF',
        texto: 'Descarga un informe completo de tu negocio en PDF desde la sección de Reportes. Incluye recaudo, capital, mora, préstamos activos y detalle por cobrador. Ideal para tus registros o para compartir con socios.',
      },
    ],
  },
  {
    version: 20,
    fecha: '2026-07-03',
    titulo: 'Novedades',
    items: [
      {
        icon: 'calculator',
        titulo: 'Cuotas extra en préstamos globo',
        texto: 'Ahora puedes programar abonos a capital en cuotas específicas de un préstamo globo (por ejemplo, en los meses donde el cliente recibe primas, bonos o ingresos extra). Toca cualquier cuota intermedia en la tabla al crear el préstamo para agregar el monto. El interés de las cuotas siguientes baja automáticamente y el capital final se reduce.',
      },
      {
        icon: 'sparkles',
        titulo: 'Módulo de socios completo',
        texto: 'Registra socios que aportan capital a tu negocio. Cada aporte y retiro mueve la caja de capital automáticamente. Puedes ver el ROI, la liquidación por año y vincular préstamos a un socio específico desde el detalle del préstamo.',
      },
      {
        icon: 'pen',
        titulo: 'Indicador de préstamo perdido',
        texto: 'Los préstamos marcados como "clavo" ahora muestran una etiqueta "Perdido" en la lista de clientes, en la ruta y en cobros del día, para identificarlos rápidamente sin entrar al detalle.',
      },
      {
        icon: 'calculator',
        titulo: 'Corrección de capital adeudado',
        texto: 'El capital adeudado ahora se calcula correctamente en todos los casos, incluyendo préstamos con acuerdos de pago o tablas de amortización. También se corrigió un error de redondeo que podía mostrar $2 de más en el capital.',
      },
    ],
  },
  {
    version: 19,
    fecha: '2026-07-02',
    titulo: 'Novedades',
    items: [
      {
        icon: 'calculator',
        titulo: 'Intereses moratorios opcionales',
        texto: 'Ahora puedes configurar un interés por mora para los clientes que llevan varios días sin pagar. Ve a Configuración → Mi organización → "Intereses moratorios" y define la tasa mensual y los días de gracia. El sistema calcula el monto automáticamente, pero tú decides si aplicarlo o no desde el detalle de cada préstamo.',
      },
      {
        icon: 'sparkles',
        titulo: 'Cuotas correctas por tipo de préstamo',
        texto: 'Los cobros de ruta y cobros del día ahora muestran la cuota real de cada período para préstamos con tabla de amortización (lineal y globo), en lugar de la cuota fija. También se muestra el número de cuota y una alerta cuando toca la cuota globo (capital + interés).',
      },
      {
        icon: 'pen',
        titulo: 'Tabla de amortización interactiva',
        texto: 'La tabla de amortización ahora resalta la próxima cuota a pagar, muestra cuotas vencidas en rojo y permite registrar el pago directamente desde cada fila. Cada pago registrado queda vinculado al número de cuota que cubre.',
      },
    ],
  },
  {
    version: 18,
    fecha: '2026-07-01',
    titulo: 'Novedades',
    items: [
      {
        icon: 'pen',
        titulo: 'Cédula opcional al crear clientes',
        texto: 'Ahora puedes crear clientes sin número de cédula. Marca la casilla "No tengo la cédula" al crear un cliente o en el migrador express. Útil cuando estás migrando tu cartera y no tienes el documento a la mano. Puedes agregarlo después editando el cliente.',
      },
      {
        icon: 'calculator',
        titulo: 'Nuevo modo: Solo interés (globo)',
        texto: 'Nuevo modo de interés para préstamos donde el cliente paga solo el interés cada período y devuelve el capital completo al final en una sola cuota. Ideal para clientes que manejan flujo de caja propio. También permite abonos a capital en cualquier momento, lo que baja el interés de las cuotas futuras automáticamente.',
      },
    ],
  },
  {
    version: 16,
    fecha: '2026-06-30',
    titulo: 'Novedades',
    items: [
      {
        icon: 'pen',
        titulo: 'Resumen editable en el wizard',
        texto: 'Ahora puedes editar monto, tasa, frecuencia, plazo y modo de interés directamente desde el resumen del préstamo, sin tener que ir atrás en el wizard. Toca cualquier campo para cambiarlo y la cuota se recalcula al instante.',
      },
      {
        icon: 'sparkles',
        titulo: 'Migrador express más completo',
        texto: 'El migrador express ahora incluye el selector de días sin cobro (días de la semana en que no se cobra al cliente). Además, el resumen del migrador también es editable.',
      },
      {
        icon: 'calculator',
        titulo: 'Ver todos los clientes en ruta',
        texto: 'En "Trabajo del día" ahora hay un botón "Ver todos" que muestra todos los clientes en una lista plana, sin agrupar por estado. Así nadie queda escondido en secciones colapsadas.',
      },
      {
        icon: 'camera',
        titulo: 'Foto del cliente con cámara',
        texto: 'En Android, al subir la foto del cliente ahora aparecen ambas opciones: tomar foto con la cámara o elegir desde la galería.',
      },
      {
        icon: 'upload',
        titulo: 'Fotos ampliables',
        texto: 'Al tocar la foto de un cliente, ahora se abre en pantalla completa. Puedes ampliarla con doble toque o con pinch (pellizco con dos dedos) y moverte por la imagen.',
      },
    ],
  },
  {
    version: 15,
    fecha: '2026-06-30',
    titulo: 'Novedades',
    items: [
      {
        icon: 'sparkles',
        titulo: 'WhatsApp desde la ruta',
        texto: 'Ahora puedes enviar plantillas de WhatsApp directamente desde la ruta, sin entrar a la ficha del cliente. Toca el icono verde de WhatsApp en cada cliente para elegir la plantilla y enviar.',
      },
      {
        icon: 'pen',
        titulo: 'Cambiar fecha de próximo cobro',
        texto: 'Los administradores ahora pueden cambiar manualmente la fecha del próximo cobro de un préstamo desde el botón "Próximo cobro" en gestión del préstamo. Al registrar un pago, la fecha vuelve a calcularse automáticamente.',
      },
      {
        icon: 'calculator',
        titulo: 'Ruta sin perder la posición',
        texto: 'Al entrar a un cliente desde la ruta y volver, la pantalla se mantiene en la misma posición donde estabas. Ya no se sale de la ruta ni se pierde el orden.',
      },
    ],
  },
  {
    version: 14,
    fecha: '2026-06-29',
    titulo: 'Novedades',
    items: [
      {
        icon: 'sparkles',
        titulo: 'Líneas de crédito rotativas',
        texto: 'Nuevo producto: aprueba un cupo a tu cliente y él puede pedir plata varias veces sin crear un préstamo nuevo cada vez. Funciona como una tarjeta de crédito. Lo encuentras en el menú lateral como "Líneas de crédito".',
      },
      {
        icon: 'calculator',
        titulo: 'Cortes mensuales automáticos',
        texto: 'Cada mes puedes generar un estado de cuenta que suma lo que el cliente debe (capital + intereses) menos lo que ha pagado. El saldo pendiente rota al siguiente mes.',
      },
      {
        icon: 'pen',
        titulo: 'Tres modos de interés',
        texto: 'Configura cómo se calculan los intereses: tasa fija mensual, interés diario sobre lo que debe, o interés sobre todo lo usado en el mes. Cada línea puede tener su propia configuración.',
      },
    ],
  },
  {
    version: 13,
    fecha: '2026-06-29',
    titulo: 'Novedades',
    items: [
      {
        icon: 'pen',
        titulo: 'Cobros agrupados por ruta',
        texto: 'La pantalla de cobros del día ahora agrupa los clientes pendientes por ruta, con secciones que puedes colapsar. También muestra la dirección del cliente y cuánto debe para ponerse al día.',
      },
      {
        icon: 'sparkles',
        titulo: 'Método de pago con memoria',
        texto: 'Al cobrar, el sistema recuerda si pagaste en efectivo o transferencia la última vez y lo marca con "Último" para que cobres más rápido.',
      },
      {
        icon: 'calculator',
        titulo: 'Alertas de mora más visibles',
        texto: 'En el dashboard, las alertas de mora ahora aparecen antes de los últimos pagos para que lo primero que veas sea lo que necesita atención.',
      },
    ],
  },
  {
    version: 12,
    fecha: '2026-06-29',
    titulo: 'Novedades',
    items: [
      {
        icon: 'pen',
        titulo: 'Renovación más clara',
        texto: 'Al renovar un préstamo, ahora ves un resumen del préstamo actual (monto, cuota, saldo), el desglose de lo que se absorbe vs lo que se entrega en mano, y la comparación de cuota anterior vs nueva.',
      },
      {
        icon: 'sparkles',
        titulo: 'Editar préstamos sin límite',
        texto: 'Los administradores ahora pueden editar cualquier préstamo en cualquier momento. Los cobradores mantienen la restricción del mismo día.',
      },
      {
        icon: 'calculator',
        titulo: 'Wizard de préstamos mejorado',
        texto: 'El selector de tipo de interés ahora muestra una etiqueta "Recomendado" en el método clásico y el stepper muestra el nombre del paso actual (Monto, Cobro, Plazo...).',
      },
    ],
  },
  {
    version: 11,
    fecha: '2026-06-29',
    titulo: 'Novedades',
    items: [
      {
        icon: 'sparkles',
        titulo: 'Interfaz visual mejorada',
        texto: 'Las cards ahora tienen profundidad y sombras sutiles. Las listas de clientes, préstamos y cobros aparecen con animaciones escalonadas. Los modales entran con transiciones suaves.',
      },
      {
        icon: 'pen',
        titulo: 'Navegación más clara',
        texto: 'El sidebar ahora tiene un indicador animado que muestra la sección activa. El dashboard tiene un fondo decorativo sutil con gradientes de marca.',
      },
    ],
  },
  {
    version: 10,
    fecha: '2026-06-28',
    titulo: 'Novedades',
    items: [
      {
        icon: 'upload',
        titulo: 'Importar desde Excel recuperado',
        texto: 'Sube tu archivo Excel o CSV con todos tus clientes y préstamos de una vez. Descarga la plantilla, llena los datos y el sistema los importa validando errores antes de guardar.',
      },
      {
        icon: 'sparkles',
        titulo: 'Onboarding simplificado',
        texto: 'Los nuevos usuarios ahora ven 3 opciones claras al registrarse: importar desde Excel, migrador express con foto, o agregar uno por uno. Sin pasos innecesarios.',
      },
    ],
  },
  {
    version: 9,
    fecha: '2026-06-28',
    titulo: 'Novedades',
    items: [
      {
        icon: 'sparkles',
        titulo: 'Migrador express mejorado',
        texto: 'Nuevo flujo guiado: configura los valores por defecto (tasa, frecuencia, ruta) al inicio y luego agrega clientes uno a uno con foto o manual. Cada cliente se guarda al instante y puedes ver, editar o eliminar desde la lista.',
      },
      {
        icon: 'calculator',
        titulo: 'Resumen del préstamo en el momento justo',
        texto: 'La cuota y el total ya no aparecen antes de elegir el modo de interés. Ahora el resumen se muestra solo cuando tienes toda la información completa, evitando confusiones.',
      },
      {
        icon: 'pen',
        titulo: 'Mejor explicación en cada paso',
        texto: 'El wizard de préstamos y el migrador ahora explican cada campo con textos claros. Si un cliente tiene condiciones diferentes, puedes cambiarlas sin perder los valores base.',
      },
    ],
  },
  {
    version: 8,
    fecha: '2026-06-27',
    titulo: 'Novedades',
    items: [
      {
        icon: 'upload',
        titulo: 'Migrador express de cartera',
        texto: 'Sube toda tu cartera de clientes de una sola vez. Crea cliente + préstamo sin cambiar de página, uno tras otro. Lo encuentras en Clientes o en el menú lateral.',
      },
      {
        icon: 'camera',
        titulo: 'Importa desde cualquier foto',
        texto: 'Tómale foto a tu cuaderno, libreta, cartulina o cualquier anotación. El sistema detecta los datos automáticamente y te dice cuáles faltan para que los completes.',
      },
      {
        icon: 'sparkles',
        titulo: 'Nuevo onboarding para usuarios nuevos',
        texto: 'Los nuevos usuarios ahora ven 3 opciones para subir su cartera al registrarse: migrador express, foto o Excel. Más fácil empezar desde el primer día.',
      },
    ],
  },
  {
    version: 7,
    fecha: '2026-06-19',
    titulo: 'Novedades',
    items: [
      {
        icon: 'pen',
        titulo: 'Firma digital del cliente',
        texto: 'Ahora el cliente puede firmar con el dedo directamente en la pantalla al momento de recibir el préstamo. La firma queda guardada como imagen en el detalle del préstamo.',
      },
      {
        icon: 'calculator',
        titulo: 'Modo abreviado de montos',
        texto: 'Activa esta opción en Configuración para escribir montos sin los últimos tres ceros. Por ejemplo, escribe 100 y el sistema lo convierte en 100.000. Ideal para agilizar el ingreso de datos.',
      },
    ],
  },
  {
    version: 5,
    fecha: '2026-06-18',
    titulo: 'Novedades',
    items: [
      {
        icon: 'calendar',
        titulo: 'Elige cómo cobrar: por día de la semana o por día del mes',
        texto: 'En préstamos quincenales y mensuales ahora puedes elegir si fijar el cobro por día de la semana (ej. todos los viernes) o por día del mes (ej. los 5 de cada mes). Usa el selector que aparece al crear el préstamo.',
      },
      {
        icon: 'shield',
        titulo: 'Tope de préstamo visible para cobradores',
        texto: 'Los cobradores ahora pueden ver el tope máximo de préstamo de cada cliente desde su perfil, para tener la información antes de realizar un préstamo. Solo el administrador puede editarlo.',
      },
    ],
  },
  {
    version: 4,
    fecha: '2026-06-17',
    titulo: 'Novedad',
    items: [
      {
        icon: 'calendar',
        titulo: 'Día de cobro por número de día del mes',
        texto: 'Ahora en préstamos semanales y quincenales puedes fijar el cobro por día del mes (ej. "los 5") además de por día de la semana. Así si tu cliente paga los 5 de cada mes, el cobro siempre cae ese día sin importar si es lunes, martes o cualquier otro.',
      },
    ],
  },
  {
    version: 3,
    fecha: '2026-06-16',
    titulo: 'Novedades',
    items: [
      {
        icon: 'calculator',
        titulo: 'Simulador de préstamos',
        texto: 'Calcula la cuota, el total y los intereses al instante para mostrárselo a tu cliente, sin tener que registrarlo. Lo encuentras en Préstamos → Simulador, y lo puedes copiar o compartir por WhatsApp.',
      },
      {
        icon: 'printer',
        titulo: 'Imprime la lista de cobro de la ruta',
        texto: 'Dentro de cada ruta ahora puedes imprimir el listado de cobro del día para entregárselo en papel al cobrador: clientes, dirección, cuota, mora y una casilla para marcar lo recogido.',
      },
      {
        icon: 'calendar',
        titulo: 'Corrige la fecha de inicio de un préstamo',
        texto: 'En "Modificar plazo" ahora puedes corregir la fecha de inicio si te equivocaste al crear el préstamo. La fecha de fin se ajusta sola.',
      },
      {
        icon: 'filter',
        titulo: 'Filtra préstamos por frecuencia',
        texto: 'En la lista de préstamos puedes filtrar por diarios, semanales, quincenales o mensuales para encontrarlos más rápido.',
      },
    ],
  },
]
