/// <reference lib="webworker" />
// La simulación pesada corre aquí para no congelar la pantalla
import { capacityByLevel, runSimulation, seasonMaps } from '../sim/simulate'
import type { SimInput } from '../sim/types'

self.onmessage = (e: MessageEvent<{ id: number; input: SimInput; kind?: 'sim' | 'capacity' | 'seasons' }>) => {
  try {
    const k = e.data.kind
    const payload =
      k === 'capacity'
        ? { capacity: capacityByLevel(e.data.input) }
        : k === 'seasons'
          ? { seasons: seasonMaps(e.data.input) }
          : { result: runSimulation(e.data.input) }
    ;(self as unknown as Worker).postMessage({ id: e.data.id, ...payload })
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id: e.data.id, error: String(err) })
  }
}
