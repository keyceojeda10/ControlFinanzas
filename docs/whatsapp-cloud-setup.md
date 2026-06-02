# Setup paso a paso — WhatsApp Cloud API (bot comercial)

Esta guía es para configurar en **Meta** todo lo necesario para que el bot comercial de
Control Finanzas funcione con la **WhatsApp Cloud API oficial**. El código ya está listo;
acá solo se obtienen los valores que van al `.env` del VPS y se crea la plantilla.

> **Arquitectura de 2 números**
> - **573011993001** (el actual): queda como WhatsApp de **administración/personal**. NO se usa
>   para el bot. Es el número delicado que hay que cuidar — nunca enviar campañas automáticas con él.
> - **Número NUEVO** (el libre que ya tienes): será el **bot comercial** sobre Cloud API. Atiende a
>   la gente que llega de la publicidad. ⚠️ Ese número **no puede tener la app de WhatsApp normal
>   instalada/activa** — la Cloud API lo "consume".

---

## Resumen de lo que vas a obtener (y dónde va en el `.env`)

| Valor en Meta | Variable en `.env` del VPS |
|---|---|
| Token permanente del System User | `WHATSAPP_ACCESS_TOKEN` |
| Phone Number ID (del número nuevo) | `WHATSAPP_PHONE_NUMBER_ID` |
| WhatsApp Business Account ID (WABA) | `WHATSAPP_WABA_ID` |
| App Secret de la app de Meta | `WHATSAPP_APP_SECRET` |
| Token que tú inventas para el webhook | `WHATSAPP_VERIFY_TOKEN` |
| Nombre de la plantilla de primer contacto | `WHATSAPP_TEMPLATE_INICIAL` |
| (Opcional) Nombre de plantilla de seguimiento | `WHATSAPP_TEMPLATE_SEGUIMIENTO` |
| (Opcional) Idioma de plantillas, default `es` | `WHATSAPP_TEMPLATE_LANG` |

---

## Paso 1 — Meta Business Manager
1. Entra a https://business.facebook.com con la cuenta que usas para los anuncios.
2. Confirma que tienes un **Business Portfolio** (negocio). Si corres ads, ya lo tienes.
3. (Recomendado, para subir límites después) Inicia la **verificación del negocio**:
   Configuración del negocio → Centro de seguridad → Verificar. Pide documento legal del negocio.
   No es obligatorio para arrancar (arrancas con 250 mensajes/día), pero sí para subir a 1.000+.

## Paso 2 — Crear la App en Meta for Developers
1. Entra a https://developers.facebook.com → My Apps → **Create App**.
2. Tipo de app: **Business**.
3. Asóciala a tu Business Portfolio del Paso 1.
4. En el dashboard de la app → **Add Product** → agrega **WhatsApp**.

## Paso 3 — Agregar el número nuevo
1. En la app → WhatsApp → **API Setup** (o "Configuración de la API").
2. En "From"/"Phone numbers" → **Add phone number** → ingresa el **número nuevo libre**.
3. Meta te envía un **código por SMS o llamada** → verifícalo.
4. Una vez agregado, en esa misma pantalla verás dos IDs. Cópialos:
   - **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - **WhatsApp Business Account ID** → `WHATSAPP_WABA_ID`

## Paso 4 — Token permanente (System User)
> El token temporal de "API Setup" dura 24h. Para producción se usa un token permanente.
1. Business Settings (Configuración del negocio) → **Users → System Users**.
2. **Add** → crea un System User (ej. "bot-control-finanzas"), rol **Admin**.
3. Con el System User seleccionado → **Add Assets** → asigna tu **App** (la del Paso 2) con
   control total.
4. **Generate New Token**:
   - Selecciona la App.
   - Permisos: marca **`whatsapp_business_messaging`** y **`whatsapp_business_management`**.
   - Expiración: **Never** (permanente).
5. Copia el token → `WHATSAPP_ACCESS_TOKEN`. (Solo se muestra una vez; guárdalo bien.)

## Paso 5 — App Secret
1. En la app → Settings → **Basic**.
2. Copia el **App Secret** (botón "Show") → `WHATSAPP_APP_SECRET`.
   (Sirve para validar que los webhooks vienen de verdad de Meta.)

## Paso 6 — Configurar el Webhook
1. Define un **Verify Token** (una cadena que tú inventas, ej. `cf_wa_verify_2026`) →
   `WHATSAPP_VERIFY_TOKEN`. Ponlo primero en el `.env` del VPS y reinicia la app, para que el
   endpoint ya lo conozca cuando Meta lo verifique.
2. En la app → WhatsApp → **Configuration** → sección Webhook → **Edit**:
   - **Callback URL:** `https://app.control-finanzas.com/api/webhook/whatsapp-cloud`
   - **Verify Token:** el mismo del paso anterior.
   - Click **Verify and Save**. Meta hará un GET; si todo está bien, queda "Verified".
3. En **Webhook fields** → **Subscribe** al campo **`messages`**.

## Paso 7 — Crear la plantilla de primer contacto
> Es OBLIGATORIA: en frío (antes de que el lead responda) solo se puede enviar una plantilla aprobada.
1. https://business.facebook.com → **WhatsApp Manager** → Account tools → **Message Templates** →
   **Create template**.
2. Categoría: **Marketing** (si Meta la reclasifica como Utility, está bien).
3. Idioma: **Spanish** (`es`).
4. Nombre (en minúsculas y guion bajo): ej. `contacto_inicial` → `WHATSAPP_TEMPLATE_INICIAL`.
5. Body con UNA variable **nombrada** `{{nombre}}` (Meta exige variables con nombre, no `{{1}}`).
   Usa el botón "+ Agregar variable" y nómbrala `nombre`. El cuerpo debe quedar:
   ```
   Hola {{nombre}}, vimos tu interés en Control Finanzas. ¿Cómo llevas el control de tu cartera hoy?
   ```
   - En "Sample" pon un nombre de ejemplo (ej. "Carlos") para que Meta apruebe.
   - ⚠️ El nombre de la variable debe ser exactamente **`nombre`** (el código envía
     `parameter_name: "nombre"`). Si la cambias, avísame para ajustar el código.
6. Enviar a revisión. Aprobación: de minutos a 24h. Estado debe quedar **Approved**.
7. (Opcional) Crea otra plantilla para seguimientos en frío y ponla en
   `WHATSAPP_TEMPLATE_SEGUIMIENTO`. Si no la creas, los seguimientos solo salen dentro de la
   ventana de 24h (cuando el lead ya respondió).

## Paso 8 — Cargar variables en el VPS y probar
1. Pega todas las variables en `/home/control-finanzas/.env`.
2. Reinicia la app (`pm2 restart cf`).
3. Verificación end-to-end:
   - El webhook debe quedar "Verified" en Meta (Paso 6).
   - La plantilla debe estar "Approved" (Paso 7).
   - Crear un BotLead de prueba con TU propio número de WhatsApp y disparar el primer contacto →
     debe llegarte la **plantilla**.
   - Responde a la plantilla desde tu teléfono → el bot (Claude/DeepSeek) debe contestarte en
     texto libre dentro de la ventana de 24h.
   - En `/admin/whatsapp-bot` el estado debe verse "Cloud API · <número>" en verde.

---

## Notas importantes (para no volver a caer en bans)
- **Nunca** uses el número admin (573011993001) para envíos automáticos masivos. Ese número es solo
  personal/manual ahora.
- El primer contacto **siempre** por plantilla aprobada. El texto libre solo dentro de la ventana de
  24h tras la respuesta del lead.
- Cuida el **quality rating** del número en WhatsApp Manager: si muchos bloquean/reportan, Meta baja
  el límite. Mensajes claros, opt-out fácil ("si no te interesa, me dices y no escribo más").
- Límite inicial: **250 mensajes/día**. Sube a 1.000 al verificar el negocio (Paso 1) y luego escala
  por calidad.
- Costo: la plantilla de marketing cuesta ~centavos por envío (Colombia); la conversación libre
  dentro de la ventana de 24h es **gratis**.
