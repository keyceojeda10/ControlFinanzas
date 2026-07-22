# Handoff: Rediseño completo — App de Préstamos y Cobranza

## Objetivo
Rediseñar **toda** la aplicación (todas las pantallas, modales, estados y componentes) con el nuevo lenguaje visual "fintech premium" definido en este paquete. Incluye pantallas que **no** están en la referencia visual (login, registro, onboarding, recuperar contraseña, estados vacíos, errores, notificaciones, escáner QR, mapa de ruta, formularios de "Nuevo préstamo / Nuevo cliente / Registrar gasto", detalle de organización, etc.). Para esas, se debe **extrapolar el sistema de diseño** documentado aquí para que queden 100% consistentes con las ya rediseñadas.

> Regla de oro: **ninguna pantalla debe quedar con el estilo viejo.** Si una pantalla no tiene mockup, se construye aplicando los tokens, componentes y patrones de este documento.

## Sobre los archivos de este paquete
El archivo `Prestamo App.dc.html` es una **referencia de diseño hecha en HTML** — un prototipo navegable que muestra el aspecto e interacciones deseadas. **No es código de producción para copiar tal cual.** La tarea es **recrear estos diseños en el entorno del código real** (React Native / Expo, Flutter, React web, etc., según lo que ya use el proyecto), usando sus patrones, librerías y componentes existentes. Si aún no hay entorno definido, elige el framework más apropiado e implementa allí.

**Para verlo tú:** abre **`Prestamo App (standalone).html`** (archivo único autónomo) con doble clic en cualquier navegador. Navega con la barra inferior, toca tarjetas de cliente/préstamo/ruta para ver sus detalles, usa el botón "+" (FAB) para el menú y Lucas IA, y el ícono de luna/sol (arriba) para alternar tema claro/oscuro.

> Nota: `Prestamo App.dc.html` es el **archivo fuente** (para que Claude Code lo lea); por sí solo no abre bien porque depende de recursos internos. Para abrirlo a mano usa siempre la versión **standalone**.

## Fidelidad
**Alta fidelidad (hi-fi).** Colores, tipografía, espaciados, radios, sombras e interacciones son finales. Recrear pixel-perfect usando las librerías del proyecto. Los datos (nombres, montos) son de ejemplo — reemplazar con datos reales del backend.

---

# 1. Sistema de diseño (la base para TODO)

## 1.1 Tipografía
- **Space Grotesk** — títulos de pantalla, números, montos, cifras (todo lo numérico usa `font-variant-numeric: tabular-nums` y `letter-spacing: -0.02em`).
- **Manrope** — todo el resto de UI (body, labels, botones, párrafos).
- Cargar ambas (pesos: Manrope 400/500/600/700/800, Space Grotesk 400/500/600/700).

Escala tipográfica:
| Uso | Familia | Tamaño | Peso |
|---|---|---|---|
| Título de pantalla (h1) | Space Grotesk | 25px | 600 |
| Monto héroe (recaudado, saldo) | Space Grotesk | 34–44px | 700 |
| Monto en tarjeta | Space Grotesk | 24–29px | 700 |
| Label de sección (uppercase) | Manrope | 11px | 800, letter-spacing .06–.09em, uppercase |
| Nombre / título de item | Manrope | 15–16px | 800 |
| Body | Manrope | 13–14px | 400–500 |
| Texto secundario | Manrope | 12–12.5px | 500, color ink-2 |
| Micro / meta | Manrope | 11–11.5px | 500–700, color ink-3 |

## 1.2 Colores (tokens, con soporte claro/oscuro)
Usar variables de tema. En el prototipo son CSS custom properties; en la app usar el sistema de theming del framework (Context/ThemeProvider, etc.).

**Tema claro**
```
--canvas:   #f4f4f1   (fondo de la app)
--surface:  #ffffff   (tarjetas)
--surface-2:#f3f3ef   (fondos sutiles, inputs, segmentos)
--ink:      #15161a   (texto primario)
--ink-2:    #676b73   (texto secundario)
--ink-3:    #9a9da5   (texto terciario / muted)
--line:     rgba(20,20,28,.08)   (bordes)
--line-2:   rgba(20,20,28,.13)   (bordes más visibles)
--accent:   #e7a400   (dorado de marca)
--green:    #12a150   (positivo / al día / cobrado)
--red:      #e5484d   (mora / crítico / eliminar)
--blue:     #2f6fed   (info / caja / fechas)
--teal:     #0fa5a5   (capital / saldo)
--purple:   #7a6cf0   (acentos, avatares, gestión)
```
**Tema oscuro**
```
--canvas:   #0c0d11
--surface:  #16171c
--surface-2:#1e2027
--ink:      #f3f3f6
--ink-2:    #9ea1ab
--ink-3:    #666973
--line:     rgba(255,255,255,.08)
--line-2:   rgba(255,255,255,.15)
--accent:   #f5b824
--green:    #2fbe6a
--red:      #f0575c
--blue:     #5b8df5
--teal:     #2dbdbd
--purple:   #9385f5
```
**Variantes "soft" (fondos tintados):** cada color semántico tiene un fondo suave = mezcla del color ~12–14% sobre `--surface`. En claro dan pasteles; en oscuro dan tintes oscuros. (En CSS: `color-mix(in srgb, var(--green) 12%, var(--surface))`. En la app, generar con opacidad/alpha o funciones de mezcla del framework.)

**Reglas de color:**
- El **dorado (accent)** es la marca: botones primarios, chips activos, tab activo, ítem de nav activo, FAB.
- Sobre superficies doradas el texto es `#3a2900` (café oscuro), nunca blanco puro.
- Verde=cobrado/al día, Rojo=mora/crítico, Azul=caja/fechas/info, Teal=capital/saldo, Púrpura=gestión/avatares.
- El FAB es siempre un círculo oscuro (`#17181c`) con el ícono en dorado, en ambos temas.

## 1.3 Sombra, radios, espaciado
- **Sombra de tarjeta:** `0 1px 2px rgba(20,20,30,.04), 0 10px 30px rgba(20,20,30,.055)` (claro) / más profunda en oscuro.
- **Radios:** tarjetas grandes 20–22px; tarjetas medianas 16–18px; chips/inputs 11–14px; botones 12–14px; pills 999px; avatares cuadrados 12–20px (redondeados), circulares 50%.
- **Padding tarjeta:** 16–20px. **Gap entre tarjetas:** 12–14px. **Padding de pantalla:** 16px horizontal, ~18px arriba, 130px abajo (para no chocar con nav+FAB).

## 1.4 Iconografía
Íconos de línea, stroke 1.8–1.9, `stroke-linecap/linejoin: round`, tamaño 14–22px, color heredado (`currentColor`). Usar una librería de íconos de línea del proyecto (Lucide, Feather, SF Symbols, etc.) — **no** dibujar íconos a mano. Emoji: no usar.

## 1.5 Animaciones (sutiles)
- Entrada de pantalla: `fadeUp` (opacity 0→1, translateY 10px→0), ~0.4s `cubic-bezier(.2,.7,.2,1)`.
- Tarjetas de lista: `pop` (opacity + scale .92→1), ~0.4s.
- Barras de progreso: `grow` (scaleX 0→1 desde la izquierda), ~0.7s `cubic-bezier(.2,.8,.2,1)`.
- Gráfica de línea: dibujado con `stroke-dashoffset`, ~1.3s.
- Bottom sheets: `sheetUp` (translateY 100%→0), ~0.38s; backdrop `fadeBg`.
- Transiciones de estado (tab/tema): 0.2–0.35s ease.

---

# 2. Componentes reutilizables (definir una vez, usar en todas las pantallas)

1. **AppShell / marco de teléfono** — top bar fija + área scrollable + bottom nav flotante + FAB. (En app nativa, el marco no aplica; sí el layout top bar / contenido / tab bar.)
2. **Top bar** — logo dorado (rayo/gráfica) + pill de usuario (avatar con dot de estado + "Carlos"); a la derecha: toggle de tema (luna/sol), campana con badge, buscar.
3. **Bottom nav** — barra flotante redondeada con 5 ítems (Inicio, Clientes, Préstamos, Rutas, Más). Ítem activo: fondo `accent-soft`, ícono `accent`. Inactivo: `ink-3`.
4. **FAB** — círculo oscuro con "+" dorado; abre el menú de acciones.
5. **Card** — `surface`, borde `line`, radio 20–22, sombra, padding 16–20.
6. **StatTile** — mini-tarjeta con label uppercase (color semántico) + número grande (Space Grotesk). Fondo `*-soft`.
7. **SectionLabel** — texto 11px, 800, uppercase, letter-spacing, color `ink-3`.
8. **Chip / Filtro** — pill; activo: `accent-soft` + borde acento + texto acento; inactivo: `surface` + borde `line-2` + `ink-2`. Fila horizontal scrollable.
9. **SegmentedControl** — contenedor `surface-2`, botón activo `surface` + sombra + texto acento.
10. **StatusPill** — pill con dot + texto, color según estado (Al día=verde, En mora/Crítica=rojo, Nuevo=verde, Pendiente/Atrasada=acento, Sin cobros=neutro).
11. **ProgressBar** — track `surface-2`, fill color semántico, animación `grow`.
12. **Avatar** — cuadrado redondeado con iniciales sobre gradiente de color, o foto; opcional badge (cámara / estado).
13. **MoneyText** — Space Grotesk, 700, tabular-nums, tracking -0.02em; color según contexto.
14. **PrimaryButton** — fondo `accent`, texto `#3a2900`, 800, radio 12–14, sombra dorada suave.
15. **SecondaryButton** — `surface` + borde `line-2` + `ink`/`ink-2`.
16. **IconButton** — cuadrado redondeado, `surface` o `*-soft`, ícono de color.
17. **ListRow** — fila con avatar/ícono + título + subtítulo + valor/acción a la derecha.
18. **BottomSheet** — hoja inferior con grabber, radio 28 arriba, backdrop oscuro, scroll interno, `sheetUp`.
19. **InfoBanner** — banda `accent-soft` con borde izquierdo acento (3px), ícono + texto + cerrar.
20. **Input / Field** — label 12.5px 700 + input `surface`/`surface-2` con borde, radio 12; estado disabled `surface-2` + `ink-3`.
21. **Donut/Gauge** — anillo con conic-gradient (porcentaje) + centro con % o cifra.
22. **LineChart / Sparkline** — para tendencias (usar lib de charts del proyecto).
23. **EmptyState** — ícono suave + título + descripción + acción (patrón para cualquier lista vacía).

---

# 3. Chrome global (en todas las pantallas)

**Top bar** (sticky, blur, borde inferior `line`): logo + pill de usuario a la izquierda; toggle tema + campana(badge "1") + buscar a la derecha.

**Bottom nav** (flotante, `left:14 right:82 bottom:16`, alto 62, blur): Inicio, Clientes, Préstamos, Rutas, Más. **FAB** separado abajo-derecha (60×60). El hub **Más** contiene sub-tabs: **Caja · Capital · Reportes · Ajustes**.

Navegación de detalle: tocar una tarjeta de cliente/préstamo/ruta abre su pantalla de detalle (con back "‹ Sección"); la nav inferior o el back cierran el detalle.

---

# 4. Pantallas ya rediseñadas (referencia en el HTML)

### Inicio (dashboard)
Saludo + subtítulo + refresh; línea de estado (dot verde "Actualizado…"); tarjeta de plan (donut días + Renovar); **tarjeta héroe dorada** "RECAUDADO HOY" (monto grande, pagos, chip, divisor, donut meta + META DIARIA, gráfica de línea 6 días); dos StatTiles (Clientes en mora / Saldo en caja).

### Clientes
Título + "Nuevo cliente"; contador "29 clientes · 13 en mora"; chip "Migrador express"; buscador + botón filtros; chips (Todos/Al día/En mora/Cancelados); selector de ruta + toggle lista/grid; **lista de tarjetas de cliente** (barra de color superior según estado, avatar, nombre, StatusPill, "Deuda total" + monto, progreso "% pagado", nº préstamos, "Cobra …").

### Cliente — detalle
Back; **tarjeta cabecera** (avatar con badge cámara, nombre, "Sin documento · Ruta", StatusPill, botones llamar/WhatsApp, SALDO TOTAL PENDIENTE, progreso); InfoBanner; chip "Sin historial"; **grid de 8 acciones** (Nuevo préstamo, Reagendar visita, Actualizar ubicación, Historial, QR, Editar, Inactivar, Eliminar — cada una con color semántico); tiles de contacto (WhatsApp, Dirección); "Tope de préstamo"; **Préstamos activos** (mini-tarjetas con "Ver préstamo").

### Préstamos
Título + "Nuevo préstamo"; "43 préstamos · 30 en mora"; chip "Simulador"; 3 filas de chips (estado / frecuencia / modo); "Filtros avanzados"; **lista de tarjetas de préstamo** (fondo tintado por estado, avatar, nombre, cobrador, badges, SALDO PENDIENTE, progreso, grid Pagado/Cuota/Próx. cobro).

### Préstamo — detalle
Back; tarjeta mini de cliente; **botón verde grande "Registrar pago mensual $…"** (abre modal Pago); chips Cobros / Gestión (abre modal Gestión); **tarjeta de saldo** (SALDO PENDIENTE, capital adeudado, donut "ha pagado"); chip "Préstamo #N"; **Línea de tiempo**; **Crédito** (grid); **Pagos** (grid); **Fechas** (grid); **Desglose por mes** (lista de cuotas, mes "Siguiente" resaltado); botón WhatsApp; **Firma del cliente** (área de firma + Modificar/Pagaré/Comprobante); **Historial de pagos (0)** + acciones; botón "Cancelar préstamo" (rojo).

### Rutas
Título + "Nueva ruta"; "6 rutas"; Guardar/Restaurar copia; toggle Trabajo/Ordenar; **lista de tarjetas de ruta** (tintadas por estado, nombre, StatusPill, cobrador · nº clientes, RECAUDADO + % grande, progreso, "de $… esperados").

### Ruta — detalle
Back; **tarjeta cabecera crítica** (ícono ruta, nombre + editar, StatusPill, "clientes por cobrar", "TE FALTAN $…", progreso, "Cobrado … de …", selector de cobrador, Días sin cobro, Festivo hoy, eliminar); InfoBanner de mora; **Cartera de la ruta**; "Habilitar capital de la ruta"; **Seguros de la ruta**; tiles Pendientes / En mora; botones +Agregar/Optimizar/Google Maps/Ver mapa; **Clientes (10)** buscador + chips por día + tabs Cobros/Ordenar/Auditoría; **lista de cobros** (nº grande de fondo, nombre, estado, monto/frecuencia, llamar/WhatsApp, botón verde "Cobrar", SALDO PENDIENTE, progreso, grid Pagado/Cuota/Próx.).

### Caja (hub Más → Caja) — 3 tabs
Título + fecha + "Reporte"; tabs de período (Hoy/Ayer/7d/30d); selector de fecha; **sub-tabs Caja del día / Por ruta / Cuadre**:
- **Caja del día:** tarjeta SALDO EN CAJA (verde) + donut % + grid (Cobrado, Prestado −, Gastos, Base inicial, Ajustes) + "Ver detalle"; **Cierre de caja del día**; **Historial de cobros** (Desde/Hasta + lista de días con montos).
- **Por ruta:** selector de cobrador + tarjeta EFECTIVO DEL DÍA con grid (Inicio, Cobrado, Prestado, Gastos).
- **Cuadre:** CUADRE DEL DÍA (0/8, total recibido vs sistema, "Confirmar los que cuadran"); tabs Todos/Pendientes/Con diferencia; lista de cobradores (Sistema/Recibido/Diferencia + Confirmar).

### Capital (hub Más → Capital)
Título + subtítulo + "Movimiento"; SALDO DEL CAPITAL (teal, grande); **Dinero en la calle** (Capital prestado / Por cobrar + notas); **Modo estricto** con toggle; grid (Prestado, Cobrado, Gastos, Balance neto).

### Reportes (hub Más → Reportes)
Título + subtítulo; tabs de período; rango de fechas; **INGRESOS DEL PERÍODO** (verde, grande); grid (Clientes activos, En mora, Préstamos activos, Cartera activa); **Interés ganado**; Capital prestado / Completados.

### Configuración (hub Más → Ajustes) — tabs
**Mi perfil:** Información personal (Nombre, Email disabled, WhatsApp + Guardar, Rol, Guardar nombre); Avatar de perfil (Cambiar/Quitar); Cambiar contraseña (3 campos). **Suscripción:** Plan actual (Empresarial $259.000/mes) + Renovar/Cambiar; Inicio/Vencimiento; Tiempo restante + progreso; Historial de suscripciones.

### Menú FAB
Panel dorado a pantalla completa "¿Qué quieres hacer?": Nuevo préstamo, Nuevo cliente, Escanear QR, Registrar gasto, Ver caja, Ver mi plan, Lucas IA (ítems con ícono + primera palabra en negrita).

### Lucas IA (chat)
Bottom sheet alto: cabecera (ícono acento, "Lucas / Asistente financiero", contador "200 de 200", editar, cerrar); mensaje de bienvenida centrado; chips de sugerencias; barra de entrada (micrófono + campo + enviar) + disclaimer.

---

# 5. Pantallas SIN referencia — construir extrapolando el sistema

Estas **no** tienen mockup; diséñalas aplicando §1–§3. Deben verse como si las hubiera hecho la misma mano.

- **Splash / carga:** fondo `canvas`, logo dorado centrado (cuadro redondeado con el rayo), micro-animación sutil.
- **Login:** logo arriba; título Space Grotesk; campos (WhatsApp/Email, Contraseña) con el estilo Input; PrimaryButton "Ingresar"; enlaces "Olvidé mi contraseña" / "Crear cuenta"; opción biométrica opcional. Centrado, mucho aire, sin nav inferior.
- **Registro:** formulario por pasos o simple (Nombre, WhatsApp, Email, Contraseña + confirmar); indicador de progreso si es multi-paso; PrimaryButton "Crear cuenta"; términos.
- **Recuperar contraseña:** campo + PrimaryButton "Enviar código"; pantalla de verificación de código (inputs OTP); nueva contraseña.
- **Onboarding:** 2–4 slides con ícono/ilustración placeholder, título, descripción, dots de progreso, "Siguiente"/"Empezar".
- **Verificación OTP:** casillas de código grandes (Space Grotesk), reenviar, contador.
- **Formularios "Nuevo préstamo / Nuevo cliente / Registrar gasto / Nueva ruta / Movimiento de capital":** como bottom sheet o pantalla; secciones con SectionLabel; Inputs; selectores tipo segmented/chips; resumen; footer Cancelar / PrimaryButton. (Guiarse por el modal "Registrar pago" ya diseñado.)
- **Escáner QR:** cámara a pantalla completa con marco/guía central, instrucción, botón cerrar.
- **Ver mapa / ruta:** mapa + pines por cliente (colores de estado) + tarjeta inferior con el cliente seleccionado + acción "Cobrar".
- **Notificaciones:** lista de ListRow (ícono de color por tipo, título, tiempo, dot no-leído); EmptyState si vacío.
- **Búsqueda global:** input activo + resultados agrupados (Clientes/Préstamos/Rutas).
- **Simulador de préstamos:** inputs (monto, tasa, plazo, frecuencia, modo) + resultado (cuota, total, desglose) usando las tarjetas Crédito/Desglose ya definidas.
- **Detalle de organización / miembros / roles:** tarjetas + ListRow de miembros con StatusPill de rol; invitar.
- **Estados vacíos** para cada lista (Clientes, Préstamos, Rutas, Historial): patrón EmptyState.
- **Estados de carga:** skeletons con `surface-2` (bloques redondeados) respetando el layout de cada tarjeta.
- **Errores / sin conexión:** ícono, mensaje, botón "Reintentar".
- **Confirmaciones destructivas:** bottom sheet o diálogo (Eliminar cliente, Cancelar préstamo, Mover a perdidos) con acción roja + Cancelar.
- **Perfil de cobrador, Auditoría, Comprobante/Pagaré (vista documento), Ajustes de organización/notificaciones/seguridad:** aplicar los mismos componentes.

**Checklist por pantalla nueva:** usa tokens de tema (claro+oscuro) · top bar + nav donde corresponda · SectionLabels · tarjetas con radio/sombra correctos · colores semánticos coherentes · Space Grotesk en cifras · animaciones de entrada · estados hover/press · estado vacío y de carga · área táctil ≥44px · textos en español.

---

# 6. Interacciones y comportamiento
- **Navegación:** tabs inferiores cambian de sección; tocar tarjeta abre detalle (push con back); FAB abre menú de acciones; desde el menú se abre Lucas.
- **Tema:** toggle claro/oscuro global (persistir preferencia).
- **Modales/sheets:** entran con `sheetUp`, backdrop oscuro, cierran con X, botón Cancelar o tocando el backdrop.
- **Segmented/tabs:** cambian contenido con fade; recordar la selección mientras dure la sesión de esa pantalla.
- **Registrar pago:** slider de días, monto, tipo (Completo/Parcial/A capital/Recargo/Intereses/Descuento), método (Efectivo / Transferencia → Nequi/Daviplata/Bancolombia — usar solo nombres, no reproducir logos de marca), nota, Confirmar.
- **Progresos, donuts y gráficas** animan al montar.

# 7. Estado (state)
- Sesión/auth (login), tema (claro/oscuro, persistido), sección activa + pila de navegación, tab activo por hub (Caja/Capital/Reportes/Ajustes), sub-tab de caja, sub-tab de config, sheet abierto (gestión/pago/fab/lucas), método de pago seleccionado, filtros de cada lista, datos remotos (clientes, préstamos, rutas, caja, capital, reportes) con estados loading/empty/error.

# 8. Tokens (resumen)
Ver §1.2 (colores claro/oscuro + soft), §1.1 (tipografía), §1.3 (radios/sombra/espaciado), §1.5 (animaciones).

# 9. Assets
- **Íconos:** de línea, vía librería del proyecto (no dibujar a mano).
- **Logos de terceros (Nequi/Daviplata/Bancolombia):** usar solo el nombre en texto con un badge de color; no reproducir sus logotipos.
- **Fuentes:** Space Grotesk + Manrope (Google Fonts o equivalentes empaquetadas).
- **Imágenes/fotos de usuario:** placeholders hasta tener las reales.

# 10. Archivos de este paquete
- `Prestamo App (standalone).html` — **ábrelo tú con doble clic**: prototipo navegable autónomo (no requiere internet ni otros archivos).
- `Prestamo App.dc.html` — archivo fuente del prototipo (para que Claude Code lo lea). No abre bien por sí solo.
- `INSTRUCCIONES_CLAUDE_CODE.md` — el prompt/instrucción exacta para pegar en Claude Code.
