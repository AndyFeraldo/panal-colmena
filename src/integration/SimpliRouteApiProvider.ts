/**
 * ESQUELETO (no se usa en la demo). Cómo sería la integración real con la API pública de SimpliRoute.
 *
 * - Base: https://api.simpliroute.com/v1/
 * - Documentación: https://documentation.simpliroute.com/es/
 * - Autenticación: header `Authorization: Token <token>`.
 * - El token NUNCA va en el repositorio ni en el navegador: debe vivir en un backend del Tablero f.
 *   (variable de entorno SIMPLIROUTE_TOKEN en el servidor). Esta web estática no hace llamadas reales.
 * - Pendiente: confirmar con Falabella si su licencia incluye acceso a la API.
 */
import type { RoutingProvider } from './RoutingProvider'

export class SimpliRouteApiProvider implements RoutingProvider {
  readonly name = 'SimpliRoute (API real — deshabilitada en la demo)'
  private fail(): never {
    throw new Error('Integración real deshabilitada: la demo usa MockSimpliRouteProvider')
  }
  publishZones = async () => this.fail()
  publishVehicles = async () => this.fail()
  sendVisits = async () => this.fail()
  splitZone = async () => this.fail()
  optimize = async () => this.fail()
  registerWebhook = async () => this.fail()
}
