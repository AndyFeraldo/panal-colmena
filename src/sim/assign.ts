import { gridDisk, latLngToCell } from 'h3-js'
import { DISTRICTS } from './data'
import { haversineKm } from './geo'
import { H3_RES } from './orders'
import { cellCenter, neighbors } from './panales'
import type { Params } from './params'
import type { Assignment, CellMove, Order, PanalMap } from './types'

const districtCenter = new Map(DISTRICTS.map((d) => [d.name, d.center]))

function nearestPanal(cell: string, map: PanalMap): string {
  for (let k = 1; k <= 4; k++) {
    for (const n of gridDisk(cell, k)) {
      const id = map.cellToPanal[n]
      if (id) return id
    }
  }
  const c = cellCenter(cell)
  let best = map.panales[0].id
  let bd = Infinity
  for (const pn of map.panales) {
    const d = haversineKm(c, pn.centroid)
    if (d < bd) {
      bd = d
      best = pn.id
    }
  }
  return best
}

/**
 * Asignación nocturna: lat/lng → celda H3 → panal (lookup en un diccionario).
 * Pedidos sin coordenadas caen en el centro de su distrito (peor asignación).
 */
export function assignOrders(orders: Order[], map: PanalMap, pctPin: number): Assignment {
  const orderPanal: Record<string, string> = {}
  const orderCell: Record<string, string> = {}
  let withoutCoords = 0
  const panalCounts: Record<string, number> = {}
  const centerPanales = new Map<string, string[]>()
  const t0 = performance.now()
  for (const o of orders) {
    let id: string
    if (o.u >= pctPin) {
      // Sin coordenadas: el pedido solo se conoce por su distrito. Cae cerca del centro del distrito,
      // repartido entre los panales que rodean ese centro (asignación peor que con pin).
      withoutCoords++
      let opts = centerPanales.get(o.district)
      if (!opts) {
        const c = districtCenter.get(o.district)!
        const cc = latLngToCell(c.lat, c.lng, H3_RES)
        opts = [...new Set(gridDisk(cc, 2).map((x) => map.cellToPanal[x]).filter(Boolean))]
        if (!opts.length) opts = [nearestPanal(cc, map)]
        centerPanales.set(o.district, opts)
      }
      id = opts.reduce((best, x) => ((panalCounts[x] ?? 0) < (panalCounts[best] ?? 0) ? x : best), opts[0])
      orderCell[o.id] = `sin-pin:${o.district}`
    } else {
      const cell = latLngToCell(o.lat, o.lng, H3_RES)
      orderCell[o.id] = cell
      id = map.cellToPanal[cell] ?? nearestPanal(cell, map)
    }
    orderPanal[o.id] = id
    panalCounts[id] = (panalCounts[id] ?? 0) + 1
  }
  const timeMs = performance.now() - t0
  return { orderPanal, orderCell, timeMs, count: orders.length, withoutCoords, moves: [], panalCounts }
}

/**
 * Desborde: si un panal supera el máximo de paradas, propone mover celdas del borde al panal vecino con espacio.
 * Cada movimiento queda como alerta aprobable en la pantalla del HUB.
 */
export function proposeOverflowMoves(a: Assignment, map: PanalMap, p: Params): CellMove[] {
  const counts = { ...a.panalCounts }
  const cellCounts: Record<string, number> = {}
  for (const [oid, cell] of Object.entries(a.orderCell)) {
    if (map.cellToPanal[cell] === a.orderPanal[oid]) cellCounts[cell] = (cellCounts[cell] ?? 0) + 1
  }
  const owner = { ...map.cellToPanal }
  const moves: CellMove[] = []
  const over = map.panales.filter((pn) => (counts[pn.id] ?? 0) > p.panalMaxStops)
  over.sort((x, y) => (counts[y.id] ?? 0) - (counts[x.id] ?? 0))
  for (const pn of over) {
    const border = pn.cells
      .filter((c) => owner[c] === pn.id && (cellCounts[c] ?? 0) > 0)
      .map((c) => ({ c, d: haversineKm(cellCenter(c), pn.centroid) }))
      .sort((x, y) => y.d - x.d)
    for (const { c } of border) {
      if ((counts[pn.id] ?? 0) <= p.panalMaxStops) break
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
        if (oc + n <= p.panalMaxStops && oc < bc) {
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
        reason: `${pn.id} tiene ${before} pedidos (+${before - p.panalTargetStops} sobre el objetivo)`,
      })
      owner[c] = best
      counts[pn.id] -= n
      counts[best] = (counts[best] ?? 0) + n
    }
  }
  return moves
}

/** Aplica los movimientos aprobados: los pedidos de esas celdas pasan al panal vecino */
export function applyMoves(a: Assignment, moves: CellMove[]): Assignment {
  if (moves.length === 0) return a
  const byCell = new Map(moves.map((m) => [m.cell, m]))
  const orderPanal = { ...a.orderPanal }
  for (const [oid, cell] of Object.entries(a.orderCell)) {
    const m = byCell.get(cell)
    if (m && orderPanal[oid] === m.from) orderPanal[oid] = m.to
  }
  const panalCounts: Record<string, number> = {}
  for (const id of Object.values(orderPanal)) panalCounts[id] = (panalCounts[id] ?? 0) + 1
  return { ...a, orderPanal, panalCounts }
}
