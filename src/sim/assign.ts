import { gridDisk, latLngToCell } from './grid'
import { DISTRICTS } from './data'
import { haversineKm } from './geo'
import { cellCenter, neighbors } from './cuadrantes'
import type { Params } from './params'
import type { Assignment, CellMove, Order, Tablero } from './types'

const districtCenter = new Map(DISTRICTS.map((d) => [d.name, d.center]))

function nearestCuad(cell: string, map: Tablero): string {
  for (let k = 1; k <= 4; k++) {
    for (const n of gridDisk(cell, k)) {
      const id = map.cellToCuad[n]
      if (id) return id
    }
  }
  const c = cellCenter(cell)
  let best = map.cuadrantes[0].id
  let bd = Infinity
  for (const pn of map.cuadrantes) {
    const d = haversineKm(c, pn.centroid)
    if (d < bd) {
      bd = d
      best = pn.id
    }
  }
  return best
}

/**
 * Asignación nocturna: lat/lng → casilla H3 → cuadrante (lookup en un diccionario).
 * Pedidos sin coordenadas caen en el centro de su distrito (peor asignación).
 */
export function assignOrders(orders: Order[], map: Tablero, pctPin: number): Assignment {
  const orderCuad: Record<string, string> = {}
  const orderCell: Record<string, string> = {}
  let withoutCoords = 0
  const cuadCounts: Record<string, number> = {}
  const centerCuadrantes = new Map<string, string[]>()
  const t0 = performance.now()
  for (const o of orders) {
    let id: string
    if (o.u >= pctPin) {
      // Sin coordenadas: el pedido solo se conoce por su distrito. Cae cerca del centro del distrito,
      // repartido entre los cuadrantes que rodean ese centro (asignación peor que con pin).
      withoutCoords++
      let opts = centerCuadrantes.get(o.district)
      if (!opts) {
        const c = districtCenter.get(o.district)!
        const cc = latLngToCell(c.lat, c.lng)
        opts = [...new Set(gridDisk(cc, 2).map((x) => map.cellToCuad[x]).filter(Boolean))]
        if (!opts.length) opts = [nearestCuad(cc, map)]
        centerCuadrantes.set(o.district, opts)
      }
      id = opts.reduce((best, x) => ((cuadCounts[x] ?? 0) < (cuadCounts[best] ?? 0) ? x : best), opts[0])
      orderCell[o.id] = `sin-pin:${o.district}`
    } else {
      const cell = latLngToCell(o.lat, o.lng)
      orderCell[o.id] = cell
      id = map.cellToCuad[cell] ?? nearestCuad(cell, map)
    }
    orderCuad[o.id] = id
    cuadCounts[id] = (cuadCounts[id] ?? 0) + 1
  }
  const timeMs = performance.now() - t0
  return { orderCuad, orderCell, timeMs, count: orders.length, withoutCoords, moves: [], cuadCounts }
}

/**
 * Desborde: si un cuadrante supera el máximo de paradas, propone mover casillas del borde al cuadrante vecino con espacio.
 * Cada movimiento queda como alerta aprobable en la pantalla del HUB.
 */
export function proposeOverflowMoves(a: Assignment, map: Tablero, p: Params): CellMove[] {
  const counts = { ...a.cuadCounts }
  const cellCounts: Record<string, number> = {}
  for (const [oid, cell] of Object.entries(a.orderCell)) {
    if (map.cellToCuad[cell] === a.orderCuad[oid]) cellCounts[cell] = (cellCounts[cell] ?? 0) + 1
  }
  const owner = { ...map.cellToCuad }
  const moves: CellMove[] = []
  const over = map.cuadrantes.filter((pn) => (counts[pn.id] ?? 0) > p.cuadMaxStops)
  over.sort((x, y) => (counts[y.id] ?? 0) - (counts[x.id] ?? 0))
  for (const pn of over) {
    const border = pn.cells
      .filter((c) => owner[c] === pn.id && (cellCounts[c] ?? 0) > 0)
      .map((c) => ({ c, d: haversineKm(cellCenter(c), pn.centroid) }))
      .sort((x, y) => y.d - x.d)
    for (const { c } of border) {
      if ((counts[pn.id] ?? 0) <= p.cuadMaxStops) break
      const n = cellCounts[c] ?? 0
      const opts = new Set<string>()
      for (const nb of neighbors(c)) {
        const o = owner[nb]
        if (o && o !== pn.id) opts.add(o)
      }
      let best = ''
      let bc = Infinity
      for (const o of opts) {
        const oc = counts[o] ?? 0
        if (oc + n <= p.cuadMaxStops && oc < bc) {
          bc = oc
          best = o
        }
      }
      if (!best) continue
      const before = counts[pn.id]
      moves.push({
        cell: c,
        from: pn.id,
        to: best,
        orders: n,
        reason: `${pn.name} tiene ${before} paquetes (+${before - p.cuadMaxStops} sobre el tope de ${p.cuadMaxStops})`,
      })
      owner[c] = best
      counts[pn.id] -= n
      counts[best] = (counts[best] ?? 0) + n
    }
  }
  return moves
}

/** Aplica los movimientos aprobados: los pedidos de esas casillas pasan al cuadrante vecino */
export function applyMoves(a: Assignment, moves: CellMove[]): Assignment {
  if (moves.length === 0) return a
  const byCell = new Map(moves.map((m) => [m.cell, m]))
  const orderCuad = { ...a.orderCuad }
  for (const [oid, cell] of Object.entries(a.orderCell)) {
    const m = byCell.get(cell)
    if (m && orderCuad[oid] === m.from) orderCuad[oid] = m.to
  }
  const cuadCounts: Record<string, number> = {}
  for (const id of Object.values(orderCuad)) cuadCounts[id] = (cuadCounts[id] ?? 0) + 1
  return { ...a, orderCuad, cuadCounts }
}
