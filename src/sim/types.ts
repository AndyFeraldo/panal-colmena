import type { DemandLevel, Params, SizeKey, TorreVehicle } from './params'
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

/** Cuadrante = grupo de casillas vecinas = 1 ruta estática de ≤50 paquetes */
export interface Cuadrante {
  id: string // id interno estable (Q-07): lo usan los ajustes del planificador
  name: string // nombre visible: letra de su Torre + número (A3) o H + número si sale del HUB (H12)
  cells: string[]
  color: number
  centroid: LatLng
  expStops: number
  expVolume: number
  estMinutes: number
  districts: string[]
  distHubKm: number
  torreId: string | null
}

/** El tablero del día: casillas → cuadrantes para un nivel de demanda y día de la semana */
export interface Tablero {
  level: DemandLevel
  weekday: number
  cuadrantes: Cuadrante[]
  cellToCuad: Record<string, string>
  cellDemand: Record<string, number> // paquetes esperados por casilla y día
  cellDistrict: Record<string, string>
}

/**
 * Torre = vehículo reabastecedor MÓVIL (camión o van) que sale del HUB con las cajas ya armadas por moto,
 * se cita con sus motos en el punto de encuentro (lat/lng = punto medio de sus cuadrantes) a horas fijas
 * y entre citas va a la tienda Saga de su zona. No se queda estacionado en la calle.
 */
export interface Torre {
  id: string
  letter: string // A, B, C… (da nombre a sus cuadrantes)
  name: string
  short: string
  store: string // tienda Saga de la zona
  storeLat: number
  storeLng: number
  lat: number // punto de encuentro con las motos
  lng: number
  cuadIds: string[]
  expLoad: number
  trucks: number // cantidad de vehículos (camiones o vans)
  vehicle: TorreVehicle
  distHubKm: number
  savedKm: number // paquetes × km de moto ahorrados (para elegir dónde vale la pena una Torre)
}

/** Un tramo del día de la Torre */
export interface TorreLeg {
  time: number // minutos desde medianoche
  kind: 'carga' | 'cita' | 'tienda' | 'regreso'
  place: string
  lat: number
  lng: number
  motos: number // motos que recogen caja en esta cita
  boxes: number // cajas entregadas en esta cita
  note: string
}

export interface CellMove {
  cell: string
  from: string
  to: string
  orders: number
  reason: string
}

/** Paquetes que pasan a un cuadrante vecino con espacio (ruta alternativa) */
export interface Spill {
  from: string
  to: string
  orders: number
}

/** Un cuadrante con más de 50 paquetes esta noche se reparte por zona entre 2+ motorizados */
export interface RiderSplit {
  cuadId: string
  orders: number
  parts: { cells: string[]; orders: number }[]
}

export interface Assignment {
  orderCuad: Record<string, string>
  orderCell: Record<string, string>
  timeMs: number
  count: number
  withoutCoords: number
  moves: CellMove[]
  cuadCounts: Record<string, number>
}

export type ScenarioKey = 'A' | 'B' | 'C'
export const SCENARIO_LABEL: Record<ScenarioKey, string> = {
  A: 'Hoy (distrito + FIFO)',
  B: 'Tablero f. (sin Torre)',
  C: 'TORRE f.',
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
  label: string // cuadrante o distrito
  cuadId?: string
  part?: number // 1, 2… si el cuadrante se repartió entre varios motorizados
  depotId: string // 'HUB' o id de la Torre
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

export interface TorreTrip {
  torreId: string
  trucks: number
  orders: number
  departure: number
  arrival: number
  cuadIds: string[]
  secondTruckAlert: boolean
  vehicle: TorreVehicle
  itinerary: TorreLeg[]
}

export interface Kpis {
  orders: number
  routes: number
  spr: number
  pctRoutesUnder30: number
  maxStops: number
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
  motosNeeded: number // motorizados distintos: el turno con más rutas
  trucks: number
  reloads: number
  windowHours: number
  sortEnd: number
  stopsHistogram: { bucket: string; count: number }[]
}

export interface ScenarioResult {
  key: ScenarioKey
  routes: Route[]
  kpis: Kpis
  torreTrips: TorreTrip[]
  splits: RiderSplit[]
  spills: Spill[] // paquetes que pasaron a un cuadrante vecino con espacio
  orderRoute: Record<string, string>
}

export interface LearningItem {
  cuadId: string
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
  pctPin: number // % con Pin f. para los escenarios B y C
  overrides: Record<string, string> // casilla -> cuadrante (ajustes del planificador)
}

export interface SimResult {
  input: SimInput
  orders: Order[]
  map: Tablero
  torres: Torre[]
  assignment: Assignment
  scenarios: Record<ScenarioKey, ScenarioResult>
  learning: LearningItem[]
  mapAfter: Record<string, string> // cellToCuad luego del aprendizaje
  cellDifficulty: Record<string, number>
  computeMs: number
}

/** Capacidad necesaria por nivel de demanda (motorizados y camiones) */
export interface CapacityRow {
  level: DemandLevel
  orders: number
  routesToday: number
  motosToday: number
  routesTorre: number
  motosTorre: number
  torres: number
  trucks: number
  sortEnd: number
  otdToday: number
  otdTorre: number
  maxStopsTorre: number
}
