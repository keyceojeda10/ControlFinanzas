import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/providers/SessionProvider";
import OfflineProvider from "@/components/providers/OfflineProvider";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import Script from "next/script";

// Script anti-FOUC: corre antes de cualquier render y setea data-theme + background
// inline para que incluso cuando el HTML viene cacheado por SW con el data-theme
// "viejo", el primer paint use el tema correcto guardado en localStorage.
// Tambien setea el background del <html> inline para evitar el flash a oscuro
// cuando la hoja de estilos aun no cargo (offline / cache miss).
// Default de marca: claro. Solo quien guardo una preferencia explicita
// (dark/system) la conserva.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('cf-theme')||'light';var r=t==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):t;var h=document.documentElement;h.setAttribute('data-theme',r);h.style.colorScheme=r;var bg=r==='light'?'#f5f7fb':'#060609';var fg=r==='light'?'#1a1a2e':'#f0f0f5';h.style.backgroundColor=bg;h.style.color=fg;if(document.body){document.body.style.backgroundColor=bg;document.body.style.color=fg;}}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono-display",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif-display",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

const SITE_URL = process.env.NEXTAUTH_URL || 'https://app.control-finanzas.com'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Control Finanzas",
  description: "Gestiona tu cartera de préstamos: clientes, cobros, pagos y reportes en tiempo real.",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
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
  themeColor: '#1e3a5f',
  // Fija el zoom para evitar el auto-zoom del navegador movil:
  // - iOS Safari hace zoom al enfocar inputs con font-size < 16px.
  // - Android amplia la pantalla al abrir modales.
  // maximumScale=1 + userScalable=false elimina ese comportamiento.
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script async src="https://www.googletagmanager.com/gtag/js?id=AW-18050279366" />
        <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','AW-18050279366');` }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased`} suppressHydrationWarning>
        <ThemeProvider>
          <SessionProvider>
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
