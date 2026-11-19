import { useEffect, useMemo, useRef, useState } from 'react'
import { Bike, PackageX, RefreshCw } from 'lucide-react'
import { Marker, Polyline } from 'react-leaflet'
import { BaseMap, FitTo, HubMarker, RouteLine, torreIcon } from '../components/MapKit'
import { More, NeedResult, PhoneFrame, ScreenHeader, SimBadge, fmtNum } from '../components/ui'
import { anaContext } from '../components/demoSteps'
import { HUB, type LatLng } from '../sim/data'
import { fmtTime, roadKm } from '../sim/geo'
import { useSim } from '../store/useSim'

export default function Rider() {
  return (
    <NeedResult>
      <RiderInner />
    </NeedResult>
  )
}

function RiderInner() {
  const result = useSim((s) => s.result)!
  const params = useSim((s) => s.params)
  const ctx = anaContext(result)
  const C = result.scenarios.C
  const max = params.cuadMaxStops

  // Carlos (ruta de Ana) + otros motorizados de su misma Torre + una ruta directa del HUB
  const options = useMemo(() => {
    const base = ctx?.route
    if (!base) return C.routes.slice(0, 6)
    const same = C.routes.filter((r) => r.id !== base.id && r.depotId === base.depotId && r.shift === 1).slice(0, 5)
    const direct = C.routes.find((r) => r.depotId === 'HUB' && r.shift === 1)
    return [base, ...same, ...(direct ? [direct] : [])]
  }, [C, ctx?.route])
  const [routeId, setRouteId] = useState(options[0]?.id)
  const [empty, setEmpty] = useState(false)
  const emptyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (empty) emptyRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [empty])
  const route = options.find((r) => r.id === routeId) ?? options[0]
  if (!route) return <div className="card p-6">No se encontró la ruta.</div>

  const torre = result.torres.find((c) => c.id === route.depotId)
  const deliveries = route.stops.filter((s) => s.kind === 'delivery')
  const first = deliveries[0]
  const kmFromStart = roadKm(route.depot, first, params.detourFactor)
  const kmFromHub = roadKm(HUB, first, params.detourFactor)
  const minOf = (km: number) => (km / params.motoSpeedKmh) * 60
  const reload = route.stops.find((s) => s.kind === 'reload')

  // ¿Dónde se queda sin paquetes? justo antes de la parada de reabastecimiento (o al 60% de la ruta)
  const reloadIdx = route.stops.findIndex((s) => s.kind === 'reload')
  const emptyAt = reloadIdx > 0 ? route.stops[reloadIdx - 1] : deliveries[Math.floor(deliveries.length * 0.6)] ?? first
  const torresActivas = result.torres.filter((t) => t.cuadIds.length > 0)
  const nearest =
    torre ??
    [...torresActivas].sort((a, b) => roadKm(emptyAt, a, params.detourFactor) - roadKm(emptyAt, b, params.detourFactor))[0]
  const kmTorre = nearest ? roadKm(emptyAt, nearest, params.detourFactor) : Infinity
  const kmHub = roadKm(emptyAt, HUB, params.detourFactor)
  const goTorre = nearest && kmTorre < kmHub
  const pctFull = Math.min(1, deliveries.length / max)

  return (
    <div>
      <ScreenHeader
        kicker="🛵 Motorizado · vista ilustrativa"
        title={`${route.rider}, cuadrante ${route.label}`}
        hint="Prueba el botón “Me quedé sin paquetes”."
        right={<SimBadge />}
      >
        El motorizado usa la <b>app de ruteo de siempre</b>. Aquí solo mostramos lo que cambia: su cuadrante tiene <b>máximo {max} paquetes</b>, recoge su caja en la cita con su Torre y, si se
        queda sin paquetes, <b>cambia la caja en la siguiente cita, no vuelve al almacén</b>.
      </ScreenHeader>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {options.map((r) => (
          <button
            key={r.id}
            onClick={() => {
              setRouteId(r.id)
              setEmpty(false)
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${r.id === route.id ? 'bg-bosque text-lima' : 'bg-white text-bosque shadow-sm'}`}
          >
            🛵 {r.rider} · {r.label}
            {r.id === ctx?.route?.id && ' (Ana)'}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[400px_1fr]">
        <PhoneFrame
          time={empty ? fmtTime(emptyAt.eta + 2) : fmtTime(route.startTime - 10)}
          title={
            <div className="bg-bosque px-4 py-3 text-white">
              <div className="flex items-center gap-2 font-bold">
                <Bike size={16} className="text-lima" /> Tu ruta de hoy
              </div>
              <div className="text-[11px] text-white/80">App de ruteo de siempre (ilustrativa, no es la interfaz real)</div>
            </div>
          }
        >
          <div className="space-y-3 p-4">
            <div className="rounded-xl bg-crema p-3">
              <div className="flex items-center justify-between">
                <span className="chip bg-bosque text-lima">Cuadrante {route.label}</span>
                <span className="text-[11px] font-semibold text-gris">Turno {route.shift}</span>
              </div>
              <div className="mt-2 text-sm font-extrabold text-bosque">Inicio: {torre ? `♜ ${torre.name}` : 'HUB VES (cuadrante cercano)'}</div>
              <div className="text-xs text-gris">
                {torre ? `A ${Math.round(minOf(kmFromStart))} min de tu primera parada` : `${Math.round(minOf(kmFromHub))} min hasta tu primera parada`}
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-bosque">
                    {deliveries.length} / {max} paquetes
                  </span>
                  <span className={deliveries.length <= max ? 'text-verde' : 'text-naranja'}>{deliveries.length <= max ? '✓ dentro del tope' : 'sobre el tope'}</span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-verde" style={{ width: `${pctFull * 100}%` }} />
                </div>
              </div>
            </div>

            {empty && (
              <div ref={emptyRef} className="anim-pop scroll-mt-2 space-y-2 rounded-xl bg-bosque p-3 text-white">
                <div className="flex items-center gap-2 text-sm font-extrabold text-lima">
                  <PackageX size={16} /> Te quedaste sin paquetes · {fmtTime(emptyAt.eta)}
                </div>
                {goTorre ? (
                  <>
                    <div className="rounded-lg bg-lima p-2.5 text-bosque">
                      <div className="text-xs font-bold uppercase">Ve a tu Torre</div>
                      <div className="text-base font-extrabold">♜ {nearest!.name}</div>
                      <div className="text-xs font-semibold">
                        {fmtNum(kmTorre)} km · {Math.round(minOf(kmTorre))} min · te reabastecen en {params.reloadMinutes} min
                      </div>
                    </div>
                    <div className="rounded-lg bg-white/10 p-2.5 text-xs">
                      <span className="line-through opacity-70">
                        Volver al almacén VES: {fmtNum(kmHub, 0)} km · {Math.round(minOf(kmHub))} min
                      </span>
                      <div className="mt-0.5 font-bold text-lima">
                        Ahorras ~{Math.round(minOf(kmHub) - minOf(kmTorre)) * 2} min de ida y vuelta. No volvemos al almacén.
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg bg-white/10 p-2.5 text-xs">
                    Tu cuadrante está cerca del HUB: volver a VES son {fmtNum(kmHub)} km ({Math.round(minOf(kmHub))} min). Aquí no hace falta Torre.
                  </div>
                )}
              </div>
            )}

            <div className="divide-y divide-linea rounded-xl border border-linea text-sm">
              {route.stops.map((s, i) =>
                s.kind === 'reload' ? (
                  <div key={i} className="flex items-center justify-between bg-naranja-soft px-3 py-2 font-bold text-naranja">
                    <span className="flex items-center gap-1.5">
                      <RefreshCw size={14} /> Reabastecer en la Torre
                    </span>
                    <span>~{fmtTime(s.eta)}</span>
                  </div>
                ) : (
                  <div key={i} className={`flex items-center justify-between px-3 py-2 ${s.orderId === 'F-208341' ? 'bg-lima-soft font-bold' : ''}`}>
                    <span className="truncate">
                      {s.seq} · {result.orders.find((o) => o.id === s.orderId)?.address.split(',')[0]}
                      {s.orderId === 'F-208341' && ' (Ana)'}
                    </span>
                    <span className="shrink-0 text-gris">{fmtTime(s.eta)}</span>
                  </div>
                ),
              )}
            </div>
          </div>
          <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-linea bg-white p-3">
            <button className="btn-dark !py-3">Iniciar ruta</button>
            <button onClick={() => setEmpty((e) => !e)} className={`btn !py-3 ${empty ? 'bg-crema text-bosque' : 'btn-naranja'}`}>
              <PackageX size={16} /> {empty ? 'Volver' : 'Me quedé sin paquetes'}
            </button>
          </div>
        </PhoneFrame>

        <div className="space-y-4">
          <div className="card overflow-hidden p-1.5">
            <BaseMap className="h-[420px]" zoom={13}>
              <FitTo points={empty ? [emptyAt, ...(nearest ? [nearest] : []), HUB] : [route.depot, ...route.stops]} deps={route.id + empty} />
              <RouteLine route={route} color="#1C4A2F" numbered={!empty} />
              {empty && <EmptyLines from={emptyAt} torre={goTorre ? nearest! : null} />}
              {nearest && <Marker position={[nearest.lat, nearest.lng]} icon={torreIcon(`${nearest.letter} · ${nearest.short}`, true)} />}
              <HubMarker />
            </BaseMap>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="card border-l-4 border-naranja p-4">
              <div className="text-[11px] font-bold uppercase text-naranja">Antes</div>
              <div className="text-lg font-extrabold text-bosque">Inicio y recarga en HUB VES</div>
              <div className="text-sm text-gris">
                ~{Math.round(kmFromHub)} km · {Math.round(minOf(kmFromHub))} min hasta la 1.ª parada
              </div>
            </div>
            <div className="card border-l-4 border-verde p-4">
              <div className="text-[11px] font-bold uppercase text-verde">Con TORRE f.</div>
              <div className="text-lg font-extrabold text-bosque">{torre ? 'Inicio en su Torre' : 'Directo del HUB (cerca)'}</div>
              <div className="text-sm text-gris">
                ~{fmtNum(kmFromStart)} km · {Math.round(minOf(kmFromStart))} min hasta la 1.ª parada
              </div>
            </div>
            <div className="card p-4">
              <div className="text-[11px] font-bold uppercase text-gris">Ruta de hoy</div>
              <div className="text-lg font-extrabold text-bosque">
                {deliveries.length} paradas · {route.reloads} reabastecimiento(s)
              </div>
              <div className="text-sm text-gris">
                {fmtTime(route.startTime)} → {fmtTime(route.endTime)} · {fmtNum(route.totalKm)} km · {route.onTime ? '✓ a tiempo' : '✕ fuera del turno'}
              </div>
            </div>
          </div>
          {reload && (
            <div className="rounded-2xl bg-naranja-soft p-4 text-sm text-bosque">
              <b>↻ {fmtTime(reload.eta)}:</b> se reabastece en la Torre ({params.reloadMinutes} min). Sin Torre: volver ~{Math.round(roadKm(reload, HUB, params.detourFactor))} km a VES.
            </div>
          )}
          <More label="ℹ️ Sobre esta vista">
            Vista ilustrativa: el motorizado usa la app de SimpliRoute de siempre; aquí solo mostramos qué cambia. El orden de paradas simula la optimización de SimpliRoute
            (vecino más cercano + 2-opt). El botón “Me quedé sin paquetes” es una propuesta para validar con Falabella.
          </More>
        </div>
      </div>
    </div>
  )
}

function EmptyLines({ from, torre }: { from: LatLng; torre: LatLng | null }) {
  return (
    <>
      <Polyline positions={[[from.lat, from.lng], [HUB.lat, HUB.lng]]} pathOptions={{ color: '#F26B21', weight: 3, dashArray: '6 8', opacity: 0.8 }} />
      {torre && <Polyline positions={[[from.lat, from.lng], [torre.lat, torre.lng]]} pathOptions={{ color: '#7DBA29', weight: 5, opacity: 0.95 }} />}
    </>
  )
}

