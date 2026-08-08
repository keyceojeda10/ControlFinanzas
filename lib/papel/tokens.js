// lib/papel/tokens.js — la marca, en hex plano, para los documentos.
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Los cuatro PDF del sistema —«Quién me debe», «Cómo me fue», el pagaré y el
// informe de rendimiento— estaban escritos por separado, cada uno con PDFKit
// crudo y **cada uno con su propia paleta declarada a mano**. Y esas paletas no
// eran las de la marca: `#16a34a`, `#dc2626`, `#d97706` son los verdes, rojos y
// ámbares que trae Tailwind por defecto.
//
// El dorado de Control Finanzas —#E7A400, la firma de la marca— **no aparecía
// en ningún PDF**. Por eso el dueño decía que «se ven súper feos»: no es que
// estuvieran mal dibujados, es que no se parecían ni a la app ni entre ellos.
//
// ⚠ ESTOS VALORES SON UNA COPIA DE `app/tokens-2026.css`, y tienen que serlo:
// PDFKit no entiende `var(--cf-gold)` ni puede leer una hoja de estilos. Si un
// día cambia el dorado en la app, hay que cambiarlo aquí — hay una prueba que
// compara los dos ficheros para que el olvido salte.

/* Los colores. Mismos nombres que en `tokens-2026.css` para poder cotejarlos de
   un vistazo. Los `rgba()` de los bordes se resuelven a su hex equivalente
   sobre papel blanco, porque en un PDF no hay nada debajo. */
export const COLOR = {
  gold: '#E7A400',        // acción y acento. La firma de la marca
  goldInk: '#3A2900',     // texto sobre dorado
  goldTint: '#FDF3D6',    // fondo suave de acento

  ink: '#15161A',         // titulares y cifras
  ink2: '#4A4E57',        // texto corriente
  ink3: '#63676F',        // rótulos de sección, metadatos
  ink4: '#8E929A',        // pies y notas al margen

  green: '#12A150',       // al día, pagado
  greenTint: '#E8F6EE',
  red: '#C23B40',         // mora, peligro
  redTint: '#FBEBEC',

  surface: '#F4F4F1',     // hueso cálido: el fondo de la app
  card: '#FFFFFF',
  cardAlt: '#F9F9F6',     // cabecera de grupo, fila cebra

  border: '#E4E4E1',      // rgba(20,20,28,.08) sobre blanco
  borderSoft: '#EDEDEA',  // filetes DENTRO de una tarjeta
}

/* La escala. En PDF se mide en puntos (1/72"), así que los números son más
   pequeños que en pantalla, pero las PROPORCIONES son las mismas del sistema.

   ⚠ Sin decimales, igual que en la interfaz: `lib/__tests__/escalas-cerradas`
   cierra la escala y un 13,5 rompe la prueba y la coherencia. */
export const TIPO = {
  titulo: 20,     // el nombre del negocio, arriba
  seccion: 13,    // «Quién me debe», «Cómo le fue a cada cobrador»
  cifra: 16,      // los números de las tarjetas de resumen
  cifraGrande: 26,// el monto que manda en un recibo o un pagaré
  texto: 10,      // el cuerpo
  tabla: 9,       // las filas
  rotulo: 8,      // ETIQUETAS EN MAYÚSCULA
  pie: 7,         // el pie de página
}

/* Espaciado y geometría de la página. Carta, porque es lo que imprime todo el
   mundo en Colombia y México. */
export const HOJA = {
  ancho: 612,      // carta, en puntos
  alto: 792,
  margen: 40,
  get util() { return this.ancho - this.margen * 2 },   // 532
  /* ⚠ EL SUELO REAL, y es la causa de las «hojas de más».
     El pie se dibujaba a `alto - 32` = 760, y el área útil acaba en
     `alto - margen` = 752. Escribir por debajo de esa línea hace que PDFKit
     abra una página nueva para meterlo. De ahí que la última hoja saliera casi
     en blanco. Todo lo que se dibuje tiene que quedar por encima de `suelo`. */
  get suelo() { return this.alto - this.margen },       // 752
  /* ⚠ EL PIE VA POR ENCIMA DEL SUELO, y esto me lo salté yo mismo.
     Lo puse en `alto - 34` = 758 con el suelo en 752, que es el mismo error que
     este archivo denuncia dos líneas más arriba. Resultado: un documento con
     SOLO la cabecera salía en 3 páginas, porque el pie se dibuja en un bucle
     sobre todas y cada escritura por debajo del margen abría otra.
     Lo cazó la prueba de humo, no la lectura. */
  get pieY() { return this.alto - this.margen - 10 },   // 742: cabe entero
}

export const RADIO = 6      // esquinas de tarjetas y pastillas
export const FILETE = 3     // grosor del filete dorado bajo la cabecera
