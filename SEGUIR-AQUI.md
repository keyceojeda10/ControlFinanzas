# Por dónde seguir — 18 de agosto de 2026

Lo anterior (los 4 puntos del 17 ago: francés, sugerencias, panel, rango de
fechas) está cerrado y en el historial de git.

Esta lista sale de MEDIR, no de opinar: son los errores que la app ya está
registrando en producción y que nadie mira, más lo que las notas del proyecto
tienen a medias.

⚠ **«Perfecto» no es la meta y perseguirlo rompe cosas sanas.** La meta es que
nos enteremos NOSOTROS primero: hoy un cliente se molesta en escribir y por eso
existe la queja; los otros 95 errores de la pantalla de rutas no los reportó
nadie.

---

## ~~1 · Un vigilante de errores~~ ← HECHO, 18 ago

`scripts/vigilante-errores.sh`, instalado en `/opt/cf-backup/` y en el crontab a
las **9:05** (cinco minutos después del vigilante del respaldo, para no mezclar
los dos avisos). Manda por Telegram cuántas pantallas se rompieron en 24h, de
qué tipo y en qué pantalla — y **calla cuando no hay ninguna**.

Lo que salió al probarlo con 30 días: **261 errores en 27 negocios**, ninguno
reportado por nadie.

⚠ Tres cosas que aprendí montándolo:

- **`source .env` PISA lo que pasas por fuera.** Probándolo con el token vacío
  para que imprimiera en pantalla, le mandó al dueño un Telegram de verdad. Un
  guion de vigilancia que no se puede ensayar en seco se ensaya en la cara de
  alguien. Ahora hay `VIGILANTE_SECO=1`.
- **Sin agrupar no se lee**: cada trozo que no carga lleva su número y su URL,
  así que el mismo problema salía en nueve renglones.
- **Safari y Chrome dicen lo mismo con otras palabras** («Can't find variable:
  X» / «X is not defined»): sin unirlos, 16 casos salían como 10 y 6, y el de 6
  se ve pequeño y se ignora.

## 2 · React #300 en la hoja de pago ← EMPEZANDO

**25 veces, la última el 16 de agosto.** En la ficha del préstamo, y varias con
`?openPago=1&fromRuta=1` — o sea abriendo la hoja de pago desde la ruta. Es el
único de los viejos que sigue vivo, y está en el camino de cobrar.

React #300 es «se pintaron menos hooks de los esperados»: casi siempre un
`return` que se salta hooks de más abajo.

⚠ Mi primer barrido buscando hooks condicionales no encontró nada y el segundo
marcó 300 falsos positivos. Hay que reproducirlo, no adivinarlo: el camino es
abrir esa ficha con `?openPago=1&fromRuta=1` en el espejo.

**Terminado cuando:** se reproduce, se corrige, y el registro deja de contarlo.

## 3 · Confirmar que los tres viejos están muertos

| error | veces | último |
|---|---|---|
| `Cannot access 'tU'` (pantalla de rutas) | 95 | 4 ago |
| `onCerrarVisita is not defined` (cobros de hoy) | 10 | 7 ago |
| `tutorial is not defined` (tutoriales) | 3 | 11 ago |
| `formatFechaCalendario is not defined` | 1 | 5 ago |

Llevan días sin aparecer: probablemente los mató algún arreglo posterior.
**Comprobarlo antes de tocar nada** — tocar código que ya funciona es como se
rompen cosas sanas.

## 4 · El ChunkLoadError

**86 veces.** Sale cuando alguien tiene la pantalla abierta y desplegamos: su
navegador pide un trozo de la versión vieja que ya no existe. Ayer subimos diez
veces.

No es grave —recargando se arregla— pero es ruido que tapa los errores de
verdad, y al usuario le sale una pantalla rota sin motivo.

---

## Después, lo que está a medias (de las notas del proyecto)

Por orden de lo que más duele:

1. **Línea de crédito** — a medio construir: sin integrar a caja, capital ni
   reportes, y sin el cron de cortes.
2. **13 pantallas ignoran el modo abreviado** — el interruptor está encendido y
   no hace nada. Ya generó un reporte.
3. **28 de 96 rutas con capital negativo**, sin revisar.
4. **Las 119 guías del bot**, de junio.
5. **El wizard de préstamo en PC** (T16-00), lo único que falta del rediseño.
6. **La tabla de escritorio de la parada de cobro**, cortada por la derecha.
7. **1.462 filas con el convenio de fechas viejo.**

## Lo que NO hay que hacer

- Las 55 cajas de préstamos anulados (`CAJAS-ANULADOS-16AGO.md`): caso por caso
  y solo si alguien reporta.
- Las 76 fechas mensuales que se arrastran.

## Cómo se cierra cada punto

1. **Medir contra producción en solo lectura ANTES de tocar.**
2. **Derivar la cifra esperada**, no escribirla a mano.
3. **Mirar la captura**, no el JSX.
4. Espejo → `npx vitest run` → `npx next build` → `npx eslint app components` →
   subir `CACHE_NAME` → desplegar → **verificar el commit en el VPS**.
