import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleMarker } from 'react-leaflet'
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Minus, Plus, Send, Users } from 'lucide-react'
import {
  BaseMap,
  CuadranteLayer,
  CuadranteNames,
  FitTo,
  HubMarker,
  MapLegend,
  MapModePicker,
  TorreMarkers,
  heatBreaks,
  type MapMode,
} from '../components/MapKit'
import { KpiCard, NeedResult, ScreenHeader, SimBadge, Tag, fmtInt } from '../components/ui'
import { routingProvider } from '../integration/MockSimpliRouteProvider'
import { HUB } from '../sim/data'
import { fmtTime } from '../sim/geo'
import { SHIFTS } from '../sim/params'
import { buildTimeline, sequenceRoute } from '../sim/routing'
import { splitByZone } from '../sim/scenarios'
import type { Order } from '../sim/types'
import { useSim } from '../store/useSim'
import { applyMoves } from '../sim/assign'
import { LevelPicker } from './Planner'

const PART_COLORS = ['#F26B21', '#00808D', '#7DBA29', '#8E44AD', '#C6D420']
const EXTRA_RIDERS = ['Kevin', 'Milagros', 'Renzo', 'Fiorella', 'Bruno', 'Alessandra', 'Diego', 'Camila']

export default function Admin() {
  return (
    <NeedResult>
      <AdminInner />
    </NeedResult>
  )
}

function AdminInner() {
  const result = useSim((s) => s.result)!
  const params = useSim((s) => s.params)
  const riders = useSim((s) => s.riders)
  const setRiders = useSim((s) => s.setRiders)
  const log = useSim((s) => s.log)
  const navigate = useNavigate()
  const { map, torres, orders, assignment } = result
  const C = result.scenarios.C
  const max = params.cuadMaxStops
  const [mode, setMode] = useState<MapMode>('calor')
  const [onlyOver, setOnlyOver] = useState(false)
  const [useSpill, setUseSpill] = useState<Record<string, boolean>>({})

  // Paquetes de esta noche por cuadrante (antes de cualquier ajuste) y por casilla (mapa de calor)
  // Plan de la noche = asignación con las casillas de borde ya movidas (igual que en la simulación)
  const applied = useMemo(() => applyMoves(assignment, assignment.moves), [assignment])
  const rawOver = useMemo(() => Object.values(assignment.cuadCounts).filter((n) => n > max).length, [assignment, max])
  const { byCuad, heat } = useMemo(() => {
    const byCuad = new Map<string, Order[]>()
    const heat: Record<string, number> = {}
    for (const o of orders) {
      const id = applied.orderCuad[o.id]
      const arr = byCuad.get(id) ?? []
      arr.push(o)
      byCuad.set(id, arr)
      const c = assignment.orderCell[o.id]
      if (c && map.cellToCuad[c]) heat[c] = (heat[c] ?? 0) + 1
    }
    return { byCuad, heat }
  }, [orders, assignment, applied, map])
  const breaks = useMemo(() => heatBreaks(Object.values(heat)), [heat])
  const nameOf = useMemo(() => new Map(map.cuadrantes.map((q) => [q.id, q.name])), [map])
  const nm = (id: string) => nameOf.get(id) ?? id

  const rows = useMemo(
    () =>
      map.cuadrantes
        .map((q) => ({ q, n: byCuad.get(q.id)?.length ?? 0 }))
        .sort((a, b) => b.n - a.n),
    [map, byCuad],
  )
  const over = rows.filter((r) => r.n > max)
  const [selected, setSelected] = useState<string | null>(over[0]?.q.id ?? C.spills[0]?.from ?? rows[0]?.q.id ?? null)
  const movesOut = assignment.moves.filter((m) => m.from === selected)

  const sel = rows.find((r) => r.q.id === selected)
  useEffect(() => {
    // con cada simulación nueva (p. ej. Normal → Cyber) se elige el cuadrante más cargado
    setSelected(over[0]?.q.id ?? C.spills[0]?.from ?? rows[0]?.q.id ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])
  const selOrders = useMemo(() => byCuad.get(selected ?? '') ?? [], [byCuad, selected])
  const spillOut = C.spills.filter((s) => s.from === selected)
  const spillIn = C.spills.filter((s) => s.to === selected)
  const spilled = spillOut.reduce((s, x) => s + x.orders, 0)
  const spillOn = selected ? (useSpill[selected] ?? spilled > 0) : false

  // Paquetes que se queda este cuadrante (si pasa los sobrantes al vecino, se quitan los más cercanos al vecino)
  const kept = useMemo(() => {
    if (!spillOn || spilled === 0) return selOrders
    const toIds = spillOut.map((s) => s.to)
    const tgt = map.cuadrantes.filter((q) => toIds.includes(q.id)).map((q) => q.centroid)
    const dist = (o: Order) => Math.min(...tgt.map((c) => Math.hypot(o.lat - c.lat, o.lng - c.lng)))
    return [...selOrders].sort((a, b) => dist(b) - dist(a)).slice(0, selOrders.length - spilled)
  }, [selOrders, spillOn, spilled, spillOut, map])

  const minRiders = Math.max(1, Math.ceil(kept.length / max))
  const k = Math.max(minRiders, selected && riders[selected] ? riders[selected] : minRiders)

  // Reparto por zona entre k motorizados y su ETA (mismo motor que la simulación)
  const plan = useMemo(() => {
    if (!sel || kept.length === 0) return []
    const base = C.routes.find((r) => r.cuadId === sel.q.id)
    const depotId = base?.depotId ?? (sel.q.torreId || 'HUB')
    const torre = torres.find((t) => t.id === depotId)
    const depot = torre ?? HUB
    const shift = base?.shift ?? 1
    const start = base?.startTime ?? SHIFTS[0].start
    const parts = splitByZone(kept, Math.ceil(kept.length / k))
    const baseRider = base?.rider ?? 'Luis'
    return parts.map((part, j) => {
      const seq = sequenceRoute(depot, part).map((i) => part[i])
      const tl = buildTimeline(
        { label: `${sel.q.name}·${j + 1}`, cuadId: sel.q.id, part: j + 1, depotId, depot, orders: seq, readyTime: 0, availableTime: 0 },
        start,
        params,
        () => 1,
      )
      return {
        rider: j === 0 ? baseRider : EXTRA_RIDERS[(j - 1 + sel.q.name.length) % EXTRA_RIDERS.length],
        orders: seq,
        end: tl.endTime,
        km: tl.totalKm,
        reloads: tl.reloads,
        onTime: tl.endTime <= SHIFTS[shift - 1].end,
        color: PART_COLORS[j % PART_COLORS.length],
      }
    })
  }, [sel, kept, k, C, torres, params])

  const send = async () => {
    if (!sel) return
    const e = await routingProvider.splitZone(
      sel.q.name,
      plan.map((p) => ({ rider: p.rider, orders: p.orders.length })),
      'Admin · reparto por zona',
    )
    log(e)
    navigate('/integracion')
  }

  const list = onlyOver ? rows.filter((r) => r.n > max - 5) : rows

  return (
    <div>
      <ScreenHeader
        kicker="⚖️ Administrador · de noche"
        title="¿Más de 50 paquetes? Se reparte"
        hint="Elige un cuadrante en naranja y decide: pasarlo al vecino o sumar un motorizado."
        right={
          <>
            <LevelPicker />
            <SimBadge />
          </>
        }
      >
        Cada cuadrante es una ruta de máximo {max} paquetes. Si esta noche llegan más, el administrador elige: <b>pasar los sobrantes a un cuadrante vecino con espacio</b> o{' '}
        <b>asignar otro motorizado en el mismo cuadrante</b>, partiéndolo por zona según la cantidad de paquetes.
      </ScreenHeader>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        <KpiCard label="Cuadrantes esta noche" value={rows.filter((r) => r.n > 0).length} sub={`${fmtInt(orders.length)} paquetes`} tone="dark" />
        <KpiCard label="Pasaban de 50" value={rawOver} sub={`${new Set(assignment.moves.map((m) => m.from)).size} se arreglan moviendo casillas de borde`} tone={rawOver ? 'light' : 'lima'} icon={<AlertTriangle size={12} />} />
        <KpiCard label="Paquetes al vecino" value={new Set(C.spills.map((s) => s.from)).size} sub={`cuadrantes · ${C.spills.reduce((s, x) => s + x.orders, 0)} paquetes traspasados`} />
        <KpiCard label="Con 2+ motorizados" value={C.splits.length} sub="partidos por zona" />
        <KpiCard label="Máx. por ruta (TORRE f.)" value={C.kpis.maxStops} sub={C.kpis.maxStops <= max ? '✓ nadie pasa de 50' : 'revisar'} tone={C.kpis.maxStops <= max ? 'lima' : 'light'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <div className="card overflow-hidden p-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2 pt-1">
              <MapModePicker mode={mode} onChange={setMode} />
              <MapLegend mode={mode} breaks={breaks} unit="Paquetes esta noche por casilla" />
            </div>
            <BaseMap className="h-[min(62vh,560px)]" zoom={12} center={[-12.1, -77.0]}>
              <CuadranteLayer
                cuadrantes={map.cuadrantes}
                cellToCuad={map.cellToCuad}
                selected={selected}
                onCuadranteClick={setSelected}
                mode={mode}
                heat={heat}
                breaks={breaks}
                fillOpacity={0.45}
              />
              <CuadranteNames cuadrantes={map.cuadrantes} minZoom={12} dark={(q) => mode === 'tablero' && !!q.torreId} />
              {sel && <FitTo points={sel.q.cells.length ? selOrders : [HUB]} deps={sel.q.id} padding={60} />}
              {plan.length > 1 &&
                plan.flatMap((p) =>
                  p.orders.map((o) => (
                    <CircleMarker key={o.id} center={[o.lat, o.lng]} radius={4} pathOptions={{ color: '#fff', weight: 1, fillColor: p.color, fillOpacity: 1 }} />
                  )),
                )}
              <TorreMarkers torres={torres} cuadrantes={map.cuadrantes} showLinks={false} activeId={sel?.q.torreId} />
              <HubMarker />
            </BaseMap>
          </div>
          <div className="flex flex-wrap gap-1">
            <Tag kind="DISEÑO">Tope de 50 = meta SPR del reto</Tag>
            <Tag kind="SUPUESTO">Pedidos sintéticos de una noche</Tag>
          </div>
        </div>

        <div className="space-y-4">
          {sel && (
            <div className="card anim-pop p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase text-gris">{sel.q.torreId ? `♜ ${torres.find((t) => t.id === sel.q.torreId)?.name}` : '🏭 Directo del HUB'}</div>
                  <div className="text-2xl font-extrabold text-bosque">Cuadrante {sel.q.name}</div>
                </div>
                <div className={`rounded-xl px-3 py-2 text-center ${sel.n > max ? 'bg-naranja text-white' : 'bg-lima-soft text-bosque'}`}>
                  <div className="text-2xl font-extrabold leading-none">{sel.n}</div>
                  <div className="text-[10px] font-bold uppercase">de {max}</div>
                </div>
              </div>

              {movesOut.length > 0 && (
                <p className="mt-2 rounded-lg bg-crema p-2 text-xs text-bosque">
                  Paso 0 (automático): cedió {movesOut.length} casilla(s) de borde con {movesOut.reduce((s, m) => s + m.orders, 0)} paquetes a{' '}
                  {[...new Set(movesOut.map((m) => nm(m.to)))].join(', ')}.
                </p>
              )}
              {spillIn.length > 0 && (
                <p className="mt-2 rounded-lg bg-crema p-2 text-xs text-bosque">
                  Recibe {spillIn.reduce((s, x) => s + x.orders, 0)} paquete(s) de {spillIn.map((x) => nm(x.from)).join(', ')} (tiene espacio).
                </p>
              )}

              {spilled > 0 && (
                <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl bg-turq-soft p-3 text-sm text-bosque">
                  <input
                    type="checkbox"
                    className="mt-1 accent-[#00808D]"
                    checked={spillOn}
                    onChange={() => setUseSpill((u) => ({ ...u, [sel.q.id]: !spillOn }))}
                  />
                  <span>
                    <b className="flex items-center gap-1">
                      <ArrowRightLeft size={14} /> Opción 1 · Pasar {spilled} paquete(s) al vecino
                    </b>
                    {spillOut.map((s) => `${s.orders} → ${nm(s.to)}`).join(' · ')} (cuadrantes vecinos con espacio, a menos de 3 km)
                  </span>
                </label>
              )}

              <div className="mt-3 rounded-xl bg-crema p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-bosque">
                    <Users size={15} /> {spilled > 0 ? 'Opción 2 · ' : ''}Motorizados en este cuadrante
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setRiders(sel.q.id, k - 1 <= minRiders ? null : k - 1)}
                      disabled={k <= minRiders}
                      className="btn !bg-white !p-1.5 text-bosque disabled:opacity-40"
                      aria-label="Quitar motorizado"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-xl font-extrabold text-bosque">{k}</span>
                    <button onClick={() => setRiders(sel.q.id, Math.min(5, k + 1))} disabled={k >= 5} className="btn !bg-white !p-1.5 text-bosque disabled:opacity-40" aria-label="Agregar motorizado">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-gris">{kept.length} paquetes → mínimo {minRiders} motorizado(s). Cada uno toma un lado del cuadrante.</p>
                <div className="mt-2 space-y-1.5">
                  {plan.map((p, j) => (
                    <div key={j} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-xs">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.color }} />
                      <span className="w-24 shrink-0 font-bold text-bosque">
                        {plan.length > 1 ? `${sel.q.name}·${j + 1}` : sel.q.name} · {p.rider}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-crema">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (p.orders.length / max) * 100)}%`, background: p.orders.length > max ? '#F26B21' : p.color }} />
                      </div>
                      <span className="w-12 shrink-0 text-right font-bold">{p.orders.length}/{max}</span>
                      <span className={`w-16 shrink-0 text-right ${p.onTime ? 'text-verde' : 'text-naranja'}`}>
                        {p.onTime ? '✓' : '✕'} {fmtTime(p.end)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={send} className="btn-turq mt-3 w-full">
                <Send size={16} /> Enviar reparto a SimpliRoute
              </button>
              
            </div>
          )}

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-bosque">Carga de esta noche</h3>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gris">
                <input type="checkbox" checked={onlyOver} onChange={() => setOnlyOver((v) => !v)} className="accent-[#7DBA29]" /> solo los que están cerca o sobre 50
              </label>
            </div>
            <div className="mt-2 max-h-[420px] space-y-1 overflow-y-auto pr-1">
              {list.map(({ q, n }) => {
                const isOver = n > max
                const near = n > max - 5 && !isOver
                return (
                  <button
                    key={q.id}
                    onClick={() => setSelected(q.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${selected === q.id ? 'bg-bosque text-white' : 'hover:bg-crema'}`}
                  >
                    <span className="w-10 shrink-0 font-extrabold">{q.name}</span>
                    <div className="relative h-2.5 flex-1 overflow-visible rounded-full bg-crema">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, (n / (max * 1.3)) * 100)}%`, background: isOver ? '#F26B21' : near ? '#E8C35A' : '#7DBA29' }}
                      />
                      <span className="absolute top-[-3px] h-4 w-0.5 bg-bosque/60" style={{ left: `${(1 / 1.3) * 100}%` }} title="tope 50" />
                    </div>
                    <span className={`w-14 shrink-0 text-right font-bold ${isOver ? (selected === q.id ? 'text-lima' : 'text-naranja') : ''}`}>
                      {n} {isOver ? '⚠' : near ? '•' : ''}
                    </span>
                  </button>
                )
              })}
              {list.length === 0 && (
                <p className="flex items-center gap-1.5 text-sm text-verde">
                  <CheckCircle2 size={16} /> Ningún cuadrante cerca del tope esta noche.
                </p>
              )}
            </div>
            <p className="mt-2 text-[11px] text-gris">│ = tope de {max} · naranja = se pasa</p>
          </div>
        </div>
      </div>
    </div>
  )
}
