# Design System — Control Finanzas

Sistema de diseño canónico. Toda UI nueva DEBE usar estos tokens y componentes.
Fuente de verdad de tokens: `app/globals.css` (@theme + html[data-theme="light"]).

## Theme

Dos temas resueltos por `data-theme` en `<html>`: **light** (default de marca) y **dark** (opcional).
Solo quien guardó preferencia explícita (dark/system) la conserva.
Regla de oro: **nunca hex hardcodeado en JSX** — siempre `var(--color-*)`. El layer de
overrides light en globals.css existe solo como red de seguridad para código legado.

## Color

| Rol | Token | Dark | Light |
|-----|-------|------|-------|
| Fondo base | `--color-bg-base` | #0a0a0a | #f5f7fb |
| Superficie (sidebar/panels) | `--color-bg-surface` | #111111 | #ffffff |
| Card | `--color-bg-card` | #141414 | #ffffff |
| Hover/campo | `--color-bg-hover` | #1a1a1a | #eef1f7 |
| Borde | `--color-border` | rgba(255,255,255,.08) | rgba(20,20,40,.08) |
| Texto primario | `--color-text-primary` | #f0f0f5 | #1a1a2e |
| Texto secundario | `--color-text-secondary` | #999 | #5a5a72 |
| Texto muted | `--color-text-muted` | #666 | #9a9ab0 |
| **Acento (marca)** | `--color-accent` | #f5c518 | #f5c518 |
| Éxito | `--color-success` | #34d399 | #22c9a0 |
| Peligro | `--color-danger` | #f87171 | #ff6b8a |
| Advertencia | `--color-warning` | #fbbf24 | #ffb347 |
| Info | `--color-info` | #60a5fa | #4fb8e5 |
| Púrpura | `--color-purple` | #c084fc | #a78bfa |

Cada color de estado tiene variantes `-dim` (fondo 10-16%) y `-border` (25-30%).

**Semántica fija:** dorado = acción primaria + selección + marca. Verde = pagado/éxito.
Rojo = mora/peligro. Ámbar = advertencia/pendiente. Azul = informativo. Púrpura = análisis/IA.
Excepción única: verde WhatsApp `#25d366` en botones/iconos de WhatsApp (color de marca externa).

## Radius (escala canónica)

| Uso | Valor |
|-----|-------|
| Chips, badges internos, elementos pequeños | **8px** |
| Elementos compactos (iconos btn, celdas) | **10px** |
| **Controles: botones, inputs, selects, toggles** | **12px** |
| Cards y contenedores | **16px** |
| Modales y sheets | **20px** |
| Pills/círculos | `rounded-full` |

Prohibidos: 7px, 9px, 13px, 14px, 18px y cualquier valor fuera de escala.

## Typography

- **Sans** (`--font-geist-sans`): todo el UI — labels, botones, cuerpo, headings de sección.
- **Serif display** (`--font-serif-display`): SOLO `h1` de página (identidad de marca).
- **Mono display** (`.font-mono-display`): TODOS los montos de dinero y datos numéricos comparables. `font-feature-settings: "tnum"`.
- Escala compacta de producto: 10px labels/eyebrows, 12-13px cuerpo denso, 14px cuerpo, 16px títulos de card, 20-24px h1.

## Components (componentes canónicos en components/ui/)

| Control | Componente | Notas |
|---------|-----------|-------|
| Botón | `Button` | variants: primary (dorado), secondary, danger, ghost, success. Alturas: sm 36px, md 44px, lg 48px. Radio 12px |
| Input/Select/Textarea | `Input`, `Select`, `Textarea` | Radio 12px, altura 44px, focus ring dorado (.cf-input) |
| Input dinero | `MoneyInput` | Formateo por país |
| Switch on/off | `Toggle` | ÚNICO switch permitido. ON = dorado accent |
| Checkbox | `Checkbox` | Check dorado, radio 6px |
| Card | `Card` | Radio 16px, elevation 0-3 |
| Modal | `Modal` | Radio 20px, sheet en móvil |
| Confirmación | `ConfirmModal` | Sobre Modal + Button |
| Badge | `Badge` | Pills de estado, 6 variantes |
| Skeleton | `Skeleton` | Loading via .skeleton-shimmer, nunca spinners en contenido |

Todo control interactivo tiene: default, hover, focus-visible (ring dorado), active, disabled.

## Motion

- Duraciones: 150-250ms. Easing: `cubic-bezier(0.22,1,0.36,1)` (ease-out-quint).
- Motion solo comunica estado: confirmación de acción, apertura de modal, skeleton→contenido.
- Stagger de listas permitido (`StaggeredList`), max ~450ms total.
- `prefers-reduced-motion`: todo cae a fade instantáneo (global en globals.css).
- Prohibido: animaciones de hover en imágenes, secuencias de página orquestadas, pulsos infinitos decorativos.

## Layout

- Mobile-first. Sidebar desktop / BottomNav pill móvil.
- Padding de card: 20px (p-5). Gaps de secciones: 16-24px.
- Densidad alta permitida en tablas y listas de cobro (es producto, no marketing).

## Mascota — Capi (capibara)

- Componente canónico: `components/ui/Capi.jsx` (SVG puro, sin assets externos).
- Poses: `feliz` (default), `celebra` (pago exitoso, metas, listas "todo al día"),
  `duerme` (listas vacías), `busca` (búsquedas sin resultados).
- `components/ui/Mascota.jsx` es wrapper retrocompatible (variant→pose). Código nuevo importa Capi.
- `components/ui/EmptyState.jsx`: estado vacío canónico (Capi + título + hint + acción).
- Entrada con `.capi-in` (rebote one-shot). NUNCA loops infinitos con la mascota.
- Capi aparece en: estados vacíos, éxito de pago, onboarding, celebraciones. No en
  contextos negativos serios (mora crítica, errores de cobro) — ahí sobra simpatía.

## Tarjetas tipo tarjeta de crédito (clientes/préstamos)

- Look "credit card": gradiente 135° que reacciona al estado (`color-mix` del mood color
  con `--color-bg-card`), chip EMV (`components/ui/ChipTarjeta.jsx`) y brillo diagonal
  (overlay `linear-gradient 115°` con blanco 5-6%).
- Mood colors: dorado = al día, naranja #f97316 = vencido, danger = mora >7d,
  success = completado, gris #64748b = cancelado/inactivo.
- Regla: el gradiente NUNCA supera 14-16% de mezcla del mood color — la tarjeta insinúa
  el estado, el badge lo declara. Todos los datos se conservan siempre.
