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
- [x] ~~El hueco de la columna izquierda a 1440~~ — **RESUELTO.** La causa no
      era el alto de las tarjetas sino la composición: debajo de la rejilla iban
      bloques a ancho completo, y uno de esos no empieza hasta que acaba la
      celda MÁS ALTA de la fila. Dos cambios que solo funcionan juntos:
      «Por ruta hoy» pasa a `lg:row-span-2`, y `PanelDinero` entra por una
      RANURA nueva (`bajoAtencion`) montada en `lg:col-start-1 lg:row-start-3`.
- [x] ~~El ancho del hero~~ — tenía un `maxWidth: 720` escrito a mano que lo
      dejaba 56px más corto que las tarjetas de su propia columna. Lo acota la
      rejilla; el tope sobraba. Verificado: los cuatro bloques cierran en 1040.
- [x] ~~El alto de «En caja» y «En mora»~~ — acababan 88px por encima del hero.
      La rejilla lleva `items-start`; bastó `lg:self-stretch` en su contenedor,
      porque las tarjetas ya traían `flex: 1`.

      ⚠ **Los tres los vio el dueño antes que yo, sobre capturas.** Yo di por
      bueno el primer arreglo del hueco sin comprobarlo contra el problema real.
      Mide, y cuando creas que está, míralo.

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
- [x] ~~El aviso a los clientes~~ — borrador en `AVISO-CAMBIOS-CIFRAS.md`, con
      las cifras medidas y el texto corto para WhatsApp. Falta ELEGIR a quien se
      le manda: no todos se mueven igual (de -7% a -27% en capital).
- [ ] **G8 · Migración y comunicación.** Regla: silencio para lo que el usuario
      no pudo apuntar a mano; **aviso** para caja del día, esperado, capital en la
      calle y ganancia del mes; **consentimiento** para todo lo que cambie lo que
      un cliente debe

---

## Las dos decisiones del dueño — YA TOMADAS (1 ago 2026)

### 1 · El abono a capital NO borra la mora

**Decidido: el atraso se sigue debiendo.** Si un cliente debe 3 cuotas y entrega
$200.000 a capital, el abono baja el capital y acorta el plazo, pero esas 3
cuotas siguen vencidas y el cliente sigue en mora hasta pagarlas.

> «Abonar a capital no es ponerse al día.»

**Qué hay que cambiar:** hoy los tres `recalcular*DesdeSaldo` reprograman TAMBIÉN
las cuotas ya vencidas, así que el atraso desaparece en silencio — nadie decidió
eso, es un efecto lateral. Deben reprogramar solo las cuotas FUTURAS.

**El alcance, medido contra el espejo (no de memoria):**

| | préstamos | saldo |
|---|---|---|
| Con abono a capital | 28 | $26.853.376 |
| De esos, **con tabla** | 16 | $14.174.376 |
| Y además **activos hoy** | **10** | **$12.054.126** |

Se venía diciendo «17»; son **16 con tabla y solo 10 vivos**. Esos 10 son los
únicos donde el arreglo cambia el comportamiento de aquí en adelante. Ojo: los ya afectados no
se auto-corrigen; entran en la migración de G8, y como cambia lo que un cliente
debe, va con **consentimiento**, préstamo por préstamo.

### 2 · Curva de devengo en cuota única: SÍ, solo para medir y abonar

**Decidido: se construye, y lo pactado NO cambia.** Hoy el modo `unico` devenga
todo el interés al prestar (`calculos.js:1889`), así que «a día 10 lleva
devengado X» no se puede contestar y «abono a interés» no significa nada.

La curva es para **medir y para abonar**, no para cobrar distinto:

- El cliente debe exactamente lo mismo que antes.
- La **liquidación anticipada NO cambia**: sigue sin perdonar interés en cuota
  única. Esa era la tercera opción y se descartó expresamente, porque sí habría
  cambiado lo que un cliente debe al cerrar antes.
- Con la curva, el atraso se mide contra lo que ya debía haberse devengado, que
  es lo que pedía «reportar si está atrasado de forma inteligente».

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
