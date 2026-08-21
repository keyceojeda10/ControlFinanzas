# Control Finanzas

Sistema de cartera y cobros para prestamistas. Next.js 15 (App Router) + Prisma 7.8
+ MariaDB + NextAuth v4. **No hay TypeScript**: es JS y JSX, así que una función
inexistente pasa build, pruebas y despliegue, y revienta en producción.

Lo usan prestamistas reales con cobradores en la calle. **Cada cifra en pantalla
es plata de alguien.** Un número mal no es un bug cosmético: es un cobrador
poniendo dinero de su bolsillo o un dueño perdiéndolo sin enterarse.

---

## Lo que no se rompe

- **Producción se LEE, no se escribe.** `ssh root@69.62.87.141`. Consultas de
  solo lectura. Nada de `UPDATE`/`DELETE` sin que el dueño lo pida explícitamente.
- **No forjar sesiones en producción.** Los JWT falsos son solo para el espejo.
- **Nunca publicar datos reales de clientes** (nombres, cédulas, teléfonos,
  cifras) fuera de la máquina.
- **Se despliega por TANDAS.** Verificar en el espejo cuanto haga falta, pero
  agrupar los envíos a producción. Excepción: lo que impide cobrar va solo.
- **No tocar la barra de navegación (la pill).** Lo nuevo va al FAB o a «Más».
- **Nada de emojis en la interfaz**: SVG en línea, estilo heroicons.
- Subir `CACHE_NAME` en `public/sw.js` en todo release con cambio visible, o la
  PWA sigue enseñando lo viejo.

---

## El dinero

Lo más delicado del sistema y donde más veces nos hemos equivocado.

### Las dos cajas dicen lo mismo

La caja del **cobrador** (`app/(dashboard)/caja/page.jsx`) es la **referencia**.
La del **administrador** (`components/caja/CajaCobradorDetalle.jsx`) se ajusta a
ella. Palabras del dueño: *«si haces un ajuste que dañe también la caja del
cobrador, ahí se jodió todo porque ningún número va a corresponder»*.

Lo cobrado, lo prestado, los gastos y lo que se entrega tienen que dar **idéntico
al peso** en las dos. Cada una puede enseñar más detalle; las cifras comunes, no.

### El fajo no es la bolsa

Son dos preguntas distintas y confundirlas es el error clásico:

| | |
|---|---|
| **el fajo** | los billetes que el cobrador lleva encima y entrega de noche |
| **la bolsa** | el capital de la ruta, incluido lo que está en el banco |

- Un cobro por transferencia **no entra al fajo**… salvo que la cuenta sea del
  cobrador. Lo decide `entraAlFajo()` en `lib/dinero/cuentas.js`, la **única**
  función que puede decidirlo. No volver a escribir `metodoPago === 'transferencia'`
  suelto: de ahí salió que una pantalla dijera $66.000 y la otra $119.000.
- Un reverso mueve la bolsa, **no el fajo** (`afectaElFajo()`).
- Un **descuento** baja el capital pero no es plata: fuera del neto y fuera del
  salto de asientos.
- ⚠ `MovimientoCapital.saldoAnterior/saldoNuevo` es el saldo **de todo el
  negocio**, no el de la ruta. Nunca restar la primera y la última foto de un
  conjunto filtrado.

### Reglas de cálculo

- Ganancia = interés cobrado − gastos. **Nunca** recaudado − gastos.
- El plazo no es un tope: el préstamo se cobra hasta saldar.
- La tasa tiene tres semánticas según `modoInteres`. Ver `calcularPrestamo`.
- Meses en **Bogotá (−5h)**, no en UTC. Mensual = mismo día del mes.
- Los reportes que recorren rutas dejan fuera a quien no creó ninguna: el 72% de
  los negocios. Ver [`bug_reportes_sin_ruta`].

---

## Antes de tocar nada

```bash
graft ask "<lo que buscas>" --source   # localizar y entender
graft callers <símbolo> --depth all    # antes de renombrar o cambiar una firma
graft skeleton <fichero>               # la API de un fichero en ~200 tokens
```

Los diez símbolos más conectados (cambiarlos toca medio sistema):
`formatMoney` 281 · `prisma` 227 · `authOptions` 176 · `useAuth` 109 ·
`useCountry` 81 · `getUtcOffset` 79 · `useCabecera` 79 · `logActividad` 71 ·
`calcularDiasMora` 66 · `calcularPrestamo` 55.

---

## Cómo se verifica

**Las pruebas verdes no bastan.** Han pasado en verde con el fallo puesto más de
una vez.

1. `npx vitest run` · `npx next build` · `npx eslint app components`
2. **Medir contra datos reales.** El espejo (`prestamos_espejo`, puerto 3005 en
   el VPS o 3016 en local con `.auditoria/arrancar-espejo.sh`) es copia de
   producción. Para datos de hoy, refrescarlo con `mysqldump` desde producción.
3. **Ver la pantalla, no el JSX.** Un botón que existe en el código puede estar
   tapado. Comprobar con `elementFromPoint`, capturar a 412px y en escritorio.

### ⚠ Mis propias mediciones mienten

Ha pasado cuatro veces en un solo día. Antes de reportar un hallazgo alarmante,
**sospechar del script**:

- Un barrido dijo «30 de 30 cajas rotas»: cruzaba pagos-por-cobrador con
  movimientos-por-ruta. El sistema estaba bien.
- Otro dijo «110 de 125»: ahí sí era real, pero solo se supo desglosando **un**
  caso hasta el peso.

Regla: **desglosar un caso concreto hasta que cuadre al peso** antes de creerse
un porcentaje. Y contrastar contra otra vista del mismo dato.

### Anclar las pruebas en código, no en prosa

Los comentarios de este repo citan literalmente a los clientes, así que
`src.indexOf('Te queda en la mano')` cae en el propio comentario y la prueba pasa
mirando texto. Anclar en JSX o en la expresión (`>Te queda en la mano</span>`).

---

## Trampas que ya costaron tiempo

- **Un `select` de Prisma que no pide un campo** devuelve `undefined` y quien lo
  lee decide mal **en silencio**. Falta `metodoPagoId` → la marca de cuenta no
  hace nada y nada revienta.
- **Columna nueva ⇒ `prisma generate` obligatorio.** Sin él la caja entera da 500
  («Unknown field»). El despliegue lo hace; el espejo local no.
- **Cambios de esquema**: sacar el SQL con
  `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`,
  **leerlo**, aplicarlo a mano **antes** del código y **comprobar el resultado** —
  MariaDB acepta un `DROP DEFAULT` sin error y sin hacer nada.
- **`const` antes de su declaración**: tres veces en `caja/page.jsx`. Pantalla en
  blanco que ninguna prueba de cifras caza.
- **La deuda está en los comentarios.** Este repo guarda las citas de los
  clientes junto al código que las obedece. Antes de revertir algo por «no tengo
  el dato», **grepear los comentarios**: casi revierto un cambio correcto por no
  encontrar una frase del dueño de agosto.
- **Arreglar la causa, no el síntoma**, y **buscar todas las vías**: el mismo
  fallo del comprobante se reportó dos días seguidos por arreglar un camino y
  dejar el otro.
- **Un rediseño pierde funciones en silencio.** Al sustituir un componente,
  listar qué hacía ADEMÁS de pintarse.

---

## Despliegue

```bash
git push origin HEAD:main
ssh root@69.62.87.141 "nohup bash /home/deploy-sistema.sh > /tmp/deploy.log 2>&1 &"
# esperar COMPLETADO, y verificar SIEMPRE:
#   git log en el VPS · /login 200 · las dos instancias `cf` en pie
```

`app.control-finanzas.com`, PM2 proceso `cf` (2 instancias), puerto 3002,
`/home/control-finanzas`. **No editar archivos directamente en el VPS**: traba el
`git pull` del siguiente despliegue.

---

## Diseño

**`DESIGN.md` es ley.** Leerlo antes de tocar la interfaz. En resumen: radios
8/10/12/16/20, tokens de color obligatorios, `Toggle`/`Checkbox` canónicos,
`color-mix` en vez de `${color}NN`, escalas cerradas de tamaños (sin decimales),
y el dorado reservado a tres cosas.

- **PC = tabla, móvil = fichas.**
- **Nunca recortar lo que identifica** (nombre, dirección, cédula, teléfono): no
  llevan puntos suspensivos, bajan de renglón.
- **El cero es un dato.** Probar siempre con el día sin movimiento: esconder los
  KPIs en cero vació la pantalla del cliente con más cobradores.
- Una cifra que cambia un total sin aparecer en la lista es de donde salen las
  preguntas: enseñarla con su nombre y su signo.

---

## Herramientas

- **graft** (`graft ask|callers|skeleton|grep`) — grafo del código, $0, en sync.
  La capa `--deep` no está construida (6.181 símbolos sin resumir); cuesta LLM.
- **graphify** — evaluado el 20 ago 2026 y **descartado**: se solapa con graft y
  su `query` no es semántica.
- Memorias del proyecto en
  `~/.claude/projects/-home-keyce-Desktop-Control-Finanzas/memory/` (130
  ficheros, índice en `MEMORY.md`). **Ahí está el detalle de todo lo anterior.**
