import { haversineKm } from './geo'
import { borderNeighbors, cellCenter } from './panales'
import type { Params } from './params'
import type { CellMove, LearningItem, PanalMap, ScenarioResult } from './types'

/**
 * "El panal aprende": con los tiempos reales por parada (webhooks de entrega), propone ajustes
 * medibles para la próxima semana. Devuelve la lista y el mapa celda→panal resultante.
 */
export function learnFromDay(
  result: ScenarioResult,
  map: PanalMap,
  moves: CellMove[],
  p: Params,
): { items: LearningItem[]; mapAfter: Record<string, string> } {
  const after = { ...map.cellToPanal }
  const stats = new Map<string, { stops: number; service: number }>()
  for (const r of result.routes) {
    if (!r.panalId) continue
    const s = stats.get(r.panalId) ?? { stops: 0, service: 0 }
    for (const st of r.stops) if (st.kind === 'delivery') {
      s.stops++
      s.service += st.serviceMin
    }
    stats.set(r.panalId, s)
  }
  const panalById = new Map(map.panales.map((pn) => [pn.id, pn]))
  const touched = new Set<string>()
  const items: (LearningItem & { score: number })[] = []

  const cedeCell = (fromId: string, prefer: 'smallest' | 'any'): { cell: string; to: string } | null => {
    const pn = panalById.get(fromId)
    if (!pn) return null
    const border = pn.cells
      .filter((c) => after[c] === fromId)
      .map((c) => ({ c, n: borderNeighbors(c, after), d: haversineKm(cellCenter(c), pn.centroid) }))
      .filter((x) => x.n.length > 0)
      .sort((a, b) => b.d - a.d)
    for (const b of border) {
      const opts = b.n.filter((id) => !touched.has(id))
      if (!opts.length) continue
      const to =
        prefer === 'smallest'
          ? opts.sort((x, y) => (stats.get(x)?.stops ?? 0) - (stats.get(y)?.stops ?? 0))[0]
          : opts[0]
      return { cell: b.c, to }
    }
    return null
  }

  // 1) Panales lentos (min/parada real > 120% del supuesto)
  for (const [id, s] of stats) {
    const avg = s.service / Math.max(1, s.stops)
    if (avg > p.minPerStop * 1.15 && !touched.has(id)) {
      const mv = cedeCell(id, 'smallest')
      if (!mv) continue
      after[mv.cell] = mv.to
      touched.add(id)
      touched.add(mv.to)
      items.push({
        panalId: id,
        kind: 'slow',
        metric: `${avg.toFixed(1)} min/parada`,
        message: `${id} promedió ${avg.toFixed(1).replace('.', ',')} min/parada (lento vs ${String(p.minPerStop).replace('.', ',')} supuesto) → ceder 1 celda a ${mv.to}`,
        cell: mv.cell,
        to: mv.to,
        score: avg / p.minPerStop,
      })
    }
  }
  // 2) Desbordes repetidos → mover la celda de forma permanente
  for (const m of moves) {
    if (touched.has(m.from) || touched.has(m.to)) continue
    after[m.cell] = m.to
    touched.add(m.from)
    touched.add(m.to)
    items.push({
      panalId: m.from,
      kind: 'overflow',
      metric: `+${m.orders} pedidos`,
      message: `${m.from} se desbordó esta noche (${m.reason.split('(')[1]?.replace(')', '') ?? ''}) → pasar la celda a ${m.to} de forma permanente`,
      cell: m.cell,
      to: m.to,
      score: 1.2,
    })
  }
  // 3) Panales chicos → absorber celda del vecino más grande
  for (const [id, s] of stats) {
    if (s.stops >= p.panalMinStops || touched.has(id)) continue
    const pn = panalById.get(id)
    if (!pn) continue
    const neigh = new Set<string>()
    for (const c of pn.cells) for (const n of borderNeighbors(c, after)) neigh.add(n)
    const big = [...neigh].filter((x) => !touched.has(x)).sort((a, b) => (stats.get(b)?.stops ?? 0) - (stats.get(a)?.stops ?? 0))[0]
    if (!big) continue
    const donor = panalById.get(big)!
    const cand = donor.cells
      .filter((c) => after[c] === big && borderNeighbors(c, after).includes(id))
      .sort((a, b) => haversineKm(cellCenter(a), pn.centroid) - haversineKm(cellCenter(b), pn.centroid))[0]
    if (!cand) continue
    after[cand] = id
    touched.add(id)
    touched.add(big)
    items.push({
      panalId: id,
      kind: 'small',
      metric: `${s.stops} paradas`,
      message: `${id} solo tuvo ${s.stops} paradas → recibir 1 celda de ${big} (${stats.get(big)?.stops ?? 0} paradas)`,
      cell: cand,
      to: id,
      score: 1 + (p.panalMinStops - s.stops) / p.panalMinStops,
    })
  }
  items.sort((a, b) => b.score - a.score)
  return { items: items.slice(0, 12).map(({ score: _s, ...rest }) => rest), mapAfter: after }
}
