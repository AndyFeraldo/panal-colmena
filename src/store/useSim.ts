import { create } from 'zustand'
import { DEFAULT_PARAMS, type DemandLevel, type Params } from '../sim/params'
import type { SimInput, SimResult } from '../sim/types'
import type { ApiLogEntry } from '../integration/RoutingProvider'

let worker: Worker | null = null
let reqId = 0
let timer: ReturnType<typeof setTimeout> | null = null

function getWorker(): Worker {
  if (!worker) worker = new Worker(new URL('../workers/sim.worker.ts', import.meta.url), { type: 'module' })
  return worker
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
  approvedMoves: string[] // celdas aprobadas en el HUB
  approvedMinivans: string[] // colmenas con 2.ª minivan aprobada
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
  approveMinivan: (colmenaId: string) => void
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
  approvedMinivans: [],
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
    set({ level, overrides: {}, approvedMoves: [], approvedMinivans: [] })
    get().run()
  },
  setWeekday: (weekday) => {
    set({ weekday, approvedMoves: [], approvedMinivans: [] })
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
      const w = getWorker()
      w.onmessage = (e: MessageEvent<{ id: number; result?: SimResult; error?: string }>) => {
        if (e.data.id !== reqId) return
        if (e.data.error) set({ running: false, error: e.data.error })
        else set({ running: false, result: e.data.result!, approvedMoves: [], approvedMinivans: [] })
      }
      w.postMessage({ id, input })
    }
    if (immediate) go()
    else timer = setTimeout(go, 180)
  },
  log: (entries) => set((s) => ({ apiLog: [...entries, ...s.apiLog].slice(0, 80) })),
  clearLog: () => set({ apiLog: [] }),
  approveMove: (cell) => set((s) => ({ approvedMoves: [...s.approvedMoves, cell] })),
  approveMinivan: (id) => set((s) => ({ approvedMinivans: [...s.approvedMinivans, id] })),
  setDemoStep: (demoStep) => set({ demoStep }),
}))
