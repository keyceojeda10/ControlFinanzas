# Seguimiento, activación y retención: el plan

**Fecha:** 12 de octubre de 2026
**Parte de:** la especificación de BotAdsManager (`ESPEC-SEGUIMIENTO-ACTIVACION-RETENCION.md`) y su auditoría (`REPORTE-AUDITORIA-OCT12.md`), aprobadas por Carlos.
**Añade:** lo que encontré en el código, el cambio de precios de WhatsApp del 1 de octubre, la estrategia de plantillas de utilidad, el descuento por Nequi guardado y el orden de trabajo.

---

## 1. Decisiones, en una tabla

| Tema | Especificación original | Queda así | Por qué |
|---|---|---|---|
| Descuento por Nequi guardado | 50 % el primer mes, solo para quien se fue | **35 %**, una vez. Para quien se fue y **también para los que pagan hoy a mano** | Ver la sección 4. El 35 % se paga solo; el 50 % no hace falta |
| Plantillas | Utility «donde aplique» | **Utility en todo lo que sea un aviso de su propia cuenta.** Marketing solo en la oferta de descuento | Desde el 1 oct se cobra todo, también las respuestas. Utility cuesta del orden de una décima parte que marketing |
| Mensajes de la prueba | Todos por WhatsApp | **Primero en la app (aviso y notificación push, que son gratis).** WhatsApp solo si no ha abierto la app en 24 h | Costo, y además no todos los mensajes de uso pasan como utility |
| Prueba 7 + 7 | Cambiar `planDemoHasta` | Cambiar `planDemoHasta` **y** la fecha de vencimiento de la suscripción de prueba | Lo que bloquea la app es la suscripción, no `planDemoHasta`. Con un solo cambio la prueba seguiría siendo de 14 días |
| Seguimiento | Un solo motor | Un solo motor **y una tabla propia** para lo que se manda y se responde | Hoy son marcas sueltas en la organización; una de ellas la comparten tres crons |

---

## 2. Lo que cambió en WhatsApp el 1 de octubre de 2026

Según la documentación de Meta:

- **Las respuestas del bot dentro de la ventana de 24 h ya no son gratis.** Desde el 1 oct 2026 cada mensaje sin plantilla («mensaje de servicio») se cobra a la tarifa de utilidad del país, sin descuento por volumen.
- **Una plantilla de utilidad dentro de la ventana también se cobra.** Antes era gratis.
- **Sigue gratis la ventana de 72 h** de quien escribe desde un anuncio «clic a WhatsApp» o desde el botón de la página de Facebook: cualquier mensaje en esas 72 h no se cobra.
- **Marketing no cambia** de precio. Sigue sometido a los límites por persona: los errores 131049 y 130472.
- **Reglas de categoría** (las de 2025, vigentes):
  - Utility tiene que ser **no promocional** y estar **ligado a la cuenta, el servicio o una transacción** de la persona.
  - Lo mixto o ambiguo cae en marketing.
  - Si Meta reclasifica muchas plantillas, puede pasar **todas** las utility de la cuenta a marketing y limitar el envío. Por eso no conviene forzar.

### Lo que esto significa para nosotros

En los últimos 30 días se mandaron:
- **2.757 textos libres** (1.404 entregados);
- **1.826 plantillas**, casi todas de marketing: `onboarding_seguimiento` 366, `seguimiento_postlink` 366, `seguimiento_lead` 199, `seguimiento_descubrimiento` 149, `contacto_v2` 96, `plan_vencido_v2` 79…

Desde octubre los 1.404 textos entregados también se cobran.

- **Las respuestas del bot cuestan.** Conviene que diga lo mismo en menos mensajes: juntar los mensajes partidos y no repetir.
- **La mitad de los textos libres falla.** 1.353 de 2.757 en 30 días. Suena a envíos fuera de la ventana. Hay que revisarlo (sección 7, bloque 5).
- **Recomendación para BotAdsManager:** los anuncios «clic a WhatsApp» dan 72 h de conversación gratis. Los formularios de Meta no: ahí el bot abre con plantilla y cada respuesta se cobra.
- **El seguimiento nuevo multiplica los envíos.** Unas 100 cuentas en prueba con un mensaje al día son unos 3.000 al mes. Por eso:
  1. utility siempre que el contenido lo permita;
  2. la app primero (aviso diario y push, gratis);
  3. WhatsApp solo cuando la persona no abre la app.

Las tarifas exactas de Colombia están en el archivo de tarifas en COP de Meta (vigente desde el 1 jul 2026). Hay que bajarlo antes de medir el costo real.

---

## 3. Las plantillas

**Regla de redacción para que pasen como utility:**
- Hablan de **su** cuenta, con **sus** datos (fechas, cantidades, montos).
- No llevan «aproveche», «no se lo pierda», descuentos ni «renueve hoy».
- El botón lleva a su cuenta, no a una oferta.

Todas van en «usted», como el resto del sistema.

Cada una lleva un botón de respuesta rápida **«No quiero más mensajes»**, que apaga el seguimiento de esa persona. Es lo que Meta mira para la calidad de la cuenta.

| Nombre | Categoría buscada | Cuándo | Texto propuesto |
|---|---|---|---|
| `cuenta_configurar` | **Utility** (el ejemplo de Meta «para terminar de configurar su cuenta…») | Registrado hace 24 h con menos de 6 clientes | «Para terminar de configurar su cuenta de Control Finanzas faltan sus clientes. Puede cargarlos usted desde la app o enviarnos fotos del cuaderno o el Excel y se los dejamos cargados en 24 horas.» Botones: *Cargarlos yo* (URL) · *Que me ayuden* (respuesta) |
| `cobros_de_hoy` | **Utility** (recordatorio de su agenda, con sus datos) | Tiene cartera y hoy no ha registrado cobros (11 a. m.) | «Recordatorio de su cuenta: hoy tiene {{1}} cobros programados por {{2}}. Puede registrarlos aquí.» Botón URL a la ruta de hoy |
| `prueba_extendida` | **Utility** (actualización de su cuenta) | Ganó el premio de 3 días | «Su prueba de Control Finanzas se extendió hasta el {{1}} porque registró cobros en 3 días distintos.» |
| `prueba_por_vencer` | **Utility** (aviso de cuenta con fecha y datos, sin empuje) | Faltan 2 días | «Su prueba de Control Finanzas vence el {{1}}. En estos días registró {{2}} cobros por {{3}}. Sus datos quedan guardados.» Botón URL «Ver mi cuenta» |
| `plan_por_vencer_v4` | **Utility** (el ejemplo de Meta del recordatorio de pago con fecha) | 3 días antes del vencimiento | «Su plan {{1}} de Control Finanzas vence el {{2}}. Valor: {{3}}.» Botón URL «Pagar». Reemplaza a `plan_por_vencer_v2/v3` (marketing) |
| `plan_vencido_v3` | **Utility** | D+1 (hoy `plan_vencido_v2`, marketing) | «Su plan de Control Finanzas venció el {{1}}. Su cuenta y sus {{2}} clientes siguen guardados.» Botón URL «Pagar» |
| `motivo_no_renovo` | **Utility** (encuesta sobre SU suscripción, no genérica). Si Meta la pasa a marketing, se acepta | D+3 | «Su plan de Control Finanzas venció el {{1}} y no se renovó. ¿Nos dice el motivo?» Respuestas rápidas: *El precio* · *No alcancé a usarla* · *Me falta algo* · *Cambié de sistema* · *Cerré el negocio* · *Otro* |
| `cuenta_inactiva` | **Utility** (alerta de su cuenta) | Cliente que paga, 7 días sin entrar («en riesgo») | «Su cuenta de Control Finanzas tiene {{1}} cobros sin registrar desde el {{2}}.» Botón URL «Ver mis cobros» |
| `datos_guardados` | **Utility** (estado de la cuenta) | D+21 | «Su cuenta de Control Finanzas está inactiva desde el {{1}}. Sus {{2}} clientes y su historial siguen guardados para cuando quiera volver.» |
| `cartera_recibida` | **Utility** (confirma lo que pidió) | Llegan sus archivos (bloque 4) | «Recibimos sus {{1}} archivos para cargar su cartera. La tendrá lista en máximo 24 horas.» |
| `cartera_cargada` | **Utility** | Se aprueba su cartera (bloque 4) | «Su cartera quedó cargada en Control Finanzas: {{1}} clientes y {{2}} en la calle. Su prueba de 7 días empieza hoy.» |
| `oferta_nequi` | **Marketing** (inevitable: es un descuento) | D+7 si respondió «el precio» · campaña a quien paga a mano | «{{1}}, si deja Nequi guardado para el pago automático, su próximo mes de Control Finanzas le sale con 35 % de descuento.» Botón URL |

**Lo que NO va por WhatsApp**, porque no pasaría como utility y es un empujón de uso:
- «le falta 1 día para el premio»;
- «2 días sin entrar».

Van en la app: aviso diario y notificación push. Si no ha abierto la app en 2 días, el mensaje de WhatsApp es `cobros_de_hoy`, que sí habla de su cuenta.

**Proceso:**
1. Tú apruebas los textos.
2. Yo los subo a Meta como utility. Si Meta cambia la categoría, me entero por la respuesta y te aviso.
3. No se insiste con una plantilla reclasificada, para no dañar la calidad de la cuenta.

---

## 4. El descuento por Nequi guardado

### Lo que dicen los datos

De 76 negocios que pagaron alguna vez:

| | Pagaron | Siguen pagando hoy | Pagos en promedio | Ticket |
|---|---|---|---|---|
| Con Nequi guardado | 8 | **8 (100 %)** | 3,3 | $45.183 |
| Pagando a mano | 68 | 46 (68 %) | 2,5 | $55.513 |

La muestra es chica (8) y hay sesgo: quien guarda Nequi ya era fiel. Aun así, la diferencia es grande y va en la dirección esperada. El que paga solo no tiene que acordarse, y la renovación de octubre se cayó al 70 % justo entre los que pagan a mano.

### La cuenta

| Concepto | Valor |
|---|---|
| Ticket medio | ~$55.000 |
| 35 % de un mes | ~$19.000, una vez |
| Mejora de renovación necesaria para recuperarlo | 1 de cada 3 clientes renovando un mes más (~$55.000) |

Si la renovación de quien guarda Nequi pasa del 68 % a cerca del 90 %, el descuento se paga en el primer o segundo mes. El 50 % (~$27.500) también se pagaría, pero regala $8.500 más por cliente sin que los datos digan que hace falta.

**Recomendación: 35 %.**

### Reglas

- **Una sola vez por negocio.** Es el descuento de **un mes** y se aplica **al primer cobro automático que entra**. Así nadie guarda el Nequi, cobra el descuento y lo borra.
- **Solo con suscripción mensual.** Es lo único que cobra el pago automático; ver la memoria `wompi_cobro_recurrente`.
- **A quién se ofrece:**
  - a los que **pagan hoy a mano** (46): una campaña única con `oferta_nequi` y un aviso en la app;
  - a **quien se fue y respondió «el precio»**: el D+7.
- **Cómo se monta:** con el precio preferencial temporal que ya existe (`lib/precio-plan.js`), por «1 cobro». No hace falta un sistema nuevo de cupones.
  - ⚠ El cobro automático y el pago a mano cobran distinto (memoria `precio_preferencial`). Hay que comprobar que el descuento entra por la vía automática.

---

## 5. Lo que ya existe y cómo se usa

| Pieza | Estado | Uso en el plan |
|---|---|---|
| Crons `onboarding-whatsapp`, `activacion-whatsapp`, `primer-cobro-whatsapp`, `trial-reminder` (correo), `recovery-whatsapp`, `reactivacion` | Por calendario; marcas en `Organization`; `waRecoverySent` compartida por tres | **Se apagan** cuando el motor nuevo cubra su caso. Se apaga uno por uno, no todos el mismo día |
| `churn-whatsapp` | Antes de vencer (0-3 días) y D+1…7 | Se queda para D+1 y antes de vencer, con las plantillas utility nuevas. El motor toma desde D+3 |
| `lib/bot/whatsapp-cloud.js` | Plantillas, botones, texto. Todo queda en `EnvioWhatsapp` (sin `organizationId`) | Se reutiliza. Se le añade el enlace a la organización |
| Webhook de WhatsApp | **Descarta la respuesta con botón de una plantilla** (`type: 'button'`) | **Hay que aceptarlo.** Sin esto el D+3 no guarda nada |
| `lib/telegram.js` | Ya tiene canal de escalamiento | Las alertas a Carlos |
| `notificar()` y push | Única puerta de notificaciones | Los mensajes de la prueba van primero por aquí |
| Prueba gratis | `DIAS_PRUEBA = 14`; el bloqueo lee `Suscripcion.fechaVencimiento` | Se cambian las dos fechas |
| Precio preferencial | Temporal, por N cobros | El 35 % |
| Lectores (cartulinas, PDF Crossbox, Excel) e importador | Leen sin guardar; el importador hace la carga real | El bloque 4 los reutiliza; falta el área de espera |

---

## 6. Datos nuevos

- **`SeguimientoOrg`** — el estado de cada negocio en el motor:
  - `organizationId` y `etapa` (prueba / pagando / en_riesgo / vencido / recuperado / no_molestar);
  - `ultimoEnvioAt` (para mandar como máximo uno al día);
  - `noMolestar` y `motivoBaja` (la respuesta del D+3);
  - `ofertaNequiUsada` y `escaladoAt` (Telegram una sola vez por caso).
- **`EnvioSeguimiento`** — cada mensaje del motor:
  - `organizationId`, `caso` y `paso`;
  - `canal` (whatsapp / push / app) y `plantilla`;
  - `enviadoAt`, `respuesta`, `respondidoAt` y `wamid`.

  De aquí salen las métricas.
- **`SolicitudCarga`** — bloque 4:
  - organización, archivos, estado (recibida / leída / en_revision / aprobada / rechazada), filas leídas con su confianza (JSON), quién la aprobó y cuándo.
- **`Organization`**: nada nuevo para la prueba. El premio se guarda en `SeguimientoOrg` y sus efectos en las dos fechas.

El SQL de cada cambio de esquema se saca con `prisma migrate diff` contra el espejo, se lee, se aplica a mano **antes** del código y se comprueba (regla del repo).

---

## 7. El trabajo, por bloques

Cada bloque se prueba en el espejo y se despliega por tandas. Lo que está entre corchetes depende de otra cosa.

### Bloque 0 · Cimientos (sin esto no arranca nada)
1. Tablas `SeguimientoOrg` y `EnvioSeguimiento`.
2. El webhook acepta la respuesta con botón de plantilla y la guarda en el envío del que viene. «No quiero más mensajes» pone `noMolestar`.
3. **Motor único** `cron/seguimiento`, que corre cada hora:
   - decide un mensaje por negocio con prioridad (el disparador más reciente gana);
   - como máximo uno al día;
   - solo entre 8 a. m. y 7 p. m. hora de Bogotá;
   - nunca a quien tiene `noMolestar`;
   - nunca a las cuentas internas: la del dueño y la de prueba.
4. **Envío por canal:** primero push y aviso en la app; WhatsApp si no abrió la app en 24 h.
5. Las 12 plantillas, redactadas y [con tu visto bueno] subidas a Meta.
6. Panel de métricas en el superadmin, con la línea base del 12 oct.

### Bloque 1 · Reenganche y escalamiento
1. Secuencia del vencido:
   - el D+1 se queda en `churn-whatsapp`, con la plantilla utility nueva;
   - **D+3** `motivo_no_renovo`, guardando la respuesta;
   - **D+7** según la respuesta: precio → `oferta_nequi` (35 %); no la usó o le falta algo → ofrecer asesor y abrir un `TicketSoporte`/`Sugerencia` con lo que pidió; cambió de sistema o cerró → un cierre amable, sin oferta;
   - **D+21** `datos_guardados`;
   - la secuencia se corta si paga.
2. Incluye a las bajas desde el 1 de septiembre (INVERSIONES JM, Inversores valencia, Inversiones soto, Préstamo Olaya, Inversiones J&M, Préstamos Rincón, CREDITOS JR). Entran en el paso que les toque según su fecha.
3. **En riesgo:** cliente que paga y lleva 7 días sin entrar → `cuenta_inactiva` con sus cobros vencidos sin registrar.
4. **Escalamiento a Carlos por Telegram:**
   - solo para cuentas con 100 o más clientes;
   - cuándo: sin respuesta 48 h tras el D+3, respuesta positiva, «precio» o «cambié de sistema», o «en riesgo»;
   - qué lleva: nombre, teléfono, clientes, plan y monto, último uso, qué le dijo el bot, qué respondió y la acción sugerida;
   - una sola vez por caso.
5. **El 35 % por Nequi guardado** (precio preferencial por 1 cobro, aplicado al primer cobro automático) **y la campaña única a los 46 que pagan a mano**.

### Bloque 2 · Prueba 7 + 7 y seguimiento en la prueba
1. **Registro:** prueba de 7 días (`planDemoHasta` y la suscripción de prueba). **Quien ya está en prueba conserva sus 14.**
2. **Premio:**
   - cobros en 3 días distintos (hora de Bogotá) antes de vencer → las dos fechas pasan a registro + 14;
   - una sola vez;
   - aviso en la app + `prueba_extendida`.
3. **Con asesor:** el reloj de 7 días arranca cuando se aprueba su cartera.
4. **Disparadores del motor:**

   | Disparador | Mensaje |
   |---|---|
   | Sin cartera a las 24 h | `cuenta_configurar` |
   | Con cartera y sin cobros | `cobros_de_hoy` |
   | Cobró ayer y hoy no, a las 11 a. m. | push primero; si no abre, `cobros_de_hoy` |
   | Le falta 1 día para el premio | solo en la app |
   | Faltan 2 días | `prueba_por_vencer` |

   El «hoy le tocan X cobros» sale de la misma cuenta que `cobros-hoy`.
5. **El texto del 7 + 7 en todos lados:**
   - bienvenida, barra de progreso y correo de bienvenida;
   - textos del bot (bloque 5) y página de precios;
   - recomendación para anuncios: «hasta 14 días gratis».
6. Se apagan `onboarding-whatsapp`, `activacion-whatsapp`, `primer-cobro-whatsapp`, `trial-reminder` y `recovery-whatsapp` cuando el motor los cubre. Se deja `reactivacion`, que es una campaña manual.

### Bloque 3 · Aviso diario en la app (solo en prueba)
- Sale al entrar, solo si hoy hay cobros pendientes y no registró ninguno.
- Muestra cuántos cobros hay y el monto esperado.
- Botón grande **«Cobrar ahora»**, que abre la ruta de hoy con el primer cobro.
- Progreso: «Día 2 de 3 para ganar sus 7 días de regalo».
- Se cierra con un toque y no vuelve ese día.
- Diseño del sistema vigente (`DESIGN.md`), probado en 412 px y en PC.

### Bloque 4 · Carga de cartera con asesor
1. **Pantalla «Cargar mi cartera con asesor»:**
   - sube fotos, Excel, PDF o capturas, todo junto;
   - los archivos van al almacén que ya usa el sistema;
   - responde «Recibido» y manda `cartera_recibida`.
2. **Archivos por WhatsApp:** los que mande al bot se adjuntan a su solicitud abierta. El webhook ya recibe imágenes; hay que añadir documentos (PDF y Excel).
3. **Lectura automática:**
   - corre con los lectores que existen, a un **área de espera** (`SolicitudCarga.filas`);
   - nada entra a la cartera real;
   - cada fila lleva su confianza, con las dudosas marcadas: faltantes, montos raros y duplicados.
4. **Superadmin:**
   - lista de solicitudes con su antigüedad;
   - vista previa editable, con la foto original al lado de cada fila dudosa;
   - botón **«Aprobar e importar»**, que usa `lib/importar-cartera.js` (el mismo camino que soporte hoy).
5. **Al aprobar:**
   - se avisa con `cartera_cargada`;
   - arranca su prueba de 7 + 7;
   - entra al seguimiento.
6. **Telegram:** aviso al entrar una solicitud y recordatorio a las 20 h sin aprobar.
7. **A quién se le ofrece:**
   - a quien declara 50+ (formulario o bot);
   - a quien lleva 24 h con menos de 6 clientes (`cuenta_configurar`, botón «Que me ayuden»).

### Bloque 5 · El bot
1. **Textos del bot:**
   - el 7 + 7 («tiene 7 días gratis; registre cobros 3 días y le regalamos 7 más»);
   - la oferta del asesor a quien declara 50+.
2. **Menos mensajes por respuesta**, porque desde el 1 oct cada uno cuesta. Juntar los mensajes partidos y medir cuántos manda por conversación antes y después.
3. **Revisar por qué falla la mitad de los textos libres** (1.353 de 2.757): probablemente envíos fuera de la ventana. Corregir antes de que crezca el volumen.
4. **Respuestas al seguimiento nuevo:** si alguien contesta a una plantilla del motor (por ejemplo «¿cuánto me sale volver?»), el bot responde con el contexto de su cuenta, no con el guion de venta a un lead nuevo.
5. **Pasar las plantillas de lead a utility donde se pueda.** `seguimiento_postlink` (366 al mes) y `onboarding_seguimiento` (366) son las más usadas. Con el criterio de la sección 3, al menos `onboarding_seguimiento` puede pasar a `cuenta_configurar`.

---

## 8. Cómo se mide

En el superadmin, con la línea base del 12 oct:

| Métrica | Hoy | Meta |
|---|---|---|
| Registros con cartera ≥6 | ~20 % | 35 % |
| Declaran 50+ y cargan ≥6 | 9-10 % | 40 % |
| Carteras que cobran en 3+ días durante la prueba | sin medir | 50 % |
| Prueba → pago, carteras ≥6 | ~20-30 % | 50 % |
| Renovación mensual | 70 % (oct) | 90 % |
| Bajas recuperadas en 30 días | 0 | 20 % |
| Negocios con Nequi guardado | 8 de 76 que pagaron | 30 |
| Mensajes de WhatsApp al mes y % utility | 4.583 / ~10 % utility | medir costo por cliente activado |

Para comparar periodos se usa la unión del cruce por teléfono y el enlace del bot. El enlace del bot solo es fiable desde el 1 de septiembre.

---

## 9. Riesgos y cómo se cubren

- **Meta reclasifica una plantilla a marketing.** Se acepta, se corrige el texto si se puede y no se insiste. El motor sabe la categoría real de cada plantilla y prefiere la app para lo que salga en marketing.
- **Molestar.** Un mensaje al día como máximo, horario, «No quiero más mensajes» en todas, y la secuencia se corta si paga o responde.
- **Apagar los crons viejos y que alguien se quede sin mensaje.** Se apaga uno por uno, solo cuando el motor ya cubre su caso. Se compara una semana de envíos antes y después.
- **El premio de la prueba se aplica dos veces o a quien no debe.** Se marca en `SeguimientoOrg` dentro de la misma transacción que mueve las fechas. Probado con relojes simulados.
- **El descuento sale por la vía equivocada.** Prueba de punta a punta en el espejo con el cobro automático de Wompi en modo de prueba.
- **El espejo no habla con nadie.** Las pruebas del motor corren con WhatsApp y Telegram apagados (memoria `espejo_no_habla_con_nadie`).

---

## 10. Qué necesito de Carlos

1. Visto bueno a los textos de las plantillas (sección 3), para subirlas a Meta.
2. Confirmar el 35 % y la campaña a los 46 que pagan a mano.
3. Pasarle a BotAdsManager la recomendación de los anuncios «clic a WhatsApp» (72 h gratis) y «hasta 14 días gratis».

## Fuentes

- Meta: [mensajes sin plantilla (cobro desde el 1 oct 2026)](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages)
- Meta: [precios](https://developers.facebook.com/docs/whatsapp/pricing)
- Meta: [categorías de plantillas](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization)
- Courier: [cambios de precios del 1 oct 2026](https://www.courier.com/blog/whatsapp-pricing-changes-october-2026)
