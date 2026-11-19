import { useMemo, useState } from 'react'
import { ArrowRightLeft, Camera, CheckCircle2, MapPin, PackageOpen, ShieldCheck, Store, Truck, Warehouse, XCircle } from 'lucide-react'
import { More, NeedResult, PhoneFrame, ScreenHeader, Tag, fmtPct } from '../components/ui'
import { anaContext } from '../components/demoSteps'
import { BaseMap, FitTo, HubMarker, TorreMarkers, TorreTripLayer } from '../components/MapKit'
import { HUB } from '../sim/data'
import { fmtTime, haversineKm } from '../sim/geo'
import { vehicleLabel, type TorreVehicleMode } from '../sim/params'
import type { TorreLeg } from '../sim/types'
import { useSim } from '../store/useSim'

const LEG_ICON: Record<TorreLeg['kind'], typeof Truck> = {
  carga: Warehouse,
  cita: MapPin,
  tienda: Store,
  regreso: Truck,
}
const LEG_STYLE: Record<TorreLeg['kind'], string> = {
  carga: 'bg-bosque text-lima',
  cita: 'bg-turq text-white',
  tienda: 'bg-naranja text-white',
  regreso: 'bg-bosque text-white',
}

/** Respuestas cortas a lo que el jurado preguntará sobre la Torre (mentoría 18-nov) */
const HARD_QUESTIONS: [string, string][] = [
  ['¿Dónde carga?', 'En el HUB de VES, de madrugada: las cajas ya vienen armadas por moto (1 caja = 1 ruta o 1 recarga).'],
  ['¿Dónde se cuadra?', 'En el punto de encuentro de sus cuadrantes, solo durante cada cita (~15 min). Entre citas espera en el estacionamiento de la tienda Saga de la zona.'],
  ['¿Se queda parada todo el día?', 'No. Hace rondas: cita con las motos → tienda Saga → siguiente cita. Nunca espera en la calle con la carga.'],
  ['¿Y si la roban?', 'Pasa la mayor parte del día dentro del estacionamiento de una tienda Saga, no en la vía pública. Cada caja se escanea al entregarla.'],
  ['¿Más personal o más camiones?', 'Se propone usar el camión del proveedor que ya va a las tiendas, con cajas extra para las motos. Solo 1–2 Torres, en zonas lejanas.'],
  ['¿Camión o van?', 'Lo que alcance: si la carga cabe en una van, va una van; si no, camión. En Cyber se suma un 2.º vehículo.'],
  ['¿Por qué no en todo Lima?', 'Cerca del HUB (VMT, SJM, Chorrillos) la moto vuelve rápido: no vale la pena. La Torre va donde más km ahorra.'],
  ['¿Cuánto cuesta?', 'Por calcular con Falabella (hoy pagan al proveedor por paquete). Va en el anexo de preguntas, no en el pitch.'],
]

export default function TorreScreen() {
  return (
    <NeedResult>
      <TorreInner />
    </NeedResult>
  )
}

type ScanResult = { ok: boolean; text: string } | null

function TorreInner() {
  const result = useSim((s) => s.result)!
  const params = useSim((s) => s.params)
  const ana = anaContext(result)
  const used = result.torres.filter((c) => result.scenarios.C.torreTrips.some((t) => t.torreId === c.id))
  const [colId, setColId] = useState(ana?.torre?.id ?? used[0]?.id)
  const col = used.find((c) => c.id === colId) ?? used[0]
  const trip = result.scenarios.C.torreTrips.find((t) => t.torreId === col?.id)
  const routes = useMemo(() => result.scenarios.C.routes.filter((r) => r.depotId === col?.id).sort((a, b) => a.startTime - b.startTime), [result, col])
  const [scanned, setScanned] = useState<Record<string, boolean>>({})
  const [last, setLast] = useState<ScanResult>(null)
  const [errorsCaught, setErrorsCaught] = useState(0)
  const [shared, setShared] = useState<string | null>(null)

  if (!col || !trip) return <div className="card p-6">No hay Torres activas en este escenario.</div>

  const pending = routes.filter((r) => !scanned[r.id])
  const scanNext = () => {
    const r = pending[0]
    if (!r) return
    setScanned((s) => ({ ...s, [r.id]: true }))
    setLast({ ok: true, text: `✓ Bolsa ${r.label} → ${r.rider}. Correcta.` })
  }
  const scanWrong = () => {
    const r = pending[0] ?? routes[0]
    const other = routes.find((x) => x.id !== r.id) ?? r
    setErrorsCaught((n) => n + 1)
    setLast({
      ok: false,
      text: `Esta bolsa es de ${other.label}, no de ${r.label}. No la entregues a ${r.rider}.`,
    })
  }
  const done = routes.length - pending.length
  // Torre vecina más cercana: puede pasarle bolsas a esta (o recibirlas) para que ninguna moto se quede parada
  const neighbor = used
    .filter((c) => c.id !== col.id)
    .map((c) => ({ c, km: haversineKm(c, col) }))
    .sort((a, b) => a.km - b.km)[0]
  const transferMin = neighbor ? Math.round((neighbor.km * params.detourFactor * 60) / params.truckSpeedKmh) : 0

  return (
    <div>
      <ScreenHeader
        kicker="♜ Torre móvil · encargado"
        title="La Torre va hacia las motos"
        hint="No se queda parada: carga en el HUB, se cita con sus motos a horas fijas y entre citas espera en la tienda Saga de la zona."
      >
        Solo hay Torre en las zonas lejanas del HUB, donde la moto perdería más tiempo volviendo a Villa El Salvador. El vehículo (camión o van) sale con las cajas ya armadas por
        moto, las entrega en el punto de encuentro de sus cuadrantes ({col.letter}1, {col.letter}2…) y sigue su ronda.
      </ScreenHeader>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {used.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setColId(c.id)
              setScanned({})
              setLast(null)
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${c.id === col.id ? 'bg-turq text-white' : 'bg-white text-turq shadow-sm'}`}
          >
            ♜ {c.letter} · {c.short}
          </button>
        ))}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[400px_1fr]">
        <PhoneFrame
          time={fmtTime(trip.arrival)}
          title={
            <div className="bg-turq px-4 py-3 text-white">
              <div className="font-bold">♜ {col.name}</div>
              <div className="text-[11px] text-white/80">Panel web Tablero f. en el celular del encargado</div>
            </div>
          }
        >
          <div className="space-y-3 p-4">
            <div className="rounded-xl bg-crema p-3">
              <div className="flex items-center gap-1.5 font-bold text-bosque">
                <MapPin size={15} /> Cita en el punto de encuentro · {fmtTime(Math.max(trip.arrival, 360))}
              </div>
              <div className="text-xs text-gris">
                {trip.cuadIds.length} cuadrantes · {trip.orders} pedidos · {vehicleLabel(trip.vehicle, trip.trucks)} · luego va a la {col.store}
              </div>
            </div>
            {last && (
              <div className={`anim-pop flex items-start gap-2 rounded-xl p-3 text-sm font-semibold ${last.ok ? 'bg-lima-soft text-bosque' : 'bg-red-600 text-white'}`}>
                {last.ok ? <CheckCircle2 size={18} className="shrink-0 text-verde" /> : <XCircle size={18} className="shrink-0" />}
                {last.text}
              </div>
            )}
            <div className="divide-y divide-linea rounded-xl border border-linea">
              {routes.map((r) => {
                const reload = r.stops.find((s) => s.kind === 'reload')
                const isScanned = scanned[r.id]
                return (
                  <div key={r.id} className={`flex items-center justify-between gap-2 px-3 py-2 text-sm ${r.rider === 'Carlos' ? 'bg-lima-soft/60' : ''}`}>
                    <div className="min-w-0">
                      <div className="font-bold text-bosque">
                        {r.label} · {r.rider}
                      </div>
                      <div className="text-[11px] text-gris">
                        Turno {r.shift} · sale {fmtTime(r.startTime)} · {r.deliveries} pedidos
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[11px] font-bold">
                      {isScanned ? (
                        <span className="text-verde">✓ entregada</span>
                      ) : r.shift === 1 ? (
                        <span className="text-amber-600">⏳ en camino</span>
                      ) : (
                        <span className="text-gris">turno {r.shift}</span>
                      )}
                      {reload && <div className="text-naranja">↻ reabastece ~{fmtTime(reload.eta)}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="sticky bottom-0 space-y-2 border-t border-linea bg-white p-3">
            <button onClick={scanNext} disabled={pending.length === 0} className="btn-lima w-full !py-3">
              <Camera size={18} /> Escanear bolsa entregada
            </button>
            <button onClick={scanWrong} className="w-full text-center text-xs font-semibold text-red-600 hover:underline">
              Simular bolsa equivocada
            </button>
          </div>
        </PhoneFrame>

        <div className="space-y-4">
          <TorreDay torreId={col.id} />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="card p-4">
              <div className="text-[11px] font-bold uppercase text-gris">Bolsas escaneadas</div>
              <div className="text-3xl font-extrabold text-bosque">
                {done}/{routes.length}
              </div>
            </div>
            <div className="card p-4">
              <div className="text-[11px] font-bold uppercase text-gris">Errores atrapados</div>
              <div className="text-3xl font-extrabold text-naranja">{errorsCaught}</div>
              <div className="text-xs text-gris">antes de salir a ruta</div>
            </div>
            <div className="rounded-2xl bg-turq p-4 text-white">
              <div className="text-[11px] font-bold uppercase opacity-80">Carga correcta Torre</div>
              <div className="text-3xl font-extrabold">{fmtPct(1 - params.loadErrorScan, 2)}</div>
              <div className="text-xs opacity-80">vs {fmtPct(1 - params.loadErrorManual, 1)} carga manual</div>
            </div>
          </div>
          {neighbor && (
            <div className="card p-5">
              <h3 className="flex items-center gap-2 font-extrabold text-bosque">
                <ArrowRightLeft size={18} className="text-turq" /> Una Torre ayuda a otra
              </h3>
              <p className="mt-1 text-sm text-bosque/80">
                Si a una Torre le sobran paquetes y a la vecina le sobran motos, se pasan bolsas entre ellas. Así ninguna moto se queda parada y nadie vuelve a VES.
              </p>
              <div className="mt-3 grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
                <div className="rounded-xl bg-naranja-soft p-3 text-sm">
                  <div className="font-extrabold text-bosque">
                    ♜ {neighbor.c.letter} · {neighbor.c.short}
                  </div>
                  <div className="text-xs text-bosque/80">le sobran 2 bolsas (día alto)</div>
                </div>
                <div className="text-center text-xs font-bold text-turq">
                  {neighbor.km.toFixed(1).replace('.', ',')} km
                  <br />~{transferMin} min
                </div>
                <div className="rounded-xl bg-lima-soft p-3 text-sm">
                  <div className="font-extrabold text-bosque">
                    ♜ {col.letter} · {col.short}
                  </div>
                  <div className="text-xs text-bosque/80">tiene motos libres después del turno 1</div>
                </div>
              </div>
              {shared === col.id ? (
                <div className="anim-pop mt-3 rounded-xl bg-lima-soft p-3 text-sm font-semibold text-bosque">
                  ✓ 2 bolsas pasan de la Torre {neighbor.c.letter} a la Torre {col.letter} en ~{transferMin} min. Las motos de {col.short} siguen trabajando y las de{' '}
                  {neighbor.c.short} no se atrasan.
                </div>
              ) : (
                <button onClick={() => setShared(col.id)} className="btn-turq mt-3 w-full !py-2.5">
                  <ArrowRightLeft size={16} /> Aprobar: pasar 2 bolsas a la Torre {col.letter}
                </button>
              )}
              <div className="mt-2">
                <Tag kind="SUPUESTO">Ejemplo ilustrativo · distancia real entre Torres simuladas</Tag>
              </div>
            </div>
          )}
          <div className="card p-5">
            <h3 className="flex items-center gap-2 font-extrabold text-bosque">
              <ShieldCheck size={18} className="text-verde" /> Doble control para el 99,9% de carga
            </h3>
            <More label="¿Cómo funciona el doble control?" className="mt-1 !bg-crema">
              <ol className="space-y-1.5">
                <li>
                  <b>1. HUB:</b> carga pocos camiones (no decenas de motos) con bolsas etiquetadas por cuadrante.
                </li>
                <li>
                  <b>2. Torre:</b> el encargado escanea cada bolsa al entregarla a cada moto; si no corresponde, alerta roja.
                </li>
                <li>
                  <b>3. Reabastecer:</b> la 2.ª bolsa del día se entrega aquí mismo, a minutos del cuadrante (el “enroque”).
                </li>
              </ol>
            </More>
            <div className="mt-3 flex flex-wrap gap-1">
              <Tag kind="ENTREVISTA">Idea nacida en la entrevista: "una unidad que alimente a la moto"</Tag>
              <Tag kind="SUPUESTO">Error 0,5% manual vs 0,05% escaneo</Tag>
            </div>
          </div>
          <div className="card p-5">
            <h3 className="flex items-center gap-2 font-extrabold text-bosque">
              <PackageOpen size={18} className="text-naranja" /> Plan de contingencia
            </h3>
            <p className="mt-1 text-sm text-bosque/80">
              ¿Cliente ausente, dirección que no existe o un incidente con la moto? El paquete <b>no vuelve a VES</b>: se deja en la Torre en la siguiente cita. Si el cliente
              reprograma para hoy, sale en el turno siguiente desde aquí; si no, la Torre lo lleva de vuelta al HUB al final del día.
            </p>
            <div className="mt-2">
              <Tag kind="NUEVO" />
            </div>
          </div>
          <div className="card p-5">
            <h3 className="font-extrabold text-bosque">Preguntas difíciles sobre la Torre</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {HARD_QUESTIONS.map(([q, a]) => (
                <div key={q} className="rounded-xl bg-crema p-3">
                  <div className="text-sm font-extrabold text-bosque">{q}</div>
                  <div className="text-xs text-bosque/80">{a}</div>
                </div>
              ))}
            </div>
            <div className="mt-2">
              <Tag kind="SUPUESTO">Respuestas del equipo, por validar con Falabella</Tag>
            </div>
          </div>
          <More label="¿Y en SimpliRoute qué es la Torre?" className="card">
            <p className="mt-1">
              <b>un vehículo + un punto de inicio (depot)</b>. Las rutas de estos cuadrantes empiezan en el punto de encuentro y cada recarga es una 2.ª ruta del día desde ahí. No
              se cambia de sistema.
            </p>
            <p className="mt-2 text-xs text-gris">
              Por validar con Falabella: ¿salen camiones diarios del HUB a las tiendas de cada zona? ¿se aceptan vans? ¿qué tiendas prestan su estacionamiento?
            </p>
          </More>
        </div>
      </div>
    </div>
  )
}

/** El día de la Torre: itinerario + mapa + vehículo */
function TorreDay({ torreId }: { torreId: string }) {
  const result = useSim((s) => s.result)!
  const params = useSim((s) => s.params)
  const setParams = useSim((s) => s.setParams)
  const trip = result.scenarios.C.torreTrips.find((t) => t.torreId === torreId)
  const torre = result.torres.find((c) => c.id === torreId)
  if (!torre || !trip) return null
  const modes: [TorreVehicleMode, string][] = [
    ['auto', 'Lo que alcance'],
    ['camion', 'Solo camión'],
    ['van', 'Solo van'],
  ]
  return (
    <div className="card p-5">
      <h3 className="font-extrabold text-bosque">El día de la {torre.name} · no se queda parada</h3>
      <div className="mt-3 grid gap-4 md:grid-cols-[1fr_230px]">
        <ol className="relative ml-2 space-y-2 border-l-2 border-linea pl-4">
          {trip.itinerary.map((l, i) => {
            const Icon = LEG_ICON[l.kind]
            return (
              <li key={i} className="relative">
                <span className={`absolute -left-[27px] top-0.5 grid h-5 w-5 place-items-center rounded-full ${LEG_STYLE[l.kind]}`}>
                  <Icon size={11} />
                </span>
                <div className="text-sm">
                  <b className="text-bosque">{fmtTime(l.time)}</b> · <b>{l.place}</b>
                  {l.kind === 'cita' && (
                    <span className="text-turq">
                      {' '}
                      · {l.motos} moto{l.motos === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gris">{l.note}</div>
              </li>
            )
          })}
        </ol>
        <div className="space-y-2">
          <BaseMap className="!h-[230px]" zoom={11} scrollWheel={false}>
            <HubMarker />
            <TorreTripLayer torre={torre} />
            <TorreMarkers torres={[torre]} cuadrantes={result.map.cuadrantes} activeId={torre.id} />
            <FitTo points={[{ lat: torre.lat, lng: torre.lng }, { lat: torre.storeLat, lng: torre.storeLng }, HUB]} deps={torre.id} />
          </BaseMap>
          <div className="rounded-xl bg-crema p-2">
            <div className="text-[11px] font-bold uppercase text-gris">Vehículo de la Torre</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {modes.map(([m, label]) => (
                <button key={m} onClick={() => setParams({ torreVehicle: m })} className={`chip ${params.torreVehicle === m ? 'bg-bosque text-lima' : 'bg-white text-bosque'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-1 text-xs text-bosque">
              Hoy: <b>{vehicleLabel(trip.vehicle, trip.trucks)}</b> para {trip.orders} pedidos
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Tag kind="SUPUESTO">
          Camión {params.truckCapacity} · van {params.vanCapacity} pedidos
        </Tag>
        <Tag kind="SUPUESTO">Tienda Saga: ubicación genérica</Tag>
        <Tag kind="NUEVO" />
      </div>
    </div>
  )
}
