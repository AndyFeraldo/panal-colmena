// Carga de Google Maps (opcional). Si no hay clave, si la clave es inválida o si Google no responde,
// la app vuelve sola a OpenStreetMap: la demo nunca se queda sin mapa.
//
// La clave se lee de VITE_GOOGLE_MAPS_KEY (archivo .env.local en tu PC, o secreto de GitHub Actions).
// Es una clave de navegador: debe estar RESTRINGIDA por sitio web (localhost y tu github.io) en Google Cloud.
import { create } from 'zustand'

export type MapProvider = 'osm' | 'google'
type Status = 'idle' | 'loading' | 'ready' | 'failed'

interface GoogleState {
  status: Status
  reason: string | null
  preferGoogle: boolean // el usuario puede volver a OSM con un clic
  setPreferGoogle: (v: boolean) => void
}

export const GOOGLE_KEY: string = (import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined)?.trim() ?? ''

export const useGoogleMaps = create<GoogleState>((set) => ({
  status: 'idle',
  reason: GOOGLE_KEY ? null : 'Sin clave de Google Maps configurada',
  preferGoogle: true,
  setPreferGoogle: (preferGoogle) => set({ preferGoogle }),
}))

let loading: Promise<boolean> | null = null

declare global {
  interface Window {
    gm_authFailure?: () => void
    __cuadranteGoogleReady?: () => void
  }
}

/** Carga el script oficial de Maps JavaScript API una sola vez. Devuelve true si quedó listo. */
export function loadGoogleMaps(): Promise<boolean> {
  if (!GOOGLE_KEY) return Promise.resolve(false)
  if (loading) return loading
  const set = useGoogleMaps.setState
  set({ status: 'loading' })
  loading = new Promise<boolean>((resolve) => {
    const fail = (reason: string) => {
      set({ status: 'failed', reason })
      resolve(false)
    }
    // Google llama a esta función si la clave es inválida o el sitio no está autorizado
    window.gm_authFailure = () => fail('Google rechazó la clave (revisa restricciones y facturación)')
    const timeout = setTimeout(() => fail('Google Maps no respondió a tiempo'), 12000)
    window.__cuadranteGoogleReady = () => {
      clearTimeout(timeout)
      set({ status: 'ready', reason: null })
      resolve(true)
    }
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_KEY)}&loading=async&language=es&region=PE&callback=__cuadranteGoogleReady`
    s.async = true
    s.onerror = () => {
      clearTimeout(timeout)
      fail('No se pudo descargar Google Maps (¿sin internet?)')
    }
    document.head.appendChild(s)
  })
  return loading
}

/** Estilo limpio: sin puntos de interés ni transporte, para que resalten los cuadrantes */
export const CLEAN_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'geometry', stylers: [{ saturation: -35 }] },
]

/**
 * Geocodificación con Google (Geocoding API). Convierte una dirección escrita en coordenadas.
 * Requiere que la clave tenga habilitada la Geocoding API.
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; formatted: string } | { error: string }> {
  const ok = await loadGoogleMaps()
  if (!ok) return { error: 'Google Maps no está disponible' }
  try {
    const geocoder = new google.maps.Geocoder()
    const res = await geocoder.geocode({
      address,
      componentRestrictions: { country: 'PE' },
      bounds: { south: -12.4, west: -77.2, north: -11.7, east: -76.7 },
    })
    const r = res.results[0]
    if (!r) return { error: 'No se encontró la dirección' }
    return { lat: r.geometry.location.lat(), lng: r.geometry.location.lng(), formatted: r.formatted_address }
  } catch (e) {
    const st = useGoogleMaps.getState()
    if (st.status === 'failed' && st.reason) return { error: st.reason }
    const msg = String(e)
    if (msg.includes('REQUEST_DENIED')) return { error: 'La clave no tiene habilitada la Geocoding API' }
    if (msg.includes('ZERO_RESULTS')) return { error: 'No se encontró la dirección' }
    return { error: 'No se pudo geocodificar la dirección' }
  }
}
