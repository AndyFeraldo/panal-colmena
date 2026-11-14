// Supuestos de la simulación. Todos editables en la pantalla "Supuestos" (P10).
// Cada valor indica su origen: RETO (bases/PPT), ENTREVISTA, SUPUESTO (equipo) o DISEÑO.

export type SourceKind = 'RETO' | 'ENTREVISTA' | 'SUPUESTO' | 'DISEÑO'

export type DemandLevel = 'Bajo' | 'Normal' | 'Alto' | 'Cyber'
export const DEMAND_LEVELS: DemandLevel[] = ['Bajo', 'Normal', 'Alto', 'Cyber']

export interface Params {
  ordersPerDay: number
  levelMult: Record<DemandLevel, number>
  mondayPeak: number // +20% => 0.2
  waveShares: [number, number, number] // 14:00, 19:00, 02:30
  hubCapacityPerHour: number
  pctPinToday: number // % pedidos con coordenadas hoy
  pctPinWithPinF: number // % con Pin f.
  geocodeMinPerOrder: number
  motoSpeedKmh: number
  detourFactor: number
  minPerStop: number
  backpackDm3: number
  sizeVolumes: Record<SizeKey, number>
  sizeMixNormal: number[] // XS3, XS2, XS, S, M
  sizeMixCyber: number[]
  panalTargetStops: number
  panalMaxStops: number
  panalMergeMax: number
  panalMinStops: number
  colmenaMinDistKm: number
  colmenaReachKm: number
  minivanCapacity: number
  minivanSpeedKmh: number
  loadErrorManual: number
  loadErrorScan: number
  reloadMinutes: number
  shiftShares: [number, number, number] // reparto de rutas por turno
  seed: number
}

export type SizeKey = 'XS3' | 'XS2' | 'XS' | 'S' | 'M'
export const SIZE_KEYS: SizeKey[] = ['XS3', 'XS2', 'XS', 'S', 'M']

export const DEFAULT_PARAMS: Params = {
  ordersPerDay: 4000,
  levelMult: { Bajo: 0.7, Normal: 1, Alto: 1.4, Cyber: 2 },
  mondayPeak: 0.2,
  waveShares: [0.15, 0.25, 0.6],
  hubCapacityPerHour: 700,
  pctPinToday: 0.6,
  pctPinWithPinF: 0.95,
  geocodeMinPerOrder: 1.5,
  motoSpeedKmh: 18,
  detourFactor: 1.3,
  minPerStop: 3.5,
  backpackDm3: 120,
  sizeVolumes: { XS3: 0.5, XS2: 1, XS: 2, S: 4, M: 8 },
  sizeMixNormal: [0.3, 0.25, 0.2, 0.15, 0.1],
  sizeMixCyber: [0.2, 0.2, 0.2, 0.22, 0.18],
  panalTargetStops: 48,
  panalMaxStops: 55,
  panalMergeMax: 62,
  panalMinStops: 30,
  colmenaMinDistKm: 10,
  colmenaReachKm: 8,
  minivanCapacity: 400,
  minivanSpeedKmh: 28,
  loadErrorManual: 0.005,
  loadErrorScan: 0.0005,
  reloadMinutes: 10,
  shiftShares: [0.5, 0.35, 0.15],
  seed: 2026,
}

// Turnos de motorizado [RETO]: minutos desde la medianoche del día de entrega
export const SHIFTS = [
  { id: 1, label: '06:00–11:00', start: 6 * 60, end: 11 * 60 },
  { id: 2, label: '12:00–17:00', start: 12 * 60, end: 17 * 60 },
  { id: 3, label: '18:00–21:00', start: 18 * 60, end: 21 * 60 },
] as const

// Oleadas CD → HUB [RETO]; minutos relativos a la medianoche del día de entrega (negativos = día anterior)
export const WAVES = [
  { id: 1, label: '14:00', time: -10 * 60 },
  { id: 2, label: '19:00', time: -5 * 60 },
  { id: 3, label: '02:30', time: 2 * 60 + 30 },
] as const

export const TARGETS = { otd: 0.96, spr: 50, load: 0.999 }

export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export interface ParamMeta {
  key: string
  label: string
  source: SourceKind
  unit?: string
  note?: string
  // ruta dentro de Params y escala para mostrar (p. ej. 100 para %)
  get: (p: Params) => number
  set: (p: Params, v: number) => Params
  display?: number // multiplicador para mostrar
  step?: number
  min?: number
  max?: number
}

const simple = (
  key: keyof Params,
  label: string,
  source: SourceKind,
  unit?: string,
  display = 1,
  extra: Partial<ParamMeta> = {},
): ParamMeta => ({
  key,
  label,
  source,
  unit,
  display,
  get: (p) => p[key] as number,
  set: (p, v) => ({ ...p, [key]: v }),
  ...extra,
})

export const PARAM_META: ParamMeta[] = [
  simple('ordersPerDay', 'Pedidos miniticket a domicilio por día (Lima)', 'SUPUESTO', 'pedidos', 1, { min: 2000, max: 8000, step: 100 }),
  simple('mondayPeak', 'Pico de lunes', 'ENTREVISTA', '%', 100, { note: 'Cualitativo: "los lunes hay picos"', step: 1 }),
  simple('hubCapacityPerHour', 'Capacidad de clasificación del HUB XD', 'RETO', 'ped/h', 1, { step: 50 }),
  simple('pctPinToday', '% pedidos con coordenadas hoy', 'SUPUESTO', '%', 100, { note: 'Entrevista: "muchas no tienen"', step: 1 }),
  simple('pctPinWithPinF', '% pedidos con coordenadas con Pin f.', 'SUPUESTO', '%', 100, { step: 1 }),
  simple('geocodeMinPerOrder', 'Geocodificación manual por dirección', 'SUPUESTO', 'min', 1, { step: 0.1 }),
  simple('motoSpeedKmh', 'Velocidad de la moto en ciudad', 'SUPUESTO', 'km/h', 1, { step: 1 }),
  simple('detourFactor', 'Factor de rodeo (calles vs. línea recta)', 'SUPUESTO', '×', 1, { step: 0.05 }),
  simple('minPerStop', 'Tiempo por parada', 'SUPUESTO', 'min', 1, { step: 0.1 }),
  simple('backpackDm3', 'Capacidad de la mochila', 'SUPUESTO', 'dm³', 1, { note: 'Entrevista: tallas por volumen', step: 5 }),
  simple('panalTargetStops', 'Objetivo de paradas por panal', 'SUPUESTO', 'paradas', 1, { note: 'Meta SPR 50', step: 1 }),
  simple('panalMaxStops', 'Máximo de paradas por panal', 'SUPUESTO', 'paradas', 1, { step: 1 }),
  simple('colmenaMinDistKm', 'Distancia mínima al HUB para usar Colmena', 'SUPUESTO', 'km', 1, { step: 0.5 }),
  simple('colmenaReachKm', 'Alcance máximo de un punto Colmena', 'SUPUESTO', 'km', 1, { step: 0.5 }),
  simple('minivanCapacity', 'Capacidad de la minivan Colmena', 'SUPUESTO', 'pedidos', 1, { step: 10 }),
  simple('minivanSpeedKmh', 'Velocidad de la minivan (madrugada)', 'SUPUESTO', 'km/h', 1, { step: 1 }),
  simple('loadErrorManual', 'Error de carga por pedido (manual)', 'SUPUESTO', '%', 100, { step: 0.01 }),
  simple('loadErrorScan', 'Error de carga por pedido (escaneo doble)', 'SUPUESTO', '%', 100, { step: 0.01 }),
  simple('reloadMinutes', 'Tiempo de recarga de mochila', 'SUPUESTO', 'min', 1, { step: 1 }),
  simple('seed', 'Semilla aleatoria (demo reproducible)', 'DISEÑO', '', 1, { step: 1 }),
]

export function avgVolume(p: Params, cyber: boolean): number {
  const mix = cyber ? p.sizeMixCyber : p.sizeMixNormal
  return SIZE_KEYS.reduce((s, k, i) => s + p.sizeVolumes[k] * mix[i], 0)
}

export function dayMultiplier(p: Params, level: DemandLevel, weekday: number): number {
  return p.levelMult[level] * (weekday === 0 ? 1 + p.mondayPeak : 1)
}
