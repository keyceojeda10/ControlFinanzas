// lib/bot-v2/index.js — Punto de entrada del bot v2.
// Exporta las mismas funciones que el bot v1 para que el webhook y crons
// puedan cambiar de version sin tocar su codigo.

export { responder, generarSeguimiento } from './agente.js'
export { enviarSeguimientos } from './sender.js'
export { clasificar } from './clasificador.js'
