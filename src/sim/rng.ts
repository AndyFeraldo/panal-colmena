import seedrandom from 'seedrandom'

export type Rng = () => number

/** Generador con semilla: misma semilla + misma etiqueta = misma secuencia */
export function makeRng(seed: number, tag: string): Rng {
  return seedrandom(`${seed}:${tag}`)
}

export function normal(rng: Rng): number {
  let u = 0
  while (u === 0) u = rng()
  const v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function pickWeighted(rng: Rng, weights: number[]): number {
  const total = weights.reduce((s, w) => s + w, 0)
  let r = rng() * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r <= 0) return i
  }
  return weights.length - 1
}

/** Tabla acumulada para muestrear rápido muchas veces */
export function cumulative(weights: number[]): number[] {
  const out: number[] = []
  let s = 0
  for (const w of weights) {
    s += w
    out.push(s)
  }
  return out.map((x) => x / s)
}

export function pickCumulative(rng: Rng, cum: number[]): number {
  const r = rng()
  let lo = 0
  let hi = cum.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cum[mid] < r) lo = mid + 1
    else hi = mid
  }
  return lo
}
