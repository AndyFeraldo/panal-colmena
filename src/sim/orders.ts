import { latLngToCell } from 'h3-js'
import { ANA, DISTRICTS, STREETS, type District, type LatLng } from './data'
import { pointInDistrict } from './geo'
import { SIZE_KEYS, avgVolume, type DemandLevel, type Params } from './params'
import { cumulative, makeRng, normal, pickCumulative, type Rng } from './rng'
import type { Order } from './types'

export const H3_RES = 8

// Curva de ventas del día anterior (00h..23h): baja de madrugada, cae en el almuerzo, sube fuerte 17:00–24:00 [ENTREVISTA]
const SALES_CURVE = [1, 0.6, 0.4, 0.3, 0.3, 0.4, 0.8, 1.5, 2.5, 3.2, 3.5, 3.4, 2.6, 2.3, 2.8, 3.3, 3.8, 5, 6.5, 7.5, 8.2, 8.5, 7.8, 6]
const SALES_CUM = cumulative(SALES_CURVE)
const DISTRICT_CUM = cumulative(DISTRICTS.map((d) => d.weight))

/** Punto aleatorio dentro del distrito: normal alrededor del centro, descartando lo que cae fuera (mar u otro distrito) */
export function samplePoint(rng: Rng, d: District): LatLng {
  const sigma = d.radiusKm * 1.0
  const cos = Math.cos((d.center.lat * Math.PI) / 180)
  for (let t = 0; t < 25; t++) {
    const p = {
      lat: d.center.lat + (normal(rng) * sigma) / 111.32,
      lng: d.center.lng + (normal(rng) * sigma) / (111.32 * cos),
    }
    if (pointInDistrict(d, p)) return p
  }
  return { ...d.center }
}

export function ordersForDay(p: Params, level: DemandLevel, weekday: number): number {
  const mult = p.levelMult[level] * (weekday === 0 ? 1 + p.mondayPeak : 1)
  return Math.round(p.ordersPerDay * mult)
}

/** Pedidos del día (sintéticos, con semilla). Incluye siempre el pedido de Ana. */
export function generateOrders(p: Params, level: DemandLevel, weekday: number): Order[] {
  const n = ordersForDay(p, level, weekday)
  const rng = makeRng(p.seed, `orders:${level}:${weekday}:${n}`)
  const mix = cumulative(level === 'Cyber' ? p.sizeMixCyber : p.sizeMixNormal)
  const orders: Order[] = []
  for (let i = 0; i < n - 1; i++) {
    const d = DISTRICTS[pickCumulative(rng, DISTRICT_CUM)]
    const pt = samplePoint(rng, d)
    const hour = pickCumulative(rng, SALES_CUM)
    const createdAt = -1440 + hour * 60 + Math.floor(rng() * 60)
    const size = SIZE_KEYS[pickCumulative(rng, mix)]
    orders.push({
      id: `F-${String(100000 + Math.floor(rng() * 899999))}`,
      lat: pt.lat,
      lng: pt.lng,
      district: d.name,
      createdAt,
      wave: 3,
      u: rng(),
      size,
      volume: p.sizeVolumes[size],
      address: `${STREETS[Math.floor(rng() * STREETS.length)]} ${100 + Math.floor(rng() * 2900)}, ${d.name}`,
    })
  }
  // Ana compra el jueves a las 21:00 con Pin f. (siempre con coordenadas)
  orders.push({
    id: ANA.id,
    lat: ANA.lat,
    lng: ANA.lng,
    district: 'Miraflores',
    createdAt: -180,
    wave: 3,
    u: 0,
    size: 'XS',
    volume: p.sizeVolumes.XS,
    address: ANA.address,
    isAna: true,
  })
  // ids únicos
  const seen = new Set<string>()
  for (const o of orders) {
    while (seen.has(o.id)) o.id = `F-${String(Number(o.id.slice(2)) + 1)}`
    seen.add(o.id)
  }
  // Oleadas según hora de compra: el 15% más temprano sale a las 14:00, el siguiente 25% a las 19:00, el 60% restante a las 02:30 [RETO]
  const sorted = [...orders].sort((a, b) => a.createdAt - b.createdAt)
  const c1 = Math.round(sorted.length * p.waveShares[0])
  const c2 = c1 + Math.round(sorted.length * p.waveShares[1])
  sorted.forEach((o, i) => {
    o.wave = i < c1 ? 1 : i < c2 ? 2 : 3
  })
  return orders
}

export interface History {
  share: Record<string, number> // fracción de la demanda diaria que cae en cada celda
  cellDistrict: Record<string, string>
  weeks: number
  samples: number
}

/** Historial sintético de 8 semanas → demanda relativa por celda H3 y distrito dominante de cada celda */
export function buildHistory(p: Params, weeks = 8, perDay = 4000): History {
  const rng = makeRng(p.seed, 'history')
  const counts: Record<string, number> = {}
  const distCounts: Record<string, Record<string, number>> = {}
  const samples = weeks * perDay
  for (let i = 0; i < samples; i++) {
    const d = DISTRICTS[pickCumulative(rng, DISTRICT_CUM)]
    const pt = samplePoint(rng, d)
    const cell = latLngToCell(pt.lat, pt.lng, H3_RES)
    counts[cell] = (counts[cell] ?? 0) + 1
    const dc = (distCounts[cell] ??= {})
    dc[d.name] = (dc[d.name] ?? 0) + 1
  }
  const share: Record<string, number> = {}
  const cellDistrict: Record<string, string> = {}
  for (const [cell, c] of Object.entries(counts)) {
    share[cell] = c / samples
    cellDistrict[cell] = Object.entries(distCounts[cell]).sort((a, b) => b[1] - a[1])[0][0]
  }
  return { share, cellDistrict, weeks, samples }
}

export function expectedDemand(h: History, p: Params, level: DemandLevel, weekday: number): Record<string, number> {
  const n = ordersForDay(p, level, weekday)
  const out: Record<string, number> = {}
  for (const [cell, s] of Object.entries(h.share)) out[cell] = s * n
  return out
}

export { avgVolume }
