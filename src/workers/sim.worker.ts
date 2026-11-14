/// <reference lib="webworker" />
// La simulación pesada corre aquí para no congelar la pantalla
import { runSimulation } from '../sim/simulate'
import type { SimInput } from '../sim/types'

self.onmessage = (e: MessageEvent<{ id: number; input: SimInput }>) => {
  try {
    const result = runSimulation(e.data.input)
    ;(self as unknown as Worker).postMessage({ id: e.data.id, result })
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id: e.data.id, error: String(err) })
  }
}
