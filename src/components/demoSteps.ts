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
  const winStart = Math.floor((eta - 30) / 60) * 60
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
      path: '/',
      title: '1 · El problema',
      text: 'El 60% de los pedidos llega al HUB a las 02:30 y la primera moto sale a las 06:00: 3,5 horas para sectorizar con la regla "primeros 50 del distrito" y muchas direcciones sin coordenadas.',
    },
    {
      path: '/cliente/checkout',
      title: '2 · Ana compra con Pin f.',
      text: `Jueves 21:00. Ana arrastra el pin hasta su puerta en Miraflores. Su pedido nace con lat/long y ya sabe su casilla, su cuadrante (${cuadrante}) y su Torre (${a?.torre?.letter ?? 'A'}).`,
    },
    {
      path: '/planificador',
      title: '3 · De día se ordena',
      text: `En el Tablero f., el planificador ve el mapa de calor y ${r?.map.cuadrantes.length ?? 110} cuadrantes que cruzan distritos (máximo 50 paquetes cada uno) y los publica en SimpliRoute como Zonas.`,
    },
    {
      path: '/hub',
      title: '4 · 02:30: nadie decide nada',
      text: `Llega la oleada grande. ${n} pedidos se asignan a su cuadrante en ${ms} ms. El HUB solo clasifica bolsas por cuadrante y carga los camiones Torre.`,
    },
    {
      path: '/admin',
      title: '5 · ¿Más de 50? El admin decide',
      text: 'Si un cuadrante pasa de 50 paquetes, el administrador pasa los sobrantes a un vecino con espacio o asigna un 2.º motorizado en el mismo cuadrante: se parte por zona según los paquetes.',
    },
    {
      path: '/torre',
      title: '6 · La Torre sale y escanea',
      text: `${fmtTime(trip?.departure ?? 330)} sale el camión de la Torre ${a?.torre?.letter ?? 'A'} hacia el punto medio de sus cuadrantes (${col}). El encargado escanea cada bolsa que entrega a cada moto: doble control de carga.`,
    },
    {
      path: '/motorizado',
      title: '7 · Carlos se reabastece cerca',
      text: `Carlos empieza su ruta en la Torre ${col}, no en Villa El Salvador. "Me quedé sin paquetes" → va a su Torre, a minutos de su cuadrante. No volvemos al almacén.`,
    },
    {
      path: '/cliente/entrega',
      title: '8 · Ana sabe cuándo llega',
      text: `En vez de "de 8 a 8", Ana recibe por el canal de siempre: "llega hoy entre ${fmtTime(a?.winStart ?? 540)} y ${fmtTime(a?.winEnd ?? 660)}".`,
    },
    {
      path: '/gerencia',
      title: '9 · Resultados',
      text: k
        ? `Hoy vs TORRE f.: paradas por ruta ${k.A.kpis.spr.toFixed(0)} → ${k.C.kpis.spr.toFixed(0)}, km vacíos −${Math.round((1 - k.C.kpis.emptyKm / k.A.kpis.emptyKm) * 100)}%, pedidos a tiempo ${(k.A.kpis.otd * 100).toFixed(0)}% → ${(k.C.kpis.otd * 100).toFixed(0)}%. Todo simulado y editable.`
        : 'Comparamos Hoy vs Tablero f. vs TORRE f. con los mismos pedidos.',
    },
    {
      path: '/integracion',
      title: '10 · Se conecta con SimpliRoute',
      text: 'No es una app nueva: cuadrantes → Zonas, pedidos → Visitas, Torre → Vehículo + inicio, entregas → Webhooks para aprender. Se ordena de día, se ejecuta de noche.',
    },
  ]
}
