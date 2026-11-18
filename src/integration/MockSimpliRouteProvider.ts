// Integración SIMULADA: no hace llamadas reales. Genera el log de lo que el Tablero f. enviaría.
// Los cuerpos JSON son ejemplos simplificados; deben validarse contra https://documentation.simpliroute.com/es/
import { cellBoundary } from '../sim/grid'
import { fmtTime } from '../sim/geo'
import type { Torre, Order, Cuadrante, Route } from '../sim/types'
import type { ApiLogEntry, RoutingProvider } from './RoutingProvider'

let seq = 0
const now = () => new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function entry(e: Omit<ApiLogEntry, 'id' | 'at' | 'status'> & { status?: number }): ApiLogEntry {
  return { id: `api-${++seq}`, at: now(), status: e.status ?? 201, ...e }
}

const sample = <T,>(arr: T[], n: number) => arr.slice(0, n)

export class MockSimpliRouteProvider implements RoutingProvider {
  readonly name = 'SimpliRoute (simulado)'

  async publishZones(cuadrantes: Cuadrante[], source: string) {
    const zones = cuadrantes.map((p) => ({
      name: p.name,
      // contorno simplificado: borde de la primera casilla (ejemplo)
      coordinates: cellBoundary(p.cells[0]).map(([lat, lng]) => ({ lat: +lat.toFixed(5), lng: +lng.toFixed(5) })),
      meta: { casillas: p.cells.length, max_paquetes: 50, torre: p.torreId ?? 'HUB', expected_stops: Math.round(p.expStops), districts: p.districts },
    }))
    return [
      entry({
        method: 'POST',
        endpoint: '/v1/zones/',
        summary: `${cuadrantes.length} cuadrantes publicados como Zonas`,
        source,
        body: { zones: sample(zones, 2), '…': `${Math.max(0, zones.length - 2)} zonas más` },
        response: { created: zones.length, ids: sample(zones, 3).map((_, i) => 90100 + i) },
      }),
    ]
  }

  async publishVehicles(torres: Torre[], source: string) {
    const used = torres.filter((c) => c.cuadIds.length > 0)
    return [
      entry({
        method: 'POST',
        endpoint: '/v1/routes/vehicles/',
        summary: `${used.length} Torres como vehículo + punto de inicio (depot)`,
        source,
        body: used.slice(0, 2).map((c) => ({
          name: `Camión ${c.name}`,
          vehicle_role: 'reabastecedor (Torre)',
          capacity: 400,
          location_start_address: c.name,
          location_start_latitude: c.lat,
          location_start_longitude: c.lng,
          shift_start: '05:30',
          shift_end: '21:00',
        })),
        response: { created: used.length },
      }),
    ]
  }

  async sendVisits(orders: Order[], orderCuad: Record<string, string>, source: string) {
    const visits = orders.map((o) => ({
      title: o.id,
      address: o.address,
      latitude: +o.lat.toFixed(6),
      longitude: +o.lng.toFixed(6),
      reference: o.id,
      load: o.volume,
      tags: [orderCuad[o.id] ?? 'sin-cuadrante'],
      planned_date: 'día de entrega',
    }))
    const ana = visits.find((v) => v.title === 'F-208341')
    return [
      entry({
        method: 'POST',
        endpoint: '/v1/routes/visits/',
        summary: `${String(visits.length).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} visitas con lat/long y etiqueta de cuadrante`,
        source,
        body: [...(ana ? [ana] : []), ...sample(visits.filter((v) => v !== ana), 2), `… ${visits.length - 3} visitas más`],
        response: { created: visits.length, errors: 0 },
      }),
    ]
  }

  async splitZone(cuadName: string, parts: { rider: string; orders: number }[], source: string) {
    return [
      entry({
        method: 'PUT',
        endpoint: `/v1/zones/${cuadName}/ (sub-zonas)`,
        summary: `${cuadName} se reparte por zona entre ${parts.length} motorizados (ninguno pasa de 50)`,
        source,
        body: {
          zone: cuadName,
          sub_zones: parts.map((p, i) => ({ name: `${cuadName}·${i + 1}`, driver: p.rider, visits: p.orders })),
        },
        response: { updated: true, routes: parts.length },
      }),
    ]
  }

  async optimize(routes: Route[], source: string) {
    return [
      entry({
        method: 'POST',
        endpoint: '/v1/plans/ (optimización)',
        summary: `Optimizar orden de paradas en ${routes.length} rutas (1 por cuadrante)`,
        source,
        body: {
          name: 'Plan TORRE f.',
          routes: routes.slice(0, 2).map((r) => ({
            vehicle: `Moto ${r.label}`,
            zone: r.label,
            visits: r.deliveries,
            start: r.depotId === 'HUB' ? 'HUB VES' : 'Torre (punto medio de sus cuadrantes)',
          })),
          '…': `${Math.max(0, routes.length - 2)} rutas más`,
        },
        response: {
          status: 'optimized',
          sample_eta: routes[0]?.stops.slice(0, 3).map((s) => ({ seq: s.seq, eta: fmtTime(s.eta) })),
        },
      }),
    ]
  }

  async registerWebhook(source: string) {
    return [
      entry({
        method: 'POST',
        endpoint: '/v1/webhooks/ (entregas)',
        summary: 'Webhook de entregas → el Tablero f. aprende cada semana',
        source,
        body: { event: 'visit_checkout', url: 'https://torre-f.example/api/webhooks/entregas' },
        response: { active: true },
      }),
    ]
  }
}

export const routingProvider: RoutingProvider = new MockSimpliRouteProvider()
