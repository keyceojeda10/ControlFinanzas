// app/api/telegram/wa-redirect/route.js
// Marca lead como contactado y redirige a WhatsApp Business
// Sirve una página HTML que fuerza apertura en app externa (no en browser de Telegram)

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('lead')
  const waUrl = searchParams.get('wa') // URL de wa.me completa (encoded)

  if (!waUrl) {
    return NextResponse.redirect('https://wa.me/')
  }

  // Marcar lead como contactado (antes de servir la página)
  if (leadId) {
    try {
      const lead = await prisma.lead.findUnique({ where: { id: leadId } })
      if (lead && lead.estado === 'nuevo') {
        await prisma.lead.update({
          where: { id: leadId },
          data: { estado: 'contactado' },
        })
      }
    } catch (e) {
      console.error('[wa-redirect] Error marcando contactado:', e)
    }
  }

  const decodedWaUrl = decodeURIComponent(waUrl)

  // Extraer teléfono y texto del wa.me link
  const urlObj = new URL(decodedWaUrl)
  const phone = urlObj.pathname.replace('/', '')
  const text = urlObj.searchParams.get('text') || ''

  // Página HTML que abre WhatsApp Business directamente
  // En Android: intent:// fuerza WA Business (com.whatsapp.w4b)
  // Fallback: abre wa.me normal (para iOS o si no tiene WA Business)
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Abriendo WhatsApp Business...</title>
  <style>
    body { background: #111; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
    .container { padding: 20px; }
    a { color: #25D366; font-size: 18px; text-decoration: none; display: inline-block; margin: 10px; padding: 12px 24px; border: 2px solid #25D366; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <p>Abriendo WhatsApp Business...</p>
    <p><a id="wa-link" href="${decodedWaUrl}">Abrir WhatsApp</a></p>
  </div>
  <script>
    (function() {
      var phone = ${JSON.stringify(phone)};
      var text = ${JSON.stringify(text)};
      var waMe = ${JSON.stringify(decodedWaUrl)};

      // Intentar abrir WhatsApp Business primero (Android)
      var intentUrl = 'intent://send/' + phone + '?text=' + encodeURIComponent(text)
        + '#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end';

      // Detectar si es Android
      var isAndroid = /android/i.test(navigator.userAgent);

      if (isAndroid) {
        // Intent para WA Business
        window.location.href = intentUrl;
        // Fallback si WA Business no instalado: abrir wa.me después de 2s
        setTimeout(function() { window.location.href = waMe; }, 2000);
      } else {
        // iOS y otros: abrir wa.me directamente
        window.location.href = waMe;
      }
    })();
  </script>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
