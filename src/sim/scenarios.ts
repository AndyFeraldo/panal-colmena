import { HUB } from './data'
import { haversineKm, roadKm } from './geo'
import { WAVES, type Params } from './params'
import { finalizeRoutes, sequenceRoute, type RouteDraft } from './routing'
import type { Assignment, Colmena, Kpis, MinivanTrip, Order, PanalMap, Route, ScenarioKey, ScenarioResult } from './types'

const LOAD_MIN = 15 // minutos de carga del vehículo en el HUB

/** Hora en que el HUB termina de clasificar cada pedido, según el orden de proceso de la oleada de 02:30 */
export function sortTimes(orders: Order[], wave3Sequence: Order[], p: Params): Record<string, number> {
  const out: Record<string, number> = {}
  const rate = p.hubCapacityPerHour / 60
  for (const w of [1, 2] as const) {
    const ws = orders.filter((o) => o.wave === w).sort((a, b) => a.createdAt - b.createdAt)
    ws.forEach((o, i) => (out[o.id] = WAVES[w - 1].time + (i + 1) / rate))
  }
  let i = 0
  for (const o of wave3Sequence) {
    if (o.wave !== 3) continue
    out[o.id] = WAVES[2].time + ++i / rate
  }
  return out
}

export function sortEndTime(orders: Order[], p: Params): number {
  const n3 = orders.filter((o) => o.wave === 3).length
  return WAVES[2].time + (n3 / p.hubCapacityPerHour) * 60
}

function draftFrom(
  label: string,
  depotId: string,
  depot: { lat: number; lng: number },
  orders: Order[],
  panalId?: string,
): RouteDraft {
  const seq = sequenceRoute(depot, orders)
  return { label, panalId, depotId, depot, orders: seq.map((i) => orders[i]), readyTime: 0, availableTime: 0 }
}

/**
 * A) Regla actual: por distrito, en orden de llegada, los primeros 50 forman una ruta; el sobrante otra.
 * Todas salen del HUB VES; si la mochila se llena, la moto vuelve al HUB.
 */
export function baselineDistrictFifo(orders: Order[], p: Params, serviceMult: (o: Order) => number): ScenarioResult {
  const t0 = performance.now()
  // "Los primeros pedidos que caen van armando rutas": por orden de llegada se llenan los turnos (50% / 35% / 15%)
  const fifoAll = [...orders].sort((a, b) => a.createdAt - b.createdAt)
  const c1 = Math.round(fifoAll.length * p.shiftShares[0])
  const c2 = c1 + Math.round(fifoAll.length * p.shiftShares[1])
  const chunks: { label: string; orders: Order[]; shift: 1 | 2 | 3 }[] = []
  for (const shift of [1, 2, 3] as const) {
    const slice = fifoAll.slice(shift === 1 ? 0 : shift === 2 ? c1 : c2, shift === 1 ? c1 : shift === 2 ? c2 : undefined)
    const byDistrict = new Map<string, Order[]>()
    for (const o of slice) {
      const arr = byDistrict.get(o.district) ?? []
      arr.push(o)
      byDistrict.set(o.district, arr)
    }
    // por cada distrito, los primeros 50 → una ruta; el sobrante forma otra (aunque sea chica)
    for (const [district, list] of byDistrict) {
      for (let i = 0; i < list.length; i += 50) chunks.push({ label: district, orders: list.slice(i, i + 50), shift })
    }
  }
  const decisionMs = performance.now() - t0
  const fifo = [...orders].sort((a, b) => a.createdAt - b.createdAt)
  const sorted = sortTimes(orders, fifo, p)
  const drafts = chunks.map((c) => {
    const d = draftFrom(c.label, 'HUB', HUB, c.orders)
    d.readyTime = Math.max(...c.orders.map((o) => sorted[o.id])) + LOAD_MIN
    d.availableTime = d.readyTime
    d.fixedShift = c.shift
    return d
  })
  const routes = finalizeRoutes(drafts, 'A', p, serviceMult)
  const withoutCoords = orders.filter((o) => o.u >= p.pctPinToday).length
  const kpis = computeKpis('A', routes, orders, p, {
    decisionMs,
    geocodeMin: withoutCoords * p.geocodeMinPerOrder,
    minivans: 0,
    windowHours: 12,
    scanDepots: new Set(),
  })
  return { key: 'A', routes, kpis, minivanTrips: [], orderRoute: orderRouteMap(routes) }
}

/**
 * B) PANAL (todas las rutas salen del HUB) · C) PANAL + Colmena (panales lejanos salen de la Colmena).
 */
export function panalScenario(
  key: 'B' | 'C',
  orders: Order[],
  assignment: Assignment,
  map: PanalMap,
  colmenas: Colmena[],
  p: Params,
  serviceMult: (o: Order) => number,
): ScenarioResult {
  const useColmena = key === 'C'
  const byPanal = new Map<string, Order[]>()
  for (const o of orders) {
    const id = assignment.orderPanal[o.id]
    const arr = byPanal.get(id) ?? []
    arr.push(o)
    byPanal.set(id, arr)
  }
  const panalById = new Map(map.panales.map((pn) => [pn.id, pn]))
  const colById = new Map(colmenas.map((c) => [c.id, c]))

  // Carga real de cada Colmena esta noche; si supera la capacidad → 2.ª minivan (aprobada automáticamente en el comparador)
  const trips: MinivanTrip[] = []
  const panalDepot = new Map<string, string>()
  if (useColmena) {
    for (const c of colmenas) {
      const panalIds = c.panalIds
        .filter((id) => byPanal.has(id))
        .sort((a, b) => haversineKm(panalById.get(a)!.centroid, c) - haversineKm(panalById.get(b)!.centroid, c))
      let load = 0
      const accepted: string[] = []
      const maxMinivans = Math.max(2, c.minivans + 1)
      for (const id of panalIds) {
        const n = byPanal.get(id)!.length
        if (load + n > p.minivanCapacity * maxMinivans) continue
        load += n
        accepted.push(id)
        panalDepot.set(id, c.id)
      }
      if (accepted.length === 0) continue
      const minivans = Math.max(1, Math.ceil(load / p.minivanCapacity))
      trips.push({
        colmenaId: c.id,
        minivans,
        orders: load,
        departure: 0,
        arrival: 0,
        panalIds: accepted,
        secondMinivanAlert: minivans > c.minivans,
      })
    }
  }

  // Borradores de ruta: 1 panal = 1 ruta (si aún desborda, se parte en 2)
  const drafts: RouteDraft[] = []
  for (const [panalId, list] of byPanal) {
    const depotId = panalDepot.get(panalId) ?? 'HUB'
    const depot = depotId === 'HUB' ? HUB : colById.get(depotId)!
    const k = Math.ceil(list.length / p.panalMergeMax) // solo se parte si supera el máximo absoluto
    if (k <= 1) {
      drafts.push(draftFrom(panalId, depotId, depot, list, panalId))
    } else {
      const full = draftFrom(panalId, depotId, depot, list, panalId)
      const size = Math.ceil(list.length / k)
      for (let j = 0; j < k; j++) {
        const part = full.orders.slice(j * size, (j + 1) * size)
        drafts.push(draftFrom(`${panalId}${String.fromCharCode(97 + j)}`, depotId, depot, part, panalId))
      }
    }
  }

  // Orden de clasificación en el HUB: primero bolsas de Colmenas (de la más cargada a la menos), luego rutas directas de la más lejana a la más cercana
  const colOrder = [...trips].sort((a, b) => b.orders - a.orders) // primero la Colmena con más pedidos
  const priority: RouteDraft[] = []
  for (const t of colOrder) priority.push(...drafts.filter((d) => d.depotId === t.colmenaId))
  priority.push(
    ...drafts
      .filter((d) => d.depotId === 'HUB')
      .sort((a, b) => haversineKm(b.orders[0] ?? HUB, HUB) - haversineKm(a.orders[0] ?? HUB, HUB)),
  )
  const sorted = sortTimes(
    orders,
    priority.flatMap((d) => d.orders),
    p,
  )
  for (const d of drafts) d.readyTime = Math.max(...d.orders.map((o) => sorted[o.id])) + LOAD_MIN

  for (const t of trips) {
    const ds = drafts.filter((d) => d.depotId === t.colmenaId)
    const col = colById.get(t.colmenaId)!
    t.departure = Math.max(...ds.map((d) => d.readyTime))
    t.arrival = t.departure + (roadKm(HUB, col, p.detourFactor) / p.minivanSpeedKmh) * 60 + 10
    for (const d of ds) d.availableTime = t.arrival
  }
  for (const d of drafts) if (d.depotId === 'HUB') d.availableTime = d.readyTime

  const routes = finalizeRoutes(drafts, key, p, serviceMult)
  const kpis = computeKpis(key, routes, orders, p, {
    decisionMs: assignment.timeMs,
    geocodeMin: assignment.withoutCoords * p.geocodeMinPerOrder,
    minivans: trips.reduce((s, t) => s + t.minivans, 0),
    windowHours: 2,
    scanDepots: new Set(trips.map((t) => t.colmenaId)),
  })
  return { key, routes, kpis, minivanTrips: trips, orderRoute: orderRouteMap(routes) }
}

function orderRouteMap(routes: Route[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of routes) for (const s of r.stops) if (s.orderId) out[s.orderId] = r.id
  return out
}

const BUCKETS: [string, number, number][] = [
  ['<20', 0, 19],
  ['20–29', 20, 29],
  ['30–39', 30, 39],
  ['40–49', 40, 49],
  ['50–55', 50, 55],
  ['>55', 56, Infinity],
]

export function computeKpis(
  _key: ScenarioKey,
  routes: Route[],
  orders: Order[],
  p: Params,
  extra: { decisionMs: number; geocodeMin: number; minivans: number; windowHours: number; scanDepots: Set<string> },
): Kpis {
  const total = routes.reduce((s, r) => s + r.deliveries, 0)
  let onTime = 0
  let errSum = 0
  let probRoute = 0
  for (const r of routes) {
    const sh = r.shift === 1 ? 11 * 60 : r.shift === 2 ? 17 * 60 : 21 * 60
    for (const s of r.stops) if (s.kind === 'delivery' && s.eta <= sh) onTime++
    const pe = extra.scanDepots.has(r.depotId) ? p.loadErrorScan : p.loadErrorManual
    errSum += r.deliveries * pe
    probRoute += 1 - Math.pow(1 - pe, r.deliveries)
  }
  const t1 = routes.filter((r) => r.shift === 1)
  const motosFromHub = t1.filter((r) => r.depotId === 'HUB').length
  return {
    orders: total,
    routes: routes.length,
    spr: routes.length ? total / routes.length : 0,
    pctRoutesUnder30: routes.length ? routes.filter((r) => r.deliveries < 30).length / routes.length : 0,
    emptyKm: routes.reduce((s, r) => s + r.emptyKm, 0),
    totalKm: routes.reduce((s, r) => s + r.totalKm, 0),
    otd: total ? onTime / total : 0,
    pctRoutesOnTime: routes.length ? routes.filter((r) => r.onTime).length / routes.length : 0,
    loadCorrect: total ? 1 - errSum / total : 1,
    probRouteError: routes.length ? probRoute / routes.length : 0,
    decisionMs: extra.decisionMs,
    geocodeMin: extra.geocodeMin,
    vehiclesAtHub: motosFromHub + extra.minivans,
    motosFromHub,
    minivans: extra.minivans,
    reloads: routes.reduce((s, r) => s + r.reloads, 0),
    windowHours: extra.windowHours,
    sortEnd: sortEndTime(orders, p),
    stopsHistogram: BUCKETS.map(([bucket, lo, hi]) => ({
      bucket,
      count: routes.filter((r) => r.deliveries >= lo && r.deliveries <= hi).length,
    })),
  }
}
