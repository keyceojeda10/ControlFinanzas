# Control Finanzas

SaaS multi-tenant para gestion de cartera de credito informal.

## Dominios

- `control-finanzas.com`: landing page.
- `app.control-finanzas.com`: aplicacion SaaS (este repositorio).

## Que resuelve

Control Finanzas permite operar el ciclo completo de un negocio de prestamos:

- Gestion de clientes, prestamos, pagos y rutas.
- Operacion por roles (`owner`, `cobrador`, `superadmin`).
- Caja, capital y reportes.
- Suscripciones y cobros con MercadoPago (pago unico y recurrente).
- CRM, leads, soporte y automatizaciones de seguimiento.
- Modo offline + PWA para trabajo en campo.

## Stack principal

- Next.js 15 (App Router).
- React 19.
- NextAuth (credenciales + JWT).
- Prisma ORM.
- MySQL (provider configurado en Prisma).
- Tailwind CSS 4.
- Vitest.

Integraciones:

- MercadoPago.
- Resend (emails transaccionales).
- Web Push.
- Telegram (notificaciones y callbacks).
- Facebook CAPI / Meta Leads.
- Microservicio WhatsApp (Baileys, en carpeta separada).

## Estructura funcional (alto nivel)

- `app/(dashboard)`: app principal para owner/cobrador.
- `app/admin`: panel de superadmin.
- `app/api`: API routes por dominio.
- `components`: UI y componentes de negocio.
- `lib`: logica compartida (auth, pagos, analytics, offline, etc).
- `prisma`: schema, migraciones y seed.
- `public/sw.js`: service worker para PWA/offline.
- `baileys-service`: servicio separado para automatizacion de WhatsApp.

## Requisitos

- Node.js 20+
- npm 10+
- MySQL 8+

## Instalacion local

1. Instalar dependencias:

```bash
npm install
```

2. Crear archivo `.env.local` en la raiz.

3. Configurar variables de entorno (minimo recomendado):

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/DB_NAME"

NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="CAMBIAR_POR_UN_SECRET_SEGURO"

MERCADOPAGO_ACCESS_TOKEN=""
MERCADOPAGO_WEBHOOK_SECRET=""

RESEND_API_KEY=""

NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
VAPID_EMAIL="mailto:soporte@control-finanzas.com"

CRON_SECRET=""

TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
TELEGRAM_NOTIF_BOT_TOKEN=""
TELEGRAM_NOTIF_CHAT_ID=""
TELEGRAM_WEBHOOK_SECRET=""
TELEGRAM_NOTIF_WEBHOOK_SECRET=""

FB_PIXEL_ID=""
FB_CAPI_ACCESS_TOKEN=""
FB_APP_SECRET=""
FB_PAGE_ACCESS_TOKEN=""
FB_LEADS_VERIFY_TOKEN=""
FB_FORM_ID=""

BACKUP_SECRET=""
```

4. Generar cliente Prisma y aplicar migraciones:

```bash
npx prisma generate
npx prisma migrate dev
```

5. (Opcional) Cargar datos iniciales:

```bash
npx prisma db seed
```

6. Iniciar en desarrollo:

```bash
npm run dev
```

## Scripts

- `npm run dev`: servidor local.
- `npm run build`: build de produccion.
- `npm run start`: correr build.
- `npm run lint`: lint con ESLint.
- `npm run test`: tests en modo watch.
- `npm run test:run`: ejecutar tests una vez.
- `./scripts/deploy-stack.ps1`: deploy app + trigger de landing opcional + verificacion post-deploy.

## Deploy automatizado (app + landing separada)

Este repositorio corresponde al sistema (`app.control-finanzas.com`).
Si la landing (`control-finanzas.com`) vive en otro repo, su deploy debe dispararse aparte.

1. Variables de entorno requeridas para deploy de app:

```powershell
$env:DEPLOY_SSH_USER = "usuario"
$env:DEPLOY_SSH_HOST = "host"
$env:DEPLOY_SCRIPT_PATH = "/home/deploy-sistema.sh" # opcional
$env:DEPLOY_SSH_PASSWORD = "..." # opcional (si no usas llave SSH)
```

2. Opciones para deploy de landing (elige una):

- Opcion A (plataformas tipo Vercel/Netlify/Render): webhook

```powershell
$env:LANDING_DEPLOY_HOOK_URL = "https://..."
```

- Opcion B (VPS/CyberPanel): deploy por SSH + script remoto

```powershell
$env:LANDING_DEPLOY_SSH_USER = "usuario"
$env:LANDING_DEPLOY_SSH_HOST = "host"
$env:LANDING_DEPLOY_SCRIPT_PATH = "/home/deploy-landing.sh" # opcional
$env:LANDING_DEPLOY_SSH_PASSWORD = "..." # opcional (si no usas llave SSH)
```

3. Ejecutar deploy completo con verificacion:

```powershell
pwsh -File ./scripts/deploy-stack.ps1 -RequireLandingFresh
```

Opciones utiles:

- Solo app + verificacion de app: `pwsh -File ./scripts/deploy-stack.ps1 -SkipLandingDeploy`
- Solo verificacion (sin desplegar): `pwsh -File ./scripts/deploy-stack.ps1 -SkipAppDeploy -SkipLandingDeploy`

### CyberPanel (Hostinger) recomendado

Si la landing esta en un VPS con CyberPanel, normalmente no hay deploy hook listo.
La via mas estable es un script remoto por SSH (ejemplo: `/home/deploy-landing.sh`) que haga:

```bash
cd /ruta/del/repo-landing
git fetch origin
git checkout main
git pull --ff-only origin main
npm ci
npm run build
sudo systemctl reload openlitespeed
```

## Seguridad y acceso

- Middleware de rutas por rol en `middleware.js`.
- Sesiones JWT con refresh periodico de claims en `lib/auth.js`.
- Endpoints criticos (cron/webhooks) protegidos por secretos.
- Verificacion de firma para webhook de MercadoPago.

## Procesos cron

Varios endpoints en `app/api/cron/*` requieren header `x-cron-secret`.

Ejemplo:

```bash
curl -X POST "http://localhost:3000/api/cron/onboarding-emails" \
	-H "x-cron-secret: TU_CRON_SECRET"
```

## Servicio WhatsApp (Baileys)

Se ejecuta aparte del frontend/backend principal:

```bash
cd baileys-service
npm install
npm start
```

Variables relevantes del microservicio:

- `PORT` (default `3003`)
- `BAILEYS_SECRET`

## Estado del README

Este README describe el estado actual del proyecto y reemplaza la plantilla base de Next.js.
Si agregas nuevas integraciones o jobs, actualiza este archivo para mantener onboarding tecnico claro.
