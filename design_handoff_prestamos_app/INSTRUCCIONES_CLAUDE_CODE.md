# Instrucción para Claude Code (VS Code)

Copia y pega esto en Claude Code, dentro del repositorio de tu app, junto con la carpeta `design_handoff_prestamos_app/` incluida en el proyecto.

---

**Prompt para pegar:**

> Voy a rediseñar por completo la app (préstamos y cobranza). En `design_handoff_prestamos_app/` está el paquete de diseño:
> - `README.md`: el sistema de diseño completo (tokens de color claro/oscuro, tipografía, componentes, animaciones), todas las pantallas ya rediseñadas y una sección de pantallas SIN referencia visual que debes construir extrapolando el sistema.
> - `Prestamo App.dc.html`: prototipo navegable en HTML con el aspecto e interacciones deseadas. Es **solo referencia visual**, NO lo copies como código; ábrelo/léelo para entender layouts y comportamiento.
>
> Objetivo: **rediseñar TODA la app** con este nuevo lenguaje visual, en el stack de este repositorio (usa el framework, la navegación, la librería de componentes y los patrones que ya existen aquí; si no hay, propón el más adecuado y créalo). **Ninguna pantalla puede quedar con el estilo viejo**, incluyendo las que NO están en el prototipo (login, registro, recuperar contraseña, onboarding, OTP, escáner QR, mapa de ruta, formularios de creación, notificaciones, búsqueda, simulador, organización/miembros, estados vacíos, de carga y de error, diálogos destructivos, etc.). Para esas, sigue la sección "Pantallas SIN referencia" del README y el checklist.
>
> Empieza así, y para en cada punto para que yo revise:
> 1. Lee todo el `README.md` y explora el repo. Dime qué stack detectaste y cómo mapearás el sistema de diseño (tema claro/oscuro, tokens, tipografías Space Grotesk + Manrope) a este proyecto.
> 2. Implementa primero la **base de diseño**: theming (claro/oscuro), tokens de color, tipografía, y los **componentes reutilizables** del §2 del README (Card, StatTile, Chip, SegmentedControl, StatusPill, ProgressBar, Avatar, BottomSheet, Input, PrimaryButton, etc.). Muéstrame estos componentes en un catálogo/pantalla de prueba.
> 3. Reconstruye el **chrome global**: top bar, bottom nav (Inicio/Clientes/Préstamos/Rutas/Más con hub Caja·Capital·Reportes·Ajustes) y FAB.
> 4. Implementa las pantallas ya rediseñadas, en este orden: Inicio → Clientes (+detalle) → Préstamos (+detalle + modales Pago/Gestión) → Rutas (+detalle) → Caja (3 tabs) → Capital → Reportes → Configuración → Menú FAB → Lucas IA.
> 5. Implementa las **pantallas sin referencia** (login, registro, etc.) aplicando el sistema, y añade estados vacíos/carga/error a todas las listas.
>
> Reglas: respeta los valores exactos del README (colores, radios, sombras, tamaños); cifras en Space Grotesk con tabular-nums; íconos de línea desde una librería (no dibujados a mano); textos en español; áreas táctiles ≥44px; soporta tema claro y oscuro en cada pantalla; datos de ejemplo reemplazables por el backend real. No reproduzcas logotipos de marcas (Nequi/Daviplata/Bancolombia): solo el nombre con un badge de color.
>
> No avances a la siguiente fase sin mostrarme la anterior.

---

**Consejos de uso:**
- Ten la carpeta `design_handoff_prestamos_app/` dentro del repo para que Claude Code la lea.
- Si quieres, abre `Prestamo App.dc.html` en tu navegador y compáralo mientras revisas cada pantalla.
- Pídele que trabaje por ramas/commits pequeños (una fase por commit) para revisar con calma.
- Si tu app ya tiene design system, dile que **adapte** los tokens a él en vez de duplicar.
