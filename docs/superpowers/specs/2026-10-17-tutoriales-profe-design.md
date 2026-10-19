# El profe en cada sección: tutoriales dentro de la app

**Estado:** BORRADOR en pausa (17 oct 2026). Se retoma cuando el dueño cierre las
fallas que reportó el agente de los videos. Falta la revisión del constructor y la
aprobación final antes del plan.

Diseños: lienzo «Tutoriales en cada sección»
(https://claude.ai/artifact/ErrmYD6VBTV7HYhULVrfn8). La elegida es la **D1**.

## Por qué

Medido en producción el 17 oct 2026 (30 días, solo lectura):

- La página `/tutoriales` casi no se usa: 19 de 221 personas activas (9 %).
- El único enlace a un video DENTRO de una pantalla («Ver cómo se arregla», bajo
  «En caja» negativo del Inicio) se abrió 3 veces en 3 días.
- Los videos cortos se ven: la clase de 2 min, 13 de 21 al 75 %; las lecciones
  de 13-29 s, 6 de 7 al 75 %.
- 23 de 99 negocios activos (23 %) nunca registraron con cuánto empezaron; 7 de
  ellos entraron a Capital y aun así no lo hicieron.
- Caja: 90 personas en 30 días; los cobradores la abren más que los dueños
  (2.030 visitas contra 1.562).

## Qué es

Un personaje animado, «el profe», que explica cada sección con videos cortos
grabados por el dueño desde cero. Vive en la propia sección, no en una página
aparte.

## Cómo se ve: D1, «se guarda en el borde»

- **Abierto:** se asoma desde el borde derecho de la pantalla, a media altura,
  con su carita, «¿Te explico la caja?» y «Ver video · 45 s», y una flechita
  para guardarlo.
- **Guardado:** una lengüeta delgada pegada al borde derecho, con su carita. No
  tapa el contenido (vive en el margen de 20 px) y siempre se puede tocar.
- No toca la barra de navegación ni el botón +.

## El flujo (definido por el dueño, 17 oct 2026)

1. Si la persona **todavía no ha visto** el tutorial de esa sección, la pestaña
   **nace abierta** (asomada).
2. Al tocarla se abre el reproductor.
3. Cuando **termina de verlo y cierra**, la pestaña **se ciñe al borde** (lengüeta).
4. Si toca la lengüeta, **vuelve a abrir el tutorial**.

Pendiente de decidir:

- Si la persona guarda la pestaña con la flechita **sin haber visto** el video,
  ¿vuelve a nacer abierta la próxima vez que entre?
- Si vuelve a asomarse cuando hay algo que arreglar en la sección (por ejemplo,
  el capital sin registrar), aunque ya haya visto el video.

## Varias funciones con su propio video en una pantalla (decidido 17 oct 2026)

Ejemplo: la ficha del préstamo tiene su video general, y dentro de «Gestionar el
préstamo» cada función grande (Renovar, Cancelar, Cerrar anticipado, Cambiar el
modo de cobro…) tiene el suyo.

- **Elegida: el ícono al lado de cada función** (lámina E2 del lienzo). Las filas
  que tienen video llevan al final, después de la flechita y de una rayita que
  las separa, un botón redondo dorado con el triángulo de play. El botón abre el
  video de ESA función; el resto de la fila abre la función, como hoy.
- Las filas sin video quedan como están: sin ícono ni rayita.
- La lengüeta D1 sigue siendo la del video general de la pantalla.
- No elegidas: E1 (la lengüeta abre un índice con todos los videos de la
  pantalla) y E3 (el botón dentro de la hoja de la función).
- Riesgo que se habló: dos sitios para tocar en la misma fila. Se mitiga con el
  área de 44 px del botón, separada por la rayita.
- **Decisión mía, por confirmar:** una vez visto, el ícono se queda pero en
  gris, para que siga sirviendo para volver a verlo.

## El reproductor

Una hoja desde abajo:

- arriba, el video;
- debajo, las partes cortas (20-40 s), para ver solo la que se necesita, con la
  que está sonando marcada;
- al pie, el botón que hace la tarea («Registrar mi capital inicial») y «Ya
  entendí, cerrar».

## Configuración → Ayuda

- «Ver el botón del profe» (prende o apaga la pestaña en todas las secciones).
- «Que me avise cuando me haga falta» (pendiente de confirmar, ligado al punto
  anterior).
- «También para mis cobradores» (suposición mía, sin confirmar): ven solo los
  videos de su trabajo (la ruta, cobrar y su caja).
- La lista de videos con «Visto», para volver a verlos.

## Suposiciones sin confirmar

- Solo aparece en las secciones que ya tengan su video; sin video, no hay pestaña.
- Primeras secciones: Capital y Caja.
- «Visto» se guarda en el servidor por persona (como la clase de bienvenida:
  `Evento` por `userId`), no en el teléfono, para que no vuelva a nacer abierta
  en otro aparato.
- Videos propios servidos por la app (`public/videos/`, como las lecciones), no
  YouTube.
- Se mide igual que la clase de bienvenida: abierto, 25/50/75/100 %, cerrado, y
  si después hace la tarea de la sección.
