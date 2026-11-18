import { useEffect, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Bike, Factory, Loader2, Truck } from 'lucide-react'
import { NeedResult, ScreenHeader, SimBadge, Tag, TorreLogo, fmtInt, fmtNum, fmtPct } from '../components/ui'
import { WeekdayPicker } from './Planner'
import { fmtTime } from '../sim/geo'
import { TARGETS, WEEKDAYS } from '../sim/params'
import { useSim } from '../store/useSim'

export default function Capacity() {
  return (
    <NeedResult>
      <CapacityInner />
    </NeedResult>
  )
}

function CapacityInner() {
  const runCapacity = useSim((s) => s.runCapacity)
  const capacity = useSim((s) => s.capacity)
  const running = useSim((s) => s.capacityRunning)
  const params = useSim((s) => s.params)
  const weekday = useSim((s) => s.weekday)
  const pctPin = useSim((s) => s.pctPin)

  useEffect(() => {
    runCapacity()
  }, [runCapacity, params, weekday, pctPin])

  const normal = capacity?.find((r) => r.level === 'Normal')
  const cyber = capacity?.find((r) => r.level === 'Cyber')
  const chart = capacity?.map((r) => ({ name: r.level, 'Motos hoy': r.motosToday, 'Motos TORRE f.': r.motosTorre, Camiones: r.trucks })) ?? []

  return (
    <div>
      <ScreenHeader
        kicker="Gerencia · capacidad"
        title="¿Cuántas motos y camiones necesito en un día normal y en Cyber?"
        right={
          <>
            <WeekdayPicker />
            <SimBadge />
          </>
        }
      >
        Corremos el mismo día con los 4 niveles de demanda (Bajo ×{fmtNum(params.levelMult.Bajo)}, Normal ×1, Alto ×{fmtNum(params.levelMult.Alto)}, Cyber ×{fmtNum(params.levelMult.Cyber, 0)}) sobre {fmtInt(params.ordersPerDay)}{' '}
        pedidos base. Motos = rutas del turno con más rutas (cada moto hace un turno). Camiones = camiones Torre que salen del HUB.
      </ScreenHeader>

      {!capacity ? (
        <div className="card flex h-64 flex-col items-center justify-center gap-3 text-gris">
          <TorreLogo className="anim-float h-16" />
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Loader2 className="animate-spin" size={16} /> Simulando Bajo, Normal, Alto y Cyber…
          </div>
        </div>
      ) : (
        <div className={running ? 'opacity-70' : ''}>
          <div className="grid gap-3 md:grid-cols-2">
            {[normal, cyber].map(
              (r) =>
                r && (
                  <div key={r.level} className={`rounded-2xl p-5 ${r.level === 'Cyber' ? 'bg-naranja text-white' : 'card-dark'}`}>
                    <div className="text-xs font-bold uppercase tracking-wider opacity-80">
                      Día {r.level} · {WEEKDAYS[weekday]} · {fmtInt(r.orders)} paquetes
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <Big icon={<Bike size={16} />} value={r.motosTorre} label="motos (turno pico)" sub={`hoy: ${r.motosToday}`} />
                      <Big icon={<Truck size={16} />} value={r.trucks} label="camiones Torre" sub={`${r.torres} Torres`} />
                      <Big icon={<Factory size={16} />} value={fmtTime(r.sortEnd)} label="HUB termina" sub="700 ped/h" />
                    </div>
                    <div className="mt-3 text-xs opacity-90">
                      Rutas: {r.routesTorre} (hoy {r.routesToday}) · máx. {r.maxStopsTorre} paquetes por ruta · a tiempo {fmtPct(r.otdTorre)} (hoy {fmtPct(r.otdToday)})
                    </div>
                  </div>
                ),
            )}
          </div>

          <div className="mt-4 grid gap-4 2xl:grid-cols-[1.4fr_1fr]">
            <div className="card overflow-x-auto p-4">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="whitespace-nowrap text-left text-[11px] uppercase tracking-wide text-gris">
                    <th className="py-2">Nivel</th>
                    <th className="py-2 text-right">Paquetes</th>
                    <th className="py-2 text-right text-naranja">Rutas hoy</th>
                    <th className="py-2 text-right text-naranja">Motos hoy</th>
                    <th className="py-2 text-right text-naranja">A tiempo hoy</th>
                    <th className="py-2 text-right text-turq">Rutas TORRE f.</th>
                    <th className="py-2 text-right text-turq">Motos</th>
                    <th className="py-2 text-right text-turq">Torres · camiones</th>
                    <th className="py-2 text-right text-turq">Máx./ruta</th>
                    <th className="py-2 text-right text-turq">A tiempo</th>
                    <th className="py-2 text-right">HUB termina</th>
                  </tr>
                </thead>
                <tbody>
                  {capacity.map((r) => (
                    <tr key={r.level} className={`border-t border-linea ${r.level === 'Cyber' ? 'bg-naranja-soft/50' : ''}`}>
                      <td className="py-2 font-extrabold text-bosque">{r.level}</td>
                      <td className="py-2 text-right">{fmtInt(r.orders)}</td>
                      <td className="py-2 text-right">{r.routesToday}</td>
                      <td className="py-2 text-right">{r.motosToday}</td>
                      <td className="py-2 text-right">{fmtPct(r.otdToday)}</td>
                      <td className="py-2 text-right font-bold">{r.routesTorre}</td>
                      <td className="py-2 text-right font-bold">{r.motosTorre}</td>
                      <td className="py-2 text-right font-bold">
                        {r.torres} · {r.trucks}
                      </td>
                      <td className={`py-2 text-right font-bold ${r.maxStopsTorre <= params.cuadMaxStops ? 'text-verde' : 'text-naranja'}`}>{r.maxStopsTorre}</td>
                      <td className={`py-2 text-right font-bold ${r.otdTorre >= TARGETS.otd ? 'text-verde' : 'text-amber-600'}`}>{fmtPct(r.otdTorre)}</td>
                      <td className={`py-2 text-right ${r.sortEnd > 360 ? 'font-bold text-naranja' : ''}`}>{fmtTime(r.sortEnd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-gris">
                Motos = máximo de rutas en un mismo turno (06–11, 12–17, 18–21). TORRE f. puede necesitar <b>más rutas</b> que hoy porque ninguna pasa de {params.cuadMaxStops}{' '}
                paquetes; a cambio, menos km vacíos y más pedidos a tiempo. HUB en naranja = termina de clasificar después de las 06:00 (no lo resuelve TORRE f.).
              </p>
            </div>
            <div className="card p-4">
              <h3 className="text-sm font-extrabold text-bosque">Motos y camiones por nivel de demanda</h3>
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={chart} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Motos hoy" fill="#F26B21" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Motos TORRE f." fill="#00808D" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Camiones" fill="#12301F" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Tag kind="ENTREVISTA">Cyber: las motos salen 8–9 y no terminan</Tag>
                <Tag kind="SUPUESTO">Camión Torre: {params.truckCapacity} paquetes</Tag>
                <Tag kind="RETO">HUB 700 ped/h</Tag>
              </div>
            </div>
          </div>

          {normal && cyber && (
            <div className="mt-4 rounded-2xl border-2 border-dashed border-turq bg-white p-4 text-sm text-bosque">
              <b>Lectura rápida:</b> pasar de un día Normal a Cyber necesita{' '}
              <b>
                +{cyber.motosTorre - normal.motosTorre} motos y +{cyber.trucks - normal.trucks} camiones
              </b>{' '}
              en el turno pico. Como los cuadrantes ya están calculados para Cyber, el plan se conoce <b>de día</b>: el proveedor puede reservar esas unidades con
              anticipación en vez de enterarse a las 02:30.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Big({ icon, value, label, sub }: { icon: ReactNode; value: ReactNode; label: string; sub: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase opacity-80">
        {icon} {label}
      </div>
      <div className="text-3xl font-extrabold leading-tight">{value}</div>
      <div className="text-[11px] opacity-80">{sub}</div>
    </div>
  )
}
