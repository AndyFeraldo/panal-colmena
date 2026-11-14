import type { DemandLevel, Params, SizeKey } from './params'
import type { LatLng } from './data'

export interface Order extends LatLng {
  id: string
  district: string
  createdAt: number // minutos relativos a la medianoche del día de entrega (negativo = día anterior)
  wave: 1 | 2 | 3
  u: number // aleatorio [0,1) para decidir si tiene coordenadas según el % con pin
  size: SizeKey
  volume: number
  address: string
  isAna?: boolean
}

export interface Panal {
  id: string
  cells: string[]
  color: number
  centroid: LatLng
  expStops: number
  expVolume: number
  estMinutes: number
  districts: string[]
  distHubKm: number
  colmenaId: string | null
}

export interface PanalMap {
  level: DemandLevel
  weekday: number
  panales: Panal[]
  cellToPanal: Record<string, string>
  cellDemand: Record<string, number> // paradas esperadas por día
  cellDistrict: Record<string, string>
}

export interface Colmena {
  id: string
  name: string
  short: string
  lat: number
  lng: number
  panalIds: string[]
  expLoad: number
  minivans: number
  distHubKm: number
}

export interface CellMove {
  cell: string
  from: string
  to: string
  orders: number
  reason: string
}

export interface Assignment {
  orderPanal: Record<string, string>
  orderCell: Record<string, string>
  timeMs: number
  count: number
  withoutCoords: number
  moves: CellMove[]
  panalCounts: Record<string, number>
}

export type ScenarioKey = 'A' | 'B' | 'C'
export const SCENARIO_LABEL: Record<ScenarioKey, string> = {
  A: 'Hoy (distrito + FIFO)',
  B: 'PANAL',
  C: 'PANAL + Colmena',
}

export interface Stop extends LatLng {
  kind: 'delivery' | 'reload'
  orderId?: string
  eta: number
  seq: number
  serviceMin: number
}

export interface Route {
  id: string
  scenario: ScenarioKey
  label: string // panal o distrito
  panalId?: string
  depotId: string // 'HUB' o id de colmena
  depot: LatLng
  stops: Stop[]
  deliveries: number
  reloads: number
  totalKm: number
  emptyKm: number
  readyTime: number
  startTime: number
  endTime: number
  shift: 1 | 2 | 3
  onTime: boolean
  rider: string
  volume: number
}

export interface MinivanTrip {
  colmenaId: string
  minivans: number
  orders: number
  departure: number
  arrival: number
  panalIds: string[]
  secondMinivanAlert: boolean
}

export interface Kpis {
  orders: number
  routes: number
  spr: number
  pctRoutesUnder30: number
  emptyKm: number
  totalKm: number
  otd: number // % pedidos con ETA dentro del turno
  pctRoutesOnTime: number
  loadCorrect: number
  probRouteError: number
  decisionMs: number
  geocodeMin: number
  vehiclesAtHub: number
  motosFromHub: number
  minivans: number
  reloads: number
  windowHours: number
  sortEnd: number
  stopsHistogram: { bucket: string; count: number }[]
}

export interface ScenarioResult {
  key: ScenarioKey
  routes: Route[]
  kpis: Kpis
  minivanTrips: MinivanTrip[]
  orderRoute: Record<string, string>
}

export interface LearningItem {
  panalId: string
  kind: 'slow' | 'small' | 'overflow'
  message: string
  metric: string
  cell?: string
  to?: string
}

export interface SimInput {
  params: Params
  level: DemandLevel
  weekday: number
  pctPin: number // % con Pin f. para escenarios B y C
  overrides: Record<string, string> // celda -> panal (ajustes del planificador)
}

export interface SimResult {
  input: SimInput
  orders: Order[]
  map: PanalMap
  colmenas: Colmena[]
  assignment: Assignment
  scenarios: Record<ScenarioKey, ScenarioResult>
  learning: LearningItem[]
  mapAfter: Record<string, string> // cellToPanal luego del aprendizaje
  cellDifficulty: Record<string, number>
  computeMs: number
}
