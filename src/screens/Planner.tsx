import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hexagon, Send, Undo2, MousePointerClick } from 'lucide-react'
import { BaseMap, CellLabels, ColmenaMarkers, DistrictLayer, HubMarker, PANAL_PALETTE, PanalLayer } from '../components/MapKit'
import { KpiCard, NeedResult, ScreenHeader, SimBadge, Tag, fmtInt, fmtNum, fmtPct } from '../components/ui'
import { routingProvider } from '../integration/MockSimpliRouteProvider'
import { borderNeighbors } from '../sim/panales'
import { DEMAND_LEVELS, WEEKDAYS } from '../sim/params'
import { useSim } from '../store/useSim'

export default function Planner() {
  return (
    <NeedResult>
      <PlannerInner />
    </NeedResult>
  )
}

export function LevelPicker() {
  const level = useSim((s) => s.level)
  const setLevel = useSim((s) => s.setLevel)
  return (
    <div className="inline-flex rounded-xl bg-white p-1 shadow-sm" role="group" aria-label="Nivel de demanda">
      {DEMAND_LEVELS.map((l) => (
        <button
          key={l}
          onClick={() => setLevel(l)}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${level === l ? (l === 'Cyber' ? 'bg-naranja text-white' : 'bg-bosque text-lima') : 'text-bosque hover:bg-crema'}`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

export function WeekdayPicker() {
  const weekday = useSim((s) => s.weekday)
  const setWeekday = useSim((s) => s.setWeekday)
  return (
    <select
      value={weekday}
      onChange={(e) => setWeekday(Number(e.target.value))}
      className="rounded-xl border-0 bg-white px-3 py-2 text-xs font-bold text-bosque shadow-sm"
      aria-label="Día de la semana"
    >
      {WEEKDAYS.map((d, i) => (
        <option key={d} value={i}>
          {d}
          {i === 0 ? ' (pico +20%)' : ''}
        </option>
      ))}
    </select>
  )
}

function PlannerInner() {
  const result = useSim((s) => s.result)!
  const pctPin = useSim((s) => s.pctPin)
  const overrides = useSim((s) => s.overrides)
  const moveCell = useSim((s) => s.moveCell)
  const clearOverrides = useSim((s) => s.clearOverrides)
  const log = useSim((s) => s.log)
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string | null>(null)
  const [cell, setCell] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const { map, colmenas } = result

  const stats = useMemo(() => {
    const n = map.panales.length
    const avg = map.panales.reduce((s, p) => s + p.expStops, 0) / n
    const cross = map.panales.filter((p) => p.districts.length > 1).length / n
    const usedCol = colmenas.filter((c) => c.panalIds.length > 0)
    const inCol = map.panales.filter((p) => p.colmenaId).length
    return { n, avg, cross, usedCol, inCol }
  }, [map, colmenas])

  const panal = map.panales.find((p) => p.id === selected)
  const colmena = colmenas.find((c) => c.id === panal?.colmenaId)
  const neighborsOfCell = cell ? borderNeighbors(cell, map.cellToPanal) : []

  const publish = async () => {
    setPublishing(true)
    const e1 = await routingProvider.publishZones(map.panales, 'P2 · Planificador')
    const e2 = await routingProvider.publishVehicles(colmenas, 'P2 · Planificador')
    const e3 = await routingProvider.registerWebhook('P2 · Planificador')
    log([...e3, ...e2, ...e1])
    setPublishing(false)
    navigate('/integracion')
  }

  return (
    <div>
      <ScreenHeader
        kicker="P2 · Planificador logístico · de día"
        title="Mapa de panales y Colmenas"
        right={
          <>
            <LevelPicker />
            <WeekdayPicker />
          </>
        }
      >
        Lima en hexágonos H3 (res. 8). Cada color es un <b>panal</b> = una ruta estática de ~50 paradas, armado con 8 semanas de historial. Las líneas punteadas son los
        límites de distrito: los panales los cruzan.
      </ScreenHeader>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="card relative overflow-hidden p-1.5">
          <BaseMap className="h-[min(68vh,640px)]" zoom={11.5} center={[-12.09, -77.02]}>
            <PanalLayer
              panales={map.panales}
              cellToPanal={map.cellToPanal}
              selected={selected}
              onPanalClick={(id) => setSelected(id)}
              onCellClick={(c) => setCell(c)}
            />
            <DistrictLayer highlight={panal?.districts} />
            <CellLabels demand={map.cellDemand} />
            <ColmenaMarkers colmenas={colmenas} panales={map.panales} activeId={colmena?.id} />
            <HubMarker />
          </BaseMap>
          <div className="pointer-events-none absolute bottom-4 left-4 z-[500] flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold shadow">
            <MousePointerClick size={13} /> Clic en un panal para ver su detalle · haz zoom para ver pedidos por celda
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <KpiCard label="Panales" value={stats.n} sub={`mapa ${map.level} · ${WEEKDAYS[map.weekday]}`} tone="dark" icon={<Hexagon size={12} />} />
            <KpiCard label="Paradas prom." value={fmtNum(stats.avg)} sub="esperadas por panal" />
            <KpiCard label="Cruzan distritos" value={fmtPct(stats.cross, 0)} sub="de los panales" />
            <KpiCard label="Colmenas" value={stats.usedCol.length} sub={`${stats.inCol} panales · ${stats.usedCol.reduce((s, c) => s + c.minivans, 0)} minivan(es)`} tone="turq" />
            <KpiCard label="Pedidos con pin" value={fmtPct(pctPin, 0)} sub="con Pin f." tone="lima" />
            <KpiCard label="Celdas activas" value={fmtInt(Object.keys(map.cellToPanal).length)} sub="≈ 0,74 km² c/u" />
          </div>
          <div className="flex items-center gap-2">
            <SimBadge />
            <Tag kind="SUPUESTO">Historial sintético 8 semanas</Tag>
          </div>

          {panal ? (
            <div className="card anim-pop p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-md" style={{ background: PANAL_PALETTE[panal.color % PANAL_PALETTE.length] }} />
                  <span className="text-xl font-extrabold text-bosque">{panal.id}</span>
                </div>
                <button className="text-xs text-gris hover:underline" onClick={() => setSelected(null)}>
                  cerrar
                </button>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <dt className="text-gris">Celdas</dt>
                <dd className="font-semibold">{panal.cells.length}</dd>
                <dt className="text-gris">Paradas esperadas</dt>
                <dd className="font-semibold">{fmtNum(panal.expStops)}</dd>
                <dt className="text-gris">Volumen</dt>
                <dd className="font-semibold">{fmtInt(panal.expVolume)} dm³</dd>
                <dt className="text-gris">Tiempo estimado</dt>
                <dd className="font-semibold">
                  {Math.floor(panal.estMinutes / 60)} h {Math.round(panal.estMinutes % 60)} min
                </dd>
                <dt className="text-gris">Distancia al HUB</dt>
                <dd className="font-semibold">{fmtNum(panal.distHubKm)} km</dd>
                <dt className="text-gris">Sale desde</dt>
                <dd className="font-semibold text-turq">{colmena ? `🚐 ${colmena.name}` : '🏭 HUB VES'}</dd>
              </dl>
              <div className="mt-3">
                <div className="text-[11px] font-bold uppercase text-gris">Distritos que cruza</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {panal.districts.map((d) => (
                    <span key={d} className="chip bg-turq-soft text-turq">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
              {cell && map.cellToPanal[cell] === panal.id && neighborsOfCell.length > 0 && (
                <div className="mt-3 rounded-xl bg-crema p-3">
                  <div className="text-xs font-bold text-bosque">Celda de borde seleccionada ({Math.round(map.cellDemand[cell] ?? 0)} pedidos esperados)</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {neighborsOfCell.map((n) => (
                      <button
                        key={n}
                        onClick={() => {
                          moveCell(cell, n)
                          setSelected(n)
                        }}
                        className="btn-dark !px-2.5 !py-1 !text-xs"
                      >
                        Mover a {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {cell && map.cellToPanal[cell] === panal.id && neighborsOfCell.length === 0 && (
                <p className="mt-3 text-xs text-gris">Esa celda está al interior del panal. Elige una celda del borde para moverla a un panal vecino.</p>
              )}
            </div>
          ) : (
            <div className="card p-4 text-sm text-gris">Selecciona un panal en el mapa para ver qué distritos cruza, sus paradas, volumen, tiempo y su Colmena.</div>
          )}

          {Object.keys(overrides).length > 0 && (
            <button onClick={clearOverrides} className="btn-ghost w-full">
              <Undo2 size={16} /> Deshacer {Object.keys(overrides).length} ajuste(s) manual(es)
            </button>
          )}
          <button onClick={publish} disabled={publishing} className="btn-turq w-full !py-3 !text-base">
            <Send size={18} /> Publicar en SimpliRoute
          </button>
          <p className="text-center text-[11px] text-gris">Panales → Zonas · Colmenas → Vehículo + inicio · Webhook de entregas (simulado)</p>
        </div>
      </div>
    </div>
  )
}
