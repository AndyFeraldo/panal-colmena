// Contrato entre PANAL y el software de ruteo. Hoy: SimpliRoute (lo que Falabella ya usa).
// PANAL no reemplaza nada: publica zonas, envía visitas agrupadas, pide optimizar y escucha entregas.
import type { Colmena, Order, Panal, Route } from '../sim/types'

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
  /** Panales → Zonas */
  publishZones(panales: Panal[], source: string): Promise<ApiLogEntry[]>
  /** Colmenas → Vehículos + punto de inicio (depot) */
  publishVehicles(colmenas: Colmena[], source: string): Promise<ApiLogEntry[]>
  /** Pedidos → Visitas (lat/long + etiqueta de panal) */
  sendVisits(orders: Order[], orderPanal: Record<string, string>, source: string): Promise<ApiLogEntry[]>
  /** Pedir la optimización (orden de paradas) dentro de cada panal */
  optimize(routes: Route[], source: string): Promise<ApiLogEntry[]>
  /** Registrar el webhook de entregas para que PANAL aprenda */
  registerWebhook(source: string): Promise<ApiLogEntry[]>
}
