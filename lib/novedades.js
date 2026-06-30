// lib/novedades.js — Registro de novedades del sistema ("Qué hay de nuevo").
//
// Cómo agregar una novedad nueva:
//  1. Sube NOVEDADES_VERSION en 1.
//  2. Agrega un objeto AL INICIO del array NOVEDADES con esa misma versión.
// El modal se le muestra UNA vez a cada usuario cuando la versión supera la
// última que vio (guardada en localStorage). No requiere backend.

export const NOVEDADES_VERSION = 14

export const NOVEDADES = [
  {
    version: 14,
    fecha: '2026-06-29',
    titulo: 'Novedades',
    items: [
      {
        icon: 'sparkles',
        titulo: 'Lineas de credito rotativas',
        texto: 'Nuevo producto: aprueba un cupo a tu cliente y el puede pedir plata varias veces sin crear un prestamo nuevo cada vez. Funciona como una tarjeta de credito. Lo encuentras en el menu lateral como "Lineas de credito".',
      },
      {
        icon: 'calculator',
        titulo: 'Cortes mensuales automaticos',
        texto: 'Cada mes puedes generar un estado de cuenta que suma lo que el cliente debe (capital + intereses) menos lo que ha pagado. El saldo pendiente rota al siguiente mes.',
      },
      {
        icon: 'pen',
        titulo: 'Tres modos de interes',
        texto: 'Configura como se calculan los intereses: tasa fija mensual, interes diario sobre lo que debe, o interes sobre todo lo usado en el mes. Cada linea puede tener su propia configuracion.',
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
