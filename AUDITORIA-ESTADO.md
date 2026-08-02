# Auditoría del dinero — estado y reparto del trabajo

> Rama `auditoria-dinero`. Producción corre `main` en PM2 `cf`, puerto 3002, base
> `prestamos_db`. **Nada de esto está desplegado a producción todavía.**

Este archivo existe para que una sesión nueva arranque trabajando en vez de
redescubrir. Si algo de aquí no cuadra con el código, **gana el código**: mídelo.

---

## Cómo NO perder tiempo (leer antes de tocar nada)

Lo que hizo lenta la primera tanda no fue pensar, fue el bucle
**editar → construir en el VPS → reiniciar → capturar**. Son 3–5 minutos por
vuelta y se dieron quince.

1. **Servidor local, no el VPS.** `npm run dev` contra el espejo por túnel. El
   VPS solo para la verificación final de cada bloque.
2. **Agrupar.** Tres o cuatro cambios y UNA vuelta de build, no una por cambio.
3. **El espejo se queda montado.** Restaurarlo cuesta minutos; ya está puesto.

### El túnel y el espejo

```bash
ssh -fN -L 3005:localhost:3005 root@69.62.87.141
```

`cf-test` (puerto 3005, dir `/home/control-finanzas-test`) está apuntando a
`prestamos_espejo`, que es una copia del respaldo de producción del 1 ago.

### Herramientas de verificación (todas contra el espejo)

| | |
|---|---|
| `.auditoria/mirar-espejo.mjs <ruta> <png> [ancho]` | captura + errores de consola + aviso de pantalla en blanco |
| `.auditoria/comparar-visual.mjs` | geometría REAL: radios, bordes, sombras, relleno |
| `.auditoria/colores-cola.mjs` | colores computados y tokens |
| `scripts/acercar.mjs <png> x y w h <sal> <zoom>` | ampliar un trozo |
| `scripts/auditar-dinero.cjs --org=<id>` | las cifras de dinero de una organización |

⚠ En Git Bash, los argumentos que empiezan por `/` necesitan `MSYS_NO_PATHCONV=1`.

### Trampas que ya costaron una vuelta cada una

- **Heredocs con acentos o backticks se rompen.** Escribe el script Python con la
  herramienta de escritura y ejecútalo; no lo metas por `<<EOF`.
- **`git fetch origin <rama>` NO actualiza el ref remoto del VPS.** Usa
  `git fetch -f origin 'refs/heads/X:refs/remotes/origin/X'` y **comprueba el
  HEAD contra el local** antes de medir. Ya medí una build vieja por esto.
- **Insertar un import buscando el último `import `** lo mete dentro de un
  `import {` multilínea. Lo caza `componentes-compilan.test.js`.
- **`{/* */}` dentro de una expresión `{...}` de JSX** es error de sintaxis. Ahí
  va `/* */`.
- **Una captura de página completa dibuja los elementos fijos en la posición de
  la ventana.** No sirve para juzgar si la pastilla tapa algo a media página.

---

## El reparto: tres corrientes que NO se tocan

| | Toca | Verifica con |
|---|---|---|
| **A · Fórmulas** | `lib/calculos.js`, `lib/dinero/` | `vitest` + SQL de solo lectura contra el espejo |
| **B · Panel** | `components/`, `app/(dashboard)/dashboard` | despliegue a `cf-test` + capturas |
| **C · Producción** | scripts, VPS, `public/sw.js` | logs de PM2 |

**Regla de no colisión: solo B despliega a `cf-test`.** A y C comparten la base
espejo en solo lectura. Si hace falta paralelo de verdad, worktrees separados —
nunca dos sesiones sobre el mismo directorio.

---

## Lo hecho (todo medido contra producción, no razonado)

| | |
|---|---|
| **G1 · La caja** | La banda dejó de cuadrar por decreto. 53 de 57 días tenían descuadre y la pantalla decía «cuadra» |
| **G2 · Daño de escritura** | Borrar un pago dejaba la tabla mintiendo. Falta #105 |
| **G3 · Reparto** | Una sola convención. `capitalEnCalle` de $277.067.809 a $201.582.321 en un negocio: **37,2% menos**. Los 5 sitios que lo publican dan ya el mismo número |
| **G4 · Diccionario** | 33 cifras con rótulo, pregunta, universo, unidad y alcance. Murieron las dos «ganancia» de la misma pantalla |
| **G3.5 · Panel** | A medias — ver abajo |

### Hallazgos que hay que contarle al cliente antes de desplegar

- **$631.726.806** que el reporte de cartera escondía: filtraba
  `cliente.estado = 'activo'` y el estado de un moroso es literalmente `'mora'`.
  1.081 clientes, el 14% de la cartera.
- **850 préstamos** con `totalAPagar < montoPrestado`, 758 cerrados justo en lo
  cobrado, 615 del cliente de los 10 cobradores. El SQL registraba
  **−$118.964.543 de «interés»** y el JS registraba $0. Es capital que no volvió,
  y ahora tiene nombre: `resumen.capitalNoRecuperado`.
- La paleta del diseño anterior estaba puesta **en línea sobre `<html>`**, así que
  ganaba a los tokens siempre.

---

## Lo que falta, por corriente

### B · Panel — G3.5 (empezar por aquí, es lo que se ve)

- [x] ~~El botón «Ver más métricas»~~ — **NO había que rehacerlo.** Medido:
      `vistaSimple` arranca en `true`, así que las cifras extra ya están
      ocultas por defecto y el toggle gobierna cinco bloques. Eso es justo lo
      que el plan pedía. Lo que estaba mal era el rótulo, ya cambiado a «Ver
      todo lo demás / Dejar solo las respuestas»
- [x] ~~`HeroCard`~~ — borrado, 111 líneas muertas
- [ ] «Listos para renovar»: 20 tarjetas seguidas. El dueño quiere que se quede
      arriba, pero compitiendo con todo
- [ ] **El panel a 1440 tiene un hueco y `PanelDinero` no se ve.** MEDIDO, no
      supuesto: la armazón de escritorio está bien —barra lateral, dos
      columnas, hero, tarjetas a la derecha, las siete barras— pero la columna
      IZQUIERDA se corta tras «Necesita tu atención» y deja un vacío enorme
      hasta el final de la página, que termina en «3 días restantes».

      «Tu plata puesta», «Este mes» y la nota **no aparecen a 1440**, aunque a
      430 sí. El contador de letras dice 2.779 a 1440 contra 2.618 a 430, así
      que el contenido ESTÁ en el DOM: es disposición, no datos. Algo en la
      rejilla de dos columnas lo deja fuera de la vista.

      Reproducir con:
      `MSYS_NO_PATHCONV=1 node .auditoria/mirar-espejo.mjs /dashboard sal.png 1440`

      ⚠ Y una advertencia sobre mi propia lista: yo daba «el escritorio» por
      pendiente entero. Al mirarlo, casi todo estaba hecho. **Mide antes de
      creerte una lista, aunque la haya escrito yo.**

- [ ] **EL HUECO DE LA COLUMNA IZQUIERDA A 1440 — la causa, ya diagnosticada.**

      El dueño lo marcó en rojo sobre la captura: un zigzag sobre el vacío
      debajo de «Necesita tu atención», y rayas verticales señalando que la
      columna derecha acaba a otra altura.

      **La causa NO es el alto de las tarjetas.** Acoté «Por ruta hoy» de diez
      rutas a cinco y el hueco se redujo pero NO desapareció, porque el problema
      es de composición:

        `Panel.jsx` monta `lg:grid-cols-[minmax(0,1fr)_360px]` con
        `lg:items-start` y posiciones FIJAS (`lg:col-start-N lg:row-start-M`):

            fila 1   hero            │ en caja + en mora
            fila 2   necesita atención│ por ruta hoy

        Debajo de esa rejilla van bloques a ANCHO COMPLETO («3 días restantes»,
        `PanelDinero`). Y un bloque a ancho completo no empieza hasta que acaba
        la celda MÁS ALTA de la fila. Como la celda izquierda de la fila 2 es
        corta, queda el hueco. Achicar la derecha solo lo achica.

      **El arreglo: meter `PanelDinero` DENTRO de la columna izquierda**, como
      fila 3 de la columna 1, en vez de a ancho completo debajo. Ahí la rejilla
      cuadra sola.

      ⚠ Requiere tocar DOS archivos a la vez: `PanelDinero` lo pinta la página
      (`app/(dashboard)/dashboard/page.jsx`) y la rejilla vive en
      `components/pantallas/Panel.jsx`. Hay que pasarlo como RANURA — igual que
      `acciones`, que ya es una — y no intentarlo desde un solo lado.

      Y `lg:items-stretch` NO es la solución: iguala los altos estirando una
      tarjeta de tres filas hasta 290px de blanco, que se ve peor.
- [ ] Los 5 bloques que cuelgan de `vistaSimple` siguen siendo componentes
      definidos dentro de la propia página (`KpiCard`, `KpiGroup`, `QuickLink`,
      `RecaudoCard`, `RoutesCard`, `ResumenDelDia`, `ProximosARenovar`). Ya
      están sobre superficies correctas, así que esto es orden, no urgencia

**Ya hecho en esta corriente:** `PanelDinero` contesta «cuánta plata tengo
puesta» y «cuánto estoy ganando»; las siete barras de la semana ya se ven en el
teléfono; las tarjetas cumplen la receta de `03-COMPONENTES.md`; la mora se dice
una vez; el pie ya no tapa 80px.

### A · Fórmulas

- [ ] **G5 · Enum real de modos.** La lista replicada a mano en 11 sitios.
      `lineal` y `lineal_dinamico` son idénticos byte a byte. `proporcional` es
      inalcanzable pero elegible como default
- [ ] **G6 · El modo clásico, rehecho.** Lo más grande y lo que pidió el dueño:
      que acepte abonos a interés y capital, y que mida el atraso por los pagos
      reales. **BLOQUEADO por la decisión #104**
- [ ] **#105 · `recalcularSaldosCapital` reescribe el histórico.** Necesita
      `fechaOperativa` y `cerradoEn` en el esquema
- [ ] **#106 · La alerta «sin pagos» es una ventana de 7×24 HORAS**, no de 7 días
      de calendario: cambia minuto a minuto. Medido: 3 préstamos y $779.000 en 19
      minutos

### C · Producción

- [ ] **#84 · «Cannot access 'O'»** en la ficha de préstamo, **593 veces**.
      Instrumentado, esperando captura
- [x] ~~#95 · El deploy sigue adelante cuando la base falla~~ — **hecho.**
      `scripts/deploy-sistema.sh` saca el SQL, y si hay diferencia la imprime y
      PARA; se aplica relanzando con `CF_APLICAR_ESQUEMA=1`. El original quedó
      en `/home/deploy-sistema.sh.antes-de-la-guarda`.
      ⚠ **Y encontró que producción NO está sincronizada**, con un
      `ALTER TABLE Lead ALTER COLUMN updatedAt DROP DEFAULT` pendiente. Hay que
      decidir si se aplica en el mismo despliegue o antes, por separado
- [ ] **#107 · Hidratación React #418** en el panel. Verificado que es previo a
      esta tanda; puede estar emparentado con #84

### Y al final, para todos

- [ ] **G7 · El extracto por ruta** — que cuando la caja no cuadre se pueda bajar
      y encontrar el día
- [ ] **G8 · Migración y comunicación.** Regla: silencio para lo que el usuario
      no pudo apuntar a mano; **aviso** para caja del día, esperado, capital en la
      calle y ganancia del mes; **consentimiento** para todo lo que cambie lo que
      un cliente debe

---

## Las dos decisiones del dueño (bloquean G6)

1. **¿El abono a capital borra la mora?** Si un cliente debe 3 cuotas y entrega
   $200.000 a capital, ¿se le perdona el atraso o lo sigue debiendo? **Hoy se le
   perdona en silencio.** Afecta a 17 préstamos.
2. **La curva de devengo en cuota única.** Hace falta para que «abono a interés»
   signifique algo en modo `unico`, que hoy devenga todo el interés al prestar.
   No cambia lo que el cliente debe; la curva es para medir y para abonar.

---

## Las reglas que no se saltan

- **Medir contra producción en solo lectura antes de diseñar.** Tests verdes ≠
  correcto.
- **Mirar la pantalla.** Un componente que compila no es un componente que
  funciona: el degradado, las líneas negras y las cifras pegadas salieron todos
  al mirar, no al leer.
- **Una suma que se enseña al usuario tiene que poder hacerse a mano.** El patrón
  que más ha aparecido: **cifras que se cancelan entre sí para que el total dé,
  siendo cada una falsa.** Cuatro veces.
- **En una migración se reproduce, no se mejora.** Si una regla está mal, se
  arregla aparte, con su medición y su nombre.
- **Nunca migrar filas antes de desplegar la fórmula que las lee.**
- No emojis en la interfaz: SVG inline.
- Subir `CACHE_NAME` en `public/sw.js` en todo cambio de UI visible.
