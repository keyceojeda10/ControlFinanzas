import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import globals from "globals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated artifacts:
    "app/generated/prisma/**",
  ]),
  {
    /* ⚠ `no-undef` ENCENDIDO. Estaba apagado y esta app ya se comió DOS fallos
       de esta clase en producción: «onCerrarVisita is not defined» (16 avisos el
       7 ago) y, el 16 ago, un `router` que yo dejé apuntando a otro componente
       —el botón habría reventado al pulsarlo, y ya estaba desplegado—.

       No lo caza el build, ni las pruebas, ni el resto del lint: solo aparece
       cuando un cliente pulsa. Encenderlo costó arreglar CINCO casos en todo el
       proyecto, y uno era una plantilla del bot que habría reventado sola.

       Hacen falta los `globals` del navegador y de node, o daría falsos
       positivos con `window`, `document`, `fetch` y `process`. */
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react/no-unescaped-entities": "off",
      "no-undef": "error",
      /* ⚠ UN COMPONENTE DECLARADO DENTRO DE OTRO SE REMONTA EN CADA RENDER.
         React compara el TIPO: si la función se vuelve a crear en cada render
         del padre, el tipo es otro, y React desmonta el subárbol y lo monta de
         nuevo. El estado de dentro se pierde y el DOM parpadea.

         Costó un reporte del dueño (20 sep 2026): la gráfica de los 7 días del
         Inicio estaba como `function Grafica()` dentro de `Hero` —«uno
         selecciona un día y se quita, y al principio parpadea»—. Medido en el
         espejo: las 14 barras cambiaban de nodo en cada repintado.

         No lo caza el build ni las pruebas de cifras: solo se ve usando la app.
         La salida es declarar el trozo como ELEMENTO (una variable con JSX), no
         como componente. */
      "react/no-unstable-nested-components": ["error", { allowAsProps: true }],
    },
  },
]);

export default eslintConfig;
