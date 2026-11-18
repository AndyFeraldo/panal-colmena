import { HUB, type TorreZone } from './data'
import { haversineKm } from './geo'
import type { Params } from './params'
import type { Cuadrante, Torre } from './types'

const LETTERS = 'ABCDEFG'

/**
 * Asigna los cuadrantes lejanos (> distancia mínima al HUB) a la zona Torre más cercana dentro de su alcance,
 * hasta la capacidad de los camiones del día (1 por Torre en Bajo/Normal/Alto, 2 en Cyber).
 * Luego ubica cada Torre en el PUNTO MEDIO de sus cuadrantes (ponderado por paquetes esperados)
 * y nombra los cuadrantes: letra de la Torre + número (A1, A2…) o H1, H2… si salen directo del HUB.
 */
export function assignTorres(cuadrantes: Cuadrante[], zones: TorreZone[], p: Params, trucksPerTorre: number): Torre[] {
  const torres: Torre[] = zones.map((z) => ({
    id: z.id,
    letter: '',
    name: z.name,
    short: z.short,
    lat: z.lat,
    lng: z.lng,
    cuadIds: [],
    expLoad: 0,
    trucks: 0,
    distHubKm: haversineKm(z, HUB),
  }))
  const candidates: { q: Cuadrante; t: Torre; d: number }[] = []
  for (const q of cuadrantes) {
    q.torreId = null
    if (q.distHubKm <= p.torreMinDistKm) continue
    let best: Torre | null = null
    let bd = Infinity
    for (const t of torres) {
      const d = haversineKm(q.centroid, t)
      if (d < bd) {
        bd = d
        best = t
      }
    }
    if (best && bd <= p.torreReachKm && bd < q.distHubKm) candidates.push({ q, t: best, d: bd })
  }
  // primero los cuadrantes más cercanos a su zona (mayor beneficio por viaje del camión)
  candidates.sort((a, b) => a.d - b.d)
  for (const { q, t } of candidates) {
    const cap = p.truckCapacity * trucksPerTorre
    if (t.expLoad + q.expStops > cap) continue
    t.expLoad += q.expStops
    t.cuadIds.push(q.id)
    q.torreId = t.id
  }

  // Punto medio: centro de sus cuadrantes ponderado por paquetes esperados
  const byId = new Map(cuadrantes.map((q) => [q.id, q]))
  for (const t of torres) {
    if (!t.cuadIds.length) continue
    let lat = 0
    let lng = 0
    let w = 0
    for (const id of t.cuadIds) {
      const q = byId.get(id)!
      lat += q.centroid.lat * q.expStops
      lng += q.centroid.lng * q.expStops
      w += q.expStops
    }
    t.lat = lat / w
    t.lng = lng / w
    t.distHubKm = haversineKm(t, HUB)
    t.trucks = Math.max(1, Math.ceil(t.expLoad / p.truckCapacity))
  }

  // Letras: A = la Torre con más carga
  const used = torres.filter((t) => t.cuadIds.length).sort((a, b) => b.expLoad - a.expLoad)
  used.forEach((t, i) => {
    t.letter = LETTERS[i] ?? String(i + 1)
    t.name = `Torre ${t.letter} · ${t.short}`
    // cuadrantes de la Torre: del más cercano al más lejano
    const qs = t.cuadIds.map((id) => byId.get(id)!).sort((a, b) => haversineKm(a.centroid, t) - haversineKm(b.centroid, t))
    qs.forEach((q, k) => (q.name = `${t.letter}${k + 1}`))
    t.cuadIds = qs.map((q) => q.id)
  })
  cuadrantes
    .filter((q) => !q.torreId)
    .sort((a, b) => a.distHubKm - b.distHubKm)
    .forEach((q, k) => (q.name = `H${k + 1}`))
  return torres
}
