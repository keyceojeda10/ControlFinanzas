# Por dónde seguir — 17 de agosto de 2026

Lista cerrada de lo que queda, en el orden en que hay que hacerlo. Se tacha a
medida que se cierra, y **no se abre nada nuevo hasta terminar lo de arriba**.

La versión anterior de este archivo (2 ago, el barrido de anchos) está en el
historial de git; aquello se cerró.

---

## ~~1 · El cálculo del sistema francés~~ ← HECHO, 17 ago

**Lo que reportó Préstamos Rincón** (segunda vez): «la última cuota queda en $0,
o un valor inferior, o incluso un valor exageradamente grande».

**Lo que dijo la medida, antes de tocar nada:** 115 préstamos a saldo con tabla
en producción, 22 con la última cuota fuera del ±10%… y **los 22 llevan cuota
escrita a mano**. Ninguno de los que deja calcular. Los suyos salen al peso: 11
de $120.700 y la última de $120.530.

O sea que la cuenta no estaba mal. Monto, tasa, plazo y cuota son cuatro cifras
y solo tres pueden ir libres: al fijar la cuota, la última recoge la diferencia.
**Lo que sí estaba mal era la pantalla**, que en crear y en editar no decía la
última cuota en ningún lado.

Ahora un aviso lo dice con las dos cifras y ofrece las dos salidas, en las tres
pantallas que calculan (`components/prestamos/AvisoUltimaCuota.jsx`):

- **Todas de $X** — la cuota que deja las N iguales. Esta sí iguala.
- **Cobrar N veces** — con su cuota, en cuántos cobros se salda **y de cuánto
  sería el último**. ⚠ Esta NO iguala: deja una cola. Se dice con su cifra en
  vez de prometer que «cuadra», que es lo que iba a escribir hasta que el
  recálculo me desmintió.

## ~~2 · Contestarles a los siete que escribieron~~ ← HECHO, 17 ago

`Sugerencia` ya lleva **estado y respuesta** (`nueva · vista · hecha · no se
hace`), y el panel de superadmin deja marcarlas, filtrar «Sin atender» y anotar
qué se le contestó. Las columnas están aplicadas y verificadas en producción.

Los siete textos, ya redactados para mandar por WhatsApp, están en
**`RESPUESTAS-SUGERENCIAS.md`**. Resumen: de los 5 puntos de Rincón, 3 ya
existían y no se le había dicho; el del francés se arregló hoy.

⚠ **Mandarlos sigue siendo suyo**: la app no le escribe a nadie.

## Lo que salió de contestarles ← lo siguiente, después del 3 y el 4

Tres cosas que pidieron ellos y no están (detalle y porqué en
`RESPUESTAS-SUGERENCIAS.md`):

1. ~~**Cobrar el interés que aún no se ha vencido.**~~ **HECHO, 17 ago.** Y no
   era solo Crediya: medido contra producción, **271 de los 382 préstamos vivos
   con tabla (71%) estaban bloqueados en 22 negocios**. La razón es sencilla y
   vuelve del revés la idea de partida: un préstamo AL DÍA no tiene nada
   vencido, así que «pagar interés» solo funcionaba con los atrasados.
   `interesCobrableAhora` suma lo vencido más la cuota que viene, y la regla,
   que estaba escrita en cuatro sitios, vive ahora en uno.
2. **Filtro «próximos a vencer» (5 y 10 días)** en préstamos. Rincón dice que es
   el que más usa; los de hoy miran el atraso, no lo que va a vencer.
3. **Interés por período en `fijo` y `unico`.** El más grande: toca cómo se
   guarda el préstamo. Medir antes de prometerlo.

## 3 · Cerrar el panel de superadmin ← EMPEZANDO

Quedó en **13 entradas**. `Usuarios` ya existe, pero `Organizaciones`,
`Suscripciones`, `Retención` y `Activación` siguen al lado — que eran justo las
cuatro que iban a fundirse en ella.

**Terminado cuando:** el menú baja a 9 y ninguna función se pierde por el camino
(la trampa conocida: `negocio` llevaba el marcador de conversión de las pruebas).

## 4 · Rango de fechas en los informes

Hoy solo hay presets y todos acaban **hoy**: no se puede pedir «del 1 al 15 de
julio» ni «el mes pasado». El motor ya lo acepta (`rangoDe` respeta
`desde`/`hasta`); falta el control en la barra de filtros.

⚠ Añade un control a las 16 pantallas: se hace de una vez y se mide en captura,
no se va poniendo informe a informe.

**Terminado cuando:** los 7 informes que reciben `desde`/`hasta` dejan elegir el
rango, y `.auditoria/_revisar-informes.mjs` sigue en verde.

---

## Lo que NO hay que hacer

- **Las 55 cajas de préstamos anulados.** Documentado en
  `CAJAS-ANULADOS-16AGO.md`. El código ya no las produce; lo histórico se
  corrige caso por caso **solo si alguien reporta**.
- **Las 76 fechas mensuales que se arrastran.** Decidido: no compensa mover
  fechas de cobro reales por un día al mes.

## Lo que depende del dueño

- **Los permisos de la sesión** (`/permissions` o `.claude/settings.local.json`).
  No cambia nada del sistema; solo evita que se pare a preguntar en cada prueba.

---

## Cómo se cierra cada punto

El método que ha funcionado esta semana, y que no se salta:

1. **Medir contra producción en solo lectura ANTES de tocar.** Tres veces esta
   semana el diagnóstico de partida era falso y la medición lo cazó.
2. **Derivar la cifra esperada**, no escribirla a mano. Una prueba con un número
   fijo marcó un fallo donde no lo había.
3. **Mirar la captura.** El `?` doble, los 51.000px y la tabla ilegible no se
   veían en el JSX.
4. Espejo → `npx vitest run` → `npx next build` → `npx eslint app components` →
   subir `CACHE_NAME` → desplegar → **verificar el commit en el VPS**.
