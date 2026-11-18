import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { BarrierLayer, BarrierLegend, BaseMap, CuadranteLayer, CuadranteNames, TorreMarkers } from '../components/MapKit'
import { NeedResult, ScreenHeader, SimBadge, TorreLogo, fmtInt, fmtNum } from '../components/ui'
import { WeekdayPicker } from './Planner'
import { CELL_AREA_KM2 } from '../sim/grid'
import { useSim, type SeasonMaps } from '../store/useSim'

export default function Seasons() {
  return (
    <NeedResult>
      <SeasonsInner />
    </NeedResult>
  )
}

type Side = SeasonMaps['Bajo']

function summary(s: Side) {
  const qs = s.map.cuadrantes
  const cells = qs.reduce((a, q) => a + q.cells.length, 0) / qs.length
  const stops = qs.reduce((a, q) => a + q.expStops, 0)
  return {
    n: qs.length,
    cells,
    km2: cells * CELL_AREA_KM2,
    stops,
    trucks: s.torres.reduce((a, t) => a + t.trucks, 0),
  }
}

// Vista centrada en la zona de más demanda (Miraflores · San Isidro · Surco), donde se nota el cambio
const CENTER: [number, number] = [-12.115, -77.015]

function SeasonsInner() {
  const runSeasons = useSim((s) => s.runSeasons)
  const seasons = useSim((s) => s.seasons)
  const params = useSim((s) => s.params)
  const weekday = useSim((s) => s.weekday)

  useEffect(() => {
    runSeasons()
  }, [runSeasons, params, weekday])

  const b = seasons ? summary(seasons.Bajo) : null
  const c = seasons ? summary(seasons.Cyber) : null

  return (
    <div>
      <ScreenHeader
        kicker="🗺️ Planificador · temporadas"
        title="Temporada baja vs Cyber"
        hint="Mismo tope de 50 paquetes por ruta: cuando hay más pedidos, cada cuadrante se achica solo."
        right={
          <>
            <WeekdayPicker />
            <SimBadge />
          </>
        }
      >
        Las zonas no son fijas: en temporada baja hay pocos pedidos por casilla, así que una ruta de 50 necesita <b>más casillas</b> (cuadrante grande). En Cyber la misma
        zona tiene el doble de pedidos y la ruta se completa con <b>menos casillas</b> (cuadrante chico). El planificador publica en SimpliRoute el mapa que toca cada día.
        Las vías rápidas y los ríos se respetan en los dos casos.
      </ScreenHeader>

      {!seasons || !b || !c ? (
        <div className="card flex h-64 flex-col items-center justify-center gap-3 text-gris">
          <TorreLogo className="anim-float h-16" />
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Loader2 className="animate-spin" size={16} /> Armando el tablero de temporada baja y de Cyber…
          </div>
        </div>
      ) : (
        <>
          {/* RESUMEN EN UNA LÍNEA */}
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <div className="card p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-gris">Temporada baja (×{fmtNum(params.levelMult.Bajo)})</div>
              <div className="mt-1 text-3xl font-extrabold text-bosque">{b.n} cuadrantes</div>
              <div className="text-sm text-bosque/80">
                ~{fmtNum(b.cells)} casillas c/u · ≈ {fmtNum(b.km2)} km² por ruta
              </div>
            </div>
            <div className="rounded-2xl bg-naranja p-4 text-white">
              <div className="text-[11px] font-bold uppercase tracking-wide opacity-90">Cyber (×{fmtNum(params.levelMult.Cyber, 0)})</div>
              <div className="mt-1 text-3xl font-extrabold">{c.n} cuadrantes</div>
              <div className="text-sm opacity-95">
                ~{fmtNum(c.cells)} casillas c/u · ≈ {fmtNum(c.km2)} km² por ruta
              </div>
            </div>
            <div className="card-dark flex flex-col justify-center p-4">
              <div className="text-3xl font-extrabold text-lima">{Math.round((1 - c.km2 / b.km2) * 100)}% más chico</div>
              <div className="text-sm opacity-90">cada cuadrante en Cyber vs temporada baja</div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {(
              [
                ['Temporada baja', seasons.Bajo, b, 'bg-bosque text-lima'],
                ['Cyber', seasons.Cyber, c, 'bg-naranja text-white'],
              ] as const
            ).map(([label, side, sum, chip]) => (
              <div key={label} className="card overflow-hidden p-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2 pt-1">
                  <span className={`chip ${chip} !text-sm`}>{label}</span>
                  <span className="text-xs font-semibold text-bosque">
                    {fmtInt(sum.stops)} paquetes · {sum.n} rutas · {sum.trucks} camión(es) Torre
                  </span>
                </div>
                <BaseMap className="h-[min(56vh,460px)]" zoom={12.5} center={CENTER}>
                  <CuadranteLayer
                    cuadrantes={side.map.cuadrantes}
                    cellToCuad={side.map.cellToCuad}
                    mode="cuadrantes"
                  />
                  <BarrierLayer />
                  <CuadranteNames cuadrantes={side.map.cuadrantes} minZoom={12} />
                  <TorreMarkers torres={side.torres} cuadrantes={side.map.cuadrantes} showLinks={false} />
                </BaseMap>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-end">
            <BarrierLegend />
          </div>
        </>
      )}
    </div>
  )
}
