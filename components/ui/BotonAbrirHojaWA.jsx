'use client'

// El botón que abre la HOJA de plantillas, en vez de disparar el mensaje.
//
// `BotonWhatsApp` genera el texto y salta a WhatsApp de una vez: el cobrador
// no ve lo que va a mandar hasta que ya está en el chat del cliente. Es el
// defecto que la hoja arregla —leerlo antes de mandarlo, y poder retocarlo—,
// y en el recibo de pago importa más que en ningún otro sitio: ahí el mensaje
// lleva cifras.
//
// Se queda con la misma pinta que el viejo a propósito: quien lleva meses
// cobrando busca el botón verde donde siempre estuvo. Lo que cambia es a dónde
// lleva, no dónde está.

const WA_ICON = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5 0-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1.1 2.8 1.2 3c.2.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3z" />
    <path d="M12 2a10 10 0 00-8.6 15L2 22l5.2-1.4A10 10 0 1012 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1112 20.2z" />
  </svg>
)

export default function BotonAbrirHojaWA({ onClick, texto = 'Enviar confirmacion por WhatsApp' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-2 px-4 h-10 rounded-[12px] text-sm font-medium transition-all duration-150 cursor-pointer w-full bg-[#25d366] hover:bg-[#1da855] text-white"
    >
      {WA_ICON}
      {texto}
    </button>
  )
}
