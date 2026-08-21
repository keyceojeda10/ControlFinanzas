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
ssh -N -L 3341:127.0.0.1:3306 root@69.62.87.141 &
bash .auditoria/arrancar-espejo.sh          # http://localhost:3016

# 2. El negocio de mentira (una vez; se puede repetir sin miedo)
node scripts/video-demo/poblar-demo.mjs

# 3. El vídeo
node scripts/video-demo/v01-registro.mjs    # → /tmp/videos/01-registro.mp4
```

Antes de escribir un vídeo nuevo, mirar qué dice la pantalla de verdad:

```bash
URL=http://localhost:3016/clientes node scripts/video-demo/sondear.mjs
URL=http://localhost:3016/registro node scripts/video-demo/sondear-publico.mjs
```

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

- El **zoom no se puede hacer con CSS**: un ancestro con `transform` saca de su
  sitio todo lo que esté en `position: fixed`, y la barra de navegación acabaría
  flotando en mitad de la pantalla. Se recorta en el montaje.
- **ffmpeg no admite un recorte que cambie de tamaño** (`crop=w='iw/(1+…t…)'`
  falla y no escribe nada). Cada acercamiento es su propio tramo.
- **La escala pedida es un máximo**, y el aire alrededor no puede ser fijo:
  acercarse a un selector de 104 px dejaba fuera el título de la pantalla.
- **`:has-text()` es de Playwright, no del DOM.** Mide Playwright, pinta el
  navegador.
- **El registro admite 3 intentos por hora y por IP.** Grabando se agota; el
  contador vive en memoria del proceso, así que se reinicia el espejo.
- Los campos se escriben **letra a letra**, no con `fill()`: tiene que verse que
  alguien está escribiendo.
- La cuenta que se crea al grabar el registro **se borra antes y después**.

## Lo que falta

Vídeos 2 a 8, según el plan acordado: cliente y préstamo · cobrar el día ·
rutas · cobradores · caja · capital · ajustes y extras. Y el corto de 90
segundos para el bot de ventas.

⚠ **El bot tiene prohibido enviar vídeos** (`lib/bot-v2/prompts.js`). Esa regla
se quita cuando estos existan y estén subidos, no antes.
