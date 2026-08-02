# Por dónde seguir — 2 ago 2026

Escrito al final de una sesión larga y con el dueño insatisfecho, con razón. Esto
es el estado real y el orden que yo seguiría, no un resumen optimista.

---

## Lo primero: el diagnóstico del dueño, literal

> «Las pantallas, todas tienen un ancho diferente, unas se ven más angostas,
> otras más anchas. Es un desastre. El modal de pago de cuotas está mal, números
> muy pequeños, los medios de pago de transferencia no tienen ícono o logo.
> Cuando se le da a pago de interés o a pago capital, **cambia por el modal
> viejo**.»

Y tiene razón. **El fallo de método de la sesión: se trabajó por reportes, no por
barridos.** Se arreglaron `/rutas`, `/capital` y `/socios` porque él los
fotografió. Existe un medidor capaz de recorrer todas las rutas de una pasada y
**nunca se lanzó sobre todas**. Por eso sigue viendo anchos distintos.

---

## EL ORDEN QUE RECOMIENDO

### 1 · Barrido de anchos de TODA la app, antes de tocar nada

```bash
node .auditoria/ancho-tarjetas.mjs /dashboard /clientes /prestamos /rutas /caja /mas /capital /socios /cobradores /gastos /reportes /actividad /clavos /lineas-credito /soporte /configuracion
```

⚠ **ARREGLAR PRIMERO EL MEDIDOR.** Se queda con la caja **MÁS ANCHA**
(`.auditoria/ancho-tarjetas.mjs:95`), y eso ya dio un falso «correcto»: en la
ficha del socio el contenedor medía 353 (bien) mientras las tarjetas de dentro
medían 319. **Que reporte la MODA de anchos, no el máximo.**

Objetivo: una tabla de qué pantallas están mal y cuánto. Convierte «es un
desastre» en una lista cerrada.

Referencia buena: **353px de ancho, empezando en x=20**, con viewport 393.
(zona útil = 393 − 20 − 20 del `px-5` de `app/(dashboard)/layout.jsx:111`)

### 2 · Arreglar la CAUSA, no las pantallas

```bash
node scripts/barrer-margen-doble.mjs
```

Da **9 componentes** que ponen relleno lateral propio y **no aceptan apagarlo**:
`FranjaAviso · PilaAvisos · Caja · CrearPrestamo · ListaClientes · Pagare ·
Socios · SociosEscritorio · TablaAmortizacion`

**La regla: el relleno lateral lo pone el ARMAZÓN, el componente NO.** Mientras
esos nueve sigan así, cada pantalla nueva nace torcida. Es un arreglo de
convención, no de parches.

⚠ El barrido tiene dos límites conocidos, escritos en el propio archivo: señala
ficheros que la pantalla ni usa (marcó `Socios.jsx` cuando `/socios` monta
`SociosReparto.jsx`), y su «familia B» da falsos positivos porque la regex corta
en el primer `>` y las props con funciones flecha la engañan.

### 3 · El modal de pago — NUNCA SE ABRIÓ, y mueve plata

Lo reportado y sin diagnosticar:
- números del monto demasiado pequeños
- los medios de pago por transferencia sin icono ni logo
- **al elegir «pago a interés» o «pago a capital» salta al modal VIEJO**

Empezar por lo último: es un camino que se quedó sin migrar, igual que pasó con
la ficha del socio (ver «la trampa de los turnos», abajo).

---

## Estado real

| | |
|---|---|
| Producción | `20b3fb17` · rama `auditoria-dinero` → `main` |
| Pruebas | 1.908 en verde |
| Servidor de prueba | PM2 `cf-test`, puerto 3005, dir `/home/control-finanzas-test`, base `prestamos_espejo` (copia de producción) |

### Desplegado hoy y verificado
- Mora del modo clásico contra su calendario real (G6.1) · `unico` −$95,8M, `fijo` +$38,5M
- El abono a capital ya no borra la mora (G6) · $143M estaban en riesgo
- Ancho de `/rutas`, `/capital` y `/socios` (lista y ficha)
- Nombres de cliente sin cortar · modo de interés y autor en las tarjetas · foto del cliente
- Ficha del socio alineada a T45-03: dos botones sin caja, `⋯` con Desactivar/Eliminar
- Huecos del pie: 7 de 21 pantallas migradas al scroll del documento

### NO hecho
- **El barrido de anchos completo** (punto 1)
- **Los 9 componentes de la familia A** (punto 2)
- **El modal de pago** (punto 3)
- 14 de 21 pantallas con scroll propio (tarea #110, con el patrón de cada una)
- Tareas #112 (bloques con diseño viejo en ficha de préstamo) y #113 («CÓMO PAGA» y «Ves 3 de los 5»)

---

## LAS TRAMPAS QUE YA MORDIERON — leer antes de tocar

**1 · `{/* */}` justo después de `return (` es un error de sintaxis.**
Cayó **siete veces** en una sesión. Los comentarios de bloque van ENCIMA del
`return`. Lo caza `lib/__tests__/componentes-compilan.test.js`, no el build.

**2 · Los hooks van ANTES de cualquier `return` temprano.**
Un `useCabecera` después de un return condicional es el React #310 que ya tiró
una pantalla entera de este proyecto.

**3 · `acciones` de `useCabecera` va con `useMemo`.**
Es JSX, cambia de identidad en cada render; sin memoizar re-registra en bucle.

**4 · Medir una pantalla VACÍA no es medir.**
`/socios` daba «correcto» porque no había tarjetas. Se resolvió sembrando datos.
Antes de creerse una medida, mirar cuántas candidatas encontró.

**5 · Build verde y 1.908 pruebas verdes NO dicen nada de diseño.**
Los dos botones del socio se desplegaron rotos con todo en verde. Solo lo caza
mirar la captura.

**6 · La trampa de los turnos.** Un turno POSTERIOR manda sobre el anterior.
`/socios/[id]` montaba el `CuentaSocio` del turno 44 cuando la lámina que manda
es **T45-03**. Antes de construir contra una lámina: buscar en
`CF Diseño 2026/Nuevo/PAQUETE-FINAL/INDICE-DE-PANTALLAS.md` si hay una posterior.

**7 · `BOTON_BASE` lleva `width: '100%'`** (`components/cf/primitivos.jsx:270`).
`BotonPrimario`/`BotonSecundario` están hechos para ir SOLOS en una barra. Lado a
lado hay que ponerles `width: 'auto'`.

---

## Herramientas

| Qué | Comando |
|---|---|
| Ancho de tarjetas | `node .auditoria/ancho-tarjetas.mjs [rutas...]` ⚠ reporta el máximo, no la moda |
| Hueco del pie | `node .auditoria/hueco-del-pie.mjs [rutas...]` |
| Margen doble | `node scripts/barrer-margen-doble.mjs` |
| Quién scrollea | `node scripts/barrer-scroll.mjs` · `node scripts/clasificar-scroll.mjs` |
| Patrón por archivo | `node scripts/listar-scroll-pantallas.mjs` |
| Pulsar el ⋯ del socio | `node .auditoria/pulsar-menu-socio.mjs` |
| Sembrar socios | `node .auditoria/sembrar-socios-espejo.mjs` |

Los de `scripts/` que tocan la base van con
`node --import ./scripts/alias-loader.mjs scripts/<x>.mjs`.

### Ver el espejo

```bash
ssh -o ServerAliveInterval=20 -N -L 3005:127.0.0.1:3005 root@69.62.87.141
```

Socios ya sembrados (solo en el espejo): `cmsc466uh000evxl0mckh70xi` Carlos
Restrepo · `cmsc4673k000jvxl09471uo3t` Marta Gil · `cmsc467fl000ovxl00yab25hp`
Andrés Pérez Villamizar.

⚠ **Cerrar el túnel al terminar.** `TaskStop` mata el envoltorio pero deja vivo
el `ssh.exe`: comprobar el puerto 3005 y matar por PID.

### Subir el espejo a la última

```bash
ssh root@69.62.87.141 "cd /home/control-finanzas-test && git fetch -f origin 'refs/heads/auditoria-dinero:refs/remotes/origin/auditoria-dinero' -q && git reset --hard origin/auditoria-dinero -q && npm run build && pm2 restart cf-test --update-env"
```

### Desplegar a producción

```bash
ssh root@69.62.87.141 "CF_APLICAR_ESQUEMA=1 bash /home/deploy-sistema.sh"
```

Antes: subir `CACHE_NAME` en `public/sw.js` (va por `cf-v773`) o la PWA sigue
enseñando lo viejo. Si cambian CIFRAS, subir también `API_CACHE`.
Después: comprobar `git log -1` en el VPS y que `/login` da 200.

---

## Reglas del proyecto que no se negocian

- **Mirar la pantalla antes de dar algo por hecho.** Es lo que falló hoy tres veces.
- **Medir contra el espejo antes de desplegar** cualquier cambio de cifras, y
  volver a medir después.
- **Nunca migrar en bloque.** 21 pantallas con scroll propio no comparten forma:
  `ReporteDia` scrollea sin alto fijo y `PortalCliente` tiene 4 altos y 2 scrolls.
- No emojis en la UI — SVG inline.
- Nunca abrir `Control Finanzas - Rediseño.dc.html` (18.000 líneas).
- `npx vitest run` en su propio comando.

---

## Tareas abiertas con detalle

`#110` huecos del pie (14 pantallas, patrón de cada una) · `#111` cerrada ·
`#112` bloques viejos en la ficha de préstamo · `#113` «CÓMO PAGA» y «Ves 3 de
los 5» · `#114` cerrada · `#84` error de producción «Cannot access 'O'» ·
`#107` hidratación React #418 en /dashboard · `#91` G5 enum de modos ·
`#92` G6 (faltan 6.2 y 6.3) · `#105` G2.4 · `#78` columna GANANCIA
