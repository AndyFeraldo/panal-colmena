import type { LatLng } from './data'
import { roadKm } from './geo'
import { SHIFTS, type Params } from './params'
import type { Order, Route, ScenarioKey, Stop } from './types'

// Distancia rápida (equirectangular) para ordenar; suficiente a escala de ciudad
function fastDist(a: LatLng, b: LatLng): number {
  const x = (b.lng - a.lng) * Math.cos(((a.lat + b.lat) * Math.PI) / 360)
  const y = b.lat - a.lat
  return Math.sqrt(x * x + y * y)
}

/**
 * Orden de paradas (simula la Optimización de SimpliRoute): vecino más cercano + 2-opt.
 * Ruta abierta que parte del depósito (HUB o Torre). Devuelve los índices en orden de visita.
 */
export function sequenceRoute(start: LatLng, pts: LatLng[]): number[] {
  const n = pts.length
  if (n <= 1) return pts.map((_, i) => i)
  const used = new Uint8Array(n)
  const order: number[] = []
  let cur = start
  for (let k = 0; k < n; k++) {
    let best = -1
    let bd = Infinity
    for (let i = 0; i < n; i++) {
      if (used[i]) continue
      const d = fastDist(cur, pts[i])
      if (d < bd) {
        bd = d
        best = i
      }
    }
    used[best] = 1
    order.push(best)
    cur = pts[best]
  }
  // 2-opt sobre el camino [start, ...order]
  const path: LatLng[] = [start, ...order.map((i) => pts[i])]
  const idx: number[] = [-1, ...order]
  const m = path.length
  let improved = true
  let passes = 0
  while (improved && passes < 40) {
    improved = false
    passes++
    for (let i = 0; i < m - 2; i++) {
      for (let j = i + 2; j < m; j++) {
        const a = path[i]
        const b = path[i + 1]
        const c = path[j]
        const hasD = j + 1 < m
        const d = hasD ? path[j + 1] : null
        const delta = fastDist(a, c) + (d ? fastDist(b, d) : 0) - fastDist(a, b) - (d ? fastDist(c, d) : 0)
        if (delta < -1e-12) {
          // invertir path[i+1..j]
          for (let l = i + 1, r = j; l < r; l++, r--) {
            ;[path[l], path[r]] = [path[r], path[l]]
            ;[idx[l], idx[r]] = [idx[r], idx[l]]
          }
          improved = true
        }
      }
    }
  }
  return idx.slice(1)
}

export interface RouteDraft {
  label: string
  cuadId?: string
  part?: number
  depotId: string
  depot: LatLng
  orders: Order[] // ya ordenados
  readyTime: number
  availableTime: number
  fixedShift?: 1 | 2 | 3 // el baseline arma rutas por turno
}

export function routeLength(depot: LatLng, pts: LatLng[]): number {
  let s = 0
  let cur = depot
  for (const p of pts) {
    s += fastDist(cur, p)
    cur = p
  }
  return s
}

/**
 * Calcula ETA por parada con los supuestos. Si el volumen acumulado supera la mochila,
 * inserta una parada de recarga en el depósito (Torre o, en el baseline, el HUB).
 */
export function buildTimeline(
  draft: RouteDraft,
  startTime: number,
  p: Params,
  serviceMult: (o: Order) => number,
): Pick<Route, 'stops' | 'deliveries' | 'reloads' | 'totalKm' | 'emptyKm' | 'endTime' | 'volume'> {
  const kmToMin = (km: number) => (km / p.motoSpeedKmh) * 60
  const stops: Stop[] = []
  let t = startTime
  let pos: LatLng = draft.depot
  let load = 0
  let totalKm = 0
  let emptyKm = 0
  let reloads = 0
  let volume = 0
  let seq = 0
  draft.orders.forEach((o, i) => {
    volume += o.volume
    if (load + o.volume > p.backpackDm3 && load > 0) {
      // volver al depósito a recargar
      const back = roadKm(pos, draft.depot, p.detourFactor)
      t += kmToMin(back)
      totalKm += back
      emptyKm += back
      stops.push({ kind: 'reload', lat: draft.depot.lat, lng: draft.depot.lng, eta: t, seq: ++seq, serviceMin: p.reloadMinutes })
      t += p.reloadMinutes
      pos = draft.depot
      load = 0
      reloads++
    }
    const leg = roadKm(pos, o, p.detourFactor)
    t += kmToMin(leg)
    totalKm += leg
    if (i === 0 || pos === draft.depot) emptyKm += leg
    const service = p.minPerStop * serviceMult(o)
    stops.push({ kind: 'delivery', orderId: o.id, lat: o.lat, lng: o.lng, eta: t, seq: ++seq, serviceMin: service })
    t += service
    load += o.volume
    pos = o
  })
  const ret = roadKm(pos, draft.depot, p.detourFactor)
  totalKm += ret
  emptyKm += ret
  const deliveries = draft.orders.length
  const lastEta = stops.length ? stops[stops.length - 1].eta : startTime
  return { stops, deliveries, reloads, totalKm, emptyKm, endTime: lastEta, volume }
}

/** Reparte las rutas en los 3 turnos según su hora de disponibilidad y calcula los tiempos */
export function finalizeRoutes(
  drafts: RouteDraft[],
  scenario: ScenarioKey,
  p: Params,
  serviceMult: (o: Order) => number,
): Route[] {
  const sorted = [...drafts].sort((a, b) => a.availableTime - b.availableTime)
  // Turnos (50/35/15 %) repartidos DENTRO de cada depósito: cada zona Torre trabaja los 3 turnos,
  // así su Torre tiene cita a las 06:00, 12:00 y 18:00 (y no solo en la mañana)
  const shiftOf = new Map<RouteDraft, 1 | 2 | 3>()
  const byDepot = new Map<string, RouteDraft[]>()
  for (const d of sorted) byDepot.set(d.depotId, [...(byDepot.get(d.depotId) ?? []), d])
  for (const group of byDepot.values()) {
    const n = group.length
    const cut1 = Math.round(n * p.shiftShares[0])
    const cut2 = cut1 + Math.round(n * p.shiftShares[1])
    group.forEach((d, i) => shiftOf.set(d, (i < cut1 ? 1 : i < cut2 ? 2 : 3) as 1 | 2 | 3))
  }
  let riderIdx = 0
  return sorted.map((d, i) => {
    const shift = d.fixedShift ?? shiftOf.get(d)!
    const sh = SHIFTS[shift - 1]
    const startTime = Math.max(sh.start, d.availableTime)
    const tl = buildTimeline(d, startTime, p, serviceMult)
    const hasAna = d.orders.some((o) => o.isAna)
    const rider = hasAna ? 'Carlos' : RIDERS[riderIdx++ % RIDERS.length]
    return {
      id: `${scenario}-${String(i + 1).padStart(3, '0')}`,
      scenario,
      label: d.label,
      cuadId: d.cuadId,
      part: d.part,
      depotId: d.depotId,
      depot: d.depot,
      readyTime: d.readyTime,
      startTime,
      shift,
      onTime: tl.endTime <= sh.end,
      rider,
      ...tl,
    }
  })
}

const RIDERS = ['Luis', 'Rosa', 'Pedro', 'Miguel', 'Lucía', 'Jorge', 'Diana', 'Raúl', 'Elena', 'Víctor', 'Sofía', 'Andrés', 'Paola', 'Hugo', 'Marta', 'Iván', 'Gaby', 'Óscar', 'Nadia', 'Felipe', 'Karen', 'Tomás', 'Julia']
