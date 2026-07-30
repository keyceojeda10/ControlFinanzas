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
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
