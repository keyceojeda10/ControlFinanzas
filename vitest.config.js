import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // FUERA LOS WORKTREES. Cuando una tarea en segundo plano corre en
    // `.claude/worktrees/…`, ahi vive una COPIA ENTERA del repo con sus 114
    // archivos de prueba, y vitest los recoge: la tanda paso de 1.583 pruebas a
    // 2.762 y me estaba diciendo el estado de OTRA sesion mezclado con el mio.
    //
    // Peor que el numero inflado: si esa otra sesion deja el arbol a medias, mis
    // pruebas fallan por algo que no he tocado, y perseguirlo es una tarde.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.claude/**'],
    // 5s no da con la maquina cargada. Estas pruebas no esperan a nada —leen
    // archivos y comparan cadenas— pero si el servidor de desarrollo y una
    // captura de Playwright estan compitiendo por CPU, un worker se queda sin
    // turno y vitest lo mata por timeout. Ha pasado dos veces con la MISMA
    // prueba, y las dos veces pasaba sola: era carga, no una regresion.
    //
    // Subirlo no tapa nada: si una prueba de verdad se cuelga, 20s siguen siendo
    // 20s y sale igual. Lo que evita es rojo falso.
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
