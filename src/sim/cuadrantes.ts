import { HUB } from './data'
import { haversineKm } from './geo'
import { CELL_AREA_KM2, cellCenter, neighbors } from './grid'
import { linkedNeighbors } from './barriers'
import { avgVolume, type DemandLevel, type Params } from './params'
import type { Cuadrante, Tablero } from './types'

export { cellCenter, neighbors }

export const CUAD_COLORS = 7
const SHIFT_MINUTES = 300
const TIME_BUFFER = 60 // margen para ir/volver y reabastecer

/** Tiempo estimado del cuadrante: paradas × tiempo por parada + recorrido aproximado (fórmula de Beardwood para TSP) */
export function estimateMinutes(stops: number, cells: number, p: Params): number {
  const area = Math.max(1, cells) * CELL_AREA_KM2
  const intraKm = 0.75 * Math.sqrt(Math.max(1, stops) * area) * p.detourFactor
  return stops * p.minPerStop + (intraKm / p.motoSpeedKmh) * 60
}

interface Group {
  cells: string[]
  stops: number
  lat: number
  lng: number
}

/**
 * Arma los cuadrantes por crecimiento de regiones contiguas sobre las casillas del tablero.
 * Semilla: casilla libre más al sur-oeste; se agrega la vecina más cercana al centro del grupo hasta ~45 paquetes
 * sin pasar el tope de 50 paquetes, el volumen de la mochila ni el tiempo del turno.
 */
export function buildCuadrantes(
  cellDemand: Record<string, number>,
  cellDistrict: Record<string, string>,
  p: Params,
  level: DemandLevel,
  weekday: number,
): Tablero {
  const vol = avgVolume(p, level === 'Cyber')
  const maxVolume = p.backpackDm3 * 2
  const maxMinutes = SHIFT_MINUTES - TIME_BUFFER
  const cells = Object.keys(cellDemand).filter((c) => cellDemand[c] > 0.05)
  const inDemand = new Set(cells)
  const sorted = [...cells].sort((a, b) => {
    const ca = cellCenter(a)
    const cb = cellCenter(b)
    return ca.lat + ca.lng - (cb.lat + cb.lng) || (a < b ? -1 : 1)
  })
  const owner = new Map<string, number>()
  const groups: Group[] = []

  for (const seed of sorted) {
    if (owner.has(seed)) continue
    const gi = groups.length
    const c0 = cellCenter(seed)
    const g: Group = { cells: [seed], stops: cellDemand[seed], lat: c0.lat, lng: c0.lng }
    groups.push(g)
    owner.set(seed, gi)
    const frontier = new Set<string>()
    const rejected = new Set<string>()
    const addFrontier = (c: string) => {
      for (const n of linkedNeighbors(c, p.respectBarriers)) if (inDemand.has(n) && !owner.has(n) && !rejected.has(n)) frontier.add(n)
    }
    addFrontier(seed)
    while (g.stops < p.cuadTargetStops && frontier.size > 0) {
      // casilla vecina más cercana al centro del grupo
      let best = ''
      let bd = Infinity
      for (const c of frontier) {
        const cc = cellCenter(c)
        const d = (cc.lat - g.lat) ** 2 + (cc.lng - g.lng) ** 2
        if (d < bd) {
          bd = d
          best = c
        }
      }
      frontier.delete(best)
      const ns = g.stops + cellDemand[best]
      const fits =
        ns <= p.cuadMaxStops &&
        ns * vol <= maxVolume &&
        estimateMinutes(ns, g.cells.length + 1, p) <= maxMinutes
      if (!fits) {
        rejected.add(best)
        continue
      }
      const cc = cellCenter(best)
      const k = g.cells.length
      g.lat = (g.lat * k + cc.lat) / (k + 1)
      g.lng = (g.lng * k + cc.lng) / (k + 1)
      g.cells.push(best)
      g.stops = ns
      owner.set(best, gi)
      addFrontier(best)
    }
  }

  // Unir cuadrantes chicos con el vecino más chico si juntos no pasan el tope
  let merged = true
  while (merged) {
    merged = false
    const alive = groups.map((g, i) => ({ g, i })).filter((x) => x.g.cells.length > 0 && x.g.stops < p.cuadMinStops)
    alive.sort((a, b) => a.g.stops - b.g.stops)
    for (const { g, i } of alive) {
      if (g.cells.length === 0) continue
      const neigh = new Set<number>()
      for (const c of g.cells) for (const n of linkedNeighbors(c, p.respectBarriers)) {
        const o = owner.get(n)
        if (o !== undefined && o !== i && groups[o].cells.length > 0) neigh.add(o)
      }
      let target = -1
      let ts = Infinity
      for (const o of neigh) {
        const s = groups[o].stops
        const total = s + g.stops
        if (
          total <= p.cuadMergeMax &&
          total * vol <= maxVolume * 1.15 &&
          estimateMinutes(total, groups[o].cells.length + g.cells.length, p) <= SHIFT_MINUTES - 20 &&
          s < ts
        ) {
          ts = s
          target = o
        }
      }
      if (target >= 0) {
        const t = groups[target]
        const k = t.cells.length
        const m = g.cells.length
        t.lat = (t.lat * k + g.lat * m) / (k + m)
        t.lng = (t.lng * k + g.lng * m) / (k + m)
        for (const c of g.cells) owner.set(c, target)
        t.cells.push(...g.cells)
        t.stops += g.stops
        g.cells = []
        g.stops = 0
        merged = true
      }
    }
  }

  const finalGroups = groups.filter((g) => g.cells.length > 0)
  const cellToCuad: Record<string, string> = {}
  const cuadrantes: Cuadrante[] = finalGroups.map((g, i) => {
    const id = `Q-${String(i + 1).padStart(3, '0')}`
    for (const c of g.cells) cellToCuad[c] = id
    return makeCuadrante(id, g.cells, cellDemand, cellDistrict, p, vol, 0)
  })
  colorCuadrantes(cuadrantes, cellToCuad)
  return { level, weekday, cuadrantes, cellToCuad, cellDemand, cellDistrict }
}

export function makeCuadrante(
  id: string,
  cells: string[],
  cellDemand: Record<string, number>,
  cellDistrict: Record<string, string>,
  p: Params,
  vol: number,
  color: number,
  name = id,
): Cuadrante {
  const stops = cells.reduce((s, c) => s + (cellDemand[c] ?? 0), 0)
  let lat = 0
  let lng = 0
  let w = 0
  for (const c of cells) {
    const cc = cellCenter(c)
    const wt = (cellDemand[c] ?? 0) + 0.01
    lat += cc.lat * wt
    lng += cc.lng * wt
    w += wt
  }
  const centroid = { lat: lat / w, lng: lng / w }
  const districts = [...new Set(cells.map((c) => cellDistrict[c]).filter(Boolean))]
  return {
    id,
    name,
    cells,
    color,
    centroid,
    expStops: stops,
    expVolume: stops * vol,
    estMinutes: estimateMinutes(stops, cells.length, p),
    districts,
    distHubKm: haversineKm(centroid, HUB),
    torreId: null,
  }
}

/** Coloreo greedy: dos cuadrantes vecinos nunca comparten color */
export function colorCuadrantes(cuadrantes: Cuadrante[], cellToCuad: Record<string, string>) {
  const adj = cuadAdjacency(cuadrantes, cellToCuad)
  const order = [...cuadrantes].sort((a, b) => (adj.get(b.id)?.size ?? 0) - (adj.get(a.id)?.size ?? 0))
  const colorOf = new Map<string, number>()
  const usage = new Array(CUAD_COLORS).fill(0)
  for (const q of order) {
    const used = new Set<number>()
    for (const n of adj.get(q.id) ?? []) {
      const c = colorOf.get(n)
      if (c !== undefined) used.add(c)
    }
    let best = -1
    for (let c = 0; c < CUAD_COLORS; c++) {
      if (!used.has(c) && (best < 0 || usage[c] < usage[best])) best = c
    }
    if (best < 0) best = usage.indexOf(Math.min(...usage))
    colorOf.set(q.id, best)
    usage[best]++
  }
  for (const q of cuadrantes) q.color = colorOf.get(q.id) ?? 0
}

export function cuadAdjacency(cuadrantes: Cuadrante[], cellToCuad: Record<string, string>): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>()
  for (const q of cuadrantes) {
    const s = new Set<string>()
    for (const c of q.cells) for (const n of neighbors(c)) {
      const o = cellToCuad[n]
      if (o && o !== q.id) s.add(o)
    }
    adj.set(q.id, s)
  }
  return adj
}

/** Aplica movimientos de casillas (ajustes manuales del planificador) y recalcula los cuadrantes */
export function applyCellOverrides(map: Tablero, overrides: Record<string, string>, p: Params): Tablero {
  const entries = Object.entries(overrides).filter(([c, to]) => map.cellToCuad[c] && map.cuadrantes.some((x) => x.id === to))
  if (entries.length === 0) return map
  const cellToCuad = { ...map.cellToCuad }
  for (const [c, to] of entries) cellToCuad[c] = to
  const vol = avgVolume(p, map.level === 'Cyber')
  const byCuad = new Map<string, string[]>()
  for (const [c, id] of Object.entries(cellToCuad)) {
    const arr = byCuad.get(id) ?? []
    arr.push(c)
    byCuad.set(id, arr)
  }
  const cuadrantes = map.cuadrantes
    .filter((q) => (byCuad.get(q.id)?.length ?? 0) > 0)
    .map((q) => makeCuadrante(q.id, byCuad.get(q.id)!, map.cellDemand, map.cellDistrict, p, vol, q.color))
  return { ...map, cuadrantes, cellToCuad }
}

/** ¿La casilla está en el borde de su cuadrante? Devuelve los cuadrantes vecinos */
export function borderNeighbors(cell: string, cellToCuad: Record<string, string>, respect = true): string[] {
  const own = cellToCuad[cell]
  const out = new Set<string>()
  for (const n of linkedNeighbors(cell, respect)) {
    const o = cellToCuad[n]
    if (o && o !== own) out.add(o)
  }
  return [...out]
}

/** Nombre visible de un cuadrante a partir de su id interno */
export function cuadName(map: Tablero, id: string | undefined | null): string {
  if (!id) return '—'
  return map.cuadrantes.find((q) => q.id === id)?.name ?? id
}

/** pedido → nombre visible del cuadrante (para etiquetas en SimpliRoute) */
export function orderCuadNames(orderCuad: Record<string, string>, map: Tablero): Record<string, string> {
  const name = new Map(map.cuadrantes.map((q) => [q.id, q.name]))
  const out: Record<string, string> = {}
  for (const k in orderCuad) out[k] = name.get(orderCuad[k]) ?? orderCuad[k]
  return out
}
