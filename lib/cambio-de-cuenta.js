/* Al cambiar de identidad en el mismo teléfono (entrar a «ver como», volver)
   se tiran las LECTURAS guardadas de la anterior:
   - las cachés del service worker (`cf-api-*`) y las de pedirCompartido;
   - las lecturas de IndexedDB: si la red falla un momento, la app serviría
     lo del otro;
   - la sesión guardada del SessionProvider: arranca con ella y no la vuelve a
     pedir, así que sin borrarla la pantalla seguiría creyendo que es la cuenta
     anterior.
   Lo mismo que hace «Cerrar sesión» en Armazon.jsx. A propósito NO se usa el
   borrado total de la base offline (el de logout completo, en lib/offline.js):
   ese arrastra también los cobros que el cobrador todavía no ha subido. */
import { olvidarCompartido } from '@/lib/pedir-compartido'
import { borrarCacheDeLecturas } from '@/lib/offline'

// La misma clave que STORAGE_KEY en components/providers/SessionProvider.jsx (lo vigila una prueba).
const CLAVE_SESION_GUARDADA = 'cf-session-cache'

export async function olvidarLecturasDeOtraCuenta() {
  try { navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_API_CACHE' }) } catch {}
  olvidarCompartido()
  try { localStorage.removeItem(CLAVE_SESION_GUARDADA) } catch {}
  await borrarCacheDeLecturas()
}
