// Contrato entre el Tablero f. y el software de ruteo. Hoy: SimpliRoute (lo que Falabella ya usa).
// TORRE f. no reemplaza nada: publica zonas, envía visitas agrupadas, pide optimizar y escucha entregas.
import type { Torre, Order, Cuadrante, Route } from '../sim/types'

export interface ApiLogEntry {
  id: string
  at: string // hora local de la demo
  method: 'GET' | 'POST' | 'PUT'
  endpoint: string
  summary: string
  source: string // pantalla que originó la llamada
  body: unknown
  response: unknown
  status: number
}

export interface RoutingProvider {
  readonly name: string
  /** Cuadrantes → Zonas */
  publishZones(cuadrantes: Cuadrante[], source: string): Promise<ApiLogEntry[]>
  /** Torres → Vehículos + punto de inicio (depot) */
  publishVehicles(torres: Torre[], source: string): Promise<ApiLogEntry[]>
  /** Pedidos → Visitas (lat/long + etiqueta de cuadrante: nombre visible A1, H3…) */
  sendVisits(orders: Order[], orderCuad: Record<string, string>, source: string): Promise<ApiLogEntry[]>
  /** Admin: un cuadrante con más de 50 paquetes se reparte por zona entre 2+ motorizados (sub-zonas) */
  splitZone(cuadName: string, parts: { rider: string; orders: number }[], source: string): Promise<ApiLogEntry[]>
  /** Pedir la optimización (orden de paradas) dentro de cada cuadrante */
  optimize(routes: Route[], source: string): Promise<ApiLogEntry[]>
  /** Registrar el webhook de entregas para que el Tablero f. aprenda */
  registerWebhook(source: string): Promise<ApiLogEntry[]>
}
