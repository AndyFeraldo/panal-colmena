import { useState } from 'react'
import { ArrowDown, ArrowLeftRight, ArrowRight, Terminal, Trash2, Zap } from 'lucide-react'
import { NeedResult, ScreenHeader, Tag } from '../components/ui'
import { routingProvider } from '../integration/MockSimpliRouteProvider'
import { applyMoves } from '../sim/assign'
import { useSim } from '../store/useSim'

const MAPPING = [
  ['Panal', 'Zona (Zones)', 'Polígono del panal; las visitas llevan la etiqueta del panal'],
  ['Pedido con Pin f.', 'Visita (Visits)', 'latitude, longitude, reference, load (dm³), tags'],
  ['Orden de paradas', 'Optimización / Planes', 'SimpliRoute ordena dentro de cada panal (no cambia)'],
  ['Colmena', 'Vehículo + punto de inicio', 'La ruta parte del depot de la Colmena; la recarga es una 2.ª ruta'],
  ['Entregas reales', 'Webhooks → PANAL', 'Tiempos por parada para ajustar panales cada semana'],
]

export default function Integration() {
  return (
    <NeedResult>
      <IntegrationInner />
    </NeedResult>
  )
}

function IntegrationInner() {
  const result = useSim((s) => s.result)!
  const apiLog = useSim((s) => s.apiLog)
  const log = useSim((s) => s.log)
  const clearLog = useSim((s) => s.clearLog)
  const [open, setOpen] = useState<string | null>(null)

  const simulateNight = async () => {
    const src = 'P8 · Integración'
    const e1 = await routingProvider.publishZones(result.map.panales, src)
    const e2 = await routingProvider.publishVehicles(result.colmenas, src)
    const e3 = await routingProvider.sendVisits(result.orders, applyMoves(result.assignment, result.assignment.moves).orderPanal, src)
    const e4 = await routingProvider.optimize(result.scenarios.C.routes, src)
    const e5 = await routingProvider.registerWebhook(src)
    log([...e5, ...e4, ...e3, ...e2, ...e1])
  }

  return (
    <div>
      <ScreenHeader kicker="P8 · Integración" title="No es una app nueva: es PANAL conectado a lo que Falabella ya usa">
        PANAL se integra con la API pública de SimpliRoute. El motorizado sigue con su app de siempre y el cliente con sus mensajes de siempre.
      </ScreenHeader>

      {/* Diagrama */}
      <div className="card p-5">
        <div className="grid items-center gap-3 lg:grid-cols-[1fr_auto_1.2fr_auto_1.3fr]">
          <div className="rounded-2xl border-2 border-lima bg-white p-4 text-center">
            <div className="font-extrabold text-bosque">🛒 falabella.com</div>
            <div className="text-xs text-gris">checkout + <b className="text-verde">Pin f.</b></div>
            <div className="mt-1 text-[11px] text-gris">pedido con lat/long</div>
          </div>
          <ArrowRight className="mx-auto hidden text-bosque lg:block" />
          <ArrowDown className="mx-auto text-bosque lg:hidden" />
          <div className="rounded-2xl bg-bosque p-4 text-white">
            <div className="text-center font-extrabold text-lima">PANAL (lo nuevo)</div>
            <div className="text-center text-[11px] text-white/70">motor + panel web (no es app)</div>
            <div className="mt-3 grid grid-cols-2 gap-1.5 text-center text-[11px] font-semibold">
              {['⬡ Arma panales', '🚐 Asigna Colmena', '⏰ Ventana 2 h', '📊 Aprende'].map((x) => (
                <div key={x} className="rounded-lg bg-white/10 px-2 py-1.5">
                  {x}
                </div>
              ))}
            </div>
          </div>
          <ArrowLeftRight className="mx-auto hidden text-turq lg:block" />
          <ArrowDown className="mx-auto text-turq lg:hidden" />
          <div className="rounded-2xl border-2 border-[#5b7fd6] bg-white p-4">
            <div className="text-center font-extrabold text-[#2f4fb5]">SimpliRoute (lo que ya usan)</div>
            <div className="text-center text-[11px] text-gris">API pública · licencia SaaS de Falabella</div>
            <div className="mt-3 grid grid-cols-2 gap-1.5 text-center text-[11px] font-semibold text-[#2f4fb5]">
              {['Zonas = panales', 'Visitas = pedidos', 'Optimización = orden', 'Webhooks = avisos'].map((x) => (
                <div key={x} className="rounded-lg bg-[#eef2fd] px-2 py-1.5">
                  {x}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-turq p-3 text-center text-sm font-bold text-white">
            🚐 COLMENA (minivan del proveedor)
            <div className="text-[11px] font-normal text-white/80">en SimpliRoute = un vehículo + un punto de inicio</div>
          </div>
          <div className="rounded-xl border-2 border-[#5b7fd6] p-3 text-center text-sm font-bold text-[#2f4fb5]">
            🛵 App motorizado
            <div className="text-[11px] font-normal text-gris">la misma de hoy</div>
          </div>
          <div className="rounded-xl border-2 border-verde p-3 text-center text-sm font-bold text-verde">
            💬 Cliente
            <div className="text-[11px] font-normal text-gris">mensajes de hoy + ventana de 2 h</div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.3fr]">
        <div className="space-y-4">
          <div className="card overflow-x-auto p-4">
            <h3 className="font-extrabold text-bosque">Mapeo PANAL → SimpliRoute</h3>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {MAPPING.map(([a, b, c]) => (
                  <tr key={a} className="border-t border-linea align-top">
                    <td className="py-2 pr-2 font-bold text-bosque">{a}</td>
                    <td className="py-2 pr-2 font-semibold text-[#2f4fb5]">{b}</td>
                    <td className="py-2 text-xs text-gris">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card p-4 text-sm">
            <h3 className="font-extrabold text-bosque">Arquitectura del código</h3>
            <ul className="mt-2 space-y-1">
              <li>
                • Interfaz <code className="rounded bg-crema px-1">RoutingProvider</code>
              </li>
              <li>
                • <code className="rounded bg-crema px-1">MockSimpliRouteProvider</code> (por defecto, esta demo)
              </li>
              <li>
                • <code className="rounded bg-crema px-1">SimpliRouteApiProvider</code> (esqueleto documentado; token solo en un backend, nunca en el repo)
              </li>
            </ul>
            <p className="mt-2 text-xs text-gris">
              Base: api.simpliroute.com/v1/ · Docs públicas:{' '}
              <a className="text-turq underline" href="https://documentation.simpliroute.com/es/" target="_blank" rel="noreferrer">
                documentation.simpliroute.com/es
              </a>
            </p>
            <div className="mt-3 rounded-xl bg-naranja-soft p-3 text-xs font-semibold text-bosque">⚠ Falta confirmar con Falabella si su licencia incluye acceso a la API.</div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-[#0f1f16] text-white shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2 font-bold">
              <Terminal size={16} className="text-lima" /> Consola de API simulada
              <span className="chip bg-white/10 text-white/70">sin llamadas reales</span>
            </div>
            <div className="flex gap-2">
              <button onClick={simulateNight} className="btn-lima !px-3 !py-1.5 !text-xs">
                <Zap size={14} /> Simular día completo
              </button>
              {apiLog.length > 0 && (
                <button onClick={clearLog} className="btn !bg-white/10 !px-2 !py-1.5 text-white" aria-label="Limpiar consola">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-[560px] overflow-y-auto font-mono text-xs">
            {apiLog.length === 0 && (
              <div className="p-6 text-center text-white/60">
                Aún no hay llamadas. Publica panales desde el <b>Planificador</b>, envía visitas desde el <b>HUB</b> o presiona "Simular día completo".
              </div>
            )}
            {apiLog.map((e) => (
              <div key={e.id} className="border-b border-white/5">
                <button onClick={() => setOpen(open === e.id ? null : e.id)} className="flex w-full items-start gap-2 px-4 py-2.5 text-left hover:bg-white/5">
                  <span className="text-white/40">{e.at}</span>
                  <span className="rounded bg-lima px-1.5 font-bold text-bosque">{e.method}</span>
                  <span className="flex-1 break-all text-[#9fd3ff]">{e.endpoint}</span>
                  <span className="text-verde">{e.status}</span>
                </button>
                <div className="-mt-1 px-4 pb-2 font-sans text-[11px] text-white/70">
                  {e.summary} · <span className="text-white/40">desde {e.source}</span>
                </div>
                {open === e.id && (
                  <div className="grid gap-2 px-4 pb-3 md:grid-cols-2">
                    <pre className="max-h-64 overflow-auto rounded-lg bg-black/40 p-2 text-[11px] text-white/85">{JSON.stringify(e.body, null, 2)}</pre>
                    <pre className="max-h-64 overflow-auto rounded-lg bg-black/40 p-2 text-[11px] text-verde">{JSON.stringify(e.response, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 px-4 py-2 text-[10px] text-white/50">
            JSON de ejemplo simplificado; los nombres de campos deben validarse contra la documentación oficial. <Tag kind="SUPUESTO">Integración simulada</Tag>
          </div>
        </div>
      </div>
    </div>
  )
}
