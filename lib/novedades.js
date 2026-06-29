// lib/novedades.js — Registro de novedades del sistema ("Qué hay de nuevo").
//
// Cómo agregar una novedad nueva:
//  1. Sube NOVEDADES_VERSION en 1.
//  2. Agrega un objeto AL INICIO del array NOVEDADES con esa misma versión.
// El modal se le muestra UNA vez a cada usuario cuando la versión supera la
// última que vio (guardada en localStorage). No requiere backend.

export const NOVEDADES_VERSION = 13

export const NOVEDADES = [
  {
    version: 13,
    fecha: '2026-06-29',
    titulo: 'Novedades',
    items: [
      {
        icon: 'pen',
        titulo: 'Cobros agrupados por ruta',
        texto: 'La pantalla de cobros del dia ahora agrupa los clientes pendientes por ruta, con secciones que puedes colapsar. Tambien muestra la direccion del cliente y cuanto debe para ponerse al dia.',
      },
      {
        icon: 'sparkles',
        titulo: 'Metodo de pago con memoria',
        texto: 'Al cobrar, el sistema recuerda si pagaste en efectivo o transferencia la ultima vez y lo marca con "Ultimo" para que cobres mas rapido.',
      },
      {
        icon: 'calculator',
        titulo: 'Alertas de mora mas visibles',
        texto: 'En el dashboard, las alertas de mora ahora aparecen antes de los ultimos pagos para que lo primero que veas sea lo que necesita atencion.',
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
        titulo: 'Renovacion mas clara',
        texto: 'Al renovar un prestamo, ahora ves un resumen del prestamo actual (monto, cuota, saldo), el desglose de lo que se absorbe vs lo que se entrega en mano, y la comparacion de cuota anterior vs nueva.',
      },
      {
        icon: 'sparkles',
        titulo: 'Editar prestamos sin limite',
        texto: 'Los administradores ahora pueden editar cualquier prestamo en cualquier momento. Los cobradores mantienen la restriccion del mismo dia.',
      },
      {
        icon: 'calculator',
        titulo: 'Wizard de prestamos mejorado',
        texto: 'El selector de tipo de interes ahora muestra una etiqueta "Recomendado" en el metodo clasico y el stepper muestra el nombre del paso actual (Monto, Cobro, Plazo...).',
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
        texto: 'Las cards ahora tienen profundidad y sombras sutiles. Las listas de clientes, prestamos y cobros aparecen con animaciones escalonadas. Los modales entran con transiciones suaves.',
      },
      {
        icon: 'pen',
        titulo: 'Navegacion mas clara',
        texto: 'El sidebar ahora tiene un indicador animado que muestra la seccion activa. El dashboard tiene un fondo decorativo sutil con gradientes de marca.',
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
        texto: 'Sube tu archivo Excel o CSV con todos tus clientes y prestamos de una vez. Descarga la plantilla, llena los datos y el sistema los importa validando errores antes de guardar.',
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
        titulo: 'Resumen del prestamo en el momento justo',
        texto: 'La cuota y el total ya no aparecen antes de elegir el modo de interes. Ahora el resumen se muestra solo cuando tienes toda la informacion completa, evitando confusiones.',
      },
      {
        icon: 'pen',
        titulo: 'Mejor explicacion en cada paso',
        texto: 'El wizard de prestamos y el migrador ahora explican cada campo con textos claros. Si un cliente tiene condiciones diferentes, puedes cambiarlas sin perder los valores base.',
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
        texto: 'Sube toda tu cartera de clientes de una sola vez. Crea cliente + prestamo sin cambiar de pagina, uno tras otro. Lo encuentras en Clientes o en el menu lateral.',
      },
      {
        icon: 'camera',
        titulo: 'Importa desde cualquier foto',
        texto: 'Tomale foto a tu cuaderno, libreta, cartulina o cualquier anotacion. El sistema detecta los datos automaticamente y te dice cuales faltan para que los completes.',
      },
      {
        icon: 'sparkles',
        titulo: 'Nuevo onboarding para usuarios nuevos',
        texto: 'Los nuevos usuarios ahora ven 3 opciones para subir su cartera al registrarse: migrador express, foto o Excel. Mas facil empezar desde el primer dia.',
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
        texto: 'Ahora el cliente puede firmar con el dedo directamente en la pantalla al momento de recibir el prestamo. La firma queda guardada como imagen en el detalle del prestamo.',
      },
      {
        icon: 'calculator',
        titulo: 'Modo abreviado de montos',
        texto: 'Activa esta opcion en Configuracion para escribir montos sin los ultimos tres ceros. Por ejemplo, escribe 100 y el sistema lo convierte en 100.000. Ideal para agilizar el ingreso de datos.',
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
        titulo: 'Elige como cobrar: por dia de la semana o por dia del mes',
        texto: 'En prestamos quincenales y mensuales ahora puedes elegir si fijar el cobro por dia de la semana (ej. todos los viernes) o por dia del mes (ej. los 5 de cada mes). Usa el selector que aparece al crear el prestamo.',
      },
      {
        icon: 'shield',
        titulo: 'Tope de prestamo visible para cobradores',
        texto: 'Los cobradores ahora pueden ver el tope maximo de prestamo de cada cliente desde su perfil, para tener la informacion antes de realizar un prestamo. Solo el administrador puede editarlo.',
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
        titulo: 'Dia de cobro por numero de dia del mes',
        texto: 'Ahora en prestamos semanales y quincenales puedes fijar el cobro por dia del mes (ej. "los 5") ademas de por dia de la semana. Asi si tu cliente paga los 5 de cada mes, el cobro siempre cae ese dia sin importar si es lunes, martes o cualquier otro.',
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
