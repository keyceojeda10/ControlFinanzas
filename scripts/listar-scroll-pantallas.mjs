// scripts/listar-scroll-pantallas.mjs — el patrón exacto, archivo por archivo.
//
// Antes de migrar 34 pantallas hay que saber si comparten forma o no. Asumir
// que sí es justo como se rompen las migraciones en bloque.
//
// Imprime, por archivo, las líneas con `overflowY:auto` y con `height:100%`,
// para poder decidir cada una mirando en vez de a ciegas.
//
//   node scripts/listar-scroll-pantallas.mjs

import fs from 'node:fs'
import path from 'node:path'

const PANTALLAS = [
  'components/pantallas/Cargando.jsx',
  'components/pantallas/Cobradores.jsx',
  'components/pantallas/CrearPrestamo.jsx',
  'components/pantallas/DetalleRuta.jsx',
  'components/pantallas/Estados.jsx',
  'components/pantallas/FichaRuta.jsx',
  'components/pantallas/Lucas.jsx',
  'components/pantallas/MiHistorial.jsx',
  'components/pantallas/ModoRuta.jsx',
  'components/pantallas/Onboarding.jsx',
  'components/pantallas/Pagare.jsx',
  'components/pantallas/Plantillas.jsx',
  'components/pantallas/PortalCliente.jsx',
  'components/pantallas/Recibo.jsx',
  'components/pantallas/RutaCierre.jsx',
  'components/pantallas/RutaEditar.jsx',
  'components/pantallas/Socios.jsx',
  'components/pantallas/SociosEscritorio.jsx',
  'components/pantallas/SociosReparto.jsx',
  'components/pantallas/TablaAmortizacion.jsx',
  'components/reportes/ReporteDia.jsx',
]

let totalScroll = 0, totalAlto = 0
for (const rel of PANTALLAS) {
  const f = path.join(process.cwd(), rel)
  if (!fs.existsSync(f)) { console.log(`\n${rel}\n   (no existe)`); continue }
  const lineas = fs.readFileSync(f, 'utf8').split('\n')
  const scroll = [], alto = []
  lineas.forEach((l, i) => {
    if (/overflowY:\s*['"]auto['"]|overflow-y-auto/.test(l)) scroll.push(i + 1)
    if (/height:\s*['"]100%['"]|\bh-full\b/.test(l)) alto.push(i + 1)
  })
  totalScroll += scroll.length
  totalAlto += alto.length
  const nombre = path.basename(rel)
  console.log(`${nombre.padEnd(24)} scroll: ${String(scroll.length).padStart(2)} en ${scroll.join(',') || '-'}`
    + `   alto100: ${String(alto.length).padStart(2)} en ${alto.join(',') || '-'}`)
}
console.log(`\nTotal: ${totalScroll} contenedores con scroll · ${totalAlto} con alto fijo`)
