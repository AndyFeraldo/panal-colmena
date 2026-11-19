import { ANA } from '../sim/data'
import { fmtTime } from '../sim/geo'
import type { SimResult } from '../sim/types'

export interface DemoStep {
  path: string
  title: string
  text: string
}

export function anaContext(r: SimResult | null) {
  if (!r) return null
  const C = r.scenarios.C
  const routeId = C.orderRoute[ANA.id]
  const route = C.routes.find((x) => x.id === routeId)
  const stop = route?.stops.find((s) => s.orderId === ANA.id)
  const cuadId = r.assignment.orderCuad[ANA.id]
  const cuadrante = r.map.cuadrantes.find((p) => p.id === cuadId)
  const torre = r.torres.find((c) => c.id === route?.depotId) ?? r.torres.find((c) => c.id === cuadrante?.torreId)
  const eta = stop?.eta ?? 9 * 60 + 40
  // ventana de 2 h que nunca empieza antes de que salga la ruta
  const winStart = Math.max(Math.floor((eta - 30) / 60) * 60, Math.ceil((route?.startTime ?? 360) / 60) * 60)
  return { route, stop, cuadId, cuadrante, torre, eta, winStart, winEnd: winStart + 120 }
}

export function demoSteps(r: SimResult | null): DemoStep[] {
  const a = anaContext(r)
  const cuadrante = a?.cuadrante?.name ?? 'A3'
  const col = a?.torre?.short ?? 'Miraflores'
  const ms = r ? r.assignment.timeMs.toFixed(1).replace('.', ',') : '4'
  const n = r ? String(r.orders.length).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '4.000'
  const k = r?.scenarios
  const trip = r?.scenarios.C.torreTrips.find((t) => t.torreId === a?.torre?.id)
  return [
    {
      path: '/cliente/entrega',
      title: '1 · Ana sabe a qué hora llega',
      text: `Hoy Falabella le dice a Ana "llega de 8 a 8". Con TORRE f. recibe por el WhatsApp de siempre: "llega hoy entre ${fmtTime(a?.winStart ?? 540)} y ${fmtTime(a?.winEnd ?? 660)}". Y si no está, lo cambia el mismo día.`,
    },
    {
      path: '/',
      title: '2 · Por qué hoy no se puede',
      text: 'El 60% de los pedidos llega al HUB a las 02:30 y la primera moto sale a las 06:00: 3,5 horas para armar rutas con la regla "primeros 50 del distrito".',
    },
    {
      path: '/cliente/checkout',
      title: '3 · Cada pedido tiene su casilla',
      text: `Al comprar, el pedido nace con su ubicación (y si la dirección es dudosa, Ana marca su puerta con un toque). Al instante sabe su cuadrante (${cuadrante}) y su Torre.`,
    },
    {
      path: '/planificador',
      title: '4 · De día se ordena',
      text: `El planificador ve Lima como un tablero: ${r?.map.cuadrantes.length ?? 110} cuadrantes de máximo 50 paquetes, que no cruzan la Panamericana ni los ríos.`,
    },
    {
      path: '/hub',
      title: '5 · De noche solo se ejecuta',
      text: `02:30: ${n} pedidos asignados en ${ms} ms. El HUB solo clasifica bolsas y carga pocos camiones Torre.`,
    },
    {
      path: '/torre',
      title: '6 · Cada moto tiene su Torre',
      text: `${fmtTime(trip?.departure ?? 330)} sale el camión Torre ${a?.torre?.letter ?? 'A'} y se estaciona en medio de sus cuadrantes (${col}). Escanea cada bolsa, y si a una Torre le sobran paquetes, se los pasa a la vecina.`,
    },
    {
      path: '/motorizado',
      title: '7 · Sin paquetes → a su Torre',
      text: `Carlos empieza en la Torre ${col}, no en Villa El Salvador. Cuando se queda sin paquetes, recarga a minutos de su zona.`,
    },
    {
      path: '/gerencia',
      title: '8 · Hoy vs TORRE f.',
      text: k
        ? `Ventana de 12 h a 2 h, pedidos a tiempo ${(k.A.kpis.otd * 100).toFixed(0)}% → ${(k.C.kpis.otd * 100).toFixed(0)}%, km vacíos −${Math.round((1 - k.C.kpis.emptyKm / k.A.kpis.emptyKm) * 100)}%. Sin apps nuevas: usa SimpliRoute y WhatsApp. Para que cuando quieras comprar en línea, pienses en Falabella.`
        : 'Comparamos Hoy vs TORRE f. con los mismos pedidos.',
    },
  ]
}
