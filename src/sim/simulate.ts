import { latLngToCell } from 'h3-js'
import { applyMoves, assignOrders, proposeOverflowMoves } from './assign'
import { assignColmenas } from './colmenas'
import { COLMENA_POINTS } from './data'
import { learnFromDay } from './learning'
import { H3_RES, buildHistory, expectedDemand, generateOrders, type History } from './orders'
import { applyCellOverrides, buildPanales } from './panales'
import type { Params } from './params'
import { makeRng, normal } from './rng'
import { baselineDistrictFifo, panalScenario } from './scenarios'
import type { Order, SimInput, SimResult } from './types'

const historyCache = new Map<number, History>()
export function getHistory(p: Params): History {
  let h = historyCache.get(p.seed)
  if (!h) {
    h = buildHistory(p)
    historyCache.set(p.seed, h)
  }
  return h
}

/** Dificultad real de cada celda (edificios, tráfico, portería): multiplica el tiempo por parada. */
export function cellDifficulty(cell: string, seed: number): number {
  const rng = makeRng(seed, `diff:${cell}`)
  const base = Math.exp(normal(rng) * 0.12)
  return rng() < 0.07 ? base * 1.45 : base
}

export function buildMap(input: SimInput) {
  const { params: p, level, weekday } = input
  const h = getHistory(p)
  const demand = expectedDemand(h, p, level, weekday)
  let map = buildPanales(demand, h.cellDistrict, p, level, weekday)
  map = applyCellOverrides(map, input.overrides, p)
  const colmenas = assignColmenas(map.panales, COLMENA_POINTS, p, level === 'Cyber' ? 2 : 1)
  return { map, colmenas }
}

/** Corre la simulación completa: panales, colmenas, pedidos del día, 3 escenarios, KPIs y aprendizaje */
export function runSimulation(input: SimInput): SimResult {
  const t0 = performance.now()
  const p = input.params
  const { map, colmenas } = buildMap(input)
  const orders = generateOrders(p, input.level, input.weekday)

  const difficulty: Record<string, number> = {}
  const trueCell = new Map<string, string>()
  for (const o of orders) {
    const c = latLngToCell(o.lat, o.lng, H3_RES)
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
  const B = panalScenario('B', orders, applied, map, colmenas, p, serviceMult)
  const C = panalScenario('C', orders, applied, map, colmenas, p, serviceMult)
  const { items, mapAfter } = learnFromDay(C, map, moves, p)
  return {
    input,
    orders,
    map,
    colmenas,
    assignment,
    scenarios: { A, B, C },
    learning: items,
    mapAfter,
    cellDifficulty: difficulty,
    computeMs: performance.now() - t0,
  }
}
