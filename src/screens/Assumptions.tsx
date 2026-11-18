import { RotateCcw } from 'lucide-react'
import { ScreenHeader, Tag } from '../components/ui'
import { DEFAULT_PARAMS, PARAM_META } from '../sim/params'
import { useSim } from '../store/useSim'

const RETO_FACTS: [string, string][] = [
  ['Pregunta del reto', '¿Cómo sectorizar los pedidos miniticket de despacho a domicilio para hacer rutas estáticas eficientes en Lima Metropolitana?'],
  ['Metas', 'OTD 96% · SPR 50 paradas por ruta · 99,9% nivel de servicio de carga'],
  ['Venta → entrega', '00:00–23:59 → entrega al día siguiente (100% stock Falabella); sellers 00:00–16:59 (50%)'],
  ['CD Villa El Salvador', '48.000 m² · recibo 35.000 · empaque 80.000 · despacho 150.000 ped/día'],
  ['HUB cross-docking', '2.500 m² · 700 pedidos/hora · ~1,9 km del CD'],
  ['Oleadas CD → HUB', '14:00 = 15% · 19:00 = 25% · 02:30 = 60%'],
  ['Ruteo estático actual', '"Los primeros 50 pedidos del distrito" = 1 ruta'],
  ['Turnos de motorizado', '06:00–11:00 · 12:00–17:00 · 18:00–21:00'],
  ['Participación por distrito', 'Surco ≈16%, Miraflores ≈11%, San Isidro ≈7,5% + cola larga (lectura aproximada de un gráfico)'],
]

const INSIGHTS = [
  'Usan SimpliRoute (licencia SaaS); la app del motorizado es intuitiva → integrarse, no crear app nueva.',
  'Muchas direcciones no tienen coordenadas; se buscan a mano en Google → Pin f.',
  'Rutas estáticas por orden de llegada; el motorizado conoce su ruta al cargar → cuadrantes por cercanía (Tablero f.).',
  'Mochila por volumen (tallas XS3, XS2, S, M en dm³); si no entra, el motorizado vuelve → se reabastece en la Torre.',
  'Idea de ellos: un camión que alimente a las motos; "pueden recargar en tiendas" → la Torre.',
  'En Cyber las motos salen 8–9 en vez de 7 y no terminan de entregar; los lunes hay picos.',
  'El 60% de las 02:30 viene de la curva de ventas (17:00–24:00) y la promesa es 24 h.',
  'Visibilidad del cliente mala ("de 8 a 8") → ventana de 2 h.',
  'Se paga al transporte por paquete entregado: el ahorro de km beneficia al proveedor; a Falabella le importa OTD, cliente y Cyber.',
  '"SimpliRoute aprende… en teoría, no sé cómo probarlo" → reporte de aprendizaje medible.',
]

export default function Assumptions() {
  const params = useSim((s) => s.params)
  const setParams = useSim((s) => s.setParams)
  const resetParams = useSim((s) => s.resetParams)
  const changed = PARAM_META.filter((m) => m.get(params) !== m.get(DEFAULT_PARAMS)).length

  return (
    <div>
      <ScreenHeader
        kicker="P10 · Supuestos y fuentes"
        title="Qué es dato, qué es insight y qué es supuesto"
        right={
          <button onClick={resetParams} className="btn-ghost" disabled={changed === 0}>
            <RotateCcw size={16} /> Restaurar valores {changed > 0 && `(${changed} cambiado${changed > 1 ? 's' : ''})`}
          </button>
        }
      >
        Todos los supuestos son editables y la simulación se recalcula al instante. Se validan con Falabella.
      </ScreenHeader>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="card overflow-x-auto p-4">
          <h3 className="font-extrabold text-bosque">Supuestos editables</h3>
          <table className="mt-2 w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase text-gris">
                <th className="py-1.5">Parámetro</th>
                <th className="py-1.5">Valor</th>
                <th className="py-1.5">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {PARAM_META.map((m) => {
                const disp = m.display ?? 1
                const v = m.get(params) * disp
                const isChanged = m.get(params) !== m.get(DEFAULT_PARAMS)
                return (
                  <tr key={m.key} className="border-t border-linea">
                    <td className="py-2 pr-2">
                      <div className="font-semibold text-bosque">{m.label}</div>
                      {m.note && <div className="text-[11px] text-gris">{m.note}</div>}
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={+v.toFixed(4)}
                          step={(m.step ?? 1) * (disp === 100 ? 1 : 1)}
                          min={m.min}
                          max={m.max}
                          onChange={(e) => {
                            const n = Number(e.target.value)
                            if (!Number.isFinite(n)) return
                            setParams(m.set(params, n / disp))
                          }}
                          className={`w-24 rounded-lg border px-2 py-1 text-right font-semibold ${isChanged ? 'border-naranja bg-naranja-soft' : 'border-linea'}`}
                        />
                        <span className="text-xs text-gris">{m.unit}</span>
                      </div>
                    </td>
                    <td className="py-2">
                      <Tag kind={m.source} />
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t border-linea">
                <td className="py-2 font-semibold text-bosque">Escenarios de demanda</td>
                <td className="py-2 text-xs">Bajo ×0,7 · Normal ×1 · Alto ×1,4 · Cyber ×2</td>
                <td className="py-2">
                  <Tag kind="SUPUESTO" />
                </td>
              </tr>
              <tr className="border-t border-linea">
                <td className="py-2 font-semibold text-bosque">Volumen por talla / mix</td>
                <td className="py-2 text-xs">XS3 0,5 · XS2 1 · XS 2 · S 4 · M 8 dm³ · mix 30/25/20/15/10% (Cyber más S y M)</td>
                <td className="py-2">
                  <Tag kind="SUPUESTO" />
                </td>
              </tr>
              <tr className="border-t border-linea">
                <td className="py-2 font-semibold text-bosque">Reparto de rutas por turno</td>
                <td className="py-2 text-xs">50% / 35% / 15% (por hora de disponibilidad)</td>
                <td className="py-2">
                  <Tag kind="SUPUESTO" />
                </td>
              </tr>
              <tr className="border-t border-linea">
                <td className="py-2 font-semibold text-bosque">Casilla del tablero</td>
                <td className="py-2 text-xs">Rombo de 0,8 km por lado (~8 cuadras, 0,64 km²); cuadrante = 1 ruta de máximo 50 paquetes</td>
                <td className="py-2">
                  <Tag kind="DISEÑO" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="flex items-center gap-2 font-extrabold text-bosque">
              Datos del reto <Tag kind="RETO" />
            </h3>
            <dl className="mt-2 space-y-1.5 text-sm">
              {RETO_FACTS.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] font-bold uppercase text-gris">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="card p-4">
            <h3 className="flex items-center gap-2 font-extrabold text-bosque">
              Insights de la entrevista <Tag kind="ENTREVISTA" />
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {INSIGHTS.map((x) => (
                <li key={x}>• {x}</li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-gris">Resumen anonimizado; no se publican nombres ni la grabación.</p>
          </div>
          <div className="card p-4 text-sm">
            <h3 className="font-extrabold text-bosque">Fuentes</h3>
            <ul className="mt-2 space-y-1 text-xs">
              <li>• Bases y PPT oficiales de la Innovathon Ulima × Saga Falabella 2026.</li>
              <li>• Entrevista grupal con el equipo de Falabella (14/11/2026), anonimizada.</li>
              <li>• Límites de distritos: INEI, vía github.com/juaneladio/peru-geojson (simplificado).</li>
              <li>• Casillas en rombo: cuadrícula propia del equipo. Mapas: Google Maps (si hay clave) o © colaboradores de OpenStreetMap.</li>
              <li>• API pública de SimpliRoute: documentation.simpliroute.com/es (integración simulada).</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
