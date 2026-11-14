import { cellToLatLng, getHexagonAreaAvg, gridDisk } from 'h3-js'
import { HUB, type LatLng } from './data'
import { haversineKm } from './geo'
import { H3_RES } from './orders'
import { avgVolume, type DemandLevel, type Params } from './params'
import type { Panal, PanalMap } from './types'

export const PANAL_COLORS = 7
const CELL_AREA_KM2 = getHexagonAreaAvg(H3_RES, 'km2')
const SHIFT_MINUTES = 300
const TIME_BUFFER = 60 // margen para ir/volver y recargar

const cellCenterCache = new Map<string, LatLng>()
export function cellCenter(cell: string): LatLng {
  let c = cellCenterCache.get(cell)
  if (!c) {
    const [lat, lng] = cellToLatLng(cell)
    c = { lat, lng }
    cellCenterCache.set(cell, c)
  }
  return c
}

export function neighbors(cell: string): string[] {
  return gridDisk(cell, 1).filter((c) => c !== cell)
}

/** Tiempo estimado del panal: paradas × tiempo por parada + recorrido aproximado (fórmula de Beardwood para TSP) */
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
 * Construye panales por crecimiento de regiones contiguas sobre celdas H3 res 8.
 * Semilla: celda libre más al sur-oeste; se agrega el vecino más cercano al centroide hasta ~48 paradas
 * sin pasar los límites de paradas, volumen y tiempo del turno.
 */
export function buildPanales(
  cellDemand: Record<string, number>,
  cellDistrict: Record<string, string>,
  p: Params,
  level: DemandLevel,
  weekday: number,
): PanalMap {
  const vol = avgVolume(p, level === 'Cyber')
  const maxVolume = p.backpackDm3 * 2
  const maxMinutes = SHIFT_MINUTES - TIME_BUFFER
  const cells = Object.keys(cellDemand).filter((c) => cellDemand[c] > 0.05)
  const inDemand = new Set(cells)
  const sorted = [...cells].sort((a, b) => {
    const ca = cellCenter(a)
    const cb = cellCenter(b)
    return ca.lat + ca.lng - (cb.lat + cb.lng)
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
      for (const n of neighbors(c)) if (inDemand.has(n) && !owner.has(n) && !rejected.has(n)) frontier.add(n)
    }
    addFrontier(seed)
    while (g.stops < p.panalTargetStops && frontier.size > 0) {
      // vecino más cercano al centroide del grupo
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
        ns <= p.panalMaxStops &&
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

  // Fusionar panales pequeños con el vecino más chico si no supera el máximo de fusión
  let merged = true
  while (merged) {
    merged = false
    const alive = groups.map((g, i) => ({ g, i })).filter((x) => x.g.cells.length > 0 && x.g.stops < p.panalMinStops)
    alive.sort((a, b) => a.g.stops - b.g.stops)
    for (const { g, i } of alive) {
      if (g.cells.length === 0) continue
      const neigh = new Set<number>()
      for (const c of g.cells) for (const n of neighbors(c)) {
        const o = owner.get(n)
        if (o !== undefined && o !== i && groups[o].cells.length > 0) neigh.add(o)
      }
      let target = -1
      let ts = Infinity
      for (const o of neigh) {
        const s = groups[o].stops
        const total = s + g.stops
        if (
          total <= p.panalMergeMax &&
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
  const cellToPanal: Record<string, string> = {}
  const panales: Panal[] = finalGroups.map((g, i) => {
    const id = `P-${String(i + 1).padStart(2, '0')}`
    for (const c of g.cells) cellToPanal[c] = id
    return makePanal(id, g.cells, cellDemand, cellDistrict, p, vol, 0)
  })
  colorPanales(panales, cellToPanal)
  return { level, weekday, panales, cellToPanal, cellDemand, cellDistrict }
}

export function makePanal(
  id: string,
  cells: string[],
  cellDemand: Record<string, number>,
  cellDistrict: Record<string, string>,
  p: Params,
  vol: number,
  color: number,
): Panal {
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
    cells,
    color,
    centroid,
    expStops: stops,
    expVolume: stops * vol,
    estMinutes: estimateMinutes(stops, cells.length, p),
    districts,
    distHubKm: haversineKm(centroid, HUB),
    colmenaId: null,
  }
}

/** Coloreo greedy: dos panales vecinos nunca comparten color */
export function colorPanales(panales: Panal[], cellToPanal: Record<string, string>) {
  const adj = panalAdjacency(panales, cellToPanal)
  const order = [...panales].sort((a, b) => (adj.get(b.id)?.size ?? 0) - (adj.get(a.id)?.size ?? 0))
  const colorOf = new Map<string, number>()
  const usage = new Array(PANAL_COLORS).fill(0)
  for (const pn of order) {
    const used = new Set<number>()
    for (const n of adj.get(pn.id) ?? []) {
      const c = colorOf.get(n)
      if (c !== undefined) used.add(c)
    }
    let best = -1
    for (let c = 0; c < PANAL_COLORS; c++) {
      if (!used.has(c) && (best < 0 || usage[c] < usage[best])) best = c
    }
    if (best < 0) best = usage.indexOf(Math.min(...usage))
    colorOf.set(pn.id, best)
    usage[best]++
  }
  for (const pn of panales) pn.color = colorOf.get(pn.id) ?? 0
}

export function panalAdjacency(panales: Panal[], cellToPanal: Record<string, string>): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>()
  for (const pn of panales) {
    const s = new Set<string>()
    for (const c of pn.cells) for (const n of neighbors(c)) {
      const o = cellToPanal[n]
      if (o && o !== pn.id) s.add(o)
    }
    adj.set(pn.id, s)
  }
  return adj
}

/** Aplica movimientos de celdas (ajustes manuales del planificador) y recalcula los panales */
export function applyCellOverrides(map: PanalMap, overrides: Record<string, string>, p: Params): PanalMap {
  const entries = Object.entries(overrides).filter(([c, to]) => map.cellToPanal[c] && map.panales.some((x) => x.id === to))
  if (entries.length === 0) return map
  const cellToPanal = { ...map.cellToPanal }
  for (const [c, to] of entries) cellToPanal[c] = to
  const vol = avgVolume(p, map.level === 'Cyber')
  const byPanal = new Map<string, string[]>()
  for (const [c, id] of Object.entries(cellToPanal)) {
    const arr = byPanal.get(id) ?? []
    arr.push(c)
    byPanal.set(id, arr)
  }
  const panales = map.panales
    .filter((pn) => (byPanal.get(pn.id)?.length ?? 0) > 0)
    .map((pn) => makePanal(pn.id, byPanal.get(pn.id)!, map.cellDemand, map.cellDistrict, p, vol, pn.color))
  return { ...map, panales, cellToPanal }
}

/** ¿La celda está en el borde de su panal? Devuelve los panales vecinos */
export function borderNeighbors(cell: string, cellToPanal: Record<string, string>): string[] {
  const own = cellToPanal[cell]
  const out = new Set<string>()
  for (const n of neighbors(cell)) {
    const o = cellToPanal[n]
    if (o && o !== own) out.add(o)
  }
  return [...out]
}
