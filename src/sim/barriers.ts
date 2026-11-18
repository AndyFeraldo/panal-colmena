// Barreras geográficas de Lima: vías rápidas y ríos que una moto no cruza en cualquier punto.
// Feedback del mentor (14-nov): "un cuadrante que cruza la Panamericana es complicado".
// Trazos APROXIMADOS (pocos puntos, a mano) [SUPUESTO]: suficientes para que el cálculo no junte
// casillas de lados opuestos. Con datos reales se usarían los ejes viales de OpenStreetMap.
import { cellCenter, cellIJ, cellId } from './grid'

export interface Barrier {
  id: string
  name: string
  kind: 'via' | 'rio'
  /** [lat, lng] */
  path: [number, number][]
}

export const BARRIERS: Barrier[] = [
  {
    id: 'pan-sur',
    name: 'Panamericana Sur / Vía de Evitamiento',
    kind: 'via',
    path: [
      [-12.29, -76.855],
      [-12.255, -76.89],
      [-12.215, -76.925],
      [-12.18, -76.955],
      [-12.15, -76.979],
      [-12.12, -76.985],
      [-12.087, -76.976],
      [-12.065, -76.984],
      [-12.048, -76.998],
      [-12.034, -77.018],
      [-12.03, -77.03],
    ],
  },
  {
    id: 'pan-norte',
    name: 'Panamericana Norte',
    kind: 'via',
    path: [
      [-12.03, -77.03],
      [-12.01, -77.045],
      [-11.985, -77.058],
      [-11.955, -77.065],
      [-11.925, -77.068],
      [-11.89, -77.072],
      [-11.86, -77.08],
      [-11.82, -77.11],
    ],
  },
  {
    id: 'expresa',
    name: 'Vía Expresa (Paseo de la República)',
    kind: 'via',
    path: [
      [-12.058, -77.036],
      [-12.075, -77.033],
      [-12.093, -77.029],
      [-12.11, -77.026],
      [-12.127, -77.024],
      [-12.143, -77.021],
    ],
  },
  {
    id: 'rimac',
    name: 'Río Rímac',
    kind: 'rio',
    path: [
      [-11.985, -76.86],
      [-11.995, -76.9],
      [-12.01, -76.94],
      [-12.025, -76.975],
      [-12.033, -77.005],
      [-12.039, -77.035],
      [-12.037, -77.065],
      [-12.033, -77.1],
      [-12.03, -77.14],
    ],
  },
  {
    id: 'chillon',
    name: 'Río Chillón',
    kind: 'rio',
    path: [
      [-11.86, -76.98],
      [-11.89, -77.02],
      [-11.92, -77.05],
      [-11.945, -77.09],
      [-11.96, -77.13],
    ],
  },
]

// ¿Se cruzan los segmentos p1-p2 y q1-q2? (plano lat/lng: suficiente a escala de ciudad)
function cross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
}
function segmentsIntersect(p1: [number, number], p2: [number, number], q1: [number, number], q2: [number, number]) {
  const d1 = cross(q1[0], q1[1], q2[0], q2[1], p1[0], p1[1])
  const d2 = cross(q1[0], q1[1], q2[0], q2[1], p2[0], p2[1])
  const d3 = cross(p1[0], p1[1], p2[0], p2[1], q1[0], q1[1])
  const d4 = cross(p1[0], p1[1], p2[0], p2[1], q2[0], q2[1])
  return d1 * d2 < 0 && d3 * d4 < 0
}

const linkCache = new Map<string, string | null>()

/** Barrera que separa dos casillas vecinas (o null si se puede pasar de una a otra) */
export function barrierBetween(a: string, b: string): string | null {
  const key = a < b ? `${a}|${b}` : `${b}|${a}`
  const hit = linkCache.get(key)
  if (hit !== undefined) return hit
  const ca = cellCenter(a)
  const cb = cellCenter(b)
  const p1: [number, number] = [ca.lat, ca.lng]
  const p2: [number, number] = [cb.lat, cb.lng]
  let found: string | null = null
  for (const br of BARRIERS) {
    for (let i = 0; i < br.path.length - 1 && !found; i++) {
      if (segmentsIntersect(p1, p2, br.path[i], br.path[i + 1])) found = br.id
    }
    if (found) break
  }
  linkCache.set(key, found)
  return found
}

/** Vecinas a las que se llega sin cruzar una vía rápida o un río */
export function linkedNeighbors(cell: string, respect = true): string[] {
  const [i, j] = cellIJ(cell)
  const all = [cellId(i + 1, j), cellId(i - 1, j), cellId(i, j + 1), cellId(i, j - 1)]
  return respect ? all.filter((n) => !barrierBetween(cell, n)) : all
}

/**
 * Cuadrantes partidos por una barrera: sus casillas no quedan conectadas sin cruzarla.
 * Devuelve id del cuadrante → barreras que lo parten.
 */
export function cuadrantesCrossingBarriers(cuadrantes: { id: string; cells: string[] }[]): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const q of cuadrantes) {
    if (q.cells.length < 2) continue
    const set = new Set(q.cells)
    const seen = new Set<string>([q.cells[0]])
    const stack = [q.cells[0]]
    while (stack.length) {
      const c = stack.pop()!
      for (const n of linkedNeighbors(c)) if (set.has(n) && !seen.has(n)) {
        seen.add(n)
        stack.push(n)
      }
    }
    if (seen.size === set.size) continue
    const names = new Set<string>()
    for (const c of q.cells) {
      const [i, j] = cellIJ(c)
      for (const n of [cellId(i + 1, j), cellId(i, j + 1)]) {
        if (!set.has(n)) continue
        const b = barrierBetween(c, n)
        if (b) names.add(BARRIERS.find((x) => x.id === b)!.name)
      }
    }
    out.set(q.id, [...names])
  }
  return out
}
