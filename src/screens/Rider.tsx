import { Bike, Info, RefreshCw } from 'lucide-react'
import { BaseMap, FitTo, HubMarker, RouteLine, colmenaIcon } from '../components/MapKit'
import { Marker } from 'react-leaflet'
import { NeedResult, PhoneFrame, ScreenHeader, SimBadge, fmtNum } from '../components/ui'
import { anaContext } from '../components/demoSteps'
import { HUB } from '../sim/data'
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
  const route = ctx?.route
  if (!route) return <div className="card p-6">No se encontró la ruta de Carlos.</div>
  const colmena = result.colmenas.find((c) => c.id === route.depotId)
  const first = route.stops.find((s) => s.kind === 'delivery')!
  const kmFromStart = roadKm(route.depot, first, params.detourFactor)
  const kmFromHub = roadKm(HUB, first, params.detourFactor)
  const minFromStart = (kmFromStart / params.motoSpeedKmh) * 60
  const minFromHub = (kmFromHub / params.motoSpeedKmh) * 60
  const deliveries = route.stops.filter((s) => s.kind === 'delivery')
  const reload = route.stops.find((s) => s.kind === 'reload')

  return (
    <div>
      <ScreenHeader kicker="P5 · Motorizado · vista genérica ilustrativa" title={`Carlos, panal ${route.label}`} right={<SimBadge />}>
        El motorizado usa la <b>app de SimpliRoute de siempre</b>. Aquí solo mostramos lo que cambia: empieza en la Colmena y recarga ahí.
      </ScreenHeader>
      <div className="grid items-start gap-6 lg:grid-cols-[400px_1fr]">
        <PhoneFrame
          time={fmtTime(route.startTime - 10)}
          title={
            <div className="bg-[#2f4fb5] px-4 py-3 text-white">
              <div className="flex items-center gap-2 font-bold">
                <Bike size={16} /> Tu ruta de hoy
              </div>
              <div className="text-[11px] text-white/80">App de ruteo de siempre (ilustrativa, no es la interfaz real)</div>
            </div>
          }
        >
          <div className="space-y-3 p-4">
            <div className="rounded-xl bg-crema p-3">
              <div className="text-sm font-extrabold text-bosque">
                Inicio: {colmena ? colmena.name : 'HUB VES'}
              </div>
              <div className="text-xs text-gris">
                Ya no en el HUB de VES · {Math.round(minFromStart)} min de tu panal
              </div>
              <span className="chip mt-1 bg-[#dfe6fb] text-[#2f4fb5]">Zona {route.label}</span>
            </div>
            <div className="divide-y divide-linea rounded-xl border border-linea text-sm">
              {route.stops.map((s, i) =>
                s.kind === 'reload' ? (
                  <div key={i} className="flex items-center justify-between bg-naranja-soft px-3 py-2 font-bold text-naranja">
                    <span className="flex items-center gap-1.5">
                      <RefreshCw size={14} /> Recarga en Colmena
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
          <div className="sticky bottom-0 border-t border-linea bg-white p-3">
            <button className="btn w-full !bg-[#2f4fb5] !py-3 text-white">Iniciar ruta</button>
          </div>
        </PhoneFrame>

        <div className="space-y-4">
          <div className="card overflow-hidden p-1.5">
            <BaseMap className="h-[420px]" zoom={13}>
              <FitTo points={[route.depot, ...route.stops]} deps={route.id} />
              <RouteLine route={route} color="#2f4fb5" numbered />
              {colmena && <Marker position={[colmena.lat, colmena.lng]} icon={colmenaIcon(colmena.short, true)} />}
              <HubMarker />
            </BaseMap>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="card border-l-4 border-naranja p-4">
              <div className="text-[11px] font-bold uppercase text-naranja">Antes</div>
              <div className="text-lg font-extrabold text-bosque">Inicio en HUB VES</div>
              <div className="text-sm text-gris">
                ~{Math.round(kmFromHub)} km · {Math.round(minFromHub)} min hasta la 1.ª parada
              </div>
            </div>
            <div className="card border-l-4 border-verde p-4">
              <div className="text-[11px] font-bold uppercase text-verde">Ahora</div>
              <div className="text-lg font-extrabold text-bosque">Inicio en la Colmena</div>
              <div className="text-sm text-gris">
                ~{fmtNum(kmFromStart)} km · {Math.round(minFromStart)} min hasta la 1.ª parada
              </div>
            </div>
            <div className="card p-4">
              <div className="text-[11px] font-bold uppercase text-gris">Ruta de hoy</div>
              <div className="text-lg font-extrabold text-bosque">
                {deliveries.length} paradas · {route.reloads} recarga(s)
              </div>
              <div className="text-sm text-gris">
                {fmtTime(route.startTime)} → {fmtTime(route.endTime)} · {fmtNum(route.totalKm)} km
              </div>
            </div>
          </div>
          {reload && (
            <div className="rounded-2xl bg-naranja-soft p-4 text-sm text-bosque">
              <b>~{fmtTime(reload.eta)}:</b> a Carlos se le vacía la mochila ({params.backpackDm3} dm³). Recarga en la Colmena en {params.reloadMinutes} min y sigue. Sin Colmena tendría que
              volver ~{Math.round(roadKm(reload, HUB, params.detourFactor))} km hasta Villa El Salvador.
            </div>
          )}
          <div className="flex items-start gap-2 rounded-2xl bg-white p-4 text-xs text-gris">
            <Info size={16} className="shrink-0 text-turq" />
            Vista ilustrativa: el motorizado usa la app de SimpliRoute de siempre; aquí solo mostramos qué cambia. El orden de paradas simula la optimización de SimpliRoute
            (vecino más cercano + 2-opt).
          </div>
        </div>
      </div>
    </div>
  )
}
