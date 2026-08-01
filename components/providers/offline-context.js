'use client'

// components/providers/offline-context.js — el contexto de sin conexión, solo.
//
// ══ POR QUE ESTA SEPARADO ══════════════════════════════════════════════════
//
// Antes el contexto y el hook vivian dentro de `OfflineProvider.jsx`, y eso
// creaba un CICLO DE IMPORTACIONES:
//
//     OfflineProvider  →  SyncDrawer  →  OfflineProvider
//
// El proveedor importa el cajon para pintarlo, y el cajon importa el hook para
// leer el estado. Cada uno necesita algo del otro.
//
// Aqui no reventaba de milagro: `useOffline` es una `function` declarada y esas
// se elevan, asi que el ciclo se resolvia solo. Pero es la forma exacta que
// produce «Cannot access 'X' before initialization» en un bundle minificado —
// basta con que alguien cambie el hook por una `const` o añada una constante
// compartida para que empiece a fallar, y solo en algunas rutas, segun como el
// empaquetador ordene los modulos. No lo cazan ni el build ni las pruebas.
//
// Con el contexto en su propio archivo los dos importan de aqui y no hay ciclo.
// `scripts/ciclos-import.mjs` comprueba que no vuelva.

import { createContext, useContext } from 'react'

export const OfflineContext = createContext({
  isOnline: true,
  pendingCount: 0,
  syncing: false,
  syncMeta: null,
  lastSyncedAt: 0,
  openSyncDrawer: () => {},
})

export function useOffline() {
  return useContext(OfflineContext)
}
