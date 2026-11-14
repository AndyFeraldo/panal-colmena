// Integración SIMULADA: no hace llamadas reales. Genera el log de lo que PANAL enviaría.
// Los cuerpos JSON son ejemplos simplificados; deben validarse contra https://documentation.simpliroute.com/es/
import { cellToBoundary } from 'h3-js'
import { fmtTime } from '../sim/geo'
import type { Colmena, Order, Panal, Route } from '../sim/types'
import type { ApiLogEntry, RoutingProvider } from './RoutingProvider'

let seq = 0
const now = () => new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function entry(e: Omit<ApiLogEntry, 'id' | 'at' | 'status'> & { status?: number }): ApiLogEntry {
  return { id: `api-${++seq}`, at: now(), status: e.status ?? 201, ...e }
}

const sample = <T,>(arr: T[], n: number) => arr.slice(0, n)

export class MockSimpliRouteProvider implements RoutingProvider {
  readonly name = 'SimpliRoute (simulado)'

  async publishZones(panales: Panal[], source: string) {
    const zones = panales.map((p) => ({
      name: p.id,
      // contorno simplificado: borde de la primera celda (ejemplo)
      coordinates: cellToBoundary(p.cells[0]).map(([lat, lng]) => ({ lat: +lat.toFixed(5), lng: +lng.toFixed(5) })),
      meta: { cells_h3_res8: p.cells.length, expected_stops: Math.round(p.expStops), districts: p.districts },
    }))
    return [
      entry({
        method: 'POST',
        endpoint: '/v1/zones/',
        summary: `${panales.length} panales publicados como Zonas`,
        source,
        body: { zones: sample(zones, 2), '…': `${Math.max(0, zones.length - 2)} zonas más` },
        response: { created: zones.length, ids: sample(zones, 3).map((_, i) => 90100 + i) },
      }),
    ]
  }

  async publishVehicles(colmenas: Colmena[], source: string) {
    const used = colmenas.filter((c) => c.panalIds.length > 0)
    return [
      entry({
        method: 'POST',
        endpoint: '/v1/routes/vehicles/',
        summary: `${used.length} Colmenas como vehículo + punto de inicio (depot)`,
        source,
        body: used.slice(0, 2).map((c) => ({
          name: `Minivan ${c.name}`,
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

  async sendVisits(orders: Order[], orderPanal: Record<string, string>, source: string) {
    const visits = orders.map((o) => ({
      title: o.id,
      address: o.address,
      latitude: +o.lat.toFixed(6),
      longitude: +o.lng.toFixed(6),
      reference: o.id,
      load: o.volume,
      tags: [orderPanal[o.id] ?? 'sin-panal'],
      planned_date: 'día de entrega',
    }))
    const ana = visits.find((v) => v.title === 'F-208341')
    return [
      entry({
        method: 'POST',
        endpoint: '/v1/routes/visits/',
        summary: `${String(visits.length).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} visitas con lat/long y etiqueta de panal`,
        source,
        body: [...(ana ? [ana] : []), ...sample(visits.filter((v) => v !== ana), 2), `… ${visits.length - 3} visitas más`],
        response: { created: visits.length, errors: 0 },
      }),
    ]
  }

  async optimize(routes: Route[], source: string) {
    return [
      entry({
        method: 'POST',
        endpoint: '/v1/plans/ (optimización)',
        summary: `Optimizar orden de paradas en ${routes.length} rutas (1 por panal)`,
        source,
        body: {
          name: 'Plan PANAL',
          routes: routes.slice(0, 2).map((r) => ({
            vehicle: r.depotId === 'HUB' ? 'Moto HUB VES' : `Moto Colmena ${r.depotId}`,
            zone: r.label,
            visits: r.deliveries,
            start: r.depotId,
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
        summary: 'Webhook de entregas → PANAL aprende cada semana',
        source,
        body: { event: 'visit_checkout', url: 'https://panal.example/api/webhooks/entregas' },
        response: { active: true },
      }),
    ]
  }
}

export const routingProvider: RoutingProvider = new MockSimpliRouteProvider()
