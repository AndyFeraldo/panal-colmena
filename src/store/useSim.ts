import { create } from 'zustand'
import { DEFAULT_PARAMS, type DemandLevel, type Params } from '../sim/params'
import type { CapacityRow, SimInput, SimResult } from '../sim/types'
import type { ApiLogEntry } from '../integration/RoutingProvider'

let worker: Worker | null = null
let capWorker: Worker | null = null
let reqId = 0
let capId = 0
let timer: ReturnType<typeof setTimeout> | null = null

function newWorker(): Worker {
  return new Worker(new URL('../workers/sim.worker.ts', import.meta.url), { type: 'module' })
}

interface SimState {
  params: Params
  level: DemandLevel
  weekday: number
  pctPin: number
  overrides: Record<string, string>
  result: SimResult | null
  running: boolean
  error: string | null
  apiLog: ApiLogEntry[]
  approvedMoves: string[] // casillas aprobadas en el HUB
  approvedTrucks: string[] // Torres con 2.º camión aprobado
  riders: Record<string, number> // decisión del admin: motorizados por cuadrante esta noche
  capacity: CapacityRow[] | null
  capacityKey: string
  capacityRunning: boolean
  demoStep: number | null
  setParams: (p: Partial<Params>) => void
  resetParams: () => void
  setLevel: (l: DemandLevel) => void
  setWeekday: (d: number) => void
  setPctPin: (v: number) => void
  moveCell: (cell: string, to: string) => void
  clearOverrides: () => void
  run: (immediate?: boolean) => void
  log: (entries: ApiLogEntry[]) => void
  clearLog: () => void
  approveMove: (cell: string) => void
  approveTruck: (torreId: string) => void
  setRiders: (cuadId: string, n: number | null) => void
  runCapacity: () => void
  setDemoStep: (s: number | null) => void
}

export const useSim = create<SimState>((set, get) => ({
  params: DEFAULT_PARAMS,
  level: 'Normal',
  weekday: 4, // viernes: Ana compra el jueves y recibe el viernes
  pctPin: DEFAULT_PARAMS.pctPinWithPinF,
  overrides: {},
  result: null,
  running: false,
  error: null,
  apiLog: [],
  approvedMoves: [],
  approvedTrucks: [],
  riders: {},
  capacity: null,
  capacityKey: '',
  capacityRunning: false,
  demoStep: null,
  setParams: (p) => {
    set((s) => ({ params: { ...s.params, ...p }, ...(p.pctPinWithPinF !== undefined ? { pctPin: p.pctPinWithPinF } : {}) }))
    get().run()
  },
  resetParams: () => {
    set({ params: DEFAULT_PARAMS, pctPin: DEFAULT_PARAMS.pctPinWithPinF, overrides: {} })
    get().run()
  },
  setLevel: (level) => {
    set({ level, overrides: {}, approvedMoves: [], approvedTrucks: [] })
    get().run()
  },
  setWeekday: (weekday) => {
    set({ weekday, approvedMoves: [], approvedTrucks: [] })
    get().run()
  },
  setPctPin: (pctPin) => {
    set({ pctPin })
    get().run()
  },
  moveCell: (cell, to) => {
    set((s) => ({ overrides: { ...s.overrides, [cell]: to } }))
    get().run(true)
  },
  clearOverrides: () => {
    set({ overrides: {} })
    get().run(true)
  },
  run: (immediate = false) => {
    if (timer) clearTimeout(timer)
    const go = () => {
      const s = get()
      const input: SimInput = { params: s.params, level: s.level, weekday: s.weekday, pctPin: s.pctPin, overrides: s.overrides }
      const id = ++reqId
      set({ running: true, error: null })
      if (!worker) worker = newWorker()
      worker.onmessage = (e: MessageEvent<{ id: number; result?: SimResult; error?: string }>) => {
        if (e.data.id !== reqId) return
        if (e.data.error) set({ running: false, error: e.data.error })
        else set({ running: false, result: e.data.result!, approvedMoves: [], approvedTrucks: [], riders: {} })
      }
      worker.postMessage({ id, input })
    }
    if (immediate) go()
    else timer = setTimeout(go, 180)
  },
  log: (entries) => set((s) => ({ apiLog: [...entries, ...s.apiLog].slice(0, 80) })),
  clearLog: () => set({ apiLog: [] }),
  approveMove: (cell) => set((s) => ({ approvedMoves: [...s.approvedMoves, cell] })),
  approveTruck: (id) => set((s) => ({ approvedTrucks: [...s.approvedTrucks, id] })),
  setRiders: (cuadId, n) =>
    set((s) => {
      const riders = { ...s.riders }
      if (n === null) delete riders[cuadId]
      else riders[cuadId] = n
      return { riders }
    }),
  /** Corre el día en los 4 niveles de demanda (Bajo · Normal · Alto · Cyber) en un worker aparte */
  runCapacity: () => {
    const s = get()
    const key = JSON.stringify([s.params, s.weekday, s.pctPin])
    if (s.capacityKey === key && (s.capacity || s.capacityRunning)) return
    const input: SimInput = { params: s.params, level: s.level, weekday: s.weekday, pctPin: s.pctPin, overrides: {} }
    if (!capWorker) capWorker = newWorker()
    const id = ++capId
    set({ capacityRunning: true, capacityKey: key, capacity: null })
    capWorker.onmessage = (e: MessageEvent<{ id: number; capacity?: unknown; error?: string }>) => {
      if (e.data.id !== capId) return
      set({ capacityRunning: false, capacity: (e.data.capacity as CapacityRow[]) ?? null })
    }
    capWorker.postMessage({ id, input, kind: 'capacity' })
  },
  setDemoStep: (demoStep) => set({ demoStep }),
}))
