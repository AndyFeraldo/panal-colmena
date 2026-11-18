import { latLngToCell } from './grid'
import { applyMoves, assignOrders, proposeOverflowMoves } from './assign'
import { assignTorres } from './torres'
import { TORRE_ZONES } from './data'
import { learnFromDay } from './learning'
import { buildHistory, expectedDemand, generateOrders, type History } from './orders'
import { applyCellOverrides, buildCuadrantes } from './cuadrantes'
import { DEMAND_LEVELS, type Params } from './params'
import { makeRng, normal } from './rng'
import { baselineDistrictFifo, tableroScenario } from './scenarios'
import type { CapacityRow, Order, SimInput, SimResult } from './types'

const historyCache = new Map<number, History>()
export function getHistory(p: Params): History {
  let h = historyCache.get(p.seed)
  if (!h) {
    h = buildHistory(p)
    historyCache.set(p.seed, h)
  }
  return h
}

/** Dificultad real de cada casilla (edificios, tráfico, portería): multiplica el tiempo por parada. */
export function cellDifficulty(cell: string, seed: number): number {
  const rng = makeRng(seed, `diff:${cell}`)
  const base = Math.exp(normal(rng) * 0.12)
  return rng() < 0.07 ? base * 1.45 : base
}

export function buildMap(input: SimInput) {
  const { params: p, level, weekday } = input
  const h = getHistory(p)
  const demand = expectedDemand(h, p, level, weekday)
  let map = buildCuadrantes(demand, h.cellDistrict, p, level, weekday)
  map = applyCellOverrides(map, input.overrides, p)
  const torres = assignTorres(map.cuadrantes, TORRE_ZONES, p, level === 'Cyber' ? 2 : 1)
  return { map, torres }
}

/** Corre la simulación completa: cuadrantes, Torres, pedidos del día, 3 escenarios, KPIs y aprendizaje */
export function runSimulation(input: SimInput): SimResult {
  const t0 = performance.now()
  const p = input.params
  const { map, torres } = buildMap(input)
  const orders = generateOrders(p, input.level, input.weekday)

  const difficulty: Record<string, number> = {}
  const trueCell = new Map<string, string>()
  for (const o of orders) {
    const c = latLngToCell(o.lat, o.lng)
    trueCell.set(o.id, c)
    if (difficulty[c] === undefined) difficulty[c] = cellDifficulty(c, p.seed)
  }
  const serviceMult = (o: Order) => difficulty[trueCell.get(o.id)!] ?? 1

  const A = baselineDistrictFifo(orders, p, serviceMult)
  const raw = assignOrders(orders, map, input.pctPin)
  const moves = proposeOverflowMoves(raw, map, p)
  // la asignación "cruda" (antes de aprobar desbordes) se muestra en el HUB; los escenarios usan los movimientos aplicados
  const assignment = { ...raw, moves }
  const applied = applyMoves(raw, moves)
  const B = tableroScenario('B', orders, applied, map, torres, p, serviceMult)
  const C = tableroScenario('C', orders, applied, map, torres, p, serviceMult)
  const { items, mapAfter } = learnFromDay(C, map, moves, p)
  return {
    input,
    orders,
    map,
    torres,
    assignment,
    scenarios: { A, B, C },
    learning: items,
    mapAfter,
    cellDifficulty: difficulty,
    computeMs: performance.now() - t0,
  }
}

/** ¿Cuántos motorizados y camiones se necesitan? Corre el día en los 4 niveles de demanda con los mismos supuestos. */
export function capacityByLevel(input: SimInput): CapacityRow[] {
  return DEMAND_LEVELS.map((level) => {
    const r = runSimulation({ ...input, level, overrides: {} })
    const { A, C } = r.scenarios
    return {
      level,
      orders: r.orders.length,
      routesToday: A.kpis.routes,
      motosToday: A.kpis.motosNeeded,
      routesTorre: C.kpis.routes,
      motosTorre: C.kpis.motosNeeded,
      torres: C.torreTrips.length,
      trucks: C.kpis.trucks,
      sortEnd: C.kpis.sortEnd,
      otdToday: A.kpis.otd,
      otdTorre: C.kpis.otd,
      maxStopsTorre: C.kpis.maxStops,
    }
  })
}

/** Mismo día en temporada baja y en Cyber: para ver que los cuadrantes se achican solos cuando sube la demanda */
export function seasonMaps(input: SimInput) {
  const bajo = buildMap({ ...input, level: 'Bajo', overrides: {} })
  const cyber = buildMap({ ...input, level: 'Cyber', overrides: {} })
  return { Bajo: bajo, Cyber: cyber }
}
