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
  const panalId = r.assignment.orderPanal[ANA.id]
  const panal = r.map.panales.find((p) => p.id === panalId)
  const colmena = r.colmenas.find((c) => c.id === route?.depotId) ?? r.colmenas.find((c) => c.id === panal?.colmenaId)
  const eta = stop?.eta ?? 9 * 60 + 40
  const winStart = Math.floor((eta - 30) / 60) * 60
  return { route, stop, panalId, panal, colmena, eta, winStart, winEnd: winStart + 120 }
}

export function demoSteps(r: SimResult | null): DemoStep[] {
  const a = anaContext(r)
  const panal = a?.panalId ?? 'P-09'
  const col = a?.colmena?.short ?? 'Miraflores'
  const ms = r ? r.assignment.timeMs.toFixed(1).replace('.', ',') : '4'
  const n = r ? String(r.orders.length).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '4.000'
  const k = r?.scenarios
  const trip = r?.scenarios.C.minivanTrips.find((t) => t.colmenaId === a?.colmena?.id)
  return [
    {
      path: '/',
      title: '1 · El problema',
      text: 'El 60% de los pedidos llega al HUB a las 02:30 y la primera moto sale a las 06:00: 3,5 horas para sectorizar con la regla "primeros 50 del distrito" y muchas direcciones sin coordenadas.',
    },
    {
      path: '/cliente/checkout',
      title: '2 · Ana compra con Pin f.',
      text: `Jueves 21:00. Ana arrastra el pin hasta su puerta en Miraflores. Su pedido nace con lat/long y ya sabe su celda, su panal (${panal}) y su Colmena.`,
    },
    {
      path: '/planificador',
      title: '3 · De día se ordena',
      text: `El planificador revisa ${r?.map.panales.length ?? 90} panales que cruzan distritos (cada uno ≈ 50 paradas) y los publica en SimpliRoute como Zonas.`,
    },
    {
      path: '/hub',
      title: '4 · 02:30: nadie decide nada',
      text: `Llega la oleada grande. ${n} pedidos se asignan a su panal en ${ms} ms. El HUB solo clasifica bolsas por panal y carga las minivanes Colmena.`,
    },
    {
      path: '/colmena',
      title: '5 · La Colmena sale y escanea',
      text: `${fmtTime(trip?.departure ?? 330)} sale la minivan hacia el Punto Colmena ${col}. El encargado escanea cada bolsa que entrega a cada moto: doble control de carga.`,
    },
    {
      path: '/motorizado',
      title: '6 · Carlos recarga cerca',
      text: `Carlos empieza su ruta en la Colmena ${col}, no en Villa El Salvador. Si la mochila se vacía, recarga a minutos de su panal.`,
    },
    {
      path: '/cliente/entrega',
      title: '7 · Ana sabe cuándo llega',
      text: `En vez de "de 8 a 8", Ana recibe por el canal de siempre: "llega hoy entre ${fmtTime(a?.winStart ?? 540)} y ${fmtTime(a?.winEnd ?? 660)}".`,
    },
    {
      path: '/gerencia',
      title: '8 · Resultados',
      text: k
        ? `Hoy vs PANAL vs PANAL + Colmena: paradas por ruta ${k.A.kpis.spr.toFixed(0)} → ${k.C.kpis.spr.toFixed(0)}, km vacíos −${Math.round((1 - k.C.kpis.emptyKm / k.A.kpis.emptyKm) * 100)}%, pedidos a tiempo ${(k.A.kpis.otd * 100).toFixed(0)}% → ${(k.C.kpis.otd * 100).toFixed(0)}%. Todo simulado y editable.`
        : 'Comparamos Hoy vs PANAL vs PANAL + Colmena con los mismos pedidos.',
    },
    {
      path: '/integracion',
      title: '9 · Se conecta con SimpliRoute',
      text: 'No es una app nueva: panales → Zonas, pedidos → Visitas, Colmena → Vehículo + inicio, entregas → Webhooks para aprender. Se ordena de día, se ejecuta de noche.',
    },
  ]
}
