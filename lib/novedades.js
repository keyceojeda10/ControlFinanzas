// lib/novedades.js — Registro de novedades del sistema ("Qué hay de nuevo").
//
// Cómo agregar una novedad nueva:
//  1. Sube NOVEDADES_VERSION en 1.
//  2. Agrega un objeto AL INICIO del array NOVEDADES con esa misma versión.
// El modal se le muestra UNA vez a cada usuario cuando la versión supera la
// última que vio (guardada en localStorage). No requiere backend.

export const NOVEDADES_VERSION = 3

export const NOVEDADES = [
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
