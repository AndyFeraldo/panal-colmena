import { useMemo, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, Minus, Factory } from 'lucide-react'
import { BaseMap, TorreMarkers, HubMarker, CUAD_PALETTE } from '../components/MapKit'
import { Polyline } from 'react-leaflet'
import { More, NeedResult, ScreenHeader, SimBadge, Tag, fmtInt, fmtMs, fmtNum, fmtPct } from '../components/ui'
import { LevelPicker, WeekdayPicker } from './Planner'
import { fmtTime } from '../sim/geo'
import { TARGETS } from '../sim/params'
import { SCENARIO_LABEL, type Kpis, type Route, type ScenarioKey } from '../sim/types'
import { useSim } from '../store/useSim'

const SC_COLOR: Record<ScenarioKey, string> = { A: '#F26B21', B: '#7DBA29', C: '#00808D' }

export default function Compare() {
  return (
    <NeedResult>
      <CompareInner />
    </NeedResult>
  )
}

type Row = {
  label: string
  get: (k: Kpis) => number
  fmt: (v: number, k: Kpis) => ReactNode
  better: 'higher' | 'lower' | 'none'
  target?: number
  tag?: ReactNode
}

const ROWS: Row[] = [
  { label: 'Paradas por ruta (SPR)', get: (k) => k.spr, fmt: (v) => fmtNum(v), better: 'higher', target: TARGETS.spr, tag: 'Meta 50' },
  { label: 'Máx. paquetes en una ruta', get: (k) => k.maxStops, fmt: (v) => fmtInt(v), better: 'lower', tag: 'Tope 50' },
  { label: 'N.º de rutas', get: (k) => k.routes, fmt: (v) => fmtInt(v), better: 'lower' },
  { label: 'Motos necesarias (turno pico)', get: (k) => k.motosNeeded, fmt: (v) => fmtInt(v), better: 'lower' },
  { label: '% rutas con < 30 paradas', get: (k) => k.pctRoutesUnder30, fmt: (v) => fmtPct(v), better: 'lower' },
  { label: 'Km vacíos (sin entregar)', get: (k) => k.emptyKm, fmt: (v) => fmtInt(v), better: 'lower' },
  { label: 'Pedidos dentro del turno (proxy OTD)', get: (k) => k.otd, fmt: (v) => fmtPct(v), better: 'higher', target: TARGETS.otd, tag: 'Meta 96%' },
  { label: '% rutas que terminan en su turno', get: (k) => k.pctRoutesOnTime, fmt: (v) => fmtPct(v), better: 'higher' },
  { label: 'Carga correcta (proxy nivel de carga)', get: (k) => k.loadCorrect, fmt: (v) => fmtPct(v, 2), better: 'higher', target: TARGETS.load, tag: 'Meta 99,9%' },
  { label: 'Prob. de ≥ 1 error de carga por ruta', get: (k) => k.probRouteError, fmt: (v) => fmtPct(v), better: 'lower' },
  {
    label: 'Tiempo de decisión nocturna',
    get: (k) => k.decisionMs,
    fmt: (v, k) => (k.windowHours === 12 ? <span title="Regla manual por orden de llegada + geocodificación a mano">regla manual*</span> : `${fmtMs(v)} ms`),
    better: 'none',
  },
  { label: 'Geocodificación manual', get: (k) => k.geocodeMin, fmt: (v) => `${fmtInt(v / 60)} h`, better: 'lower' },
  { label: 'Vehículos a cargar en el HUB (turno 1)', get: (k) => k.vehiclesAtHub, fmt: (v, k) => `${fmtInt(v)}${k.trucks ? ` (${k.trucks} camiones)` : ''}`, better: 'lower' },
  { label: 'Viajes para reabastecer', get: (k) => k.reloads, fmt: (v) => fmtInt(v), better: 'lower' },
  { label: 'Ventana prometida al cliente', get: (k) => k.windowHours, fmt: (v) => `${v} h`, better: 'lower' },
]

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
  tag,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  fmt: (v: number) => string
  tag?: ReactNode
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between text-xs font-bold text-bosque">
        <span>{label}</span>
        <span className="rounded-md bg-bosque px-2 py-0.5 text-lima">{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-[#7DBA29]" />
      {tag && <div className="-mt-0.5">{tag}</div>}
    </label>
  )
}

function MiniMap({ routes }: { routes: Route[] }) {
  const result = useSim((s) => s.result)!
  const colorOf = useMemo(() => {
    const m = new Map<string, string>()
    routes.forEach((r, i) => m.set(r.id, CUAD_PALETTE[i % CUAD_PALETTE.length]))
    return m
  }, [routes])
  const hasCol = routes.some((r) => r.depotId !== 'HUB')
  return (
    <BaseMap className="h-[230px]" zoom={10} center={[-12.1, -77.0]} scrollWheel={false}>
      {routes.map((r) => (
        <Polyline
          key={r.id}
          positions={[[r.depot.lat, r.depot.lng], ...r.stops.map((s) => [s.lat, s.lng] as [number, number])]}
          pathOptions={{ color: colorOf.get(r.id), weight: 1.4, opacity: 0.85 }}
          interactive={false}
        />
      ))}
      {hasCol && <TorreMarkers torres={result.torres} cuadrantes={result.map.cuadrantes} showLinks={false} />}
      <HubMarker />
    </BaseMap>
  )
}

function CompareInner() {
  const result = useSim((s) => s.result)!
  const params = useSim((s) => s.params)
  const pctPin = useSim((s) => s.pctPin)
  const setParams = useSim((s) => s.setParams)
  const setPctPin = useSim((s) => s.setPctPin)
  const running = useSim((s) => s.running)
  const sc = result.scenarios
  const keys: ScenarioKey[] = ['A', 'B', 'C']

  const hist = sc.A.kpis.stopsHistogram.map((h, i) => ({
    bucket: h.bucket,
    Hoy: h.count,
    'Tablero f.': sc.B.kpis.stopsHistogram[i].count,
    'TORRE f.': sc.C.kpis.stopsHistogram[i].count,
  }))
  const bars = [
    { name: 'Km vacíos', Hoy: Math.round(sc.A.kpis.emptyKm), 'Tablero f.': Math.round(sc.B.kpis.emptyKm), 'TORRE f.': Math.round(sc.C.kpis.emptyKm) },
  ]
  const otdBars = [
    {
      name: '% a tiempo',
      Hoy: +(sc.A.kpis.otd * 100).toFixed(1),
      'Tablero f.': +(sc.B.kpis.otd * 100).toFixed(1),
      'TORRE f.': +(sc.C.kpis.otd * 100).toFixed(1),
    },
  ]

  return (
    <div className={running ? 'opacity-80 transition' : 'transition'}>
      <ScreenHeader
        kicker="📊 Resultados"
        title="Hoy vs TORRE f."
        hint="Primero, lo que gana el cliente. Abajo, el detalle para la operación: mismos pedidos, 3 formas de armar rutas."
        right={
          <>
            <SimBadge />
            <span className="text-xs text-gris">Mismos {fmtInt(result.orders.length)} pedidos en los 3 escenarios · semilla {params.seed}</span>
          </>
        }
      />

      {/* LO QUE GANA EL CLIENTE: va primero (foco pedido por Saga en mentoría) */}
      <div className="card-dark mb-4 p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-extrabold text-lima md:text-xl">Lo que gana el cliente</h2>
          <span className="text-xs text-white/70">Hoy → con TORRE f.</span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          <BeforeAfter label="Ventana de espera" before={`${sc.A.kpis.windowHours} h`} after={`${sc.C.kpis.windowHours} h`} note={'"de 8 a 8" → ventana de 2 horas'} />
          <BeforeAfter label="Pedidos a tiempo" before={fmtPct(sc.A.kpis.otd, 0)} after={fmtPct(sc.C.kpis.otd, 0)} note="meta del reto: 96%" />
          <BeforeAfter label="Si no está en casa" before="1–2 días" after="mismo día" note="dato de mentoría, por validar" />
          <BeforeAfter
            label="Km sin entregar"
            before={fmtInt(sc.A.kpis.emptyKm)}
            after={`−${Math.round((1 - sc.C.kpis.emptyKm / sc.A.kpis.emptyKm) * 100)}%`}
            note="motos que no vuelven a VES"
          />
        </div>
      </div>

      <div className="card mb-4 grid gap-4 p-4 md:grid-cols-3 xl:grid-cols-[auto_repeat(5,minmax(0,1fr))]">
        <div className="space-y-2">
          <div className="text-xs font-bold text-bosque">Escenario de demanda</div>
          <LevelPicker />
          <WeekdayPicker />
        </div>
        <Slider label="Pedidos por día (base)" value={params.ordersPerDay} min={2000} max={8000} step={250} onChange={(v) => setParams({ ordersPerDay: v })} fmt={fmtInt} tag={<Tag kind="SUPUESTO" />} />
        <Slider label="% pedidos con pin (con Pin f.)" value={pctPin} min={0.5} max={1} step={0.01} onChange={setPctPin} fmt={(v) => fmtPct(v, 0)} tag={<Tag kind="SUPUESTO">Hoy: {fmtPct(params.pctPinToday, 0)}</Tag>} />
        <Slider label="Distancia mínima para Torre" value={params.torreMinDistKm} min={0} max={20} step={0.5} onChange={(v) => setParams({ torreMinDistKm: v })} fmt={(v) => `${fmtNum(v)} km`} />
        <Slider label="Torres como máximo" value={params.maxTorres} min={1} max={5} step={1} onChange={(v) => setParams({ maxTorres: v })} fmt={(v) => `${v} Torre${v === 1 ? "" : "s"}`} tag={<Tag kind="DISEÑO">Mentoría: 1 o 2</Tag>} />
        <Slider label="Tamaño de mochila" value={params.backpackDm3} min={60} max={200} step={5} onChange={(v) => setParams({ backpackDm3: v })} fmt={(v) => `${v} dm³`} />
        <Slider label="Tiempo por parada" value={params.minPerStop} min={2} max={6} step={0.1} onChange={(v) => setParams({ minPerStop: v })} fmt={(v) => `${fmtNum(v)} min`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {keys.map((k) => {
          const kp = sc[k].kpis
          return (
            <div key={k} className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3" style={{ background: SC_COLOR[k] }}>
                <div className="font-extrabold text-white">
                  {k}) {SCENARIO_LABEL[k]}
                </div>
                <span className="chip bg-white/20 text-white">{kp.routes} rutas</span>
              </div>
              <div className="p-1.5">
                <MiniMap routes={sc[k].routes} />
              </div>
              <div className="grid grid-cols-3 gap-2 p-3 pt-1.5 text-center">
                <Mini label="SPR" value={fmtNum(kp.spr)} ok={kp.spr >= TARGETS.spr} />
                <Mini label="A tiempo" value={fmtPct(kp.otd, 1)} ok={kp.otd >= TARGETS.otd} />
                <Mini label="Km vacíos" value={fmtInt(kp.emptyKm)} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="card overflow-x-auto p-4">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gris">
                <th className="py-2">Indicador</th>
                {keys.map((k) => (
                  <th key={k} className="py-2 text-right" style={{ color: SC_COLOR[k] }}>
                    {SCENARIO_LABEL[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => {
                const base = r.get(sc.A.kpis)
                return (
                  <tr key={r.label} className="border-t border-linea">
                    <td className="py-2 pr-2 font-semibold text-bosque">
                      {r.label} {r.tag && <span className="ml-1 text-[10px] font-bold text-turq">{r.tag}</span>}
                    </td>
                    {keys.map((k) => {
                      const v = r.get(sc[k].kpis)
                      return (
                        <td key={k} className="py-2 text-right">
                          <Cell value={v} base={base} better={k === 'A' ? 'none' : r.better} target={r.target}>
                            {r.fmt(v, sc[k].kpis)}
                          </Cell>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <More label="¿Cómo leer la tabla?" className="mt-2 text-xs">Verde = cumple la meta del reto · ámbar = a menos de 10% · flechas = mejora o empeora frente a "Hoy". *Hoy las rutas se arman por orden de llegada; el costo real es la
            geocodificación manual. Proxy OTD = pedido con ETA antes del fin de su turno (06–11, 12–17, 18–21).
          </More>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-extrabold text-bosque">Distribución de paradas por ruta</h3>
            <div className="h-48">
              <ResponsiveContainer>
                <BarChart data={hist} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Hoy" fill={SC_COLOR.A} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Tablero f." fill={SC_COLOR.B} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="TORRE f." fill={SC_COLOR.C} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SmallBar title="Km vacíos" data={bars} />
            <SmallBar title="% pedidos a tiempo" data={otdBars} domain={[50, 100]} />
          </div>
          <div className="rounded-2xl border-2 border-dashed border-naranja bg-white p-4">
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-naranja">
              <Factory size={16} /> Lo que NO resuelve
            </h3>
            <p className="mt-1 text-sm">
              El HUB sigue clasificando {params.hubCapacityPerHour} ped/h: termina a las{' '}
              <b className={sc.A.kpis.sortEnd > 360 ? 'text-naranja' : 'text-bosque'}>{fmtTime(sc.A.kpis.sortEnd)}</b>
              {sc.A.kpis.sortEnd > 360 ? ', después de que salen las motos (06:00).' : '.'}
            </p>
            <div className="mt-2">
              <Tag kind="RETO">700 ped/h · oleadas 15/25/60%</Tag>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Mini({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className={`rounded-xl p-2 ${ok ? 'bg-lima-soft' : 'bg-crema'}`}>
      <div className="text-[10px] font-bold uppercase text-gris">{label}</div>
      <div className="text-lg font-extrabold text-bosque">{value}</div>
    </div>
  )
}

function Cell({ value, base, better, target, children }: { value: number; base: number; better: Row['better']; target?: number; children: ReactNode }) {
  let color = 'text-bosque'
  if (target !== undefined) color = value >= target ? 'text-verde' : value >= target * 0.9 ? 'text-amber-600' : 'text-naranja'
  const diff = value - base
  const improved = better === 'higher' ? diff > 1e-9 : better === 'lower' ? diff < -1e-9 : false
  const worse = better === 'higher' ? diff < -1e-9 : better === 'lower' ? diff > 1e-9 : false
  return (
    <span className={`inline-flex items-center gap-1 font-bold ${color}`}>
      {children}
      {better !== 'none' &&
        (improved ? (
          <ArrowUpRight size={14} className="text-verde" aria-label="mejora" />
        ) : worse ? (
          <ArrowDownRight size={14} className="text-naranja" aria-label="empeora" />
        ) : (
          <Minus size={12} className="text-gris" />
        ))}
    </span>
  )
}

function SmallBar({ title, data, domain }: { title: string; data: Record<string, number | string>[]; domain?: [number, number] }) {
  return (
    <div className="card p-3">
      <h3 className="text-xs font-extrabold text-bosque">{title}</h3>
      <div className="h-36">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 0, left: -22, bottom: 0 }}>
            <XAxis dataKey="name" hide />
            <YAxis tick={{ fontSize: 10 }} domain={domain ?? [0, 'auto']} />
            <Tooltip />
            <Bar dataKey="Hoy" fill={SC_COLOR.A} radius={[3, 3, 0, 0]} />
            <Bar dataKey="Tablero f." fill={SC_COLOR.B} radius={[3, 3, 0, 0]} />
            <Bar dataKey="TORRE f." fill={SC_COLOR.C} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function BeforeAfter({ label, before, after, note }: { label: string; before: string; after: string; note: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-white/70">{label}</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="text-base font-bold text-white/60 line-through decoration-naranja decoration-2">{before}</span>
        <span className="text-2xl font-extrabold text-lima md:text-3xl">{after}</span>
      </div>
      <div className="text-[11px] text-white/70">{note}</div>
    </div>
  )
}
