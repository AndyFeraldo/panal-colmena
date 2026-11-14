import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { DISTRICT_GEOJSON, DISTRICTS, type District, type DistrictFeature, type LatLng } from './data'

const R = 6371

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** km por calles (línea recta × factor de rodeo) */
export function roadKm(a: LatLng, b: LatLng, detour: number): number {
  return haversineKm(a, b) * detour
}

export function centroid(points: LatLng[]): LatLng {
  let lat = 0
  let lng = 0
  for (const p of points) {
    lat += p.lat
    lng += p.lng
  }
  return { lat: lat / points.length, lng: lng / points.length }
}

const featureByGeoName = new Map<string, DistrictFeature>()
for (const f of DISTRICT_GEOJSON.features) featureByGeoName.set(f.properties.name, f)

export function districtFeature(d: District): DistrictFeature | undefined {
  return featureByGeoName.get(d.geoName)
}

export function pointInDistrict(d: District, p: LatLng): boolean {
  const f = districtFeature(d)
  if (!f) return true
  return booleanPointInPolygon([p.lng, p.lat], f as never)
}

/** Distrito (de los 30 con demanda) que contiene el punto; si ninguno, el de centroide más cercano */
export function districtOf(p: LatLng): District {
  for (const d of DISTRICTS) if (pointInDistrict(d, p)) return d
  let best = DISTRICTS[0]
  let bd = Infinity
  for (const d of DISTRICTS) {
    const k = haversineKm(p, d.center)
    if (k < bd) {
      bd = k
      best = d
    }
  }
  return best
}

export function fmtTime(min: number): string {
  let m = Math.round(min)
  m = ((m % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}
