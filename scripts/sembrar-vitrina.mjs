// scripts/sembrar-vitrina.mjs — el negocio de mentira del que salen las guías.
//
// ══ POR QUÉ EXISTE, Y POR QUÉ ESTÁ AQUÍ Y NO EN EL VPS ═════════════════════
//
// Las 34 guías de `/tutoriales` se fotografían de un negocio INVENTADO —
// «Créditos La Esperanza»— y nunca del espejo, porque esas imágenes se sirven a
// los 429 negocios de producción: una captura del espejo publicaría nombres,
// cédulas y deudas de gente real. `capturar-tutoriales.mjs` lo comprueba antes
// de disparar y aborta si ve un cliente que no está en su lista blanca.
//
// ⚠ EL SEMBRADOR ANTERIOR VIVÍA SUELTO EN EL VPS Y SE PERDIÓ. El 31 ago 2026 la
// vitrina estaba vacía —0 clientes, 0 préstamos, 0 usuarios— y su guion no
// aparecía por ningún lado del disco. Consecuencia: ninguna de las 34 guías se
// podía regenerar, aunque las imágenes viejas siguieran sirviendo. Por eso esto
// vive en el repo, al lado del guion que lo necesita.
//
// ── SON DOS VITRINAS ───────────────────────────────────────────────────────
//
//   · «Créditos La Esperanza» (`vitrina_org_tutoriales`) — la LLENA. La que
//     siembra este guion, y de la que sale casi todo.
//   · «Mi Negocio Nuevo» (`vitrina_org_vacia`) — la de CERO. No se siembra
//     NUNCA: su valor es estar vacía.
//
// La segunda existe porque varias guías enseñan la pantalla de PRIMERA VEZ
// —«Registrar capital inicial», «Crear primera ruta»— y ese estado no puede
// convivir con un negocio que ya tiene préstamos: en cuanto hay un desembolso
// el capital deja de estar sin configurar y el botón desaparece. Con una sola
// vitrina esos pasos se quedaban sin captura, y encima los rótulos cambian con
// el estado («Nueva ruta» vs «Crear primera ruta»).
//
// Un paso la pide con `vitrina: 'vacia'` en `pasos-tutoriales.mjs`.
//
// ⚠ SU COMPROBACIÓN VA AL REVÉS que la de la llena: a la llena se le exige que
// sus clientes estén en la lista blanca; a la vacía, estar VACÍA. Si algún día
// tuviera clientes, o la sesión apunta a otro sitio o alguien la usó para
// trabajar — y en los dos casos fotografiarla publicaría datos de alguien.
//
// La de cero se crea con el mismo SQL de abajo cambiando los ids y el nombre;
// no necesita nada más.
//
// ── QUÉ SIEMBRA (la llena) ─────────────────────────────────────────────────
//
// Lo mínimo para que las 34 guías tengan algo que fotografiar, sin más:
//   · los 8 clientes de la lista blanca de `capturar-tutoriales.mjs`
//   · una ruta con clientes dentro, y un cobrador asignado
//   · préstamos en varios modos —el PRIMERO es el que sale en las 8 guías de
//     préstamo, así que lleva pagos hechos y sirve para todas
//   · pagos, para que el historial no salga vacío
//
// ── CÓMO SE USA ────────────────────────────────────────────────────────────
//
//   1. el espejo en pie:  bash .auditoria/arrancar-espejo.sh
//   2. sembrar:           node scripts/sembrar-vitrina.mjs
//   3. capturar:          BASE_CAPTURAS=http://localhost:3016 node scripts/capturar-tutoriales.mjs
//
// ⚠ SIEMBRA POR LA API, NO POR SQL. Un préstamo escrito a mano tendría el
// `totalAPagar` y la tabla de amortización inventados por mí, y las capturas
// enseñarían cuentas que la app nunca habría calculado así. Pasando por la API
// las cifras son las que el sistema calcula de verdad.
//
// La organización y el dueño SÍ van por SQL, una sola vez, porque no hay API
// que los cree con un id fijo. Si faltan, este guion lo dice y da el SQL.

import { encode } from 'next-auth/jwt'

const BASE = process.env.BASE_VITRINA || 'http://localhost:3016'
const SECRETO = process.env.SECRETO_ESPEJO || 'prueba-rediseno-2026-no-usar-en-produccion-8f3a1c'
const ORG = 'vitrina_org_tutoriales'
const DUENO = 'vitrina_user_tutoriales'

/* ⚠ LOS NOMBRES SON LOS DE LA LISTA BLANCA de `capturar-tutoriales.mjs`. Si se
   cambian aquí y no allí, el guion de capturas aborta creyendo que son clientes
   reales — que es exactamente lo que esa guardia viene a evitar. */
const CLIENTES = [
  { nombre: 'Steven Olmos',            cedula: '1017234501', telefono: '3001234501', direccion: 'Calle 45 #12-30, Manrique' },
  { nombre: 'Carlitos Chaparro',       cedula: '1017234502', telefono: '3001234502', direccion: 'Carrera 50 #78-14, Aranjuez' },
  { nombre: 'María Fernanda Restrepo', cedula: '1017234503', telefono: '3001234503', direccion: 'Calle 10 #43-22, Poblado' },
  { nombre: 'Jhoan Sebastián Cruz',    cedula: '1017234504', telefono: '3001234504', direccion: 'Carrera 80 #33-11, Laureles' },
  { nombre: 'Marta Lucía Ríos',        cedula: '1017234505', telefono: '3001234505', direccion: 'Calle 103 #65-40, Castilla' },
  { nombre: 'Julián Vélez',            cedula: '1017234506', telefono: '3001234506', direccion: 'Carrera 47 #96-18, Belén' },
  { nombre: 'Ana Milena Guzmán',       cedula: '1017234507', telefono: '3001234507', direccion: 'Calle 30 #70-55, Envigado' },
  { nombre: 'Diego Alejandro Peña',    cedula: '1017234508', telefono: '3001234508', direccion: 'Carrera 65 #48-09, Itagüí' },
]

/* ⚠ EL ÚLTIMO DE ESTA LISTA ES EL QUE SALE EN LAS OCHO GUÍAS DE PRÉSTAMO.
 *
 * El guion de capturas coge `/api/prestamos?limit=1`, y esa API devuelve **el
 * más reciente primero**. Así que el préstamo de la vitrina es el que se crea
 * AL FINAL, no el primero de esta lista.
 *
 * Lo aprendí por las malas: dejé el préstamo sin pagos para el final y la guía
 * de «ver y gestionar los pagos» falló tres pasos seguidos —el chip «Pagos» no
 * se pinta si no hay ninguno—.
 *
 * El de la vitrina va en el caso más común —cuota fija, diario— y con pagos
 * hechos, que es lo que necesitan a la vez el historial, el cierre anticipado y
 * la ficha, para que ninguna salga vacía. */
const PRESTAMOS = [
  { cliente: 4, montoPrestado: 400000,  tasaInteres: 20, diasPlazo: 30,  frecuencia: 'diario', modoInteres: 'fijo', pagos: 0, desdeHace: 3 },
  { cliente: 1, montoPrestado: 1500000, tasaInteres: 10, diasPlazo: 180, frecuencia: 'mensual', modoInteres: 'solo_interes', pagos: 2, desdeHace: 70 },
  { cliente: 2, montoPrestado: 600000,  tasaInteres: 20, diasPlazo: 60,  frecuencia: 'semanal', modoInteres: 'fijo', pagos: 3, desdeHace: 21 },
  { cliente: 3, montoPrestado: 2000000, tasaInteres: 8,  diasPlazo: 180, frecuencia: 'mensual', modoInteres: 'saldo', pagos: 1, desdeHace: 40 },
  /* ⚠ EL DE LA VITRINA. Va el último a propósito (ver arriba) y ATRASADO a
     propósito, que es lo contrario de lo que yo supuse primero.
     El botón de cobrar es `isUrgente ? 'Pagar ahora · vencido' : 'Registrar
     pago diario'`, y la guía de registrar un pago señala «Pagar ahora». Con el
     préstamo al día ese rótulo no existe y la guía se queda sin sus dos pasos.
     Doce días de vida y seis cuotas pagadas lo dejan con unos días de atraso:
     suficiente para el rótulo, y sin que la ficha parezca abandonada. */
  { cliente: 0, montoPrestado: 1000000, tasaInteres: 20, diasPlazo: 30, frecuencia: 'diario', modoInteres: 'fijo', pagos: 6, desdeHace: 12 },
]

const token = await encode({
  token: {
    id: DUENO, sub: DUENO, email: 'vitrina@ejemplo.test',
    nombre: 'Carlos Ramírez', name: 'Carlos Ramírez',
    rol: 'owner', organizationId: ORG, plan: 'professional', country: 'co', rutaIds: [],
  },
  secret: SECRETO,
})

const api = async (ruta, cuerpo, metodo = 'POST') => {
  const r = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Cookie: `next-auth.session-token=${token}` },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  })
  const txt = await r.text()
  let j = null
  try { j = JSON.parse(txt) } catch { /* una pantalla de error devuelve HTML */ }
  if (!r.ok) throw new Error(`${metodo} ${ruta} → ${r.status}: ${(j?.error ?? txt).slice(0, 160)}`)
  return j
}

// ── 0 · ¿está la organización? ─────────────────────────────────────────────
try {
  await api('/api/clientes?limit=1', null, 'GET')
} catch (e) {
  console.error('No pude leer como la vitrina:', e.message)
  console.error(`
La organización y el dueño se crean UNA vez, por SQL:

  INSERT IGNORE INTO Organization (id, nombre, plan, telefono, ciudad, activo, createdAt, country, timezone, onboardingStep)
  VALUES ('${ORG}', 'Créditos La Esperanza', 'professional', '3001112233', 'Medellín', 1, NOW(), 'co', 'America/Bogota', 99);
  -- ⚠ EL TELÉFONO DEL USUARIO NO ES ADORNO (va abajo, en User). Sin él,
  --   «Agrega tu número de celular» se abre encima de la pantalla y arruina la
  --   captura: el aro señala «Guardar y continuar» en vez de la fila que la
  --   guía quería enseñar. Pasó, y la imagen salía perfecta salvo que enseñaba
  --   otra cosa. Lo mira CompletarTelefonoModal contra User.telefono, NO contra
  --   el de la organización: probé primero con el de la organización y el aviso
  --   siguió saliendo.
  --   (Sin acentos graves aquí dentro: esto vive en una plantilla de texto y un
  --    acento grave la cierra. Ya rompió el guion una vez.)
  INSERT IGNORE INTO User (id, nombre, email, password, telefono, rol, organizationId, createdAt)
  VALUES ('${DUENO}', 'Carlos Ramírez', 'vitrina@ejemplo.test', '(cualquier hash)', '3001112233', 'owner', '${ORG}', NOW());
`)
  process.exit(1)
}

const yaHay = (await api('/api/clientes?limit=60', null, 'GET'))
const listaPrevia = Array.isArray(yaHay) ? yaHay : (yaHay?.clientes ?? [])
if (listaPrevia.length) {
  console.log(`la vitrina ya tiene ${listaPrevia.length} clientes — no se toca nada`)
  console.log('   (para rehacerla, bórralos primero)')
  process.exit(0)
}

// ── 1 · la ruta ────────────────────────────────────────────────────────────
const ruta = await api('/api/rutas', { nombre: 'Ruta Centro', descripcion: 'Manrique y Aranjuez' })
console.log(`✓ ruta «${ruta?.nombre ?? 'Ruta Centro'}»`)

// ── 2 · los clientes ───────────────────────────────────────────────────────
const ids = []
for (const c of CLIENTES) {
  const hecho = await api('/api/clientes', { ...c, rutaId: ruta?.id })
  ids.push(hecho?.id ?? hecho?.cliente?.id)
  console.log(`✓ ${c.nombre}`)
}

// ── 3 · los préstamos, y sus pagos ─────────────────────────────────────────
const hoy = new Date()
const haceDias = (n) => new Date(hoy.getTime() - n * 86400000).toISOString().slice(0, 10)

for (const p of PRESTAMOS) {
  const prestamo = await api('/api/prestamos', {
    clienteId: ids[p.cliente],
    montoPrestado: p.montoPrestado,
    tasaInteres: p.tasaInteres,
    diasPlazo: p.diasPlazo,
    frecuencia: p.frecuencia,
    modoInteres: p.modoInteres,
    /* Empezado hace unos días: uno de hoy sale sin historial, y las guías
       tienen que enseñar una ficha con vida. `desdeHace` va por préstamo
       porque de él depende si sale al día o atrasado, y eso cambia los
       rótulos de los botones. */
    fechaInicio: haceDias(p.desdeHace),
  })
  const id = prestamo?.id ?? prestamo?.prestamo?.id
  const cuota = Math.round(prestamo?.cuotaDiaria ?? prestamo?.prestamo?.cuotaDiaria ?? 0)
  console.log(`✓ préstamo de ${CLIENTES[p.cliente].nombre} · ${p.modoInteres} · cuota ${cuota}`)

  for (let i = 0; i < p.pagos; i++) {
    /* ⚠ `confirmarDuplicado=1` A PROPÓSITO. La API rechaza dos pagos del mismo
       monto y tipo en 60 segundos, que es una defensa real contra el doble
       toque del cobrador. Aquí sembramos seis cuotas iguales de golpe, así que
       hay que decirle que sí, que van en serio. */
    await api(`/api/prestamos/${id}/pagos?confirmarDuplicado=1`, {
      montoPagado: cuota,
      tipo: 'completo',
      metodoPago: 'efectivo',
    })
  }
  /* ⚠ Y SE LES CORRIGE LA FECHA, UNO A UNO.
   *
   * Al registrar un pago la API lo fecha HOY, y hace bien: un pago ocurre
   * cuando se registra. Pero eso deja los seis pagos el mismo día, y con uno de
   * hoy el préstamo entra en `yaPagoHoy` — que ESCONDE el botón de cobrar. La
   * guía de registrar un pago se quedaba sin sus dos capturas por esto, y me
   * costó dos tiradas enteras entenderlo: probé el préstamo al día y atrasado, y
   * en los dos casos faltaba el botón por la misma razón de fondo.
   *
   * Se corrigen por la MISMA puerta que usa el prestamista cuando un cobro
   * quedó con fecha equivocada, no por SQL. */
  const lista = await api(`/api/prestamos/${id}`, null, 'GET')
  const suyos = (lista?.pagos ?? lista?.prestamo?.pagos ?? []).map((x) => x.id)
  for (let i = 0; i < suyos.length; i++) {
    await api(`/api/pagos/${suyos[i]}`, { fechaPago: new Date(hoy.getTime() - (suyos.length - i) * 86400000).toISOString() }, 'PATCH')
  }
  if (p.pagos) console.log(`    ${p.pagos} pagos, repartidos en ${suyos.length} días`)
}

console.log('\nvitrina sembrada. Ahora:')
console.log('  BASE_CAPTURAS=' + BASE + ' node scripts/capturar-tutoriales.mjs')
