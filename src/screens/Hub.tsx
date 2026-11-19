import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CircleMarker } from 'react-leaflet'
import { AlertTriangle, CheckCircle2, Pause, Play, RotateCcw, Send, Truck, Zap } from 'lucide-react'
import { BaseMap, TorreMarkers, HubMarker, CUAD_PALETTE } from '../components/MapKit'
import { NeedResult, ScreenHeader, SimBadge, Tag, fmtInt, fmtMs } from '../components/ui'
import { routingProvider } from '../integration/MockSimpliRouteProvider'
import { applyMoves, assignOrders } from '../sim/assign'
import { orderCuadNames } from '../sim/cuadrantes'
import { fmtTime } from '../sim/geo'
import { useSim } from '../store/useSim'
import { vehicleLabel } from '../sim/params'

const TIMELINE = [
  { t: '14:00', label: 'Oleada 1 · 15%', wave: 1 },
  { t: '19:00', label: 'Oleada 2 · 25%', wave: 2 },
  { t: '02:30', label: 'Oleada 3 · 60%', wave: 3 },
  { t: '05:30', label: 'Salen camiones', wave: 3 },
  { t: '06:00', label: 'Salen las motos', wave: 3 },
]

export default function Hub() {
  return (
    <NeedResult>
      <HubInner />
    </NeedResult>
  )
}

function HubInner() {
  const result = useSim((s) => s.result)!
  const pctPin = useSim((s) => s.pctPin)
  const params = useSim((s) => s.params)
  const approvedMoves = useSim((s) => s.approvedMoves)
  const approvedTrucks = useSim((s) => s.approvedTrucks)
  const approveMove = useSim((s) => s.approveMove)
  const approveTruck = useSim((s) => s.approveTruck)
  const demoStep = useSim((s) => s.demoStep)
  const log = useSim((s) => s.log)
  const navigate = useNavigate()
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [measured, setMeasured] = useState<{ n: number; ms: number } | null>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const { map, torres, orders, assignment } = result
  const C = result.scenarios.C

  useEffect(() => {
    if (demoStep === 4) {
      setIdx(0)
      setMeasured(null)
      setPlaying(true)
    }
  }, [demoStep])

  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => {
      if (idx >= TIMELINE.length - 1) setPlaying(false)
      else setIdx(idx + 1)
    }, 1300)
    return () => clearTimeout(t)
  }, [playing, idx])

  // Calentamiento (primera pasada del lookup) para medir "en caliente", como correría cada noche
  useEffect(() => {
    assignOrders(orders, map, pctPin)
  }, [orders, map, pctPin])

  // Al llegar la oleada de 02:30 se mide la asignación real en este navegador
  useEffect(() => {
    if (idx === 2 && !measured) {
      const a = assignOrders(orders, map, pctPin)
      setMeasured({ n: a.count, ms: a.timeMs })
    }
  }, [idx, measured, orders, map, pctPin])

  const wave = TIMELINE[idx].wave
  const visible = useMemo(() => orders.filter((o) => o.wave <= wave), [orders, wave])
  const nameOf = useMemo(() => new Map(map.cuadrantes.map((p) => [p.id, p.name])), [map])
  const nm = (id: string) => nameOf.get(id) ?? id
  const colorOf = useMemo(() => new Map(map.cuadrantes.map((p) => [p.id, CUAD_PALETTE[p.color % CUAD_PALETTE.length]])), [map])

  const approved = useMemo(() => assignment.moves.filter((m) => approvedMoves.includes(m.cell)), [assignment, approvedMoves])
  const counts = useMemo(() => {
    const a = applyMoves(assignment, approved)
    const c: Record<string, number> = {}
    for (const o of visible) {
      const id = a.orderCuad[o.id]
      c[id] = (c[id] ?? 0) + 1
    }
    return c
  }, [assignment, approved, visible])

  const cuadranteBars = map.cuadrantes
    .map((p) => ({ p, n: counts[p.id] ?? 0 }))
    .sort((a, b) => b.n / params.cuadMaxStops - a.n / params.cuadMaxStops)
  const colBars = torres
    .filter((c) => c.cuadIds.length)
    .map((c) => {
      const n = c.cuadIds.reduce((s, id) => s + (counts[id] ?? 0), 0)
      const vans = c.trucks + (approvedTrucks.includes(c.id) ? 1 : 0)
      return { c, n, cap: (c.vehicle === 'van' ? params.vanCapacity : params.truckCapacity) * vans, vans }
    })
  const pendingMoves = idx >= 2 ? assignment.moves.filter((m) => !approvedMoves.includes(m.cell)) : []
  // una alerta por cuadrante desbordado (puede ceder varias casillas a vecinos)
  const groups = [...new Set(pendingMoves.map((m) => m.from))].map((from) => {
    const ms = pendingMoves.filter((m) => m.from === from)
    return { from, moves: ms, orders: ms.reduce((s, m) => s + m.orders, 0), to: [...new Set(ms.map((m) => m.to))] }
  })
  const colAlerts = idx >= 2 ? colBars.filter((b) => b.n > b.cap && !approvedTrucks.includes(b.c.id)) : []
  const directT1 = C.routes.filter((r) => r.depotId === 'HUB' && r.shift === 1)
  const trips = [...C.torreTrips].sort((a, b) => b.orders - a.orders)

  const sendVisits = async () => {
    const e1 = await routingProvider.sendVisits(orders, orderCuadNames(applyMoves(assignment, assignment.moves).orderCuad, result.map), 'P3 · HUB')
    const e2 = await routingProvider.optimize(C.routes, 'P3 · HUB')
    log([...e2, ...e1])
    navigate('/integracion')
  }

  return (
    <div>
      <ScreenHeader
        kicker="🏭 Jefe de HUB · 02:30"
        title="Nadie decide nada: solo se clasifica"
        hint="Presiona ▶ Reproducir la noche y mira cómo cae cada pedido en su cuadrante."
        right={
          <>
            <SimBadge />
            <button onClick={sendVisits} className="btn-turq">
              <Send size={16} /> Enviar visitas a SimpliRoute
            </button>
          </>
        }
      />

      {/* Línea de tiempo */}
      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => (idx >= TIMELINE.length - 1 ? (setIdx(0), setMeasured(null), setPlaying(true)) : setPlaying(!playing))} className="btn-dark">
            {playing ? <Pause size={16} /> : idx >= TIMELINE.length - 1 ? <RotateCcw size={16} /> : <Play size={16} />}
            {playing ? 'Pausar' : idx >= TIMELINE.length - 1 ? 'Repetir la noche' : 'Reproducir la noche'}
          </button>
          <div className="flex flex-1 items-center gap-1">
            {TIMELINE.map((s, i) => (
              <button
                key={s.t}
                onClick={() => {
                  setPlaying(false)
                  setIdx(i)
                }}
                className={`flex-1 rounded-xl px-2 py-2 text-left transition ${i <= idx ? (i === 2 ? 'bg-naranja text-white' : 'bg-bosque text-white') : 'bg-crema text-gris'}`}
              >
                <div className="text-sm font-extrabold">{s.t}</div>
                <div className="text-[10px] font-semibold opacity-80">{s.label}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {measured ? (
            <div className="anim-pop flex items-center gap-2 rounded-xl bg-lima px-4 py-2 text-bosque">
              <Zap size={20} />
              <span className="text-lg font-extrabold">
                {fmtInt(measured.n)} pedidos asignados en {fmtMs(measured.ms)} ms
              </span>
              <span className="text-xs font-semibold">medido ahora en este navegador</span>
            </div>
          ) : (
            <div className="rounded-xl bg-crema px-4 py-2 text-sm text-gris">Avanza hasta las 02:30 para ver la asignación en milisegundos.</div>
          )}
          <div className="text-xs text-gris">
            Pedidos en el HUB: <b className="text-bosque">{fmtInt(visible.length)}</b> de {fmtInt(orders.length)}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="card overflow-hidden p-1.5">
            <BaseMap className="h-[440px]" zoom={11} center={[-12.08, -77.02]}>
              {visible.map((o) => (
                <CircleMarker
                  key={o.id}
                  center={[o.lat, o.lng]}
                  radius={o.isAna ? 7 : 2.6}
                  pathOptions={{ stroke: !!o.isAna, color: '#F26B21', weight: 2, fillColor: colorOf.get(assignment.orderCuad[o.id]) ?? '#999', fillOpacity: 0.9 }}
                />
              ))}
              <TorreMarkers torres={torres} cuadrantes={map.cuadrantes} showLinks={false} />
              <HubMarker />
            </BaseMap>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="card p-4">
              <h3 className="flex items-center gap-2 font-extrabold text-bosque">
                <Truck size={18} /> Checklist de carga por camión
              </h3>
              <div className="mt-2 max-h-72 space-y-3 overflow-y-auto pr-1">
                {trips.map((t) => {
                  const col = torres.find((c) => c.id === t.torreId)!
                  return (
                    <div key={t.torreId} className="rounded-xl bg-crema p-3">
                      <div className="flex items-center justify-between text-sm font-bold text-turq">
                        ♜ {col.name} <span className="text-xs text-gris">sale {fmtTime(t.departure)} · {vehicleLabel(t.vehicle, t.trucks)}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-1">
                        {t.cuadIds.map((pid) => {
                          const key = t.torreId + pid
                          return (
                            <label key={pid} className="flex cursor-pointer items-center gap-1.5 text-xs">
                              <input type="checkbox" checked={!!checked[key]} onChange={() => setChecked((c) => ({ ...c, [key]: !c[key] }))} className="accent-[#7DBA29]" />
                              Bolsas {nm(pid)} · {counts[pid] ?? 0}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="card p-4">
              <h3 className="font-extrabold text-bosque">Orden de clasificación sugerido</h3>
              <ol className="mt-2 space-y-1 text-sm">
                {trips.map((t, i) => (
                  <li key={t.torreId}>
                    <b>{i + 1}.</b> Bolsas de {torres.find((c) => c.id === t.torreId)?.name} ({fmtInt(t.orders)} ped.)
                  </li>
                ))}
                <li>
                  <b>{trips.length + 1}.</b> Rutas directas del turno 1 (de la más lejana a la más cercana)
                </li>
              </ol>
              <h4 className="mt-3 text-sm font-extrabold text-bosque">Motos que salen directo del HUB (turno 1): {directT1.length}</h4>
              <div className="mt-1 flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                {directT1.map((r) => (
                  <span key={r.id} className="chip bg-crema text-bosque">
                    {r.label} · {r.rider}
                  </span>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-naranja/40 bg-naranja-soft p-3 text-xs text-bosque">
                <b>Lo que NO resuelve:</b> el HUB clasifica {params.hubCapacityPerHour} ped/h y termina a las <b>{fmtTime(C.kpis.sortEnd)}</b>. <Tag kind="RETO">700 ped/h</Tag>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="flex items-center gap-2 font-extrabold text-bosque">
              <AlertTriangle size={18} className="text-naranja" /> Alertas por aprobar
            </h3>
            {idx < 2 && <p className="mt-2 text-sm text-gris">Sin alertas: la oleada grande llega a las 02:30.</p>}
            {idx >= 2 && groups.length === 0 && colAlerts.length === 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-verde">
                <CheckCircle2 size={16} /> Todo en orden. Cuadrantes y Torres dentro de capacidad.
              </p>
            )}
            <div className="mt-2 space-y-2">
              {colAlerts.map((b) => (
                <div key={b.c.id} className="anim-pop flex items-center gap-2 rounded-xl bg-naranja p-3 text-white">
                  <div className="flex-1 text-sm">
                    <b>{b.c.name}</b> al {Math.round((b.n / b.cap) * 100)}% → ¿enviar 2.º camión?
                  </div>
                  <button onClick={() => approveTruck(b.c.id)} className="btn !bg-white !px-3 !py-1 text-naranja">
                    Sí
                  </button>
                </div>
              ))}
              {groups.map((g) => (
                <div key={g.from} className="anim-pop flex items-center gap-2 rounded-xl bg-naranja-soft p-3">
                  <div className="flex-1 text-sm text-bosque">
                    <b>{nm(g.from)}</b> tiene {counts[g.from] ?? 0} paquetes (tope {params.cuadMaxStops}) → ¿pasar {g.moves.length > 1 ? `${g.moves.length} casillas` : '1 casilla'} ({g.orders} ped.) a{' '}
                    <b>{g.to.map(nm).join(', ')}</b> (vecino{g.to.length > 1 ? 's' : ''})?
                  </div>
                  <button onClick={() => g.moves.forEach((m) => approveMove(m.cell))} className="btn-naranja !px-3 !py-1">
                    Aprobar
                  </button>
                </div>
              ))}
              {approved.length > 0 && <p className="text-xs text-verde">✓ {approved.length} movimiento(s) aprobado(s) y recalculado(s).</p>}
              {idx >= 2 && (
                <Link to="/admin" className="mt-1 block rounded-xl bg-bosque p-3 text-xs font-semibold text-white hover:bg-bosque/90">
                  ¿Un cuadrante sigue con más de {params.cuadMaxStops}? En el <span className="text-lima">panel Admin</span> asignas un 2.º motorizado y se parte por zona →
                </Link>
              )}
            </div>
          </div>

          <div className="card p-4">
            <h3 className="font-extrabold text-bosque">Llenado por Torre</h3>
            <div className="mt-2 space-y-2">
              {colBars.map((b) => (
                <Bar key={b.c.id} label={`♜ ${b.c.letter} · ${b.c.short}`} value={b.n} max={b.cap} suffix={`${b.n}/${b.cap} · ${b.vans} camión${b.vans > 1 ? 'es' : ''}`} />
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-bosque">Llenado por cuadrante</h3>
              <span className="text-[11px] text-gris">máx. {params.cuadMaxStops} paradas</span>
            </div>
            <div className="mt-2 max-h-[340px] space-y-1.5 overflow-y-auto pr-1">
              {cuadranteBars.map(({ p, n }) => (
                <Bar key={p.id} label={p.name} value={n} max={params.cuadMaxStops} suffix={String(n)} color={CUAD_PALETTE[p.color % CUAD_PALETTE.length]} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Bar({ label, value, max, suffix, color }: { label: string; value: number; max: number; suffix: string; color?: string }) {
  const pct = Math.min(1.15, value / max)
  const over = value > max
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 truncate font-semibold">{label}</span>
      <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-crema">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, pct * 100)}%`, background: over ? '#F26B21' : (color ?? '#7DBA29') }}
        />
      </div>
      <span className={`w-24 shrink-0 text-right ${over ? 'font-bold text-naranja' : 'text-gris'}`}>{suffix}</span>
    </div>
  )
}
