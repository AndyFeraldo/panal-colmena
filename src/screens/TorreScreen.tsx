import { useMemo, useState } from 'react'
import { Camera, CheckCircle2, MapPin, ShieldCheck, XCircle } from 'lucide-react'
import { NeedResult, PhoneFrame, ScreenHeader, Tag, fmtPct } from '../components/ui'
import { anaContext } from '../components/demoSteps'
import { fmtTime } from '../sim/geo'
import { useSim } from '../store/useSim'

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
  const routes = useMemo(
    () => result.scenarios.C.routes.filter((r) => r.depotId === col?.id).sort((a, b) => a.startTime - b.startTime),
    [result, col],
  )
  const [scanned, setScanned] = useState<Record<string, boolean>>({})
  const [last, setLast] = useState<ScanResult>(null)
  const [errorsCaught, setErrorsCaught] = useState(0)

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
    setLast({ ok: false, text: `Esta bolsa es de ${other.label}, no de ${r.label}. No la entregues a ${r.rider}.` })
  }
  const done = routes.length - pending.length

  return (
    <div>
      <ScreenHeader kicker="P4 · Encargado de la Torre · 05:30–21:00 · en el celular" title="La Torre: el camión que reabastece en el punto medio de sus cuadrantes">
        Un camión del proveedor de transporte sale del HUB con las bolsas de sus cuadrantes ({col.letter}1, {col.letter}2…) y se estaciona en el punto medio de ellos. Las motos recogen y se
        reabastecen aquí: "me quedé sin paquetes" → voy a mi Torre, no vuelvo al almacén de Villa El Salvador.
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
                <MapPin size={15} /> Estacionado · {fmtTime(trip.arrival)}
              </div>
              <div className="text-xs text-gris">
                Punto medio de sus cuadrantes (estacionamiento genérico) · {trip.cuadIds.length} cuadrantes · {trip.orders} pedidos · {trip.trucks} camión(es)
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
                      {isScanned ? <span className="text-verde">✓ entregada</span> : r.shift === 1 ? <span className="text-amber-600">⏳ en camino</span> : <span className="text-gris">turno {r.shift}</span>}
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
          <div className="card p-5">
            <h3 className="flex items-center gap-2 font-extrabold text-bosque">
              <ShieldCheck size={18} className="text-verde" /> Doble control para el 99,9% de carga
            </h3>
            <ol className="mt-2 space-y-1.5 text-sm">
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
            <div className="mt-3 flex flex-wrap gap-1">
              <Tag kind="ENTREVISTA">Idea nacida en la entrevista: "una unidad que alimente a la moto"</Tag>
              <Tag kind="SUPUESTO">Error 0,5% manual vs 0,05% escaneo</Tag>
            </div>
          </div>
          <div className="card p-5 text-sm">
            <h3 className="font-extrabold text-bosque">En SimpliRoute la Torre es…</h3>
            <p className="mt-1">
              <b>un vehículo + un punto de inicio (depot)</b>. Las rutas de estos cuadrantes empiezan aquí y el reabastecimiento es una 2.ª ruta del día desde la Torre. No se cambia
              de sistema.
            </p>
            <p className="mt-2 text-xs text-gris">Por validar con Falabella: ¿quién paga el camión? (proveedor de transporte) · ¿qué puntos usar? (tiendas / estacionamientos)</p>
          </div>
        </div>
      </div>
    </div>
  )
}
