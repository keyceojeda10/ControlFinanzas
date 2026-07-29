# Onboarding — el diseño, palabra por palabra

Extraído del `.dc.html`. **Sin rediseñar todavía**: hoy corre
`components/onboarding/OnboardingWizard.jsx` con bienvenida → capital →
cartulina → éxito, con el diseño viejo.

La nota del diseñador que encuadra todo:

> Reordena el flujo con **una sola espina de progreso**. El plan sale del
> onboarding y pasa a después del primer cliente cargado. El aviso de verificar
> correo baja de bloque de 120px a una línea. **El método de carga se elige una
> vez, no por cliente.** La revisión del OCR se vuelve la pantalla principal del
> flujo, porque ahí es donde se abandona.

---

## Paso 1 de 4 · Tu forma de trabajar  (`01 · Perfil`)

```
Carlos, vamos a cargar tu cartera
Tres minutos. Todo lo que crees aquí lo puedes editar o borrar después.

¿Quién cobra?
  Yo cobro           Manejo mi cartera directamente.
  Tengo cobradores   Creo sus cuentas y asigno rutas.

19 de cada 20 negocios cobran solos. Si más adelante contratas, activas el
modo equipo desde Más.

[Continuar]
Ya conozco el sistema, saltar
```

## Paso 2 de 4 · Capital  (`02 · Capital`)

```
¿Con cuánto dinero arrancas?
El efectivo que tienes disponible para prestar hoy.

Capital inicial · COP
$ 3.000.000
[+500k] [+1M] [+5M] [Borrar]

Si lo dejas en cero, tu caja va a quedar en negativo el primer día que
prestes. Puedes corregirlo después en Caja.

[Continuar]
Lo registro después
```

> **El monto ES la pantalla:** 40px en Space Grotesk tabular. Atajos de 44px,
> no chips de 26px.

## Paso 3 de 4 · Tu cartera  (`03 · Método de carga`)

```
¿Cómo tienes tus clientes hoy?
Eliges una vez. Después no vuelve a preguntar.

  Foto de la cartulina   [MÁS RÁPIDO]
    Hasta 5 fotos por tanda. Se leen los datos y tú confirmas antes de crear nada.
  Un Excel o CSV
    Sube el archivo que ya tengas.
  Los escribo yo
    Uno por uno, a mano.

[Tomar la primera foto]
Empezar con la cartera vacía
```

> Hoy el migrador pregunta "manual o foto" **en cada cliente**. Aquí se decide
> una vez.

**Son TRES métodos**, no dos. El asistente actual solo ofrece foto y manual —
por eso `components/pantallas/CarteraVacia.jsx` (que sí tiene tres) no cuadra
hoy con el onboarding. **La forma de cuadrarlo es añadir el Excel aquí**, no
quitarlo de la cartera vacía.

## Paso 4 · Listo  (`03 · Listo`)

```
Ya tienes tu negocio en la app
18 clientes y 31 préstamos, sacados de tu cuaderno.

Tu cartera quedó en
$14.280.000

Clientes 18 · Préstamos 31 · Cobras hoy 7

Lo que falta, cuando puedas
  6 clientes sin teléfono
  3 sin dirección
Nada de esto te frena. Puedes cobrar hoy mismo y completarlo cuando pases por
su casa.

[Ver los 7 cobros de hoy]
Ir al panel
```

## `04 · Revisión del OCR` — «la pantalla clave»

Un punto de estado por fila, y el dudoso abierto con el recorte de la foto
donde iba el dato.

```
LEÍDO POR IA
Encontré 7 clientes
Revisa los 2 marcados en ámbar. No se crea nada hasta que confirmes.

Carlos Chaparro   CC 81283812 · quincenal · 20%   $1.200.000
Julián Vélez      CC 71920034 · diario · 20%        $670.000
Steven Olmos      Falta la cédula                   $450.000   ← ámbar, abierto
     Cédula [1 0 3 4 …]  + recorte de la foto donde iba el dato
Carmen Jiménez    Monto poco legible                 $45.000?  ← ámbar
Deisy Ramírez     CC 43987112 · semanal · 15%       $300.000

7 clientes · cartera   $4.865.000
[Crear los 7 clientes]
```

---

## La decisión que más cambia el producto

**El paso de elegir plan sale del onboarding.** Palabras del diseñador:

> Hoy este paso pide escoger entre tres planes **con cero clientes en la app**:
> es adivinar, y es una pantalla de cobro puesta justo antes del paso que decide
> si el negocio se queda. Aquí no hay nada que elegir —el plan es gratis 30
> días, sin tarjeta— y los precios se muestran solo como información de lo que
> viene. La acción dorada no es "continuar", es **cargar mi cartera**: la barra
> de progreso dice "falta cargar tu cartera", **porque el registro no termina
> cuando la cuenta existe, termina cuando hay datos dentro.**

Esto cuadra con lo medido: la activación es el cuello de botella y los clientes
cargados predicen el pago (0 clientes → 0%; 51-150 → 74%).
