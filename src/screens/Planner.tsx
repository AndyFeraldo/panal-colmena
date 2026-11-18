import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Diamond, Send, Undo2 } from 'lucide-react'
import { BarrierLayer, BarrierLegend, BaseMap, CellLabels, TorreMarkers, DistrictLayer, HubMarker, CUAD_PALETTE, CuadranteLayer, CuadranteNames, MapLegend, MapModePicker, heatBreaks, type MapMode } from '../components/MapKit'
import { KpiCard, NeedResult, ScreenHeader, fmtInt, fmtNum, fmtPct } from '../components/ui'
import { routingProvider } from '../integration/MockSimpliRouteProvider'
import { borderNeighbors } from '../sim/cuadrantes'
import { cuadrantesCrossingBarriers } from '../sim/barriers'
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
  const overrides = useSim((s) => s.overrides)
  const moveCell = useSim((s) => s.moveCell)
  const clearOverrides = useSim((s) => s.clearOverrides)
  const respect = useSim((s) => s.params.respectBarriers)
  const setParams = useSim((s) => s.setParams)
  const log = useSim((s) => s.log)
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string | null>(null)
  const [cell, setCell] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [mode, setMode] = useState<MapMode>('calor')
  const { map, torres } = result

  const stats = useMemo(() => {
    const n = map.cuadrantes.length
    const avg = map.cuadrantes.reduce((s, p) => s + p.expStops, 0) / n
    const cross = map.cuadrantes.filter((p) => p.districts.length > 1).length / n
    const usedCol = torres.filter((c) => c.cuadIds.length > 0)
    const inCol = map.cuadrantes.filter((p) => p.torreId).length
    const barrierCross = cuadrantesCrossingBarriers(map.cuadrantes)
    return { n, avg, cross, usedCol, inCol, barrierCross }
  }, [map, torres])

  const breaks = useMemo(() => heatBreaks(Object.values(map.cellDemand)), [map])
  const nm = (id: string) => map.cuadrantes.find((q) => q.id === id)?.name ?? id
  const cuadrante = map.cuadrantes.find((p) => p.id === selected)
  const torre = torres.find((c) => c.id === cuadrante?.torreId)
  const neighborsOfCell = cell ? borderNeighbors(cell, map.cellToCuad, respect) : []

  const publish = async () => {
    setPublishing(true)
    const e1 = await routingProvider.publishZones(map.cuadrantes, 'P2 · Planificador')
    const e2 = await routingProvider.publishVehicles(torres, 'P2 · Planificador')
    const e3 = await routingProvider.registerWebhook('P2 · Planificador')
    log([...e3, ...e2, ...e1])
    setPublishing(false)
    navigate('/integracion')
  }

  return (
    <div>
      <ScreenHeader
        kicker="🗺️ Planificador · de día"
        title="El tablero de Lima"
        hint="Más oscuro = más paquetes. Haz clic en un cuadrante para ver su detalle."
        right={
          <>
            <LevelPicker />
            <WeekdayPicker />
          </>
        }
      >
        Lima como un tablero: <b>casillas en rombo de ~8 cuadras</b>. Las casillas vecinas se juntan en <b>cuadrantes de máximo 50 paquetes</b> (1 ruta), armados con 8 semanas de
        historial y nombrados por su Torre (A1, A2…) o H si salen directo del HUB. Las líneas punteadas son los límites de distrito: los cuadrantes los cruzan. Las líneas <b>naranjas (vías rápidas)</b> y <b>azules (ríos)</b> no se cruzan nunca: la Panamericana parte el tablero.
        <br />
        <b>3 vistas del mapa:</b> 🔥 Calor = dónde hay más paquetes (la vista para decidir) · ◆ Cuadrantes = un color por ruta · ♜ Tablero = negro lo atiende una Torre,
        blanco sale directo del HUB (es la imagen de marca; va semitransparente para no tapar las calles). Datos: historial sintético de 8 semanas.
      </ScreenHeader>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="card relative overflow-hidden p-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2 pt-1">
            <MapModePicker mode={mode} onChange={setMode} />
            <div className="flex flex-wrap items-center gap-3">
              <BarrierLegend />
              <MapLegend mode={mode} breaks={breaks} unit="Paquetes esperados por casilla" />
            </div>
          </div>
          <BaseMap className="h-[min(68vh,640px)]" zoom={11.5} center={[-12.09, -77.02]}>
            <CuadranteLayer
              cuadrantes={map.cuadrantes}
              cellToCuad={map.cellToCuad}
              selected={selected}
              onCuadranteClick={(id) => setSelected(id)}
              onCellClick={(c) => setCell(c)}
              mode={mode}
              heat={map.cellDemand}
              breaks={breaks}
            />
            <DistrictLayer highlight={cuadrante?.districts} />
            <BarrierLayer highlight={!respect} />
            <CellLabels demand={map.cellDemand} />
            <CuadranteNames cuadrantes={map.cuadrantes} minZoom={12} dark={(q) => (mode === 'tablero' ? !!q.torreId : mode === 'calor' ? q.expStops / Math.max(1, q.cells.length) >= breaks[3] : false)} />
            <TorreMarkers torres={torres} cuadrantes={map.cuadrantes} activeId={torre?.id} />
            <HubMarker />
          </BaseMap>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <KpiCard label="Cuadrantes" value={stats.n} sub={`mapa ${map.level} · ${WEEKDAYS[map.weekday]}`} tone="dark" icon={<Diamond size={12} />} />
            <KpiCard label="Paquetes prom." value={fmtNum(stats.avg)} sub="por cuadrante · tope 50" />
            <KpiCard label="Cruzan distritos" value={fmtPct(stats.cross, 0)} sub="de los cuadrantes" />
            <KpiCard label="Torres" value={stats.usedCol.length} sub={`${stats.inCol} cuadrantes · ${stats.usedCol.reduce((s, c) => s + c.trucks, 0)} camión(es)`} tone="turq" />
          </div>

          <div className={`rounded-2xl p-4 ${stats.barrierCross.size === 0 ? 'bg-lima-soft' : 'bg-naranja-soft'}`}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-bosque/70">Cruzan Panamericana, vía rápida o río</div>
                <div className={`text-2xl font-extrabold ${stats.barrierCross.size === 0 ? 'text-bosque' : 'text-naranja'}`}>
                  {stats.barrierCross.size} cuadrante{stats.barrierCross.size === 1 ? '' : 's'}
                </div>
              </div>
              <label className="flex cursor-pointer flex-col items-center gap-1 text-[11px] font-bold text-bosque">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[#12301F]"
                  checked={respect}
                  onChange={(e) => setParams({ respectBarriers: e.target.checked })}
                />
                Respetar
              </label>
            </div>
            {stats.barrierCross.size > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {[...stats.barrierCross.keys()].slice(0, 12).map((id) => (
                  <button key={id} onClick={() => setSelected(id)} className="chip bg-white text-naranja hover:underline">
                    {nm(id)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-bosque/80">Las casillas a los dos lados de una vía rápida o un río nunca se juntan en la misma ruta.</p>
            )}
          </div>

          {cuadrante ? (
            <div className="card anim-pop p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-md" style={{ background: CUAD_PALETTE[cuadrante.color % CUAD_PALETTE.length] }} />
                  <span className="text-xl font-extrabold text-bosque">Cuadrante {cuadrante.name}</span>
                </div>
                <button className="text-xs text-gris hover:underline" onClick={() => setSelected(null)}>
                  cerrar
                </button>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <dt className="text-gris">Casillas</dt>
                <dd className="font-semibold">{cuadrante.cells.length}</dd>
                <dt className="text-gris">Paquetes esperados</dt>
                <dd className="font-semibold">{fmtNum(cuadrante.expStops)} / 50</dd>
                <dt className="text-gris">Volumen</dt>
                <dd className="font-semibold">{fmtInt(cuadrante.expVolume)} dm³</dd>
                <dt className="text-gris">Tiempo estimado</dt>
                <dd className="font-semibold">
                  {Math.floor(cuadrante.estMinutes / 60)} h {Math.round(cuadrante.estMinutes % 60)} min
                </dd>
                <dt className="text-gris">Distancia al HUB</dt>
                <dd className="font-semibold">{fmtNum(cuadrante.distHubKm)} km</dd>
                <dt className="text-gris">Sale desde</dt>
                <dd className="font-semibold text-turq">{torre ? `♜ ${torre.name}` : '🏭 HUB VES (directo)'}</dd>
              </dl>
              <div className="mt-3">
                <div className="text-[11px] font-bold uppercase text-gris">Distritos que cruza</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {cuadrante.districts.map((d) => (
                    <span key={d} className="chip bg-turq-soft text-turq">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
              {stats.barrierCross.has(cuadrante.id) && (
                <p className="mt-3 rounded-xl bg-naranja-soft p-2 text-xs font-semibold text-naranja">
                  ⚠️ Este cuadrante cruza: {stats.barrierCross.get(cuadrante.id)!.join(' · ')}
                </p>
              )}
              {cell && map.cellToCuad[cell] === cuadrante.id && neighborsOfCell.length > 0 && (
                <div className="mt-3 rounded-xl bg-crema p-3">
                  <div className="text-xs font-bold text-bosque">Casilla de borde seleccionada ({Math.round(map.cellDemand[cell] ?? 0)} paquetes esperados)</div>
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
                        Mover a {nm(n)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {cell && map.cellToCuad[cell] === cuadrante.id && neighborsOfCell.length === 0 && (
                <p className="mt-3 text-xs text-gris">Esa casilla está al interior del cuadrante. Elige una casilla del borde para moverla a un cuadrante vecino.</p>
              )}
            </div>
          ) : (
            <div className="card p-4 text-center text-sm font-semibold text-gris">👆 Toca un cuadrante en el mapa</div>
          )}

          {Object.keys(overrides).length > 0 && (
            <button onClick={clearOverrides} className="btn-ghost w-full">
              <Undo2 size={16} /> Deshacer {Object.keys(overrides).length} ajuste(s) manual(es)
            </button>
          )}
          <button onClick={publish} disabled={publishing} className="btn-turq w-full !py-3 !text-base">
            <Send size={18} /> Publicar en SimpliRoute
          </button>
        </div>
      </div>
    </div>
  )
}

