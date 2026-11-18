// Tablero de Lima: casillas en forma de rombo (cuadrados girados 45°) de ~8 cuadras por lado.
// Proyección local equirectangular alrededor de Lima: suficiente a escala de ciudad (error < 0,5%).
import type { LatLng } from './data'

/** Lado de la casilla en km (~8 cuadras de ~100 m) */
export const CELL_SIDE_KM = 0.8
export const CELL_AREA_KM2 = CELL_SIDE_KM * CELL_SIDE_KM

const LAT0 = -12.05
const LNG0 = -77.03
const KX = 111.32 * Math.cos((LAT0 * Math.PI) / 180) // km por grado de longitud
const KY = 110.57 // km por grado de latitud
const R2 = Math.SQRT2

/** lat/lng → coordenadas (u, v) del tablero en km, giradas 45° */
function toUV(lat: number, lng: number): [number, number] {
  const x = (lng - LNG0) * KX
  const y = (lat - LAT0) * KY
  return [(x + y) / R2, (y - x) / R2]
}

function fromUV(u: number, v: number): LatLng {
  const x = (u - v) / R2
  const y = (u + v) / R2
  return { lat: LAT0 + y / KY, lng: LNG0 + x / KX }
}

export function cellId(i: number, j: number): string {
  return `${i}:${j}`
}

export function cellIJ(cell: string): [number, number] {
  const k = cell.indexOf(':')
  return [Number(cell.slice(0, k)), Number(cell.slice(k + 1))]
}

/** Casilla que contiene el punto (búsqueda directa, sin índices: microsegundos) */
export function latLngToCell(lat: number, lng: number): string {
  const [u, v] = toUV(lat, lng)
  return cellId(Math.floor(u / CELL_SIDE_KM), Math.floor(v / CELL_SIDE_KM))
}

const centerCache = new Map<string, LatLng>()
export function cellCenter(cell: string): LatLng {
  let c = centerCache.get(cell)
  if (!c) {
    const [i, j] = cellIJ(cell)
    c = fromUV((i + 0.5) * CELL_SIDE_KM, (j + 0.5) * CELL_SIDE_KM)
    centerCache.set(cell, c)
  }
  return c
}

/** Las 4 esquinas del rombo (sur, este, norte, oeste) como [lat, lng] */
export function cellBoundary(cell: string): [number, number][] {
  const [i, j] = cellIJ(cell)
  const L = CELL_SIDE_KM
  return [
    [i, j],
    [i + 1, j],
    [i + 1, j + 1],
    [i, j + 1],
  ].map(([a, b]) => {
    const p = fromUV(a * L, b * L)
    return [p.lat, p.lng] as [number, number]
  })
}

/** Vecinos que comparten un lado (4) */
export function neighbors(cell: string): string[] {
  const [i, j] = cellIJ(cell)
  return [cellId(i + 1, j), cellId(i - 1, j), cellId(i, j + 1), cellId(i, j - 1)]
}

/** Casillas a distancia ≤ k (cuadrado de (2k+1)² casillas, incluye la propia) */
export function gridDisk(cell: string, k: number): string[] {
  const [i, j] = cellIJ(cell)
  const out: string[] = []
  for (let a = -k; a <= k; a++) for (let b = -k; b <= k; b++) out.push(cellId(i + a, j + b))
  return out
}

/** Lados de la casilla con el vecino que está al otro lado: sirve para dibujar los bordes de los cuadrantes */
export function cellEdges(cell: string): { neighbor: string; a: [number, number]; b: [number, number] }[] {
  const [i, j] = cellIJ(cell)
  const [s, e, n, w] = cellBoundary(cell)
  return [
    { neighbor: cellId(i, j - 1), a: s, b: e },
    { neighbor: cellId(i + 1, j), a: e, b: n },
    { neighbor: cellId(i, j + 1), a: n, b: w },
    { neighbor: cellId(i - 1, j), a: w, b: s },
  ]
}

/** Color de ajedrez de la casilla (0 = clara, 1 = oscura) */
export function cellParity(cell: string): 0 | 1 {
  const [i, j] = cellIJ(cell)
  return (((i + j) % 2) + 2) % 2 === 0 ? 0 : 1
}
