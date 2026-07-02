# Product

## Register

product

## Users

Prestamistas y cobradores de microcréditos (gota a gota / crédito informal) en LATAM, principalmente Colombia. El dueño (owner) administra cartera, rutas, cobradores y caja desde el celular o PC. Los cobradores trabajan en la calle, en movimiento, con el celular (PWA instalada), a veces con mala señal y bajo sol directo. La tarea principal de cada pantalla es: cobrar, registrar, verificar. Rapidez y legibilidad ganan sobre todo lo demás.

## Product Purpose

SaaS de gestión de préstamos: clientes, préstamos con múltiples modos de interés, rutas de cobro, caja, mora, reportes y mensajería WhatsApp. Reemplaza el cuaderno/cartulina física. El éxito se mide en que el prestamista confíe sus números al sistema y el cobrador gestione su ruta completa sin fricción.

## Brand Personality

Confiable, sobrio, eficiente. Es una herramienta de dinero: debe sentirse precisa como un banco pero cercana como una libreta. El dorado (#f5c518) es la firma de la marca — se usa para acción primaria y selección, nunca como decoración.

## Anti-references

- Apps "vibe-coded": bordes ultra redondeados, sombras por todas partes, gradientes decorativos en cada card, animaciones sin propósito.
- Dashboards genéricos de plantilla (Tailwind UI sin personalizar).
- Apps de banca tradicional recargadas de azul corporativo y densidad ilegible.

## Design Principles

1. **Premium por consistencia, no por decoración.** El mismo control se ve igual en todas las pantallas. Si un botón de guardar se ve distinto en dos lugares, uno está mal.
2. **La herramienta desaparece en la tarea.** El cobrador está en la calle: cero fricción, cero espera coreografiada, targets táctiles grandes.
3. **El color comunica estado, no adorna.** Dorado = acción/selección. Verde = éxito/pagado. Rojo = mora/peligro. Ámbar = advertencia. Nada más.
4. **Movimiento solo para estado.** Transiciones de 150-250ms que confirman acciones. Sin secuencias de entrada orquestadas.
5. **Datos monetarios siempre en mono tabular.** Los números son el producto; se alinean y comparan visualmente.

## Accessibility & Inclusion

- Uso móvil intenso bajo luz solar: contraste alto en texto de datos (mínimo 4.5:1).
- Targets táctiles ≥ 40px en acciones de cobro.
- `prefers-reduced-motion` respetado globalmente (ya implementado en globals.css).
- Dos temas (oscuro default, claro pastel) via `data-theme`; todo color nuevo pasa por tokens CSS, nunca hex hardcodeado.
