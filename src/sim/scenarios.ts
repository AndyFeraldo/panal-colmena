import { HUB } from './data'
import { haversineKm, roadKm } from './geo'
import { cuadAdjacency } from './cuadrantes'
import { latLngToCell } from './grid'
import { SHIFTS, WAVES, pickVehicle, type Params } from './params'
import { finalizeRoutes, sequenceRoute, type RouteDraft } from './routing'
import type { Assignment, Kpis, Order, RiderSplit, Route, ScenarioKey, ScenarioResult, Spill, Tablero, Torre, TorreLeg, TorreTrip } from './types'

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

function draftFrom(label: string, depotId: string, depot: { lat: number; lng: number }, orders: Order[], cuadId?: string, part?: number): RouteDraft {
  const seq = sequenceRoute(depot, orders)
  return {
    label,
    cuadId,
    part,
    depotId,
    depot,
    orders: seq.map((i) => orders[i]),
    readyTime: 0,
    availableTime: 0,
  }
}

/**
 * Reparte un cuadrante de más de `max` paquetes entre k motorizados POR ZONA:
 * se traza una línea a lo largo del eje principal del cuadrante y cada motorizado se queda con un lado,
 * con la misma cantidad de paquetes (± 1). Así nadie pasa de 50 y cada uno trabaja una zona compacta.
 */
export function splitByZone(orders: Order[], max: number): Order[][] {
  const k = Math.ceil(orders.length / max)
  if (k <= 1) return [orders]
  const mx = orders.reduce((s, o) => s + o.lng, 0) / orders.length
  const my = orders.reduce((s, o) => s + o.lat, 0) / orders.length
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const o of orders) {
    const dx = o.lng - mx
    const dy = o.lat - my
    sxx += dx * dx
    syy += dy * dy
    sxy += dx * dy
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy) // eje de mayor dispersión
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)
  const sorted = [...orders].sort((a, b) => (a.lng - mx) * ux + (a.lat - my) * uy - ((b.lng - mx) * ux + (b.lat - my) * uy))
  const size = Math.ceil(sorted.length / k)
  const parts: Order[][] = []
  for (let j = 0; j < k; j++) parts.push(sorted.slice(j * size, (j + 1) * size))
  return parts.filter((x) => x.length)
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
    trucks: 0,
    windowHours: 12,
    scanDepots: new Set(),
  })
  return {
    key: 'A',
    routes,
    kpis,
    torreTrips: [],
    splits: [],
    spills: [],
    orderRoute: orderRouteMap(routes),
  }
}

/**
 * B) Tablero f. sin Torre (todas las rutas salen del HUB) · C) TORRE f. (los cuadrantes lejanos salen de su Torre).
 */
export function tableroScenario(
  key: 'B' | 'C',
  orders: Order[],
  assignment: Assignment,
  map: Tablero,
  torres: Torre[],
  p: Params,
  serviceMult: (o: Order) => number,
): ScenarioResult {
  const useTorre = key === 'C'
  const byCuad = new Map<string, Order[]>()
  for (const o of orders) {
    const id = assignment.orderCuad[o.id]
    const arr = byCuad.get(id) ?? []
    arr.push(o)
    byCuad.set(id, arr)
  }
  const cuadById = new Map(map.cuadrantes.map((q) => [q.id, q]))
  const torreById = new Map(torres.map((t) => [t.id, t]))
  const spills = spillToNeighbors(byCuad, map, p.cuadMaxStops)

  // Carga real de cada Torre esta noche; si supera la capacidad → 2.º camión (aprobado automáticamente en el comparador)
  const trips: TorreTrip[] = []
  const cuadDepot = new Map<string, string>()
  if (useTorre) {
    for (const t of torres) {
      const cuadIds = t.cuadIds.filter((id) => byCuad.has(id)).sort((a, b) => haversineKm(cuadById.get(a)!.centroid, t) - haversineKm(cuadById.get(b)!.centroid, t))
      let load = 0
      const accepted: string[] = []
      const maxTrucks = Math.max(2, t.trucks + 1)
      for (const id of cuadIds) {
        const n = byCuad.get(id)!.length
        if (load + n > p.truckCapacity * maxTrucks) continue
        load += n
        accepted.push(id)
        cuadDepot.set(id, t.id)
      }
      if (accepted.length === 0) continue
      const v = pickVehicle(load, p)
      trips.push({
        torreId: t.id,
        trucks: v.count,
        vehicle: v.vehicle,
        orders: load,
        departure: 0,
        arrival: 0,
        cuadIds: accepted,
        // alerta si esta noche hace falta un vehículo más (o un camión en vez de la van del plan)
        secondTruckAlert: v.count > t.trucks || v.vehicle !== t.vehicle,
        itinerary: [],
      })
    }
  }

  // 1 cuadrante = 1 ruta. Si esta noche pasa de 50 paquetes, se reparte POR ZONA entre 2+ motorizados.
  const drafts: RouteDraft[] = []
  const splits: RiderSplit[] = []
  for (const [cuadId, list] of byCuad) {
    const depotId = cuadDepot.get(cuadId) ?? 'HUB'
    const depot = depotId === 'HUB' ? HUB : torreById.get(depotId)!
    const name = cuadById.get(cuadId)?.name ?? cuadId
    const parts = splitByZone(list, p.cuadMaxStops)
    if (parts.length === 1) {
      drafts.push(draftFrom(name, depotId, depot, list, cuadId))
      continue
    }
    splits.push({
      cuadId,
      orders: list.length,
      parts: parts.map((part) => ({
        cells: [...new Set(part.map((o) => latLngToCell(o.lat, o.lng)))],
        orders: part.length,
      })),
    })
    parts.forEach((part, j) => drafts.push(draftFrom(`${name}·${j + 1}`, depotId, depot, part, cuadId, j + 1)))
  }

  // Orden de clasificación en el HUB: primero las bolsas de las Torres (de la más cargada a la menos), luego rutas directas de la más lejana a la más cercana
  const torreOrder = [...trips].sort((a, b) => b.orders - a.orders)
  const priority: RouteDraft[] = []
  for (const t of torreOrder) priority.push(...drafts.filter((d) => d.depotId === t.torreId))
  priority.push(...drafts.filter((d) => d.depotId === 'HUB').sort((a, b) => haversineKm(b.orders[0] ?? HUB, HUB) - haversineKm(a.orders[0] ?? HUB, HUB)))
  const sorted = sortTimes(
    orders,
    priority.flatMap((d) => d.orders),
    p,
  )
  for (const d of drafts) d.readyTime = Math.max(...d.orders.map((o) => sorted[o.id])) + LOAD_MIN

  for (const t of trips) {
    const ds = drafts.filter((d) => d.depotId === t.torreId)
    const torre = torreById.get(t.torreId)!
    t.departure = Math.max(...ds.map((d) => d.readyTime))
    t.arrival = t.departure + (roadKm(HUB, torre, p.detourFactor) / p.truckSpeedKmh) * 60 + 10
    for (const d of ds) d.availableTime = t.arrival
  }
  for (const d of drafts) if (d.depotId === 'HUB') d.availableTime = d.readyTime

  const routes = finalizeRoutes(drafts, key, p, serviceMult)
  for (const t of trips)
    t.itinerary = buildItinerary(
      t,
      torreById.get(t.torreId)!,
      routes.filter((r) => r.depotId === t.torreId),
      p,
    )
  const kpis = computeKpis(key, routes, orders, p, {
    decisionMs: assignment.timeMs,
    geocodeMin: assignment.withoutCoords * p.geocodeMinPerOrder,
    trucks: trips.reduce((s, t) => s + t.trucks, 0),
    windowHours: 2,
    scanDepots: new Set(trips.map((t) => t.torreId)),
  })
  return {
    key,
    routes,
    kpis,
    torreTrips: trips,
    splits,
    spills,
    orderRoute: orderRouteMap(routes),
  }
}

const CITA_WINDOW = 40 // minutos: las motos que necesitan caja dentro de esta ventana se juntan en una sola cita

/**
 * El día de la Torre móvil: carga en el HUB → citas con sus motos en el punto de encuentro (inicio de turno y
 * recargas, agrupadas en ventanas de 40 min) → entre citas largas va a la tienda Saga de su zona (abastece la
 * tienda y espera en su estacionamiento, no en la calle) → al final recoge los no entregados y vuelve al HUB.
 */
export function buildItinerary(t: TorreTrip, torre: Torre, routes: Route[], p: Params): TorreLeg[] {
  const meet = { lat: torre.lat, lng: torre.lng }
  const store = { lat: torre.storeLat, lng: torre.storeLng }
  const drive = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => (roadKm(a, b, p.detourFactor) / p.truckSpeedKmh) * 60
  const legs: TorreLeg[] = [
    {
      time: t.departure,
      kind: 'carga',
      place: 'HUB XD Villa El Salvador',
      lat: HUB.lat,
      lng: HUB.lng,
      motos: 0,
      boxes: routes.length + routes.reduce((s, r) => s + r.reloads, 0),
      note: `Carga las cajas ya armadas: 1 por moto + sus recargas (${t.orders} pedidos)`,
    },
  ]
  const events = routes
    .flatMap((r) => [{ time: r.startTime, route: r.id }, ...r.stops.filter((s) => s.kind === 'reload').map((s) => ({ time: s.eta, route: r.id }))])
    .sort((a, b) => a.time - b.time)
  const citas: {
    start: number
    end: number
    routes: Set<string>
    boxes: number
  }[] = []
  for (const e of events) {
    const last = citas[citas.length - 1]
    if (last && e.time - last.start <= CITA_WINDOW) {
      last.end = e.time
      last.routes.add(e.route)
      last.boxes++
    } else
      citas.push({
        start: e.time,
        end: e.time,
        routes: new Set([e.route]),
        boxes: 1,
      })
  }
  const toStore = drive(meet, store)
  citas.forEach((c, i) => {
    legs.push({
      time: Math.round(c.start),
      kind: 'cita',
      place: 'Punto de encuentro',
      lat: meet.lat,
      lng: meet.lng,
      motos: c.routes.size,
      boxes: c.boxes,
      note: i === 0 ? 'Cada moto recoge su 1.ª caja' : 'Las motos sin paquetes cambian su caja vacía por una llena',
    })
    const next = citas[i + 1]
    const leave = c.end + p.reloadMinutes
    // entre citas espera en la tienda Saga de la zona (abastece la tienda; estacionamiento seguro, no en la calle)
    if (!next || next.start - leave >= 2 * toStore + 20) {
      legs.push({
        time: Math.round(leave + toStore),
        kind: 'tienda',
        place: torre.store,
        lat: store.lat,
        lng: store.lng,
        motos: 0,
        boxes: 0,
        note: next ? 'Abastece la tienda y espera en su estacionamiento hasta la próxima cita' : 'Abastece la tienda y guarda los reprogramados del día',
      })
    }
  })
  const lastEnd = Math.max(...routes.map((r) => r.endTime), citas.length ? citas[citas.length - 1].end : t.arrival)
  legs.push({
    time: Math.round(lastEnd + 15),
    kind: 'regreso',
    place: 'Punto de encuentro → HUB',
    lat: HUB.lat,
    lng: HUB.lng,
    motos: 0,
    boxes: 0,
    note: `Recoge los no entregados (cliente ausente, dirección errada) y vuelve al HUB: llega ~${Math.round(drive(meet, HUB))} min después`,
  })
  return legs
}

/**
 * Ruta alternativa a nivel de paquete: si un cuadrante pasa de `max`, sus paquetes más cercanos a un cuadrante
 * vecino con espacio pasan a ese vecino (el motorizado vecino los toma). Solo si no hay espacio cerca se reparte
 * el cuadrante entre 2 motorizados. Modifica `byCuad` y devuelve los traspasos.
 */
export function spillToNeighbors(byCuad: Map<string, Order[]>, map: Tablero, max: number): Spill[] {
  const adj = cuadAdjacency(map.cuadrantes, map.cellToCuad)
  const cuadById = new Map(map.cuadrantes.map((q) => [q.id, q]))
  const count = (id: string) => byCuad.get(id)?.length ?? 0
  const out = new Map<string, Spill>()
  const over = [...byCuad.keys()].filter((id) => count(id) > max).sort((a, b) => count(b) - count(a))
  for (const id of over) {
    const list = byCuad.get(id)!
    const near = [...(adj.get(id) ?? [])].filter((n) => cuadById.has(n))
    if (!near.length) continue
    // paquetes ordenados por cercanía al vecino más próximo
    const scored = list.map((o) => {
      let best = ''
      let bd = Infinity
      for (const n of near) {
        const d = haversineKm(o, cuadById.get(n)!.centroid)
        if (d < bd) {
          bd = d
          best = n
        }
      }
      return { o, d: bd, best }
    })
    scored.sort((a, b) => a.d - b.d)
    for (const s of scored) {
      if (list.length <= max) break
      let to = ''
      let bd = Infinity
      for (const n of near) {
        if (count(n) >= max) continue
        const d = haversineKm(s.o, cuadById.get(n)!.centroid)
        if (d < bd) {
          bd = d
          to = n
        }
      }
      if (!to || bd > 3) continue
      list.splice(list.indexOf(s.o), 1)
      const dest = byCuad.get(to) ?? []
      dest.push(s.o)
      byCuad.set(to, dest)
      const key = `${id}>${to}`
      const sp = out.get(key) ?? { from: id, to, orders: 0 }
      sp.orders++
      out.set(key, sp)
    }
  }
  return [...out.values()]
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
  ['40–44', 40, 44],
  ['45–50', 45, 50],
  ['>50', 51, Infinity],
]

export function computeKpis(
  _key: ScenarioKey,
  routes: Route[],
  orders: Order[],
  p: Params,
  extra: {
    decisionMs: number
    geocodeMin: number
    trucks: number
    windowHours: number
    scanDepots: Set<string>
  },
): Kpis {
  const total = routes.reduce((s, r) => s + r.deliveries, 0)
  let onTime = 0
  let errSum = 0
  let probRoute = 0
  for (const r of routes) {
    const sh = SHIFTS[r.shift - 1].end
    for (const s of r.stops) if (s.kind === 'delivery' && s.eta <= sh) onTime++
    const pe = extra.scanDepots.has(r.depotId) ? p.loadErrorScan : p.loadErrorManual
    errSum += r.deliveries * pe
    probRoute += 1 - Math.pow(1 - pe, r.deliveries)
  }
  const t1 = routes.filter((r) => r.shift === 1)
  const motosFromHub = t1.filter((r) => r.depotId === 'HUB').length
  const perShift = [1, 2, 3].map((s) => routes.filter((r) => r.shift === s).length)
  return {
    orders: total,
    routes: routes.length,
    spr: routes.length ? total / routes.length : 0,
    pctRoutesUnder30: routes.length ? routes.filter((r) => r.deliveries < 30).length / routes.length : 0,
    maxStops: routes.reduce((m, r) => Math.max(m, r.deliveries), 0),
    emptyKm: routes.reduce((s, r) => s + r.emptyKm, 0),
    totalKm: routes.reduce((s, r) => s + r.totalKm, 0),
    otd: total ? onTime / total : 0,
    pctRoutesOnTime: routes.length ? routes.filter((r) => r.onTime).length / routes.length : 0,
    loadCorrect: total ? 1 - errSum / total : 1,
    probRouteError: routes.length ? probRoute / routes.length : 0,
    decisionMs: extra.decisionMs,
    geocodeMin: extra.geocodeMin,
    vehiclesAtHub: motosFromHub + extra.trucks,
    motosFromHub,
    motosNeeded: Math.max(...perShift),
    trucks: extra.trucks,
    reloads: routes.reduce((s, r) => s + r.reloads, 0),
    windowHours: extra.windowHours,
    sortEnd: sortEndTime(orders, p),
    stopsHistogram: BUCKETS.map(([bucket, lo, hi]) => ({
      bucket,
      count: routes.filter((r) => r.deliveries >= lo && r.deliveries <= hi).length,
    })),
  }
}
