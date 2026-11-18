import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { NeedResult, ScreenHeader, SimBadge, Tag, fmtInt, fmtMs, fmtNum, fmtPct } from '../components/ui'
import { anaContext } from '../components/demoSteps'
import { fmtTime } from '../sim/geo'
import { TARGETS } from '../sim/params'
import type { SimResult } from '../sim/types'
import { useSim } from '../store/useSim'

type Verdict = 'ok' | 'partial' | 'no' | 'out'
const VERDICT: Record<Verdict, { label: string; cls: string }> = {
  ok: { label: '✓ Responde', cls: 'bg-lima text-bosque' },
  partial: { label: '◐ Parcial', cls: 'bg-amber-100 text-amber-800' },
  no: { label: '✕ No resuelve', cls: 'bg-naranja text-white' },
  out: { label: '— Fuera de alcance', cls: 'bg-slate-100 text-slate-600' },
}

interface Item {
  id: string
  source: 'RETO' | 'ENTREVISTA'
  need: string
  piece: string
  evidence: string
  verdict: Verdict
  to: string
}

function buildItems(r: SimResult, cyber: { otd: number; motos: number; trucks: number; sortEnd: number } | null): Item[] {
  const { A, C } = r.scenarios
  const a = A.kpis
  const c = C.kpis
  const ana = anaContext(r)
  const cross = r.map.cuadrantes.filter((q) => q.districts.length > 1).length / r.map.cuadrantes.length
  const anaIn = ana ? ana.eta >= ana.winStart && ana.eta <= ana.winEnd : false
  const verdictFor = (v: number, target: number, base: number): Verdict => (v >= target ? 'ok' : v > base ? 'partial' : 'no')
  return [
    // ── Reto (bases oficiales)
    {
      id: 'R1',
      source: 'RETO',
      need: 'Sectorizar en el poco tiempo entre el cierre de pedidos y la salida de las unidades',
      piece: 'Pin f. + Tablero f. (asignación al comprar)',
      evidence: `${fmtInt(r.assignment.count)} pedidos asignados a su cuadrante en ${fmtMs(r.assignment.timeMs)} ms. A las 02:30 solo se clasifica.`,
      verdict: 'ok',
      to: '/hub',
    },
    {
      id: 'R2',
      source: 'RETO',
      need: 'Rutas estáticas eficientes · 50 paradas por ruta (SPR)',
      piece: 'Cuadrantes de máximo 50 paquetes + Admin (vecino o 2.º motorizado)',
      evidence: `SPR ${fmtNum(a.spr)} → ${fmtNum(c.spr)}; rutas con < 30 paradas ${fmtPct(a.pctRoutesUnder30, 0)} → ${fmtPct(c.pctRoutesUnder30, 0)}; ninguna ruta pasa de ${c.maxStops}. El promedio no llega a 50 porque 50 es el tope.`,
      verdict: c.spr >= TARGETS.spr ? 'ok' : 'partial',
      to: '/gerencia',
    },
    {
      id: 'R3',
      source: 'RETO',
      need: '96% de entregas a tiempo (OTD)',
      piece: 'Torre (menos km vacíos) + ventana de 2 h',
      evidence: `Pedidos dentro del turno ${fmtPct(a.otd)} → ${fmtPct(c.otd)} (meta 96%). Km vacíos ${fmtInt(a.emptyKm)} → ${fmtInt(c.emptyKm)}.`,
      verdict: verdictFor(c.otd, TARGETS.otd, a.otd),
      to: '/gerencia',
    },
    {
      id: 'R4',
      source: 'RETO',
      need: '99,9% de nivel de servicio de carga',
      piece: 'Pocos camiones en el HUB + escaneo de cada bolsa en la Torre',
      evidence: `Carga correcta ${fmtPct(a.loadCorrect, 2)} → ${fmtPct(c.loadCorrect, 2)} (las rutas directas del HUB siguen con carga manual).`,
      verdict: verdictFor(c.loadCorrect, TARGETS.load, a.loadCorrect),
      to: '/torre',
    },
    {
      id: 'R5',
      source: 'RETO',
      need: 'Capacidad del HUB: 700 pedidos/hora',
      piece: '— (solo se cambia el orden de clasificación)',
      evidence: `El HUB termina de clasificar a las ${fmtTime(c.sortEnd)}${cyber ? ` (en Cyber: ${fmtTime(cyber.sortEnd)})` : ''}. TORRE f. no agrega capacidad física; la Torre solo lo desacopla.`,
      verdict: 'no',
      to: '/hub',
    },
    {
      id: 'R6',
      source: 'RETO',
      need: 'Lima Metropolitana completa, no distrito por distrito',
      piece: 'Casillas en rombo que se juntan sin mirar límites de distrito',
      evidence: `${fmtPct(cross, 0)} de los ${r.map.cuadrantes.length} cuadrantes cruzan al menos un límite de distrito.`,
      verdict: 'ok',
      to: '/planificador',
    },
    // ── Entrevista
    {
      id: 'E1',
      source: 'ENTREVISTA',
      need: 'Ya usan SimpliRoute y la app del motorizado les gusta',
      piece: 'Integración: cuadrante → Zona, pedido → Visita, Torre → Vehículo + inicio, entregas → Webhooks',
      evidence: 'No se crea app nueva. Integración simulada; falta confirmar si su licencia incluye acceso a la API.',
      verdict: 'partial',
      to: '/integracion',
    },
    {
      id: 'E2',
      source: 'ENTREVISTA',
      need: 'Muchas direcciones sin coordenadas; se buscan a mano en Google',
      piece: 'Pin f. en el checkout + geocodificación automática de día',
      evidence: `Geocodificación manual: ${fmtInt(a.geocodeMin / 60)} h → ${fmtInt(c.geocodeMin / 60)} h por noche.`,
      verdict: 'ok',
      to: '/cliente/checkout',
    },
    {
      id: 'E3',
      source: 'ENTREVISTA',
      need: 'Rutas por orden de llegada ("los primeros que caen arman rutas")',
      piece: 'Cuadrantes por cercanía, calculados de día con el historial',
      evidence: `Rutas chicas (< 30) ${fmtPct(a.pctRoutesUnder30, 0)} → ${fmtPct(c.pctRoutesUnder30, 0)}; rutas ${a.routes} → ${c.routes}.`,
      verdict: 'ok',
      to: '/planificador',
    },
    {
      id: 'E4',
      source: 'ENTREVISTA',
      need: 'Mochila por volumen: si no entra, el motorizado vuelve',
      piece: 'Torre: "me quedé sin paquetes" → se reabastece en la Torre',
      evidence: `${c.reloads} reabastecimientos en la Torre en vez de volver a VES; km vacíos −${fmtPct(1 - c.emptyKm / a.emptyKm, 0)}.`,
      verdict: 'ok',
      to: '/motorizado',
    },
    {
      id: 'E5',
      source: 'ENTREVISTA',
      need: '"Un camión que alimente a la moto"; "pueden recargar en tiendas"',
      piece: 'Torre A, B, C… en el punto medio de sus cuadrantes',
      evidence: `${C.torreTrips.length} Torres y ${c.trucks} camiones esta noche; las motos de ${C.torreTrips.reduce((s, t) => s + t.cuadIds.length, 0)} cuadrantes salen de su Torre.`,
      verdict: 'ok',
      to: '/torre',
    },
    {
      id: 'E6',
      source: 'ENTREVISTA',
      need: 'En Cyber las motos salen 8–9 y no terminan; los lunes hay picos',
      piece: 'Mapas Bajo/Normal/Alto/Cyber y por día + capacidad planificada de día',
      evidence: cyber
        ? `Cyber: ${cyber.motos} motos y ${cyber.trucks} camiones; a tiempo ${fmtPct(cyber.otd)}. El HUB sigue siendo el cuello de botella.`
        : 'Abre "Capacidad" para simular Cyber.',
      verdict: 'partial',
      to: '/capacidad',
    },
    {
      id: 'E7',
      source: 'ENTREVISTA',
      need: 'El 60% llega a las 02:30 y no se puede adelantar (promesa de 24 h)',
      piece: 'Se ordena de día, se ejecuta de noche',
      evidence: 'No se cambia la oleada: el pedido ya trae su cuadrante y su Torre al llegar.',
      verdict: 'ok',
      to: '/hub',
    },
    {
      id: 'E8',
      source: 'ENTREVISTA',
      need: 'Visibilidad del cliente mala ("de 8 a 8")',
      piece: 'Ventana de 2 h por el canal de mensajes que ya existe',
      evidence: ana
        ? `Ana: "llega entre ${fmtTime(ana.winStart)} y ${fmtTime(ana.winEnd)}"; ETA ${fmtTime(ana.eta)} ${anaIn ? 'dentro' : 'fuera'} de la ventana.`
        : 'Ventana de 12 h → 2 h.',
      verdict: anaIn ? 'ok' : 'partial',
      to: '/cliente/entrega',
    },
    {
      id: 'E9',
      source: 'ENTREVISTA',
      need: 'Se paga al transporte por paquete entregado',
      piece: 'El ahorro de km es del proveedor; para Falabella el valor es OTD, cliente y Cyber',
      evidence: `${fmtInt(a.emptyKm - c.emptyKm)} km vacíos menos por día para el proveedor. Falabella no ahorra directo en flete.`,
      verdict: 'partial',
      to: '/gerencia',
    },
    {
      id: 'E10',
      source: 'ENTREVISTA',
      need: 'Marcas falsas de "cliente no estaba"',
      piece: '— (ya lo controlan con la ubicación de la marca)',
      evidence: 'No se aborda.',
      verdict: 'out',
      to: '/supuestos',
    },
    {
      id: 'E11',
      source: 'ENTREVISTA',
      need: '"SimpliRoute aprende… no sé cómo probarlo"',
      piece: 'Reporte de aprendizaje medible cada semana',
      evidence: `${r.learning.length} ajustes propuestos con su causa y el mapa antes/después.`,
      verdict: 'ok',
      to: '/reporte',
    },
    {
      id: 'E12',
      source: 'ENTREVISTA',
      need: 'Same day ya usa tiendas como puntos de salida',
      piece: 'Respaldo para ubicar Torres en estacionamientos o tiendas',
      evidence: 'Los puntos Torre son genéricos; falta validar ubicaciones reales con Falabella.',
      verdict: 'partial',
      to: '/planificador',
    },
    {
      id: 'E13',
      source: 'ENTREVISTA',
      need: 'Dirección errada → servicio al cliente llama y se reintenta',
      piece: 'Pin f.: el cliente marca su puerta',
      evidence: 'Debería bajar los reintentos, pero la simulación no lo mide.',
      verdict: 'partial',
      to: '/cliente/checkout',
    },
    {
      id: 'X1',
      source: 'ENTREVISTA',
      need: 'Funcionalidad extra pedida: si un cuadrante pasa de 50, mover o asignar otro motorizado',
      piece: 'Panel Admin: pasar sobrantes a un vecino o partir por zona entre 2+ motorizados',
      evidence: `${C.spills.length} traspasos a vecinos y ${C.splits.length} cuadrantes partidos esta noche; máximo por ruta: ${c.maxStops}.`,
      verdict: c.maxStops <= 50 ? 'ok' : 'partial',
      to: '/admin',
    },
  ]
}

export default function Evaluation() {
  return (
    <NeedResult>
      <EvaluationInner />
    </NeedResult>
  )
}

function EvaluationInner() {
  const result = useSim((s) => s.result)!
  const capacity = useSim((s) => s.capacity)
  const runCapacity = useSim((s) => s.runCapacity)
  const [filter, setFilter] = useState<Verdict | 'all'>('all')
  useEffect(() => {
    runCapacity()
  }, [runCapacity])
  const cy = capacity?.find((x) => x.level === 'Cyber')
  const items = buildItems(result, cy ? { otd: cy.otdTorre, motos: cy.motosTorre, trucks: cy.trucks, sortEnd: cy.sortEnd } : null)
  const counts = (Object.keys(VERDICT) as Verdict[]).map((v) => ({ v, n: items.filter((i) => i.verdict === v).length }))
  const shown = filter === 'all' ? items : items.filter((i) => i.verdict === filter)

  return (
    <div>
      <ScreenHeader
        kicker="Gerencia · evaluación honesta"
        title="¿Cada pieza responde al reto y a lo que nos contaron?"
        right={<SimBadge />}
      >
        Cada fila es una exigencia de las bases o un insight de la entrevista, con la pieza de TORRE f. que lo atiende y la evidencia que sale <b>de esta simulación</b>. Si algo
        no se cumple, lo decimos.
      </ScreenHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={() => setFilter('all')} className={`rounded-xl px-4 py-2 text-sm font-bold ${filter === 'all' ? 'bg-bosque text-lima' : 'bg-white text-bosque shadow-sm'}`}>
          Todos · {items.length}
        </button>
        {counts.map(({ v, n }) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${VERDICT[v].cls} ${filter === v ? 'ring-2 ring-bosque' : 'opacity-90'}`}
          >
            {VERDICT[v].label} · {n}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto p-2">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-gris">
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Lo que pide el reto / lo que nos dijeron</th>
              <th className="px-2 py-2">Pieza de TORRE f.</th>
              <th className="px-2 py-2">Evidencia (simulada)</th>
              <th className="px-2 py-2">Veredicto</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((i) => (
              <tr key={i.id} className="border-t border-linea align-top">
                <td className="px-2 py-2.5">
                  <div className="font-extrabold text-bosque">{i.id}</div>
                  <div className="mt-1">
                    <Tag kind={i.source} />
                  </div>
                </td>
                <td className="px-2 py-2.5 font-semibold text-bosque">{i.need}</td>
                <td className="px-2 py-2.5">{i.piece}</td>
                <td className="px-2 py-2.5 text-xs text-gris">
                  {i.evidence}{' '}
                  <Link to={i.to} className="whitespace-nowrap font-semibold text-turq hover:underline">
                    ver →
                  </Link>
                </td>
                <td className="px-2 py-2.5">
                  <span className={`chip whitespace-nowrap ${VERDICT[i.verdict].cls}`}>{VERDICT[i.verdict].label}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-gris">
        Los veredictos de las metas (SPR, OTD, carga) se recalculan con cada cambio de supuestos. Parcial = mejora frente a hoy pero no llega a la meta, o depende de validar algo
        con Falabella.
      </p>
    </div>
  )
}
