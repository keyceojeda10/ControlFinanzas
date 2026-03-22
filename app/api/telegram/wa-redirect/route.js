// app/api/telegram/wa-redirect/route.js
// Marca lead como contactado y redirige a WhatsApp Business
// Sirve una página HTML que fuerza apertura en app externa (no en browser de Telegram)

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('lead')
  // searchParams.get() ya decodifica un nivel automáticamente
  // NO usar decodeURIComponent adicional — destruye los %0A (saltos de línea) de la URL
  const waMe = searchParams.get('wa')

  if (!waMe) {
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

  // Intent Android: usa la misma URL de wa.me pero forzando apertura con WA Business
  // waMe ya tiene %0A intactos para saltos de línea
  const intentUrl = waMe.replace('https://', 'intent://') +
    '#Intent;scheme=https;package=com.whatsapp.w4b;end'

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
    <p><a id="wa-link" href="${waMe}">Abrir WhatsApp</a></p>
  </div>
  <script>
    (function() {
      var waMe = ${JSON.stringify(waMe)};
      var intentUrl = ${JSON.stringify(intentUrl)};
      var isAndroid = /android/i.test(navigator.userAgent);

      if (isAndroid) {
        window.location.href = intentUrl;
        setTimeout(function() { window.location.href = waMe; }, 2000);
      } else {
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
