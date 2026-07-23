/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.NEXT_BUILD_DIR ? { distDir: process.env.NEXT_BUILD_DIR } : {}),
  eslint: { ignoreDuringBuilds: true },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['pdfkit'],
  // optimizePackageImports (experimental) reescribia los imports de barril de
  // @/lib y @/components/ui y reordenaba modulos. Combinado con el scope
  // hoisting de webpack, eso producia "Cannot access 'aj' before
  // initialization" en produccion (un TDZ por import circular latente que el
  // reordenamiento destrababa). El build decia "compilado con exito" igual.
  // Se quito: era solo una optimizacion de tamaño/velocidad de build.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Apagar la concatenacion de modulos (scope hoisting) en el cliente.
      // Es el mecanismo exacto del TDZ: al fusionar modulos en un mismo scope,
      // un import circular queda accediendo a una variable antes de
      // inicializarse. Sin fusion, cada modulo mantiene su closure y el ciclo
      // se resuelve de forma perezosa. Cuesta un poco de tamaño, nada mas.
      config.optimization = config.optimization || {}
      config.optimization.concatenateModules = false
    }
    return config
  },
  async rewrites() {
    return [
      // Servir fotos subidas via API route (Next.js no sirve archivos agregados a public/ despues del build)
      { source: '/uploads/:path*', destination: '/api/uploads/:path*' },
    ]
  },
  async redirects() {
    return [
      { source: '/register', destination: '/registro', permanent: true },
    ]
  },
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.mercadopago.com https://http2.mlstatic.com https://connect.facebook.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' http://localhost capacitor://localhost https://api.groq.com https://api.mercadopago.com https://events.mercadopago.com https://http2.mlstatic.com https://www.facebook.com; frame-src https://sdk.mercadopago.com https://www.mercadopago.com.co https://www.youtube.com; object-src 'none'; base-uri 'self'" },
        ],
      },
    ]
  },
};

export default nextConfig;
