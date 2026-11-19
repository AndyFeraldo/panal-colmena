import { HUB, type TorreZone } from './data'
import { haversineKm } from './geo'
import { pickVehicle, type Params } from './params'
import type { Cuadrante, Torre } from './types'

const LETTERS = 'ABCDEFG'

/**
 * Elige y arma las Torres móviles del día.
 * 1. Cada cuadrante lejano (> distancia mínima al HUB) se acerca a la zona Torre más próxima dentro de su alcance.
 * 2. Solo se quedan las `maxTorres` zonas que MÁS km ahorran (paquetes × km que la moto ya no recorre hasta VES).
 *    Las zonas cercanas al HUB no llevan Torre: ahí la moto vuelve rápido a recargar.
 * 3. Cada Torre se cita con sus motos en el PUNTO DE ENCUENTRO (punto medio de sus cuadrantes, ponderado por
 *    paquetes) y entre citas va a la tienda Saga de su zona: no se queda estacionada en la calle.
 * 4. Vehículo: van si la carga cabe (y Falabella lo permite), si no camión(es). En Cyber se permite más capacidad.
 */
export function assignTorres(cuadrantes: Cuadrante[], zones: TorreZone[], p: Params, capacityMult: number): Torre[] {
  const torres: Torre[] = zones.map((z) => ({
    id: z.id,
    letter: '',
    name: z.name,
    short: z.short,
    store: z.store,
    storeLat: z.lat,
    storeLng: z.lng,
    lat: z.lat,
    lng: z.lng,
    cuadIds: [],
    expLoad: 0,
    trucks: 0,
    vehicle: 'camion',
    distHubKm: haversineKm(z, HUB),
    savedKm: 0,
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

  // Ahorro de cada zona: paquetes esperados × km que la moto deja de recorrer hasta el HUB
  for (const { q, t, d } of candidates) t.savedKm += q.expStops * (q.distHubKm - d)
  const keep = new Set(
    [...torres]
      .filter((t) => t.savedKm > 0)
      .sort((a, b) => b.savedKm - a.savedKm)
      .slice(0, Math.max(0, p.maxTorres))
      .map((t) => t.id),
  )

  // primero los cuadrantes más cercanos a su zona (mayor beneficio por viaje)
  candidates.sort((a, b) => a.d - b.d)
  const maxCap = p.truckCapacity * capacityMult
  for (const { q, t } of candidates) {
    if (!keep.has(t.id)) continue
    if (t.expLoad + q.expStops > maxCap) continue
    t.expLoad += q.expStops
    t.cuadIds.push(q.id)
    q.torreId = t.id
  }

  // Punto de encuentro: centro de sus cuadrantes ponderado por paquetes esperados
  const byId = new Map(cuadrantes.map((q) => [q.id, q]))
  for (const t of torres) {
    if (!t.cuadIds.length) {
      t.savedKm = 0
      continue
    }
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
    const v = pickVehicle(t.expLoad, p)
    t.vehicle = v.vehicle
    t.trucks = v.count
  }

  // Letras: A = la Torre más lejana del HUB
  const used = torres.filter((t) => t.cuadIds.length).sort((a, b) => b.distHubKm - a.distHubKm)
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
