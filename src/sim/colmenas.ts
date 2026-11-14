import { HUB, type ColmenaPoint } from './data'
import { haversineKm } from './geo'
import type { Params } from './params'
import type { Colmena, Panal } from './types'

/**
 * Asigna panales lejanos (> distancia mínima al HUB) al punto Colmena más cercano dentro de su alcance,
 * hasta la capacidad de las minivanes del día (1 en Bajo/Normal/Alto, 2 en Cyber).
 * Los panales que no entran salen directo del HUB.
 */
export function assignColmenas(
  panales: Panal[],
  points: ColmenaPoint[],
  p: Params,
  minivansPerColmena: number,
): Colmena[] {
  const colmenas: Colmena[] = points.map((pt) => ({
    id: pt.id,
    name: pt.name,
    short: pt.short,
    lat: pt.lat,
    lng: pt.lng,
    panalIds: [],
    expLoad: 0,
    minivans: 0,
    distHubKm: haversineKm(pt, HUB),
  }))
  const candidates: { panal: Panal; col: Colmena; d: number }[] = []
  for (const pn of panales) {
    pn.colmenaId = null
    if (pn.distHubKm <= p.colmenaMinDistKm) continue
    let best: Colmena | null = null
    let bd = Infinity
    for (const c of colmenas) {
      const d = haversineKm(pn.centroid, c)
      if (d < bd) {
        bd = d
        best = c
      }
    }
    if (best && bd <= p.colmenaReachKm && bd < pn.distHubKm) candidates.push({ panal: pn, col: best, d: bd })
  }
  // primero los panales más cercanos a su Colmena (mayor beneficio por viaje de minivan)
  candidates.sort((a, b) => a.d - b.d)
  for (const { panal, col } of candidates) {
    const cap = p.minivanCapacity * minivansPerColmena
    if (col.expLoad + panal.expStops > cap) continue
    col.expLoad += panal.expStops
    col.panalIds.push(panal.id)
    panal.colmenaId = col.id
  }
  for (const c of colmenas) c.minivans = c.expLoad > 0 ? Math.max(1, Math.ceil(c.expLoad / p.minivanCapacity)) : 0
  return colmenas
}
