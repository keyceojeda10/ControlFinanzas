import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/providers/SessionProvider";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import OfflineProvider from "@/components/providers/OfflineProvider";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import Script from "next/script";
import { SCRIPT_CAPTURA_INSTALAR } from '@/lib/instalar'

// Script anti-FOUC: corre antes de cualquier render y setea data-theme + background
// inline para que incluso cuando el HTML viene cacheado por SW con el data-theme
// "viejo", el primer paint use el tema correcto guardado en localStorage.
// Tambien setea el background del <html> inline para evitar el flash a oscuro
// cuando la hoja de estilos aun no cargo (offline / cache miss).
// Default de marca: claro. Solo quien guardo una preferencia explicita
// (dark/system) la conserva.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('cf-theme')||'light';var r=t==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):t;var h=document.documentElement;h.setAttribute('data-theme',r);h.style.colorScheme=r;var bg=r==='light'?'#f4f4f1':'#0c0d11';var fg=r==='light'?'#15161a':'#f3f3f6';h.style.backgroundColor=bg;h.style.color=fg;if(document.body){document.body.style.backgroundColor=bg;document.body.style.color=fg;}var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',bg);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const SITE_URL = process.env.NEXTAUTH_URL || 'https://app.control-finanzas.com'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Control Finanzas",
  description: "Gestiona tu cartera de préstamos: clientes, cobros, pagos y reportes en tiempo real.",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Control Finanzas',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
    shortcut: '/favicon-32x32.png',
  },
  openGraph: {
    title: 'Control Finanzas',
    description: 'Gestiona tu cartera de préstamos: clientes, cobros, pagos y reportes en tiempo real.',
    url: SITE_URL,
    siteName: 'Control Finanzas',
    locale: 'es_LA',
    type: 'website',
    // PNG estatico (no dinamico via next/og) para que WhatsApp/Meta lo
    // scrapeen al instante sin cold start y muestren el banner completo.
    images: [
      {
        url: '/og.png?v=2',
        width: 1200,
        height: 630,
        alt: 'Control Finanzas — Gestiona tu cartera de préstamos',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Control Finanzas',
    description: 'Gestiona tu cartera de préstamos en tiempo real.',
    images: ['/og.png?v=2'],
  },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f4f1' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0d11' },
  ],
  // Fija el zoom para evitar el auto-zoom del navegador movil:
  // - iOS Safari hace zoom al enfocar inputs con font-size < 16px.
  // - Android amplia la pantalla al abrir modales.
  // maximumScale=1 + userScalable=false elimina ese comportamiento.
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

/* ⚠ LA SESIÓN BAJA DEL SERVIDOR (12 oct 2026, el #418 del Inicio).
   El proveedor arrancaba en el cliente con la sesión guardada en localStorage
   y en el servidor sin ninguna: desde la SEGUNDA carga de cualquier pantalla,
   lo que dependiera de la sesión en el primer render (el banner de fotos del
   Inicio, `{esOwner && …}`) pintaba un árbol distinto al del HTML y React
   tiraba la página entera para volverla a pintar en el cliente. Se había
   parchado pantalla por pantalla con `montado` (FranjaVerComo); con la misma
   sesión a los dos lados deja de pasar en todas. */
export default async function RootLayout({ children }) {
  const session = await getServerSession(authOptions).catch(() => null);
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* El aviso «se puede instalar» de Chrome llega al cargar y no se repite:
            se oye aquí, antes que React, para que «Instalar» sea de un toque
            en cualquier pantalla (lib/instalar.js). */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_CAPTURA_INSTALAR }} />
        <script async src="https://www.googletagmanager.com/gtag/js?id=AW-18050279366" />
        <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','AW-18050279366');` }} />
      </head>
      <body className={`${manrope.variable} ${spaceGrotesk.variable} antialiased`} suppressHydrationWarning>
        <ThemeProvider>
          <SessionProvider session={session}>
            <OfflineProvider>
              {children}
            </OfflineProvider>
          </SessionProvider>
        </ThemeProvider>
        <Script id="fb-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window,document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init','1286258560093362');
          fbq('track','PageView');
        `}</Script>
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img height="1" width="1" style={{display:'none'}}
            src="https://www.facebook.com/tr?id=1286258560093362&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
      </body>
    </html>
  );
}
