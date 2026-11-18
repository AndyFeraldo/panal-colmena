import { describe, expect, it } from 'vitest'
import { latLngToCell, neighbors } from './grid'
import { assignOrders } from './assign'
import { ANA, DISTRICTS } from './data'
import { districtOf, haversineKm } from './geo'
import { generateOrders } from './orders'
import { cuadAdjacency } from './cuadrantes'
import { cuadrantesCrossingBarriers, linkedNeighbors } from './barriers'
import { DEFAULT_PARAMS } from './params'
import { sequenceRoute, routeLength } from './routing'
import { buildMap, runSimulation } from './simulate'
import type { SimInput } from './types'

const input: SimInput = { params: DEFAULT_PARAMS, level: 'Normal', weekday: 3, pctPin: 0.95, overrides: {} }

describe('datos y geografía', () => {
  it('pesos de distrito normalizados a 100%', () => {
    expect(DISTRICTS.reduce((s, d) => s + d.weight, 0)).toBeCloseTo(1, 6)
  })
  it('la dirección de Ana cae en Miraflores', () => {
    expect(districtOf(ANA).name).toBe('Miraflores')
  })
})

describe('generador de pedidos', () => {
  it('misma semilla = mismos pedidos', () => {
    const a = generateOrders(DEFAULT_PARAMS, 'Normal', 3)
    const b = generateOrders(DEFAULT_PARAMS, 'Normal', 3)
    expect(a.length).toBe(4000)
    expect(a.map((o) => o.id + o.lat)).toEqual(b.map((o) => o.id + o.lat))
  })
  it('oleadas 15/25/60 y ids únicos', () => {
    const o = generateOrders(DEFAULT_PARAMS, 'Normal', 3)
    const w3 = o.filter((x) => x.wave === 3).length / o.length
    expect(w3).toBeCloseTo(0.6, 2)
    expect(new Set(o.map((x) => x.id)).size).toBe(o.length)
  })
  it('lunes +20% y Cyber ×2', () => {
    expect(generateOrders(DEFAULT_PARAMS, 'Normal', 0).length).toBe(4800)
    expect(generateOrders(DEFAULT_PARAMS, 'Cyber', 3).length).toBe(8000)
  })
})

describe('cuadrantes', () => {
  const { map, torres } = buildMap(input)
  it('cada casilla pertenece a un solo cuadrante y los cuadrantes respetan el máximo de fusión', () => {
    const all = map.cuadrantes.flatMap((p) => p.cells)
    expect(new Set(all).size).toBe(all.length)
    for (const p of map.cuadrantes.filter((x) => x.cells.length > 1)) expect(p.expStops).toBeLessThanOrEqual(DEFAULT_PARAMS.cuadMergeMax + 0.001)
  })
  it('paradas promedio cerca del objetivo', () => {
    const avg = map.cuadrantes.reduce((s, p) => s + p.expStops, 0) / map.cuadrantes.length
    expect(avg).toBeGreaterThan(32) // con barreras quedan algunos cuadrantes chicos junto a vías y ríos
    expect(avg).toBeLessThan(56)
  })
  it('hay cuadrantes que cruzan distritos', () => {
    expect(map.cuadrantes.filter((p) => p.districts.length > 1).length).toBeGreaterThan(5)
  })
  it('cuadrantes vecinos no comparten color', () => {
    const adj = cuadAdjacency(map.cuadrantes, map.cellToCuad)
    const color = new Map(map.cuadrantes.map((p) => [p.id, p.color]))
    let clashes = 0
    for (const [id, ns] of adj) for (const n of ns) if (color.get(id) === color.get(n)) clashes++
    expect(clashes).toBe(0)
  })
  it('los cuadrantes son contiguos', () => {
    for (const p of map.cuadrantes.slice(0, 40)) {
      const set = new Set(p.cells)
      const seen = new Set([p.cells[0]])
      const stack = [p.cells[0]]
      while (stack.length) {
        const c = stack.pop()!
        for (const n of neighbors(c)) if (set.has(n) && !seen.has(n)) {
          seen.add(n)
          stack.push(n)
        }
      }
      expect(seen.size).toBe(p.cells.length)
    }
  })
  it('torres no superan la capacidad planificada', () => {
    for (const c of torres) expect(c.expLoad).toBeLessThanOrEqual(DEFAULT_PARAMS.truckCapacity * c.trucks + 0.001)
    expect(torres.some((c) => c.cuadIds.length > 0)).toBe(true)
  })
})

describe('asignación nocturna', () => {
  it('4.000 pedidos asignados en < 50 ms', () => {
    const { map } = buildMap(input)
    const orders = generateOrders(DEFAULT_PARAMS, 'Normal', 3)
    assignOrders(orders, map, 0.95) // calentamiento
    const a = assignOrders(orders, map, 0.95)
    expect(Object.keys(a.orderCuad).length).toBe(orders.length)
    expect(a.timeMs).toBeLessThan(50)
  })
  it('Ana queda en el cuadrante de su casilla', () => {
    const { map } = buildMap(input)
    const orders = generateOrders(DEFAULT_PARAMS, 'Normal', 3)
    const a = assignOrders(orders, map, 0.95)
    const cell = latLngToCell(ANA.lat, ANA.lng)
    expect(a.orderCuad[ANA.id]).toBe(map.cellToCuad[cell])
  })
})

describe('secuenciación', () => {
  it('2-opt no empeora al vecino más cercano y visita todo una vez', () => {
    const pts = Array.from({ length: 40 }, (_, i) => ({ lat: -12.1 + Math.sin(i * 7.1) * 0.02, lng: -77.03 + Math.cos(i * 3.3) * 0.02 }))
    const start = { lat: -12.12, lng: -77.05 }
    const seq = sequenceRoute(start, pts)
    expect([...seq].sort((a, b) => a - b)).toEqual(pts.map((_, i) => i))
    const naive = routeLength(start, pts)
    expect(routeLength(start, seq.map((i) => pts[i]))).toBeLessThan(naive)
  })
})

describe('simulación completa', () => {
  const r = runSimulation(input)
  const { A, B, C } = r.scenarios
  it('todos los pedidos se rutean exactamente una vez en cada escenario', () => {
    for (const s of [A, B, C]) {
      const ids = s.routes.flatMap((x) => x.stops.filter((st) => st.kind === 'delivery').map((st) => st.orderId))
      expect(ids.length).toBe(r.orders.length)
      expect(new Set(ids).size).toBe(r.orders.length)
    }
  })
  it('baseline: rutas de máximo 50 por distrito', () => {
    for (const x of A.routes) expect(x.deliveries).toBeLessThanOrEqual(50)
  })
  it('Tablero f. reduce las rutas chicas y la Torre los km vacíos', () => {
    expect(B.kpis.pctRoutesUnder30).toBeLessThan(A.kpis.pctRoutesUnder30)
    expect(C.kpis.emptyKm).toBeLessThan(A.kpis.emptyKm)
  })
  it('TORRE f.: ninguna ruta pasa de 50 paquetes, incluso en Cyber', () => {
    for (const x of C.routes) expect(x.deliveries).toBeLessThanOrEqual(50)
    const cy = runSimulation({ ...input, level: 'Cyber' })
    for (const x of cy.scenarios.C.routes) expect(x.deliveries).toBeLessThanOrEqual(50)
  })
  it('nombres visibles: A1, A2… por Torre y H1, H2… directos del HUB', () => {
    for (const q of r.map.cuadrantes) {
      const t = r.torres.find((x) => x.id === q.torreId)
      if (t) expect(q.name).toMatch(new RegExp(`^${t.letter}\\d+$`))
      else expect(q.name).toMatch(/^H\d+$/)
    }
    expect(new Set(r.map.cuadrantes.map((q) => q.name)).size).toBe(r.map.cuadrantes.length)
  })
  it('cada Torre está en el punto medio de sus cuadrantes', () => {
    for (const t of r.torres.filter((x) => x.cuadIds.length > 0)) {
      const qs = r.map.cuadrantes.filter((q) => t.cuadIds.includes(q.id))
      const w = qs.reduce((s, q) => s + q.expStops, 0)
      const lat = qs.reduce((s, q) => s + q.centroid.lat * q.expStops, 0) / w
      const lng = qs.reduce((s, q) => s + q.centroid.lng * q.expStops, 0) / w
      expect(haversineKm(t, { lat, lng })).toBeLessThan(1.5)
    }
  })
  it('Torre mejora el OTD y la carga correcta', () => {
    expect(C.kpis.otd).toBeGreaterThan(A.kpis.otd)
    expect(C.kpis.loadCorrect).toBeGreaterThan(A.kpis.loadCorrect)
  })
  it('reproducible con la misma semilla', () => {
    const r2 = runSimulation(input)
    expect(r2.scenarios.C.kpis.otd).toBe(C.kpis.otd)
    expect(r2.scenarios.A.kpis.emptyKm).toBe(A.kpis.emptyKm)
  })
  it('imprime resumen', () => {
    const f = (k: typeof A.kpis) => ({
      rutas: k.routes, spr: +k.spr.toFixed(1), chicas: +(k.pctRoutesUnder30 * 100).toFixed(1), kmVacios: Math.round(k.emptyKm),
      otd: +(k.otd * 100).toFixed(1), rutasOk: +(k.pctRoutesOnTime * 100).toFixed(1), carga: +(k.loadCorrect * 100).toFixed(3),
      recargas: k.reloads, hub: k.vehiclesAtHub, trucks: k.trucks, ms: +k.decisionMs.toFixed(2),
    })
    console.log('cuadrantes', r.map.cuadrantes.length, 'torres', r.torres.map((c) => `${c.short}:${c.cuadIds.length}/${Math.round(c.expLoad)}`).join(' '))
    console.log('A', JSON.stringify(f(A.kpis)))
    console.log('B', JSON.stringify(f(B.kpis)))
    console.log('C', JSON.stringify(f(C.kpis)))
    console.log('moves', r.assignment.moves.length, 'learning', r.learning.length, 'ms', Math.round(r.computeMs))
    const ana = C.routes.find((x) => x.stops.some((s) => s.orderId === ANA.id))!
    console.log('Ana', ana.label, ana.depotId, ana.rider, ana.startTime, ana.stops.find((s) => s.orderId === ANA.id)!.eta)
    expect(haversineKm(ANA, ana.depot)).toBeLessThan(20)
  })
})

describe('barreras geográficas (Panamericana, Vía Expresa, ríos)', () => {
  it('con barreras, ningún cuadrante queda partido por una vía rápida o un río', () => {
    for (const level of ['Normal', 'Cyber'] as const) {
      const { map } = buildMap({ ...input, level })
      expect(cuadrantesCrossingBarriers(map.cuadrantes).size).toBe(0)
    }
  })
  it('sin barreras, sí aparecen cuadrantes que cruzan (el ajuste importa)', () => {
    const { map } = buildMap({ ...input, params: { ...DEFAULT_PARAMS, respectBarriers: false } })
    expect(cuadrantesCrossingBarriers(map.cuadrantes).size).toBeGreaterThan(0)
  })
  it('la Panamericana Sur separa Surco de San Juan de Miraflores', () => {
    const surco = latLngToCell(-12.15, -76.99)
    const sjm = latLngToCell(-12.15, -76.965)
    expect(linkedNeighbors(surco)).not.toContain(sjm)
  })
  it('en Cyber los cuadrantes son más chicos que en temporada baja', () => {
    const bajo = buildMap({ ...input, level: 'Bajo' }).map
    const cyber = buildMap({ ...input, level: 'Cyber' }).map
    const avgCells = (m: typeof bajo) => m.cuadrantes.reduce((s, q) => s + q.cells.length, 0) / m.cuadrantes.length
    expect(cyber.cuadrantes.length).toBeGreaterThan(bajo.cuadrantes.length)
    expect(avgCells(cyber)).toBeLessThan(avgCells(bajo))
  })
})
