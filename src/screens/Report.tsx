import { useMemo, useState } from 'react'
import { Polygon } from 'react-leaflet'
import { Brain, Gauge, Snail, Split, Shrink } from 'lucide-react'
import { BaseMap, FitTo, PanalLayer, cellPoly } from '../components/MapKit'
import { NeedResult, ScreenHeader, SimBadge, Tag, fmtNum, fmtPct } from '../components/ui'
import { cellCenter } from '../sim/panales'
import { TARGETS, WEEKDAYS } from '../sim/params'
import { useSim } from '../store/useSim'

export default function Report() {
  return (
    <NeedResult>
      <ReportInner />
    </NeedResult>
  )
}

const ICON = { slow: Snail, overflow: Split, small: Shrink }

function ReportInner() {
  const result = useSim((s) => s.result)!
  const { A, C } = result.scenarios
  const [focus, setFocus] = useState<number>(0)
  const items = result.learning
  const item = items[focus]
  const changed = useMemo(() => Object.keys(result.mapAfter).filter((c) => result.mapAfter[c] !== result.map.cellToPanal[c]), [result])
  const focusPts = useMemo(() => {
    if (!item?.cell) return []
    const ids = new Set([item.panalId, item.to])
    const cells = Object.entries(result.map.cellToPanal)
      .filter(([, id]) => ids.has(id))
      .map(([c]) => cellCenter(c))
    return cells
  }, [item, result])

  const metas = [
    { label: 'Pedidos a tiempo (proxy OTD)', a: A.kpis.otd, c: C.kpis.otd, target: TARGETS.otd, fmt: (v: number) => fmtPct(v) },
    { label: 'Paradas por ruta (SPR)', a: A.kpis.spr, c: C.kpis.spr, target: TARGETS.spr, fmt: (v: number) => fmtNum(v) },
    { label: 'Carga correcta', a: A.kpis.loadCorrect, c: C.kpis.loadCorrect, target: TARGETS.load, fmt: (v: number) => fmtPct(v, 2) },
  ]

  return (
    <div>
      <ScreenHeader kicker="P9 · Reporte de cierre y aprendizaje" title={`Cierre del día simulado · ${WEEKDAYS[result.input.weekday]} · ${result.input.level}`} right={<SimBadge />}>
        Con los webhooks de entrega (tiempos reales por parada), PANAL propone ajustes medibles para la próxima semana y muestra qué cambió y por qué.
      </ScreenHeader>

      <div className="grid gap-3 md:grid-cols-3">
        {metas.map((m) => {
          const ok = m.c >= m.target
          return (
            <div key={m.label} className={`rounded-2xl p-4 ${ok ? 'bg-lima text-bosque' : 'card'}`}>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase">
                <Gauge size={13} /> {m.label}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold">{m.fmt(m.c)}</span>
                <span className="text-xs">meta {m.fmt(m.target)}</span>
              </div>
              <div className="text-xs opacity-80">
                Hoy (regla actual): {m.fmt(m.a)} · {ok ? '✓ cumple' : `faltan ${m.fmt(Math.max(0, m.target - m.c))}`}
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-gris">
        Si un indicador no llega a la meta lo mostramos igual: los supuestos se validan con Falabella y se ajustan en la pantalla de Supuestos.
      </p>

      <div className="mt-4 grid gap-4 xl:grid-cols-[420px_1fr]">
        <div className="card p-4">
          <h3 className="flex items-center gap-2 font-extrabold text-bosque">
            <Brain size={18} className="text-turq" /> El panal aprende · ajustes para la próxima semana
          </h3>
          <p className="text-xs text-gris">Generados a partir de esta simulación. Clic en uno para verlo en el mapa.</p>
          <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {items.length === 0 && <p className="text-sm text-gris">Sin ajustes: todos los panales estuvieron dentro de lo esperado.</p>}
            {items.map((it, i) => {
              const Icon = ICON[it.kind]
              return (
                <button
                  key={i}
                  onClick={() => setFocus(i)}
                  className={`flex w-full items-start gap-2 rounded-xl p-3 text-left text-sm transition ${i === focus ? 'bg-bosque text-white' : 'bg-crema hover:bg-lima-soft'}`}
                >
                  <Icon size={16} className={`mt-0.5 shrink-0 ${i === focus ? 'text-lima' : 'text-naranja'}`} />
                  <span className="flex-1">{it.message}</span>
                  <span className={`chip shrink-0 ${i === focus ? 'bg-white/15 text-lima' : 'bg-white text-bosque'}`}>{it.metric}</span>
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            <Tag kind="ENTREVISTA">"SimpliRoute aprende… no sé cómo probarlo"</Tag>
            <Tag kind="SUPUESTO">Dificultad por celda simulada</Tag>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {(['Antes', 'Después'] as const).map((label) => (
            <div key={label} className="card overflow-hidden">
              <div className={`px-4 py-2 text-sm font-extrabold ${label === 'Antes' ? 'bg-crema text-bosque' : 'bg-turq text-white'}`}>
                {label} {label === 'Después' && `· ${changed.length} celda(s) movida(s)`}
              </div>
              <div className="p-1.5">
                <BaseMap className="h-[460px]" zoom={13} scrollWheel={false}>
                  <FitTo points={focusPts} deps={String(focus) + label} padding={20} />
                  <PanalLayer
                    panales={result.map.panales}
                    cellToPanal={label === 'Antes' ? result.map.cellToPanal : result.mapAfter}
                    selected={item?.panalId}
                    fillOpacity={0.5}
                  />
                  {changed.map((c) => (
                    <Polygon key={c} positions={cellPoly(c)} pathOptions={{ color: '#F26B21', weight: label === 'Después' ? 3 : 2, dashArray: label === 'Antes' ? '4 3' : undefined, fill: false }} />
                  ))}
                </BaseMap>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
