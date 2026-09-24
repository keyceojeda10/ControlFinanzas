# Importar la «Planilla Recaudador» de Crossbox desde el PDF — Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** que un prestamista que viene de Crossbox suba el PDF de su «Planilla Recaudador» y cargue su cartera solo. La tasa, las cuotas y la frecuencia se deducen y se comprueban contra «Atrasadas»; los saldos entran exactos.

**Arquitectura:** tres piezas nuevas y separadas, más cambios pequeños en el importador de hoy:
- `lib/importar/planilla-crossbox.js`: pura. Recibe el texto del PDF con posiciones y devuelve filas.
- `lib/importar/deducir-condiciones.js`: pura. Deduce tasa, cuotas y frecuencia; no sabe nada de Crossbox.
- `lib/importar/pdf-texto.js`: saca el texto con `unpdf`. Solo en el servidor.

Una ruta nueva (`/api/carga-masiva/leer-pdf`) las junta. Después, las filas entran por la validación e importación de siempre (`lib/importar-cartera.js`), que aprende a deducir y a ofrecer «no cobro los domingos».

**Tecnología:** Next.js 15 (App Router, JS/JSX, **sin TypeScript**), Prisma 7.8 + MariaDB, vitest 4, `unpdf` (nueva) y `pdfkit` (ya está, solo para pruebas).

**Spec:** `docs/superpowers/specs/2026-09-24-importar-planilla-crossbox-pdf-design.md`

**Base:** rama `importar-crossbox`, sobre `9265ec0d`.

## Restricciones globales

- JS y JSX sin TypeScript: una función que no existe pasa el build y revienta en producción. Todo nombre usado está en el bloque «Produce» de su tarea.
- **Los rótulos de las rutas no exportan nada más:** un `route.js` de Next solo exporta `GET`, `POST`, `runtime`, etc. Constantes y mensajes van en `lib/`.
- **Mensajes exactos:**
  - PDF desconocido: «Este PDF no es una planilla que sepamos leer. Escríbenos por WhatsApp y te ayudamos.»
  - Incompleto: «No pudimos leer la planilla completa: los totales no cuadran con las filas. Escríbenos por WhatsApp y te ayudamos.»
  - Pesado: «El PDF pesa más de 5 MB. Escríbenos por WhatsApp y te ayudamos.»
  - Páginas: «Tu PDF tiene {n} páginas; el máximo es 30. Escríbenos por WhatsApp y te ayudamos.»
  - No es PDF: «Ese archivo no es un PDF.»
  - Falta archivo: «Elige el PDF de tu planilla.»
  - Números absurdos: «Los números de este crédito no tienen sentido (cuota o crédito demasiado pequeños): créalo a mano con tus datos»
  - No se deduce: «No pudimos deducir la tasa y las cuotas de este crédito: créalo a mano con tus datos»
- **Topes:** 5 MB (`5 * 1024 * 1024`) y 30 páginas.
- **Deducción:**
  - tasas `[20, 10, 30, 40, 50, 60]`;
  - tolerancia de 1.000 pesos por cuota;
  - «cuadra» si la diferencia con «Atrasadas» es de 1 cuota o menos;
  - absurdo si capital < $10.000, cuota ≤ 0, o cuota < capital ÷ 1.000.
- Domingos: `diasSinCobro` es un JSON de números, 0 = domingo, así que «sin domingos» es `'[0]'`. Solo se guarda si la cuenta no tiene nada (`null` o `'[]'`) y el dueño deja la casilla marcada.
- **Datos personales:** el fichero de prueba sale del PDF real con los **nombres y teléfonos cambiados**. Nunca se sube a git un nombre ni un teléfono real.
- **DESIGN.md es ley:**
  - colores solo con `var(--cf-…)`;
  - el dorado solo para el monto principal, la acción primaria y el foco;
  - nada de emojis (SVG en línea);
  - `Checkbox` canónico de `components/ui/Checkbox.jsx`, con `onChange(boolean)`;
  - los nombres no se recortan.
- **Verificación:**
  - `npx vitest run`;
  - `npx eslint app components`, con línea base de 53 problemas y 9 errores, sin ninguno nuevo; lint por ruta para los ficheros de `lib/`;
  - `npx next build` en las tareas que tocan rutas o pantallas.
- Los commits terminan con `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Las pruebas se anclan en código, no en comentarios.

## Foco de revisión

1. **PDF escaneado o de otra app** (no hay texto de la planilla): `leerPlanillaCrossbox` devuelve `null` y la ruta contesta el mensaje de «no es una planilla que sepamos leer». No es un error del servidor. Prueba en la tarea 1 (páginas de otro PDF dan `null`) y en la tarea 3 (un PDF de pdfkit sin la planilla).
2. **Planilla a la que le falta una página:** la suma no cuadra con «Totales» y no se carga nada. Prueba en la tarea 1: se quita una fila del fichero de prueba y `cuadraConTotales` da `false`.
3. **La cuenta ya tiene días sin cobro:** se respeta lo que tiene, no aparece la casilla y la deducción usa su configuración. Prueba en la tarea 4 (`validarCartera` con `diasSinCobro: '[0]'`).
4. **«Nunca» con una cuota que no divide exacto** ($1.280.000 en 12): no se inventa un «abono previo» de $4. El total queda en $1.280.004 y el aviso lo dice. Prueba en la tarea 4 (fila 13: `abonadoHasta` 0, total 1.280.004).
5. **Nombre partido en dos piezas, o fila sin teléfono:** el nombre sale completo y el teléfono vacío. Prueba en la tarea 1, con páginas inventadas.

---

## Mapa de ficheros

| Fichero | Qué hace |
|---|---|
| `lib/importar/planilla-crossbox.js` (nuevo) | `leerPlanillaCrossbox(paginas)`, `fechaCrossbox(texto)` |
| `lib/importar/deducir-condiciones.js` (nuevo) | `deducirCondiciones(fila, { sinDomingos })`, `decidirDomingos(filas)`, `fechasDeCuotas(...)` |
| `lib/importar/pdf-texto.js` (nuevo) | `paginasDePdf(buffer, { maxPaginas })`, `MENSAJES_PDF`, `MAX_BYTES_PDF`, `MAX_PAGINAS_PDF` |
| `app/api/carga-masiva/leer-pdf/route.js` (nuevo) | POST multipart: devuelve `{ planilla }` o `{ error }` |
| `lib/__tests__/fixtures/planilla-crossbox-paginas.json` (nuevo) | el texto del PDF real, anonimizado |
| `lib/carga-masiva.js` | `validarFila(..., opciones)` deduce cuando la fila no trae tasa ni plazo |
| `lib/importar-cartera.js` | `validarCartera` decide los domingos y los devuelve en el resumen |
| `app/api/carga-masiva/importar/route.js` | `noCobrarDomingos` guarda `'[0]'` antes de importar |
| `lib/archivos-tabla.js` | `ACCEPT_CARTERA` (tabla + PDF), `esPdf(file)` |
| `components/carga-masiva/PasoSubir.jsx`, `app/(dashboard)/carga-masiva/page.jsx`, `components/carga-masiva/PasoRevisar.jsx`, `components/carga-masiva/PasoConfirmar.jsx` | subir el PDF, saltarse el mapeo, el recuadro, la casilla y la ruta |

---

### Tarea 1: leer la planilla (texto con posiciones → filas)

**Ficheros:**
- Crear: `lib/importar/planilla-crossbox.js`, `lib/__tests__/fixtures/planilla-crossbox-paginas.json` (generado por un guion), `.auditoria/_fixture-crossbox.mjs` (no va a git)
- Modificar: `package.json` / `package-lock.json` (`npm i unpdf`)
- Prueba: `lib/__tests__/planilla-crossbox.test.js`

**Interfaces:**
- Consume: nada.
- Produce:
  - `fechaCrossbox(texto) → 'YYYY-MM-DD' | null`;
  - `leerPlanillaCrossbox(paginas) → null | { formato: 'crossbox-planilla', fechaCorte, ruta, filas, totales, suma, cuadraConTotales }`, donde:
    - `paginas: Array<Array<{ str: string, x: number, y: number }>>`;
    - cada fila es `{ filaPlanilla, nombre, telefono, fechaInicio, ultimoAbono, sinAbonos, montoPrestado, saldoActual, valorCuota, atrasadas, vencidos, fechaCorte }`, con los montos en pesos enteros;
    - `totales` es `{ credito, saldo, cuota }` o `null`, y `suma` es `{ credito, saldo }`.

- [ ] **Paso 1: instalar `unpdf` y generar el fichero de prueba anonimizado**

```bash
npm i unpdf@^1.8.1
```

`.auditoria/_fixture-crossbox.mjs`:

```js
// Saca el texto con posiciones del PDF real de la planilla y lo ANONIMIZA: los
// nombres pasan a «Cliente N» (conservando «Semanal», «Diario», «Mensual»,
// «Quincenal», que la deducción usa) y los teléfonos a 300 + N. Cifras, fechas,
// cabeceras y totales quedan igual. Solo se ejecuta en la máquina de keyce.
import { getDocumentProxy } from 'unpdf'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

const RUTA = process.env.HOME + '/Descargas/PlanillaRecaudador-RUTA 1.24-Sep-2026 (1).pdf'
const pdf = await getDocumentProxy(new Uint8Array(readFileSync(RUTA)))
const paginas = []
for (let p = 1; p <= pdf.numPages; p++) {
  const { items } = await (await pdf.getPage(p)).getTextContent()
  const piezas = items.filter((i) => String(i.str).trim())
    .map((i) => ({ str: i.str, x: Math.round(i.transform[4]), y: Math.round(i.transform[5]) }))
  const porY = new Map()
  for (const pz of piezas) {
    const k = [...porY.keys()].find((y) => Math.abs(y - pz.y) <= 3) ?? pz.y
    if (!porY.has(k)) porY.set(k, [])
    porY.get(k).push(pz)
  }
  for (const fila of porY.values()) {
    fila.sort((a, b) => a.x - b.x)
    if (fila.length < 9 || !/^\d+$/.test(fila[0].str.trim()) || !/^\d{2} \w{3} \d{2}$/.test(fila[1].str.trim())) continue
    const n = fila[0].str.trim()
    const medio = fila.slice(3, -5)
    const tel = medio.length > 1 && /^[\d\s]{7,}$/.test(medio[medio.length - 1].str) ? medio.pop() : null
    const palabras = medio.map((m) => m.str).join(' ').match(/semanal|quincenal|mensual|diario/ig) || []
    medio.forEach((m, i) => { m.str = i === 0 ? ['Cliente', n, ...palabras].join(' ') : '' })
    if (tel) tel.str = '300' + n.padStart(7, '0')
  }
  paginas.push(piezas.filter((pz) => pz.str !== ''))
}
mkdirSync('lib/__tests__/fixtures', { recursive: true })
writeFileSync('lib/__tests__/fixtures/planilla-crossbox-paginas.json', JSON.stringify(paginas))
console.log('páginas', paginas.length, 'piezas', paginas.reduce((a, pg) => a + pg.length, 0))
```

Ejecutar: `node .auditoria/_fixture-crossbox.mjs`. Esperado: «páginas 3 piezas …».

Comprobar que no quedó nada real. Esto no debe imprimir nada:

```bash
grep -oE '"str":"[A-Za-zÁÉÍÓÚáéíóúñÑ" ]{3,}"' lib/__tests__/fixtures/planilla-crossbox-paginas.json | grep -vE 'Cliente|Planilla|Recaudador|Fecha|Ruta|RUTA|Créditos|Cliente|Teléfono|Crédito|Saldo|Cuota|Atrasadas|Vencidos|Totales|Nunca|U\. Abono|Sep|Ago|Jun|Jul|CROSSBOX' | head
```

Si imprime algo, es un nombre que se escapó. Se arregla el guion antes de seguir.

- [ ] **Paso 2: la prueba, que falla**

`lib/__tests__/planilla-crossbox.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { leerPlanillaCrossbox, fechaCrossbox } from '@/lib/importar/planilla-crossbox'

const paginas = JSON.parse(readFileSync(resolve(process.cwd(), 'lib/__tests__/fixtures/planilla-crossbox-paginas.json'), 'utf8'))

describe('las fechas de la planilla', () => {
  it('«22 Sep 26», «24 Sep 2026», meses en español y en inglés', () => {
    expect(fechaCrossbox('22 Sep 26')).toBe('2026-09-22')
    expect(fechaCrossbox('24 Sep 2026')).toBe('2026-09-24')
    expect(fechaCrossbox('31 Ago 26')).toBe('2026-08-31')
    expect(fechaCrossbox('05 Dic 26')).toBe('2026-12-05')
    expect(fechaCrossbox('05 Dec 26')).toBe('2026-12-05')
    expect(fechaCrossbox('Nunca')).toBeNull()
  })
})

describe('la planilla real (anonimizada)', () => {
  const r = leerPlanillaCrossbox(paginas)
  it('lee las 49 filas, la fecha de corte y la ruta, y cuadra al peso con «Totales»', () => {
    expect(r.formato).toBe('crossbox-planilla')
    expect(r.fechaCorte).toBe('2026-09-24')
    expect(r.ruta).toBe('RUTA 1')
    expect(r.filas).toHaveLength(49)
    expect(r.totales).toEqual({ credito: 39606000, saldo: 44503400, cuota: 2869668 })
    expect(r.suma).toEqual({ credito: 39606000, saldo: 44503400 })
    expect(r.cuadraConTotales).toBe(true)
  })
  it('cada fila con sus campos', () => {
    expect(r.filas[0]).toEqual({
      filaPlanilla: 1, nombre: 'Cliente 1', telefono: '3000000001', fechaInicio: '2026-09-22',
      ultimoAbono: null, sinAbonos: true, montoPrestado: 150000, saldoActual: 180000, valorCuota: 180000,
      atrasadas: 0, vencidos: 0, fechaCorte: '2026-09-24',
    })
    expect(r.filas[1]).toMatchObject({ filaPlanilla: 2, ultimoAbono: '2026-09-23', sinAbonos: false, valorCuota: 20000 })
    expect(r.filas.find((f) => f.filaPlanilla === 15).nombre).toBe('Cliente 15 Semanal')
    expect(r.filas.find((f) => f.filaPlanilla === 37).atrasadas).toBe(-48)
  })
  it('si falta una fila (una página que no se leyó), NO cuadra', () => {
    // Se quita la fila 7 ENTERA (todas las piezas a su altura), como si no se hubiera leído.
    const sinUna = paginas.map((pg) => {
      const nombre = pg.find((pz) => pz.str === 'Cliente 7')
      return nombre ? pg.filter((pz) => Math.abs(pz.y - nombre.y) > 3) : pg
    })
    const incompleta = leerPlanillaCrossbox(sinUna)
    expect(incompleta.filas).toHaveLength(48)
    expect(incompleta.cuadraConTotales).toBe(false)
  })
})

describe('lo que no es la planilla', () => {
  it('otro PDF da null', () => {
    expect(leerPlanillaCrossbox([[{ str: 'Factura de venta', x: 40, y: 700 }, { str: 'Total $10.000', x: 40, y: 680 }]])).toBeNull()
    expect(leerPlanillaCrossbox([])).toBeNull()
  })
  it('nombre partido en dos piezas y fila sin teléfono', () => {
    const cab = [
      { str: 'Planilla Recaudador', x: 44, y: 458 }, { str: 'Fecha:', x: 640, y: 460 }, { str: '24 Sep 2026', x: 671, y: 460 },
      { str: 'Ruta:', x: 742, y: 460 }, { str: 'RUTA 2', x: 766, y: 460 },
      { str: 'Crédito', x: 494, y: 395 }, { str: 'Saldo', x: 590, y: 395 }, { str: 'Cuota', x: 673, y: 395 }, { str: 'Atrasadas', x: 707, y: 395 },
      { str: 'Totales', x: 66, y: 378 }, { str: '$500,000.00', x: 455, y: 378 }, { str: '$600,000.00', x: 544, y: 378 }, { str: '$40,000.00', x: 632, y: 378 },
    ]
    const fila = (y, piezas) => piezas.map(([str, x]) => ({ str, x, y }))
    const pg = [
      ...cab,
      ...fila(357, [['1', 45], ['01 Sep 26', 66], ['Nunca', 126], ['Ana María', 185], ['de la Hoz', 230], ['300 111 2233', 374], ['$300,000.00', 470], ['$360,000.00', 559], ['$15,000.00', 647], ['3', 743], ['0', 793]]),
      ...fila(336, [['2', 45], ['02 Sep 26', 66], ['20 Sep 26', 126], ['Pedro', 185], ['$200,000.00', 470], ['$240,000.00', 559], ['$25,000.00', 647], ['0', 743], ['0', 793]]),
    ]
    const r = leerPlanillaCrossbox([pg])
    expect(r.ruta).toBe('RUTA 2')
    expect(r.filas[0]).toMatchObject({ nombre: 'Ana María de la Hoz', telefono: '3001112233', sinAbonos: true })
    expect(r.filas[1]).toMatchObject({ nombre: 'Pedro', telefono: '', ultimoAbono: '2026-09-20' })
    expect(r.cuadraConTotales).toBe(true)
  })
})
```

- [ ] **Paso 3: ejecutarla, tiene que fallar**

Ejecutar: `npx vitest run lib/__tests__/planilla-crossbox.test.js`
Esperado: FALLA al resolver `@/lib/importar/planilla-crossbox`.

- [ ] **Paso 4: el lector**

`lib/importar/planilla-crossbox.js`:

```js
/* LA «PLANILLA RECAUDADOR» DE CROSSBOX — 24 sep 2026.
 *
 * Un prestamista que venía de Crossbox solo tenía su cartera en este PDF. Lo
 * convirtió a Excel y el importador dijo «No reconocí las columnas». Esto lee la
 * tabla a partir del texto con posiciones que da pdf.js (lib/importar/pdf-texto.js):
 *
 *   Fecha | U. Abono | Cliente | Teléfono | Crédito | Saldo | Cuota | Atrasadas | Vencidos
 *
 * Cada celda es una pieza de texto; un renglón son las piezas a la misma altura.
 * Se lee por los extremos: número, fecha y último abono al principio; crédito,
 * saldo, cuota, atrasadas y vencidos al final; teléfono y nombre en medio (el
 * nombre puede venir partido en varias piezas). La planilla NO trae tasa, cuotas,
 * frecuencia ni cédula: eso lo deduce lib/importar/deducir-condiciones.js.
 * Pura: sin pdf.js, sin base de datos.
 */
const MESES = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
  jan: 1, apr: 4, aug: 8, dec: 12,
}

/** «22 Sep 26» o «24 Sep 2026» → «2026-09-22». null si no es una fecha así. */
export function fechaCrossbox(texto) {
  const m = String(texto ?? '').trim().match(/^(\d{1,2}) ([A-Za-zé]{3})\w* (\d{2}|\d{4})$/)
  if (!m) return null
  const mes = MESES[m[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')]
  if (!mes) return null
  const anio = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  return `${anio}-${String(mes).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

const dinero = (s) => /^-?\$[\d,]+(\.\d{1,2})?$/.test(String(s).trim())
const pesos = (s) => Math.round(Number(String(s).replace(/[$,]/g, '')))
const entero = (s) => /^-?\d+$/.test(String(s).trim())

/** Las piezas de una página en renglones (misma altura ±3), cada uno de izquierda a derecha. */
function renglones(piezas) {
  const orden = piezas.filter((p) => String(p.str).trim()).sort((a, b) => b.y - a.y || a.x - b.x)
  const out = []
  for (const p of orden) {
    const r = out.find((x) => Math.abs(x.y - p.y) <= 3)
    if (r) r.piezas.push(p); else out.push({ y: p.y, piezas: [p] })
  }
  return out.map((r) => r.piezas.sort((a, b) => a.x - b.x).map((p) => String(p.str).trim()))
}

/**
 * paginas: [[{ str, x, y }]] — el texto de cada página con su posición.
 * null si no es la planilla de Crossbox.
 */
export function leerPlanillaCrossbox(paginas) {
  const plano = (paginas || []).map(renglones).flat()
  const texto = plano.map((r) => r.join(' ')).join('\n')
  if (!/Planilla Recaudador/i.test(texto) || !/Cr[eé]dito/.test(texto) || !/Atrasadas/.test(texto)) return null

  const cab = plano.find((r) => r.includes('Fecha:')) || []
  const fechaCorte = fechaCrossbox(cab[cab.indexOf('Fecha:') + 1])
  const iRuta = cab.indexOf('Ruta:')
  const ruta = iRuta >= 0 ? cab.slice(iRuta + 1).join(' ').trim() || null : null

  const filas = []
  let totales = null
  for (const r of plano) {
    if (r[0] === 'Totales' && r.length >= 4 && r.slice(1, 4).every(dinero)) {
      totales = { credito: pesos(r[1]), saldo: pesos(r[2]), cuota: pesos(r[3]) }
      continue
    }
    // [n, fecha, u.abono, …cliente…, teléfono?, crédito, saldo, cuota, atrasadas, vencidos]
    if (r.length < 9 || !entero(r[0]) || !fechaCrossbox(r[1])) continue
    const cola = r.slice(-5)
    if (!dinero(cola[0]) || !dinero(cola[1]) || !dinero(cola[2]) || !entero(cola[3]) || !entero(cola[4])) continue
    const medio = r.slice(3, -5)
    let telefono = ''
    if (medio.length > 1 && /^[\d\s+()-]{7,}$/.test(medio[medio.length - 1])) telefono = medio.pop().replace(/\D/g, '')
    const nunca = /^nunca$/i.test(r[2])
    filas.push({
      filaPlanilla: Number(r[0]),
      nombre: medio.join(' ').replace(/\s+/g, ' ').trim(),
      telefono,
      fechaInicio: fechaCrossbox(r[1]),
      ultimoAbono: nunca ? null : fechaCrossbox(r[2]),
      sinAbonos: nunca,
      montoPrestado: pesos(cola[0]),
      saldoActual: pesos(cola[1]),
      valorCuota: pesos(cola[2]),
      atrasadas: Number(cola[3]),
      vencidos: Number(cola[4]),
      fechaCorte,
    })
  }
  const suma = filas.reduce((a, f) => ({ credito: a.credito + f.montoPrestado, saldo: a.saldo + f.saldoActual }), { credito: 0, saldo: 0 })
  const cuadraConTotales = !!totales && totales.credito === suma.credito && totales.saldo === suma.saldo
  return { formato: 'crossbox-planilla', fechaCorte, ruta, filas, totales, suma, cuadraConTotales }
}
```

- [ ] **Paso 5: ejecutarla, tiene que pasar**

Ejecutar: `npx vitest run lib/__tests__/planilla-crossbox.test.js`
Esperado: PASA (6 pruebas).

- [ ] **Paso 6: commit**

```bash
git add package.json package-lock.json lib/importar/planilla-crossbox.js lib/__tests__/planilla-crossbox.test.js lib/__tests__/fixtures/planilla-crossbox-paginas.json
git commit -m "Leer la «Planilla Recaudador» de Crossbox a partir del texto del PDF

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 2: deducir tasa, cuotas y frecuencia

**Ficheros:**
- Crear: `lib/importar/deducir-condiciones.js`
- Prueba: `lib/__tests__/deducir-condiciones.test.js`

**Interfaces:**
- Consume: `leerPlanillaCrossbox` y el fichero de prueba (tarea 1), solo en la prueba.
- Produce:
  - `deducirCondiciones(fila, { sinDomingos = true }) → { ok: true, tasaInteres, numeroCuotas, frecuencia, valorCuota, total, aviso } | { ok: false, motivo }`.
    - `fila` lleva `montoPrestado`, `saldoActual`, `valorCuota` (números), `sinAbonos`, `atrasadas` (número o `null`), `vencidos`, `fechaInicio`, `fechaCorte` (`'YYYY-MM-DD'`) y `nombre`.
    - `frecuencia` es `'diario' | 'semanal' | 'quincenal' | 'mensual'`.
  - `decidirDomingos(filas) → boolean`: `true` si «sin domingos» deduce más filas, o las mismas.
  - `fechasDeCuotas(inicio, frecuencia, n, sinDomingos) → Date[]`.

- [ ] **Paso 1: la prueba, que falla**

`lib/__tests__/deducir-condiciones.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { leerPlanillaCrossbox } from '@/lib/importar/planilla-crossbox'
import { deducirCondiciones, decidirDomingos } from '@/lib/importar/deducir-condiciones'

const { filas } = leerPlanillaCrossbox(JSON.parse(readFileSync(resolve(process.cwd(), 'lib/__tests__/fixtures/planilla-crossbox-paginas.json'), 'utf8')))
const fila = (n) => filas.find((f) => f.filaPlanilla === n)
const deducir = (n) => deducirCondiciones(fila(n), { sinDomingos: true })

describe('la planilla entera', () => {
  it('sin domingos cuadran 46; contando domingos, 41: la planilla es sin domingos', () => {
    const ok = (s) => filas.filter((f) => deducirCondiciones(f, { sinDomingos: s }).ok).length
    expect(ok(true)).toBe(46)
    expect(ok(false)).toBe(41)
    expect(decidirDomingos(filas)).toBe(true)
  })
  it('las tres que no se pueden deducir, cada una con su motivo', () => {
    const malas = filas.filter((f) => !deducirCondiciones(f, { sinDomingos: true }).ok).map((f) => f.filaPlanilla)
    expect(malas).toEqual([45, 48, 49])
    expect(deducir(45).motivo).toBe('No pudimos deducir la tasa y las cuotas de este crédito: créalo a mano con tus datos')
    expect(deducir(48).motivo).toBe('Los números de este crédito no tienen sentido (cuota o crédito demasiado pequeños): créalo a mano con tus datos')
    expect(deducir(49).ok).toBe(false)
  })
})

describe('casos concretos', () => {
  it('lo más común: 20 % en 24 cuotas diarias', () => {
    expect(deducir(2)).toMatchObject({ ok: true, tasaInteres: 20, numeroCuotas: 24, frecuencia: 'diario', valorCuota: 20000, total: 480000 })
    expect(deducir(3).aviso).toBe('Deducido: 20 % en 24 cuotas diarias; cuadra con su cuota atrasada')
    expect(deducir(2).aviso).toBe('Deducido: 20 % en 24 cuotas diarias; cuadra con su planilla (al día)')
  })
  it('«Nunca» abonó: el total es el saldo, y el redondeo de la cuota se dice', () => {
    expect(deducir(13)).toMatchObject({ tasaInteres: 60, numeroCuotas: 12, frecuencia: 'semanal', valorCuota: 106667, total: 1280004 })
    expect(deducir(13).aviso).toMatch(/total \$1\.280\.004 por el redondeo de la cuota$/)
  })
  it('el nombre manda en el empate («Semanal»)', () => {
    expect(deducir(15)).toMatchObject({ tasaInteres: 20, numeroCuotas: 4, frecuencia: 'semanal' })
  })
  it('«Vencidos» desempata: 4 semanales, no 4 diarias', () => {
    expect(deducir(39)).toMatchObject({ tasaInteres: 20, numeroCuotas: 4, frecuencia: 'semanal' })
  })
  it('una sola cuota va a un mes', () => {
    expect(deducir(1)).toMatchObject({ tasaInteres: 20, numeroCuotas: 1, frecuencia: 'mensual', total: 180000 })
    expect(deducir(1).aviso).toMatch(/^Deducido: 20 % en 1 cuota mensual/)
  })
  it('va adelantado (atrasadas negativas)', () => {
    expect(deducir(37)).toMatchObject({ tasaInteres: 20, numeroCuotas: 222, frecuencia: 'diario' })
    expect(deducir(37).aviso).toMatch(/va adelantado/)
  })
  it('«Nunca» pero con saldo menor que el crédito: se trata como con abonos', () => {
    expect(deducir(46)).toMatchObject({ tasaInteres: 40, numeroCuotas: 8, frecuencia: 'semanal', total: 560000 })
  })
  it('sin columna de atrasadas no se inventa un error: sale lo más común', () => {
    const r = deducirCondiciones({ montoPrestado: 300000, saldoActual: 200000, valorCuota: 15000, atrasadas: null, fechaInicio: '2026-09-01', fechaCorte: '2026-09-24', nombre: 'X' })
    expect(r).toMatchObject({ ok: true, tasaInteres: 20, numeroCuotas: 24, frecuencia: 'diario' })
  })
})
```

- [ ] **Paso 2: ejecutarla, tiene que fallar**

Ejecutar: `npx vitest run lib/__tests__/deducir-condiciones.test.js`
Esperado: FALLA al resolver `@/lib/importar/deducir-condiciones`.

- [ ] **Paso 3: la deducción**

`lib/importar/deducir-condiciones.js`:

```js
/* DEDUCIR TASA, CUOTAS Y FRECUENCIA — 24 sep 2026.
 *
 * Para el crédito que solo trae capital, saldo y cuota (la planilla de Crossbox, y
 * cualquier otro archivo así). El saldo es el del archivo, siempre; lo que se
 * deduce es cómo se llegó a él:
 *   · «Nunca» abonó (y el saldo no es menor que el crédito): el total es el saldo.
 *   · Si no: tasas del 10 al 60 % (primero el 20, lo más común) que den un número
 *     entero de cuotas, y cada frecuencia. Gana la que mejor explica sus cuotas
 *     «Atrasadas» a la fecha de corte.
 * Medido en la planilla real (49 créditos): sin domingos cuadran 46 y los 3 que no
 * son números sin sentido o casos ambiguos, que salen en error para crearlos a mano.
 * Pura: sin base de datos. Ver lib/__tests__/deducir-condiciones.test.js.
 */
const TASAS = [20, 10, 30, 40, 50, 60]
const FRECUENCIAS = ['diario', 'semanal', 'quincenal', 'mensual']
// Un crédito de UNA cuota no deja ver su frecuencia en las atrasadas: lo típico es a un mes.
const FRECUENCIAS_UNA_CUOTA = ['mensual', 'quincenal', 'semanal', 'diario']
const NOMBRE_FRECUENCIA = { diario: 'diarias', semanal: 'semanales', quincenal: 'quincenales', mensual: 'mensuales' }
const DIA = 864e5
const pesos = (n) => '$' + Math.round(n).toLocaleString('es-CO')
const fecha = (s) => new Date(`${String(s).slice(0, 10)}T12:00:00Z`)
/** a < b comparando posición por posición. */
const antes = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false }

const MOTIVO_ABSURDO = 'Los números de este crédito no tienen sentido (cuota o crédito demasiado pequeños): créalo a mano con tus datos'
const MOTIVO_NO_CUADRA = 'No pudimos deducir la tasa y las cuotas de este crédito: créalo a mano con tus datos'

/** Las fechas de las n cuotas de un préstamo que arranca en `inicio`. */
export function fechasDeCuotas(inicio, frecuencia, n, sinDomingos) {
  const base = fecha(inicio)
  const out = []
  let x = base
  for (let i = 1; i <= n; i++) {
    if (frecuencia === 'diario') {
      x = new Date(x.getTime() + DIA)
      while (sinDomingos && x.getUTCDay() === 0) x = new Date(x.getTime() + DIA)
    } else if (frecuencia === 'semanal') x = new Date(base.getTime() + 7 * i * DIA)
    else if (frecuencia === 'quincenal') x = new Date(base.getTime() + 15 * i * DIA)
    else x = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + i, Math.min(base.getUTCDate(), 28), 12))
    out.push(x)
  }
  return out
}

const pista = (nombre) => {
  const s = String(nombre ?? '').toLowerCase()
  return /semanal/.test(s) ? 'semanal' : /quincenal/.test(s) ? 'quincenal' : /mensual/.test(s) ? 'mensual' : /diario/.test(s) ? 'diario' : null
}

export function deducirCondiciones(fila, { sinDomingos = true } = {}) {
  const capital = Number(fila.montoPrestado) || 0
  const saldo = Number(fila.saldoActual)
  const cuota = Number(fila.valorCuota) || 0
  const atrasadas = fila.atrasadas == null || fila.atrasadas === '' ? null : Number(fila.atrasadas)
  const vencidos = Number(fila.vencidos) || 0
  if (capital < 10000 || !(cuota > 0) || !(saldo >= 0) || cuota < capital / 1000 || !fila.fechaInicio || !fila.fechaCorte) {
    return { ok: false, motivo: MOTIVO_ABSURDO }
  }

  const candidatos = []
  if (fila.sinAbonos && saldo >= capital) {
    const n = Math.max(1, Math.round(saldo / cuota))
    candidatos.push({ tasa: Math.round((saldo / capital - 1) * 10000) / 100, n, total: saldo })
  } else {
    for (const t of TASAS) {
      const total = Math.round(capital * (1 + t / 100))
      if (total < saldo) continue
      const n = Math.round(total / cuota)
      if (n < 1 || Math.abs(n * cuota - total) > n * 1000) continue
      candidatos.push({ tasa: t, n, total })
    }
  }

  const corte = fecha(fila.fechaCorte)
  const ayer = new Date(corte.getTime() - DIA)
  const preferida = pista(fila.nombre)
  let mejor = null
  for (const c of candidatos) {
    const pagadas = (c.total - saldo) / (c.total / c.n)
    const orden = c.n === 1 ? FRECUENCIAS_UNA_CUOTA : FRECUENCIAS
    for (const fr of orden) {
      const fechas = fechasDeCuotas(fila.fechaInicio, fr, c.n, sinDomingos)
      const ultima = fechas[fechas.length - 1]
      const diasVencido = Math.max(0, Math.round((corte - ultima) / DIA))
      for (const hasta of [ayer, corte]) {
        const vencidas = fechas.filter((x) => x <= hasta).length
        const err = atrasadas == null ? 0 : Math.abs(vencidas - pagadas - atrasadas)
        // Desempates, en orden: lo que cuadra con «Atrasadas», lo que dice el nombre,
        // el 20 % (lo más común), lo que cuadra con «Vencidos» (días desde la última
        // cuota) y el orden de frecuencias.
        const clave = [
          Math.round(err * 100),
          preferida && fr !== preferida ? 1 : 0,
          c.tasa === 20 ? 0 : 1,
          vencidos > 0 ? Math.abs(diasVencido - vencidos) : 0,
          orden.indexOf(fr),
        ]
        if (!mejor || antes(clave, mejor.clave)) mejor = { clave, err, c, fr }
      }
    }
  }
  if (!mejor || mejor.err > 1) return { ok: false, motivo: MOTIVO_NO_CUADRA }

  const { c, fr } = mejor
  const valorCuota = Math.ceil(c.total / c.n)
  const total = valorCuota * c.n
  const cuadra = atrasadas == null ? ''
    : atrasadas === 1 ? '; cuadra con su cuota atrasada'
      : atrasadas > 1 ? `; cuadra con sus ${atrasadas} cuotas atrasadas`
        : atrasadas === 0 ? '; cuadra con su planilla (al día)' : '; cuadra con su planilla (va adelantado)'
  // La cuota se redondea al peso hacia arriba: si el total cambia, se dice.
  const redondeo = total !== c.total ? `; total ${pesos(total)} por el redondeo de la cuota` : ''
  const cuotas = c.n === 1 ? `1 cuota ${fr === 'diario' ? 'diaria' : fr}` : `${c.n} cuotas ${NOMBRE_FRECUENCIA[fr]}`
  return {
    ok: true, tasaInteres: c.tasa, numeroCuotas: c.n, frecuencia: fr, valorCuota, total,
    aviso: `Deducido: ${String(c.tasa).replace('.', ',')} % en ${cuotas}${cuadra}${redondeo}`,
  }
}

/** ¿La planilla entera cuadra mejor sin domingos? Cuenta las filas que se deducen de cada manera. */
export function decidirDomingos(filas) {
  const cuenta = (sinDomingos) => filas.filter((f) => deducirCondiciones(f, { sinDomingos }).ok).length
  return cuenta(true) >= cuenta(false)
}
```

- [ ] **Paso 4: ejecutarla, tiene que pasar**

Ejecutar: `npx vitest run lib/__tests__/deducir-condiciones.test.js`
Esperado: PASA (10 pruebas).

- [ ] **Paso 5: commit**

```bash
git add lib/importar/deducir-condiciones.js lib/__tests__/deducir-condiciones.test.js
git commit -m "Deducir tasa, cuotas y frecuencia de un crédito que solo trae saldo y cuota

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 3: leer el PDF en el servidor

**Ficheros:**
- Crear: `lib/importar/pdf-texto.js`, `app/api/carga-masiva/leer-pdf/route.js`
- Prueba: `lib/__tests__/leer-pdf.test.js`

**Interfaces:**
- Consume: `leerPlanillaCrossbox` (tarea 1).
- Produce:
  - `paginasDePdf(buffer, { maxPaginas = 30 }) → Promise<{ paginas } | { error: 'demasiadas-paginas', numPages }>`, con `paginas: Array<Array<{ str, x, y }>>`;
  - `MAX_BYTES_PDF = 5 * 1024 * 1024`, `MAX_PAGINAS_PDF = 30`;
  - `MENSAJES_PDF = { falta, noEsPdf, pesado, paginas(n), desconocido, incompleto }`;
  - `POST /api/carga-masiva/leer-pdf` (FormData, campo `archivo`) → `200 { planilla }` o `4xx { error }`.

- [ ] **Paso 1: la prueba, que falla**

`lib/__tests__/leer-pdf.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import PDFDocument from 'pdfkit'
import { paginasDePdf, MENSAJES_PDF, MAX_PAGINAS_PDF, MAX_BYTES_PDF } from '@/lib/importar/pdf-texto'
import { leerPlanillaCrossbox } from '@/lib/importar/planilla-crossbox'

/** Un PDF de verdad, hecho con pdfkit: una página por texto. */
function pdfDe(textos) {
  return new Promise((ok) => {
    const doc = new PDFDocument()
    const partes = []
    doc.on('data', (c) => partes.push(c))
    doc.on('end', () => ok(Buffer.concat(partes)))
    textos.forEach((t, i) => { if (i) doc.addPage(); doc.text(t) })
    doc.end()
  })
}

describe('sacar el texto del PDF', () => {
  it('devuelve las piezas de cada página con su posición', async () => {
    const r = await paginasDePdf(await pdfDe(['Planilla Recaudador', 'Segunda página']))
    expect(r.paginas).toHaveLength(2)
    expect(r.paginas[0].some((p) => p.str.includes('Planilla Recaudador') && typeof p.x === 'number' && typeof p.y === 'number')).toBe(true)
  })
  it('se niega pasado el tope de páginas', async () => {
    const r = await paginasDePdf(await pdfDe(['a', 'b', 'c']), { maxPaginas: 2 })
    expect(r).toEqual({ error: 'demasiadas-paginas', numPages: 3 })
  })
  it('un PDF que no es la planilla: el lector da null (la ruta contesta «no es una planilla que sepamos leer»)', async () => {
    const r = await paginasDePdf(await pdfDe(['Factura de venta N.º 123']))
    expect(leerPlanillaCrossbox(r.paginas)).toBeNull()
  })
})

describe('los mensajes y los topes', () => {
  it('son los del diseño', () => {
    expect(MAX_PAGINAS_PDF).toBe(30)
    expect(MAX_BYTES_PDF).toBe(5 * 1024 * 1024)
    expect(MENSAJES_PDF.desconocido).toBe('Este PDF no es una planilla que sepamos leer. Escríbenos por WhatsApp y te ayudamos.')
    expect(MENSAJES_PDF.incompleto).toBe('No pudimos leer la planilla completa: los totales no cuadran con las filas. Escríbenos por WhatsApp y te ayudamos.')
    expect(MENSAJES_PDF.paginas(40)).toBe('Tu PDF tiene 40 páginas; el máximo es 30. Escríbenos por WhatsApp y te ayudamos.')
  })
})

describe('la ruta', () => {
  const src = readFileSync(resolve(process.cwd(), 'app/api/carga-masiva/leer-pdf/route.js'), 'utf8')
  it('solo el dueño, con tope de tamaño, y solo PDF de verdad', () => {
    expect(src).toMatch(/session\.user\.rol !== 'owner'/)
    expect(src).toMatch(/archivo\.size > MAX_BYTES_PDF/)
    expect(src).toMatch(/subarray\(0, 5\)\.toString\('latin1'\) !== '%PDF-'/)
  })
  it('no carga nada si no es la planilla o si no cuadra con sus totales', () => {
    expect(src).toMatch(/if \(!planilla \|\| planilla\.filas\.length === 0\)/)
    expect(src).toMatch(/if \(!planilla\.cuadraConTotales\)/)
  })
  it('solo exporta lo que Next permite en una ruta', () => {
    const exportados = [...src.matchAll(/^export (?:async )?(?:function|const) (\w+)/gm)].map((m) => m[1])
    expect(exportados.sort()).toEqual(['POST', 'runtime'])
  })
})
```

- [ ] **Paso 2: ejecutarla, tiene que fallar**

Ejecutar: `npx vitest run lib/__tests__/leer-pdf.test.js`
Esperado: FALLA al resolver `@/lib/importar/pdf-texto`.

- [ ] **Paso 3: `lib/importar/pdf-texto.js`**

```js
/* El texto de un PDF, página por página, con la posición de cada pieza. Lo usa
   la ruta /api/carga-masiva/leer-pdf; el lector de cada plantilla (hoy, la
   planilla de Crossbox) decide qué hay en él. Solo en el servidor. */
import { getDocumentProxy } from 'unpdf'

export const MAX_BYTES_PDF = 5 * 1024 * 1024
export const MAX_PAGINAS_PDF = 30

export const MENSAJES_PDF = {
  falta: 'Elige el PDF de tu planilla.',
  noEsPdf: 'Ese archivo no es un PDF.',
  pesado: 'El PDF pesa más de 5 MB. Escríbenos por WhatsApp y te ayudamos.',
  paginas: (n) => `Tu PDF tiene ${n} páginas; el máximo es ${MAX_PAGINAS_PDF}. Escríbenos por WhatsApp y te ayudamos.`,
  desconocido: 'Este PDF no es una planilla que sepamos leer. Escríbenos por WhatsApp y te ayudamos.',
  incompleto: 'No pudimos leer la planilla completa: los totales no cuadran con las filas. Escríbenos por WhatsApp y te ayudamos.',
}

export async function paginasDePdf(buffer, { maxPaginas = MAX_PAGINAS_PDF } = {}) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  if (pdf.numPages > maxPaginas) return { error: 'demasiadas-paginas', numPages: pdf.numPages }
  const paginas = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const { items } = await (await pdf.getPage(p)).getTextContent()
    paginas.push(items
      .filter((i) => typeof i.str === 'string' && i.str.trim())
      .map((i) => ({ str: i.str, x: Math.round(i.transform[4]), y: Math.round(i.transform[5]) })))
  }
  return { paginas }
}
```

- [ ] **Paso 4: `app/api/carga-masiva/leer-pdf/route.js`**

```js
// La «Planilla Recaudador» de Crossbox, subida en PDF: devuelve sus filas para la
// revisión de siempre. No guarda nada. Ver lib/importar/planilla-crossbox.js.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { paginasDePdf, MAX_BYTES_PDF, MENSAJES_PDF } from '@/lib/importar/pdf-texto'
import { leerPlanillaCrossbox } from '@/lib/importar/planilla-crossbox'

export const runtime = 'nodejs'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return Response.json({ error: 'Solo el administrador puede importar datos' }, { status: 403 })

  const form = await request.formData().catch(() => null)
  const archivo = form?.get('archivo')
  if (!archivo || typeof archivo.arrayBuffer !== 'function') return Response.json({ error: MENSAJES_PDF.falta }, { status: 400 })
  if (archivo.size > MAX_BYTES_PDF) return Response.json({ error: MENSAJES_PDF.pesado }, { status: 400 })

  const buffer = Buffer.from(await archivo.arrayBuffer())
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') return Response.json({ error: MENSAJES_PDF.noEsPdf }, { status: 400 })

  let leido
  try {
    leido = await paginasDePdf(buffer)
  } catch (err) {
    console.error('[carga-masiva/leer-pdf]', err?.message)
    return Response.json({ error: MENSAJES_PDF.desconocido }, { status: 422 })
  }
  if (leido.error) return Response.json({ error: MENSAJES_PDF.paginas(leido.numPages) }, { status: 400 })

  const planilla = leerPlanillaCrossbox(leido.paginas)
  if (!planilla || planilla.filas.length === 0) return Response.json({ error: MENSAJES_PDF.desconocido }, { status: 422 })
  // La cifra de control: si las filas no suman lo mismo que «Totales», falta algo.
  if (!planilla.cuadraConTotales) return Response.json({ error: MENSAJES_PDF.incompleto }, { status: 422 })

  return Response.json({ planilla })
}
```

- [ ] **Paso 5: ejecutarla, el build y el lint**

Ejecutar: `npx vitest run lib/__tests__/leer-pdf.test.js`. Esperado: PASA (7 pruebas).

Después, `npx next build`: tiene que compilar la ruta con `unpdf`. Si el empaquetador falla con `unpdf`, añadir `serverExternalPackages: ['unpdf']` a `next.config` y decirlo en el reporte.

Por último, `npx eslint app/api/carga-masiva/leer-pdf lib/importar/pdf-texto.js`, sin errores.

- [ ] **Paso 6: commit**

```bash
git add lib/importar/pdf-texto.js app/api/carga-masiva/leer-pdf/route.js lib/__tests__/leer-pdf.test.js
git commit -m "Leer el PDF en el servidor: /api/carga-masiva/leer-pdf devuelve la planilla

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 4: la validación deduce, y decide los domingos

**Ficheros:**
- Modificar:
  - `lib/carga-masiva.js`: `validarFila(fila, indice, cedulasExistentes, huellasExistentes = new Map(), opciones = {})`;
  - `lib/importar-cartera.js`: `validarCartera`.
- Prueba: `lib/__tests__/validar-planilla.test.js`

**Interfaces:**
- Consume:
  - `deducirCondiciones` y `decidirDomingos` (tarea 2);
  - `leerPlanillaCrossbox` y el fichero de prueba (tarea 1, en la prueba);
  - `parsearDiasSinCobro` de `lib/dias-sin-cobro.js` (ya existe: `[0]` → `[0]`, `'[]'` → `[]`, `null` → `null`).
- Produce:
  - `validarFila(..., { sinDomingos })`: deduce cuando la fila trae `fechaCorte` y no trae ni tasa ni plazo;
  - `validarCartera(...)` devuelve en `resumen`:
    - `sinDomingosSugerido: boolean | null`, que es `true` cuando la planilla va sin domingos y la cuenta no tiene nada, y `null` cuando no hubo nada que deducir o la cuenta ya tenía sus días;
    - `domingosConfigurados: boolean`.

- [ ] **Paso 1: la prueba, que falla**

`lib/__tests__/validar-planilla.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const org = vi.hoisted(() => ({ diasSinCobro: null, llamadas: 0 }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    cliente: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) },
    prestamo: { findMany: vi.fn(async () => []) },
    ruta: { findMany: vi.fn(async () => []) },
    organization: { findUnique: vi.fn(async () => { org.llamadas++; return { diasSinCobro: org.diasSinCobro } }) },
  },
}))

import { validarFila } from '@/lib/carga-masiva'
import { validarCartera } from '@/lib/importar-cartera'
import { leerPlanillaCrossbox } from '@/lib/importar/planilla-crossbox'

const { filas } = leerPlanillaCrossbox(JSON.parse(readFileSync(resolve(process.cwd(), 'lib/__tests__/fixtures/planilla-crossbox-paginas.json'), 'utf8')))
const fila = (n) => filas.find((f) => f.filaPlanilla === n)
const validar = (n) => validarFila(fila(n), n - 1, new Map(), new Map(), { sinDomingos: true })

beforeEach(() => { org.diasSinCobro = null; org.llamadas = 0 })

describe('validarFila con una fila de la planilla', () => {
  it('deduce, calcula el total y el abono previo sale del saldo', () => {
    const r = validar(2)
    expect(r.estado).toBe('advertencia')
    expect(r.errores).toEqual([])
    expect(r.datos).toMatchObject({ tasaInteres: 20, frecuencia: 'diario', valorCuota: 20000, abonadoHasta: 60000 })
    expect(r.calculado.totalAPagar).toBe(480000)
    expect(r.advertencias).toContain('Deducido: 20 % en 24 cuotas diarias; cuadra con su planilla (al día)')
  })
  it('«Nunca» con cuota que no divide: SIN abono previo inventado, y el total dice su redondeo', () => {
    const r = validar(13)
    expect(r.datos.abonadoHasta).toBe(0)
    expect(r.calculado.totalAPagar).toBe(1280004)
    expect(r.advertencias.some((a) => a.includes('por el redondeo de la cuota'))).toBe(true)
  })
  it('la que no se deduce sale con UN motivo, sin los errores de tasa y plazo', () => {
    const r = validar(45)
    expect(r.estado).toBe('error')
    expect(r.errores).toEqual(['No pudimos deducir la tasa y las cuotas de este crédito: créalo a mano con tus datos'])
  })
  it('una fila normal de Excel (con tasa) no se toca', () => {
    const r = validarFila({ nombre: 'Ana', cedula: '1', montoPrestado: 300000, tasaInteres: 20, numeroCuotas: 24, frecuencia: 'diario', fechaInicio: '2026-09-01' }, 0, new Map())
    expect(r.advertencias.some((a) => a.startsWith('Deducido'))).toBe(false)
  })
})

describe('validarCartera decide los domingos', () => {
  it('cuenta sin configurar: la planilla va sin domingos → se sugiere', async () => {
    const v = await validarCartera({ organizationId: 'o1', plan: 'starter', filas })
    expect(v.resumen.sinDomingosSugerido).toBe(true)
    expect(v.resumen.domingosConfigurados).toBe(false)
    expect(v.resumen.filasConError).toBe(3)
    expect(v.resumen.filasValidas).toBe(46)
  })
  it('la cuenta ya no cobra domingos: se respeta y no se sugiere nada', async () => {
    org.diasSinCobro = '[0]'
    const v = await validarCartera({ organizationId: 'o1', plan: 'starter', filas })
    expect(v.resumen.domingosConfigurados).toBe(true)
    expect(v.resumen.sinDomingosSugerido).toBeNull()
  })
  it('un Excel normal no pregunta por los domingos (ni consulta la cuenta)', async () => {
    const v = await validarCartera({ organizationId: 'o1', plan: 'starter', filas: [{ nombre: 'Ana', cedula: '1', montoPrestado: 300000, tasaInteres: 20, numeroCuotas: 24, frecuencia: 'diario', fechaInicio: '2026-09-01' }] })
    expect(v.resumen.sinDomingosSugerido).toBeNull()
    expect(org.llamadas).toBe(0)
  })
})
```

- [ ] **Paso 2: ejecutarla, tiene que fallar**

Ejecutar: `npx vitest run lib/__tests__/validar-planilla.test.js`
Esperado: FALLA (la fila 2 sale en error: no hay deducción).

- [ ] **Paso 3: `validarFila` deduce**

En `lib/carga-masiva.js`:
- añadir `import { deducirCondiciones } from '@/lib/importar/deducir-condiciones'` junto a los imports del principio;
- cambiar la firma a `export function validarFila(fila, indice, cedulasExistentes, huellasExistentes = new Map(), opciones = {}) {`;
- justo después de `const advertencias = []`:

```js
  /* LA FILA SIN TASA NI PLAZO, CON SALDO Y CUOTA (la planilla de Crossbox, 24 sep
     2026): se deducen tasa, cuotas y frecuencia. Ver lib/importar/deducir-condiciones.js. */
  let deduccion = null
  const sinCondiciones = (fila.tasaInteres == null || fila.tasaInteres === '') && !Number(fila.numeroCuotas) && !Number(fila.diasPlazo)
  if (fila.fechaCorte && sinCondiciones) {
    deduccion = deducirCondiciones({
      ...fila,
      montoPrestado: parsearNumero(fila.montoPrestado),
      saldoActual: parsearNumero(fila.saldoActual),
      valorCuota: parsearNumero(fila.valorCuota),
    }, { sinDomingos: opciones.sinDomingos !== false })
    if (deduccion.ok) {
      fila = {
        ...fila,
        tasaInteres: deduccion.tasaInteres,
        numeroCuotas: deduccion.numeroCuotas,
        frecuencia: deduccion.frecuencia,
        valorCuota: deduccion.valorCuota,
        // «Nunca» abonó: nada de abono previo, ni siquiera los pesos del redondeo.
        ...(fila.sinAbonos ? { saldoActual: '' } : {}),
      }
      advertencias.push(deduccion.aviso)
    }
  }
```

- justo antes de `if (tienePrestamo) {`, añadir `const erroresAntesDelPrestamo = errores.length`;
- justo antes de `if (existente && !repetido) {`:

```js
  // Si no se pudo deducir, UN motivo en vez de «tasa requerida», «plazo»…
  if (deduccion && !deduccion.ok) {
    errores.splice(erroresAntesDelPrestamo, errores.length - erroresAntesDelPrestamo, deduccion.motivo)
  }
```

Comprobar que `parsearNumero` está definida en el mismo fichero antes de `validarFila`: está en la línea ~131. Si hace falta, mover la declaración de `erroresAntesDelPrestamo` para que quede en el mismo ámbito que el `splice`.

- [ ] **Paso 4: `validarCartera` decide los domingos**

En `lib/importar-cartera.js`:
- añadir `import { decidirDomingos } from '@/lib/importar/deducir-condiciones'`, `import { parsearDiasSinCobro } from '@/lib/dias-sin-cobro'` y `parsearNumero` al import de `@/lib/carga-masiva`;
- dentro de `validarCartera`, antes de `const filasValidadas = …`:

```js
  /* ¿Hay filas que deducir (sin tasa ni plazo)? Entonces hay que saber antes si
     se cuentan los domingos: si la cuenta ya lo tiene configurado, manda eso; si
     no, se decide con la planilla entera y se le SUGIERE al dueño. */
  const deducibles = filas.filter((f) => f.fechaCorte && (f.tasaInteres == null || f.tasaInteres === '') && !Number(f.numeroCuotas) && !Number(f.diasPlazo))
  let sinDomingos = true
  let sinDomingosSugerido = null
  let domingosConfigurados = false
  if (deducibles.length > 0) {
    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { diasSinCobro: true } })
    const dias = parsearDiasSinCobro(org?.diasSinCobro)
    domingosConfigurados = Array.isArray(dias) && dias.includes(0)
    if (dias && dias.length > 0) {
      sinDomingos = dias.includes(0)
    } else {
      sinDomingos = decidirDomingos(deducibles.map((f) => ({
        ...f,
        montoPrestado: parsearNumero(f.montoPrestado),
        saldoActual: parsearNumero(f.saldoActual),
        valorCuota: parsearNumero(f.valorCuota),
      })))
      sinDomingosSugerido = sinDomingos ? true : null
    }
  }
```

- cambiar la llamada a `validarFila(fila, i, cedulasExistentes, huellasExistentes, { sinDomingos })`;
- añadir al objeto `resumen` devuelto: `sinDomingosSugerido,` y `domingosConfigurados,`.

- [ ] **Paso 5: ejecutarla, y la suite**

Ejecutar: `npx vitest run lib/__tests__/validar-planilla.test.js`. Esperado: PASA (7 pruebas).

Después, `npx vitest run`: las pruebas del importador que ya existen tienen que seguir en verde. Una fila con tasa no toca la deducción.

- [ ] **Paso 6: commit**

```bash
git add lib/carga-masiva.js lib/importar-cartera.js lib/__tests__/validar-planilla.test.js
git commit -m "La validación deduce las condiciones de la planilla y decide los domingos

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 5: importar guarda «no cobro los domingos» si él lo deja marcado

**Ficheros:**
- Modificar: `app/api/carga-masiva/importar/route.js`
- Prueba: `lib/__tests__/importar-domingos.test.js`

**Interfaces:**
- Consume: `parsearDiasSinCobro` (existe), `logActividad` (existe).
- Produce: `POST /api/carga-masiva/importar` acepta `noCobrarDomingos: true`. Si la cuenta no tiene días sin cobro, guarda `'[0]'` **antes** de importar (así el estado de mora de cada cliente ya sale sin domingos) y lo deja en el Historial.

- [ ] **Paso 1: la prueba, que falla**

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
const src = readFileSync(resolve(process.cwd(), 'app/api/carga-masiva/importar/route.js'), 'utf8')

describe('importar con «no cobro los domingos»', () => {
  it('solo con la casilla, solo si la cuenta no tiene nada, y ANTES de importar', () => {
    expect(src).toMatch(/const \{ filas, rutaId, crearRuta, noCobrarDomingos \} = await request\.json\(\)/)
    expect(src).toMatch(/if \(noCobrarDomingos === true\) \{/)
    expect(src).toMatch(/if \(!dias \|\| dias\.length === 0\) \{/)
    expect(src).toMatch(/data: \{ diasSinCobro: '\[0\]' \}/)
    expect(src.indexOf("diasSinCobro: '[0]'")).toBeLessThan(src.indexOf('await importarCartera('))
  })
  it('queda en el Historial', () => {
    expect(src).toMatch(/accion: 'editar_configuracion'[\s\S]{0,200}Días sin cobro: ninguno → domingo/)
  })
})
```

- [ ] **Paso 2: ejecutarla, tiene que fallar**

Ejecutar: `npx vitest run lib/__tests__/importar-domingos.test.js`. Esperado: FALLA.

- [ ] **Paso 3: la ruta**

En `app/api/carga-masiva/importar/route.js`:
- añadir `import { prisma } from '@/lib/prisma'` y `import { parsearDiasSinCobro } from '@/lib/dias-sin-cobro'`;
- cambiar `const { filas, rutaId, crearRuta } = await request.json()` por `const { filas, rutaId, crearRuta, noCobrarDomingos } = await request.json()`;
- justo antes de `const r = await importarCartera(`:

```js
    /* «Tu planilla cuenta sin domingos: no cobro los domingos» (la revisión la
       ofrece marcada; él decide). Solo si la cuenta no tiene días sin cobro, y
       ANTES de importar: así el estado de cada cliente ya sale sin domingos. */
    if (noCobrarDomingos === true) {
      const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { diasSinCobro: true } })
      const dias = parsearDiasSinCobro(org?.diasSinCobro)
      if (!dias || dias.length === 0) {
        await prisma.organization.update({ where: { id: organizationId }, data: { diasSinCobro: '[0]' } })
        logActividad({
          session,
          accion: 'editar_configuracion',
          entidadTipo: 'organizacion',
          detalle: 'Días sin cobro: ninguno → domingo (al importar su planilla)',
          ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
        })
      }
    }
```

- [ ] **Paso 4: ejecutarla, tiene que pasar**

Ejecutar: `npx vitest run lib/__tests__/importar-domingos.test.js`. Esperado: PASA.

- [ ] **Paso 5: commit**

```bash
git add app/api/carga-masiva/importar/route.js lib/__tests__/importar-domingos.test.js
git commit -m "Importar guarda «no cobro los domingos» si el dueño deja la casilla marcada

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 6: la pantalla

**Ficheros:**
- Modificar:
  - `lib/archivos-tabla.js`: `ACCEPT_CARTERA` y `esPdf`;
  - `components/carga-masiva/PasoSubir.jsx`;
  - `app/(dashboard)/carga-masiva/page.jsx`;
  - `components/carga-masiva/PasoRevisar.jsx`;
  - `components/carga-masiva/PasoConfirmar.jsx`;
  - `lib/__tests__/subir-archivo-en-movil.test.js`: PasoSubir usa `ACCEPT_CARTERA`.
- Prueba: `lib/__tests__/importar-pdf-pantalla.test.js`

**Interfaces:**
- Consume:
  - `POST /api/carga-masiva/leer-pdf` (tarea 3) → `{ planilla: { ruta, fechaCorte, filas, ... } }`;
  - `resumen.sinDomingosSugerido` y `resumen.domingosConfigurados` (tarea 4);
  - `noCobrarDomingos` en importar (tarea 5).
- Produce:
  - `ACCEPT_CARTERA: string`, que es `ACCEPT_TABLA` más `.pdf` y `application/pdf`;
  - `esPdf(file) → boolean`;
  - `<PasoSubir onDatos onPlanilla />`;
  - `<PasoRevisar ... planilla />`, con `planilla = { ruta, fechaCorte, filas: número } | null`;
  - `onConfirmar({ filas, rutaId, crearRuta, noCobrarDomingos })`.

- [ ] **Paso 1: la prueba, que falla**

`lib/__tests__/importar-pdf-pantalla.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { ACCEPT_CARTERA, ACCEPT_TABLA, esPdf } from '@/lib/archivos-tabla'
const src = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')

describe('subir el PDF', () => {
  it('el importador acepta PDF además de todo lo de siempre', () => {
    for (const t of ACCEPT_TABLA.split(',')) expect(ACCEPT_CARTERA).toContain(t)
    expect(ACCEPT_CARTERA).toContain('.pdf')
    expect(ACCEPT_CARTERA).toContain('application/pdf')
    expect(esPdf({ type: 'application/pdf', name: 'x' })).toBe(true)
    expect(esPdf({ type: 'application/octet-stream', name: 'Planilla.PDF' })).toBe(true)
    expect(esPdf({ type: 'text/csv', name: 'a.csv' })).toBe(false)
  })
  it('PasoSubir manda el PDF al servidor y no a SheetJS', () => {
    const s = src('components/carga-masiva/PasoSubir.jsx')
    expect(s).toMatch(/accept=\{ACCEPT_CARTERA\}/)
    expect(s).toMatch(/if \(esPdf\(file\)\) \{/)
    expect(s).toMatch(/form\.append\('archivo', file\)/)
    expect(s).toMatch(/fetch\('\/api\/carga-masiva\/leer-pdf', \{ method: 'POST', body: form \}\)/)
    expect(s).toMatch(/onPlanilla\(data\.planilla\)/)
  })
})

describe('la planilla se salta el mapeo y va a la revisión', () => {
  it('la página valida las filas de la planilla y pasa al paso 3', () => {
    const p = src('app/(dashboard)/carga-masiva/page.jsx')
    expect(p).toMatch(/const handlePlanilla = async \(pl\) => \{/)
    expect(p).toMatch(/<PasoSubir onDatos=\{handleDatosCrudos\} onPlanilla=\{handlePlanilla\} \/>/)
    expect(p).toMatch(/planilla=\{planilla\}/)
  })
  it('la revisión: el recuadro, la casilla de domingos y la ruta de la planilla', () => {
    const r = src('components/carga-masiva/PasoRevisar.jsx')
    expect(r).toMatch(/Leímos tu planilla de Crossbox/)
    expect(r).toMatch(/label="Tu planilla cuenta sin domingos: no cobro los domingos"/)
    expect(r).toMatch(/noCobrarDomingos: mostrarDomingos && noCobrarDomingos,/)
    expect(r).toMatch(/useState\(\(\) => !!planilla\?\.ruta && !rutaDePlanilla\)/)
  })
  it('confirmar manda la casilla', () => {
    expect(src('components/carga-masiva/PasoConfirmar.jsx')).toMatch(/body: JSON\.stringify\(\{ filas, rutaId, crearRuta, noCobrarDomingos \}\)/)
  })
})
```

- [ ] **Paso 2: ejecutarla, tiene que fallar**

Ejecutar: `npx vitest run lib/__tests__/importar-pdf-pantalla.test.js`. Esperado: FALLA (no existe `ACCEPT_CARTERA`).

- [ ] **Paso 3: `lib/archivos-tabla.js`**

Al final del fichero:

```js
/* El importador de cartera acepta además el PDF de la «Planilla Recaudador» de
   Crossbox (lo lee el servidor). Solo él: el asistente de inicio sigue con tablas. */
export const ACCEPT_CARTERA = [ACCEPT_TABLA, '.pdf', 'application/pdf'].join(',')

export const esPdf = (file) => file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name || '')
```

En `lib/__tests__/subir-archivo-en-movil.test.js`, dentro de `it(\`${f} usa la lista compartida\`…`, cambiar `expect(src).toMatch(/accept=\{ACCEPT_TABLA\}/)` por `expect(src).toMatch(/accept=\{ACCEPT_(TABLA|CARTERA)\}/)`.

- [ ] **Paso 4: `PasoSubir.jsx`**

- Import: `import { ACCEPT_CARTERA, AVISO_HOJA_DE_GOOGLE, esPdf } from '@/lib/archivos-tabla'`, en lugar de `ACCEPT_TABLA`.
- Firma: `export default function PasoSubir({ onDatos, onPlanilla }) {`.
- En `handleArchivo`, justo después de `setCargando(true)` y antes del `try` que usa SheetJS:

```js
    // La «Planilla Recaudador» de Crossbox en PDF: la lee el servidor.
    if (esPdf(file)) {
      try {
        const form = new FormData()
        form.append('archivo', file)
        const res = await fetch('/api/carga-masiva/leer-pdf', { method: 'POST', body: form })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) { setError(data.error || 'No pudimos leer el PDF.'); return }
        onPlanilla(data.planilla)
      } catch {
        setError('Error de conexión. Intenta de nuevo.')
      } finally {
        setCargando(false)
        if (fileRef.current) fileRef.current.value = ''
      }
      return
    }
```

- El `<input>`: `accept={ACCEPT_CARTERA}`.
- El texto debajo de «Toca para seleccionar archivo»: `Excel (.xlsx, .xls), CSV o la planilla PDF de Crossbox`.

- [ ] **Paso 5: `page.jsx`**

- Estado nuevo, junto a los demás: `const [planilla, setPlanilla] = useState(null)   // { ruta, fechaCorte, filas } cuando vino de un PDF`.
- Nuevo manejador, junto a `handleDatosCrudos`:

```js
  /* La planilla de Crossbox (PDF) ya viene con sus campos: se salta «Columnas» y
     va directo a validar. */
  const handlePlanilla = async (pl) => {
    setValidando(true)
    setError('')
    try {
      const data = await validar(pl.filas)
      if (data.error) { setError(data.error); return }
      setPlanilla({ ruta: pl.ruta, fechaCorte: pl.fechaCorte, filas: pl.filas.length })
      setFilasMapeadas(pl.filas)
      setFilasValidadas(data.filas)
      setResumen(data.resumen)
      setRutas(data.rutas)
      setPaso(3)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setValidando(false)
    }
  }
```

- En `handleVolver`, al principio: `if (paso === 3 && planilla) { setPlanilla(null); setPaso(1); return }`. Si `handleVolver` no existe con ese nombre, localizar la función que usa `setPaso((p) => p - 1)` y ponerlo ahí.
- En `handleReiniciar`: `setPlanilla(null)`.
- Render:
  - `<PasoSubir onDatos={handleDatosCrudos} onPlanilla={handlePlanilla} />`;
  - en `<PasoRevisar …>`, añadir `planilla={planilla}`.

- [ ] **Paso 6: `PasoRevisar.jsx`**

- Imports: `import { Checkbox } from '@/components/ui/Checkbox'` y `import { formatFechaCalendario } from '@/lib/i18n'`.
- Firma: `export default function PasoRevisar({ filas, resumen, rutas, onConfirmar, onVolver, onCorregir, corrigiendo = false, planilla = null }) {`.
- El estado de ruta arranca con la ruta de la planilla. Cambiar los tres `useState` de ruta por:

```js
  // Si vino de la planilla, «RUTA 1»: la existente con ese nombre, o crearla.
  const rutaDePlanilla = planilla?.ruta ? rutas.find((r) => r.nombre.trim().toLowerCase() === planilla.ruta.trim().toLowerCase()) : null
  const [rutaId, setRutaId] = useState(() => rutaDePlanilla?.id || '')
  const [nuevaRuta, setNuevaRuta] = useState(() => (planilla?.ruta && !rutaDePlanilla ? planilla.ruta : ''))
  const [crearNueva, setCrearNueva] = useState(() => !!planilla?.ruta && !rutaDePlanilla)
  const mostrarDomingos = resumen.sinDomingosSugerido === true && !resumen.domingosConfigurados
  const [noCobrarDomingos, setNoCobrarDomingos] = useState(true)
```

- En `handleConfirmar`, añadir a `onConfirmar({...})` la línea `noCobrarDomingos: mostrarDomingos && noCobrarDomingos,`.
- Justo antes del bloque `{/* Asignar ruta */}`:

```jsx
      {planilla && (
        <div className="bg-[var(--cf-card)] border border-[var(--cf-border)] rounded-[12px] p-4 space-y-3">
          <p className="text-sm text-[var(--cf-ink)]">
            Leímos tu planilla de Crossbox: <strong>{planilla.ruta || 'sin ruta'}</strong>, corte al {formatFechaCalendario(planilla.fechaCorte)}, {planilla.filas} créditos.
            {' '}La tasa y las cuotas son deducidas: revisa los avisos de cada cliente.
          </p>
          {mostrarDomingos && (
            <Checkbox
              checked={noCobrarDomingos}
              onChange={setNoCobrarDomingos}
              label="Tu planilla cuenta sin domingos: no cobro los domingos"
              description="Se guarda en tu configuración al importar. Así la mora se cuenta como en tu app anterior."
            />
          )}
        </div>
      )}
```

- [ ] **Paso 7: `PasoConfirmar.jsx`**

- `const { filas, rutaId, crearRuta, noCobrarDomingos } = datosImportar`
- `body: JSON.stringify({ filas, rutaId, crearRuta, noCobrarDomingos }),`
- En el resumen previo a importar, donde ya se enseña `crearRuta`, añadir después:

```jsx
      {noCobrarDomingos && (
        <p className="text-sm text-[var(--cf-ink-2)]">No cobras los domingos: se guarda en tu configuración.</p>
      )}
```

- [ ] **Paso 8: pruebas, lint y build**

Ejecutar:
- `npx vitest run lib/__tests__/importar-pdf-pantalla.test.js lib/__tests__/subir-archivo-en-movil.test.js`: PASAN.
- `npx vitest run` (entera).
- `npx eslint app components`: 53/9 sin nuevos.
- `npx next build`: compila.

- [ ] **Paso 9: commit**

```bash
git add lib/archivos-tabla.js components/carga-masiva/PasoSubir.jsx "app/(dashboard)/carga-masiva/page.jsx" components/carga-masiva/PasoRevisar.jsx components/carga-masiva/PasoConfirmar.jsx lib/__tests__/importar-pdf-pantalla.test.js lib/__tests__/subir-archivo-en-movil.test.js
git commit -m "Subir la planilla PDF de Crossbox: se salta el mapeo, recuadro, domingos y ruta

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 7: de punta a punta en el espejo

**Ficheros:**
- Crear: `.auditoria/_planilla-pdf-espejo.mjs` (no va a git)

**Interfaces:**
- Consume: todo lo anterior.
- Produce: nada.

- [ ] **Paso 1: build y espejo**

```bash
npx next build
bash .auditoria/arrancar-espejo.sh   # sirve el espejo en :3016, sin claves reales
```

Cuenta de prueba: org `cmm7iigyr00011t2rwyg9luph`, dueño `cmm7iigz600031t2rqrfksymp`. JWT de prueba con el secreto del espejo, como en `.auditoria/_importar-pantalla.mjs`. Antes de empezar, guardar por SQL para reponerlos al final:
- `Organization.diasSinCobro`;
- el `saldo` de su `Capital`;
- sus rutas.

- [ ] **Paso 2: el guion, en 412 px y en 1366 px**

1. Abre `/carga-masiva` y sube el PDF real: `~/Descargas/PlanillaRecaudador-RUTA 1.24-Sep-2026 (1).pdf`.
2. Comprueba que va **directo** a la revisión, sin «Columnas», y que el recuadro dice «Leímos tu planilla de Crossbox: RUTA 1, corte al … 49 créditos».
3. Comprueba 46 a crear y 3 con errores (las filas 45, 48 y 49), cada una con su motivo.
4. Si la cuenta de prueba no tenía días sin cobro, la casilla de domingos se ve marcada.
5. «Asignar a ruta» dice «+ Crear ruta nueva: RUTA 1», o la RUTA 1 que ya exista.
6. Importa y comprueba por SQL:
   - los préstamos creados tienen `totalAPagar − pagado` igual al saldo del PDF (menos las 3 excluidas);
   - `diasSinCobro` pasó a `'[0]'`, si la casilla se vio.
7. Sube un PDF que no es la planilla (por ejemplo `~/Descargas/Pre_0000055051_es.pdf`) y comprueba el mensaje «Este PDF no es una planilla que sepamos leer…».
8. Guarda las capturas en `informes/` (no va a git).
9. **Limpieza:** borra lo creado (clientes, préstamos, pagos, movimientos y la ruta si se creó) y repone `diasSinCobro` y el saldo de `Capital`.

- [ ] **Paso 3: reporte**

Cada punto con PASA o FALLA y su evidencia (URL, texto visible, cifras SQL antes y después). Sin nombres ni teléfonos reales en el reporte.

El despliegue (subir `CACHE_NAME`, push y deploy) **espera el visto bueno del dueño**.
