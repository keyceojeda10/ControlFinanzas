# Los vídeos de los tutoriales

Graban la aplicación **de verdad** y le añaden lo que pide un tutorial:
acercarse a un detalle, subrayarlo, poner un rótulo y un cursor que se ve.

Salen **sin voz**, con un guion cronometrado al lado para grabar la narración
encima.

## Por qué existen

La gente pide ver cómo funciona el sistema antes de comprarlo: 52 leads en 45
días, y son los que mejor convierten —23,1 % se registran, contra 7,5 % de los
que no lo piden—. Hoy el bot les contesta «pruébelo usted mismo», porque los
vídeos que había son de marzo y enseñan la interfaz anterior al rediseño.

## Cómo se hace uno

```bash
# 1. Túnel al espejo y espejo en pie
#    ⚠ Reiniciar el espejo ANTES de grabar el registro: admite 3 cuentas por
#      hora y por IP, y el contador vive en memoria del proceso.
ssh -N -L 3341:127.0.0.1:3306 root@69.62.87.141 &
bash .auditoria/arrancar-espejo.sh          # http://localhost:3016

# 2. El negocio de mentira (una vez; se puede repetir sin miedo)
node scripts/video-demo/poblar-demo.mjs

# 3. El vídeo, por tomas
node scripts/video-demo/v01-registro.mjs            # todas y las pega
node scripts/video-demo/v01-registro.mjs --toma 4   # rehace SOLO la 4
node scripts/video-demo/v01-registro.mjs --pegar    # vuelve a pegar
```

Cada toma es una pantalla y se puede rehacer sola: lo pidió el dueño al ver el
primer montaje, porque rehacer un vídeo entero por un rótulo mal puesto es
absurdo. Al terminar imprime la escaleta con los tiempos, que es de donde salen
las marcas del guion de voz.

Antes de escribir un vídeo nuevo, mirar qué dice la pantalla de verdad:

```bash
URL=http://localhost:3016/clientes node scripts/video-demo/sondear.mjs
URL=http://localhost:3016/registro node scripts/video-demo/sondear-publico.mjs
```

## El formato, que no cambia

Seis vídeos y tres rondas de correcciones del dueño después, esto es lo que
funciona. **Un vídeo nuevo se ajusta a esto**, o desentona con la serie.

### La forma

| | |
|---|---|
| **Vertical 1080×1920**, 30 fps, H.264 | se ve en el móvil, que es donde lo abren |
| **Sin voz**, con guion cronometrado al lado | la narración la graba el dueño |
| **Una toma por sección de pantalla** | y cada una se puede rehacer sola |
| **Duración** | 2:30 los sencillos, 4:00-5:00 los monográficos |
| Rótulos negros sobre la imagen | dibujados aparte, nunca dentro de la página |
| Subrayado dorado con el resto atenuado | y un cursor que se ve pulsar |

### El ritmo

**~2,4 palabras por segundo.** Es lo que se narra cómodo en español. Cada bloque
del guion lleva escrito cuántas caben, y **hay que comprobarlo**: siete de los
once bloques del vídeo 6 no cabían, y eso obliga al narrador a correr o el audio
sale desfasado. Cuando un bloque se pasa, **se alarga la toma**, no se recorta la
explicación — salvo que sobre prosa.

> *«Si es muy rápido, después la voz toca ponerla muy rápido o va a salir audio
> desfasado del vídeo.»*

Y al revés: **si sobra tiempo, callar**. Dos segundos de silencio sobre una
pantalla que se entiende sola no molestan a nadie.

### Las seis reglas de cada toma

Viven en la cabecera de `grabador.mjs`, que es quien las hace cumplir:

1. **No se entra por URL** a una pantalla que el vídeo explica: se llega
   tocando, por donde la toca el usuario.
   > *«No pulsas el botón de donde la gente encuentra el crear el cliente.»*
2. **Una sección de pantalla, una parada.**
3. Las pausas se calculan contra lo que hay que decir.
4. **Un acercamiento por parada.** El montaje avisa si dos quedan a menos de
   1,2 s: se ve como un tirón.
   > *«Mete como un zoom y después otro zoom y es como excesivo.»*
5. **Ninguna toma corta en seco**: termina su acción y descansa sobre el
   resultado (`reposo`).
6. **Todo vídeo lleva una toma de CIERRE** que completa el proceso y enseña
   dónde te deja.
   > *«Todos los tutoriales están así como cortados abruptamente al final.»*

### El orden dentro de una parada

**Primero `decir`, después `mirar`.** Al revés el rótulo se sienta encima de la
tarjeta que va a subrayar, y además aparece cuando el acercamiento ya terminó.
Se ve en el fotograma; en el código parece correcto.

```js
await decir('Lo que se dice aquí', 4.4)   // sobre la pantalla limpia
await esperar(4600)
await mirar(modo('Cuota fija'), { escala: 1.7, ms: 4800 })
await esperar(900)
```

Y **el arrastre hasta la sección va antes de `empezar()`**, o la toma abre cinco
segundos sobre otra parte del formulario mientras el rótulo ya habla de otra
cosa.

### El guion de voz

Un `.md` por vídeo en `guiones/`, con esta forma:

- Encabezado con **archivo, duración** y de cuántas tomas consta.
- Un bloque por toma: `### 01:52 — 02:23 · Toma 6 · Título · *~75 palabras*`,
  y debajo la narración en cita (`>`).
- **Notas para quien narre**: qué decir despacio y qué se malentiende.
- **De dónde salen las cifras**, si el vídeo enseña números. No se escriben a
  mano: se sacan de la función que las calcula y se contrastan contra la
  pantalla. Si cambian, el vídeo miente.
- **Lo que NO se dice, y por qué** — cuando hay algo que soporte debería saber
  pero asusta en un tutorial.
- Cómo rehacer un trozo.

### El tono

Tuteo. Sin palabras técnicas. **Se nombran las cosas como las nombra el
prestamista**, no como se llaman por dentro: «el fajo», «la cartulina», «lo que
te queda en la mano». En el vídeo de los modos no se dice ni una vez «balloon»
ni «sistema francés».

## Reglas

- **Ni un dato de cliente real.** Todo sale del negocio inventado «Créditos del
  Valle» y de correos en `ejemplo.com`, que está reservado por norma para
  documentación. El espejo tiene copia de producción: nunca grabar otra
  organización.
- **Los rótulos se copian de la pantalla**, no se escriben de memoria. Para eso
  está `sondear`.
- **La escaleta la imprime el propio guion** al terminar, y de ahí salen los
  tiempos del `.md`. Si se cambia una pausa, se vuelve a correr y se ajusta el
  guion: un narrador desincronizado se nota más que un vídeo feo.

## Trampas que ya costaron su rato

- **Un `subrayar` que no encuentra su elemento esperaba 30 segundos** dentro de
  la grabación, y como la llamada estaba en un `try` nadie se enteraba: la toma
  de la verificación salió de 81 segundos en vez de 6. Ahora la espera es de 6 s
  y explícita.
- **El registro admite 3 cuentas por hora y por IP**, y cada toma crea la suya.
  A partir de la cuarta el asistente se queda en «Demasiados intentos» y la toma
  graba una pantalla equivocada sin que nada falle. El guion lo detecta y aborta
  con el remedio escrito.
- **Los rótulos NO van dentro de la página**: el acercamiento recorta la imagen
  y se llevaba media frase por delante. Se dibujan aparte y se pegan encima, y
  así además caen siempre a la misma altura.
- El **zoom no se puede hacer con CSS**: un ancestro con `transform` saca de su
  sitio todo lo que esté en `position: fixed`, y la barra de navegación acabaría
  flotando en mitad de la pantalla. Se recorta en el montaje.
- **ffmpeg no admite un recorte que cambie de tamaño** (`crop=w='iw/(1+…t…)'`
  falla y no escribe nada). Cada acercamiento es su propio tramo.
- **La escala pedida es un máximo**, y el aire alrededor no puede ser fijo:
  acercarse a un selector de 104 px dejaba fuera el título de la pantalla.
- **`:has-text()` es de Playwright, no del DOM.** Mide Playwright, pinta el
  navegador.
- **⚠ TODO SELECTOR LLEVA `:visible`.** Media app pinta DOS ÁRBOLES —el de móvil
  y el de escritorio, con `hidden lg:block`— con los mismos botones y las mismas
  etiquetas. A 540px la copia de escritorio sigue en el DOM y va PRIMERA, así que
  `.first()` la coge: la toma espera diez segundos a que un elemento invisible se
  deje pulsar y aborta. Ya lo lleva `tocar()`; en los selectores que se escriben
  a mano (`mirar`, `tocarSel`) hay que ponerlo. Costó tres intentos en el 7.
- **Y `:not([disabled])` cuando haya varios iguales.** La flecha «Subir» de la
  primera fila viene deshabilitada, y un botón deshabilitado no se pone
  «enabled» nunca: la espera agota el tiempo entero.
- **`:has-text()` es subcadena.** «Ordenar» caza también «Reordenar recorrido»,
  que está antes en el DOM: la toma pulsaba otro botón y grababa otra pantalla
  sin que nada fallara. Para eso está `tocarSel('button:text-is("Ordenar")')`.
- **Lo efímero se enseña en cuanto aparece**, y ahí el rótulo va DESPUÉS. El
  aviso de «Deshacer» dura diez segundos: diciendo primero la frase, para cuando
  llegaba el subrayado el aviso ya no existía y la toma abortaba. Y **aparece
  sobre los 8 s**, no al instante — medido, no supuesto.
- **Un botón que se pulsa y no cambia nada es peor que no enseñarlo.** El filtro
  «Hoy» de la ruta es un conmutador cuya etiqueta no cambia, y en la demo les
  toca a los ocho: al pulsarlo la lista queda igual. Se subraya y se cuenta de
  palabra.
- **Una toma puede entrar con OTRA sesión** (`toma.cookie`). Hace falta para
  enseñar lo que ve el cobrador dentro de un vídeo que va del dueño: es la mitad
  de la explicación y antes había que grabarlo aparte.
- **Fuera de cuadro lo que fecha el vídeo.** El banner de la campaña «¿Qué le
  cambiarías a la app?» ocupaba un tercio de la pantalla del cobrador: cuando se
  apague, el tutorial enseñará algo que ya no existe. Se arrastra antes de
  `empezar()`.
- **Ojo con lo que abre otra pestaña o saca un `confirm()`.** «Google Maps» hace
  `window.open` y dejaría el vídeo fuera de la app; «Quitar de la ruta» usa el
  `confirm()` del navegador, que Playwright descarta solo y cancela la acción sin
  que se note.
- **El registro admite 3 intentos por hora y por IP.** Grabando se agota; el
  contador vive en memoria del proceso, así que se reinicia el espejo.
- Los campos se escriben **letra a letra**, no con `fill()`: tiene que verse que
  alguien está escribiendo.
- La cuenta que se crea al grabar el registro **se borra antes y después**.

## Los que hay

| | Vídeo | Dura |
|---|---|---|
| 1 | Cómo registrarse | 2:24 |
| 2 | Crear un cliente | 2:28 |
| 3 | Primeros pasos, cobrando solo | — |
| 4 | Primeros pasos, con cobradores | — |
| 5 | Crear un préstamo | 3:43 |
| 6 | Todos los modos de interés | 4:53 |
| 7 | Las rutas | 6:22 |
| 8 | Los cobradores | 5:40 |
| 9 | Cobrar el día | 4:39 |

## Lo que falta

Caja · capital · ajustes y extras. Y el corto de 90 segundos para el bot de
ventas.

⚠ **Antes del vídeo de caja hay que arreglar el decorado.** `poblar-demo`
desembolsa los trece préstamos con fecha de HOY, así que la caja del cobrador
sale con «Te queda en la mano −$3.628.200». En un día de verdad nadie presta
3,6 millones: los préstamos tienen que venir de días anteriores.

⚠ **El bot tiene prohibido enviar vídeos** (`lib/bot-v2/prompts.js`). Esa regla
se quita cuando estos existan y estén subidos, no antes.
