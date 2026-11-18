import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import L from 'leaflet'
import { CircleMarker, GeoJSON, MapContainer, Marker, Pane, Polygon, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import GoogleMutant from 'leaflet.gridlayer.googlemutant/src/Leaflet.GoogleMutant.mjs'
import { CLEAN_STYLE, GOOGLE_KEY, loadGoogleMaps, useGoogleMaps } from './googleMaps'
import { DISTRICT_GEOJSON, HUB, type LatLng } from '../sim/data'
import { BARRIERS } from '../sim/barriers'
import type { Torre, Cuadrante, Route } from '../sim/types'
import { cellBoundary, cellCenter, cellEdges, cellParity } from '../sim/grid'

// Paleta suave para cuadrantes (se distinguen y respetan el contraste del texto encima)
export const CUAD_PALETTE = ['#C6D420', '#8FB3E8', '#F4A27A', '#5FB8B2', '#A8D27A', '#E8C35A', '#C59BD8']
export const LIMA_CENTER: [number, number] = [-12.08, -77.02]

// Mapa de calor: paquetes por casilla (escala secuencial lima → verde oscuro)
export const HEAT_COLORS = ['#F4F7D9', '#E2EC9A', '#C6D420', '#7DBA29', '#2E7D3C', '#12301F']
export function heatBreaks(values: number[]): number[] {
  const v = values.filter((x) => x > 0).sort((a, b) => a - b)
  if (!v.length) return [1, 2, 3, 4, 5]
  const q = (f: number) => Math.max(1, Math.round(v[Math.min(v.length - 1, Math.floor(f * v.length))]))
  const b = [q(0.2), q(0.4), q(0.6), q(0.8), q(0.95)]
  for (let i = 1; i < b.length; i++) if (b[i] <= b[i - 1]) b[i] = b[i - 1] + 1
  return b
}
export function heatColor(v: number, breaks: number[]): string {
  let i = 0
  while (i < breaks.length && v >= breaks[i]) i++
  return HEAT_COLORS[i]
}

/** Pieza Torre (ícono de marca) como SVG en texto, para marcadores del mapa */
export function rookSvg(fill: string, text: string, h = 18): string {
  return `<svg width="${h * 0.8}" height="${h}" viewBox="0 0 40 50" style="display:block"><path fill="${fill}" d="M7 3h6v5h4V3h6v5h4V3h6v11l-4 4v16l6 7v5H5v-5l6-7V18l-4-4z"/><text x="20" y="35" text-anchor="middle" font-family="Poppins" font-weight="800" font-size="12" fill="${text}">f.</text></svg>`
}

export function BaseMap({
  children,
  center = LIMA_CENTER,
  zoom = 11,
  className = 'h-[520px]',
  scrollWheel = true,
}: {
  children?: ReactNode
  center?: [number, number]
  zoom?: number
  className?: string
  scrollWheel?: boolean
}) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className={`${className} w-full rounded-2xl`}
      preferCanvas
      scrollWheelZoom={scrollWheel}
      zoomSnap={0.5}
    >
      <BaseTiles />
      {children}
    </MapContainer>
  )
}

/** Mapa base: Google Maps si hay clave válida; si no, OpenStreetMap (respaldo automático) */
function BaseTiles() {
  const map = useMap()
  const status = useGoogleMaps((s) => s.status)
  const preferGoogle = useGoogleMaps((s) => s.preferGoogle)
  const useGoogle = !!GOOGLE_KEY && preferGoogle && status !== 'failed'

  useEffect(() => {
    if (useGoogle && status === 'idle') loadGoogleMaps()
  }, [useGoogle, status])

  useEffect(() => {
    if (!useGoogle || status !== 'ready') return
    const layer = new GoogleMutant({ type: 'roadmap', styles: CLEAN_STYLE, maxZoom: 21 })
    layer.addTo(map)
    return () => {
      map.removeLayer(layer)
    }
  }, [map, useGoogle, status])

  return (
    <>
      {!(useGoogle && status === 'ready') && (
        <TileLayer
          className="osm-tiles"
          attribution='&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
      )}
      <ProviderSwitch />
    </>
  )
}

/** Selector chico del mapa base (solo aparece si hay clave de Google configurada) */
function ProviderSwitch() {
  const { status, reason, preferGoogle, setPreferGoogle } = useGoogleMaps()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) {
      L.DomEvent.disableClickPropagation(ref.current)
      L.DomEvent.disableScrollPropagation(ref.current)
    }
  })
  if (!GOOGLE_KEY) return null
  const onGoogle = preferGoogle && status === 'ready'
  return (
    <div className="leaflet-top leaflet-right">
      <div ref={ref} className="leaflet-control m-2 flex overflow-hidden rounded-lg bg-white text-[11px] font-bold shadow" title={reason ?? undefined}>
        <button
          onClick={() => setPreferGoogle(true)}
          disabled={status === 'failed'}
          className={`px-2 py-1 ${onGoogle ? 'bg-bosque text-lima' : 'text-bosque disabled:opacity-40'}`}
        >
          Google{status === 'loading' ? '…' : ''}
        </button>
        <button onClick={() => setPreferGoogle(false)} className={`px-2 py-1 ${!onGoogle ? 'bg-bosque text-lima' : 'text-bosque'}`}>
          OSM
        </button>
      </div>
    </div>
  )
}

export function FitTo({ points, padding = 30, deps = '' }: { points: LatLng[]; padding?: number; deps?: string }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    const b = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]))
    map.fitBounds(b, { padding: [padding, padding], maxZoom: 15 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps])
  return null
}

export function DistrictLayer({ highlight }: { highlight?: string[] }) {
  return (
    <GeoJSON
      key={highlight?.join(',') ?? 'all'}
      data={DISTRICT_GEOJSON as never}
      style={(f) => {
        const name = (f?.properties as { name: string })?.name
        const on = highlight?.some((h) => h.toUpperCase() === name)
        return {
          color: on ? '#00808D' : '#12301F',
          weight: on ? 2 : 1,
          opacity: on ? 0.9 : 0.45,
          dashArray: '4 5',
          fill: false,
          interactive: false,
        }
      }}
    />
  )
}

/** Vías rápidas (naranja) y ríos (azul) que un cuadrante no debe cruzar. Trazo aproximado. */
export function BarrierLayer({ highlight }: { highlight?: boolean }) {
  return (
    <Pane name="barriers" style={{ zIndex: 450 }}>
      {BARRIERS.map((b) => (
        <Fragment key={b.id}>
          <Polyline positions={b.path} interactive={false} pathOptions={{ color: '#ffffff', weight: highlight ? 9 : 7, opacity: 0.9 }} />
          <Polyline
            positions={b.path}
            pathOptions={{ color: b.kind === 'via' ? '#F26B21' : '#2B7BB9', weight: highlight ? 5 : 3.5, opacity: 0.95 }}
          >
            <Tooltip sticky>
              {b.kind === 'via' ? '🛣️' : '🌊'} {b.name} · ningún cuadrante la cruza (trazo aproximado)
            </Tooltip>
          </Polyline>
        </Fragment>
      ))}
    </Pane>
  )
}

/** Leyenda corta de barreras */
export function BarrierLegend() {
  return (
    <span className="flex items-center gap-3 text-[11px] font-semibold text-bosque">
      <span className="flex items-center gap-1">
        <span className="inline-block h-1 w-5 rounded bg-naranja" /> Vía rápida
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-1 w-5 rounded" style={{ background: '#2B7BB9' }} /> Río
      </span>
    </span>
  )
}

const boundaryCache = new Map<string, [number, number][]>()
/** Rombo de la casilla como polígono para Leaflet */
export function cellPoly(cell: string): [number, number][] {
  let b = boundaryCache.get(cell)
  if (!b) {
    b = cellBoundary(cell)
    boundaryCache.set(cell, b)
  }
  return b
}

export type MapMode = 'calor' | 'cuadrantes' | 'tablero'
export const MAP_MODES: { key: MapMode; label: string; hint: string }[] = [
  { key: 'calor', label: '🔥 Calor', hint: 'Paquetes por casilla' },
  { key: 'cuadrantes', label: '◆ Cuadrantes', hint: 'Un color por ruta' },
  { key: 'tablero', label: '♜ Tablero', hint: 'Negro = Torre · Blanco = HUB' },
]

export function MapModePicker({ mode, onChange }: { mode: MapMode; onChange: (m: MapMode) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-white p-1 shadow-sm">
      {MAP_MODES.map((m) => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          title={m.hint}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${mode === m.key ? 'bg-bosque text-lima' : 'text-bosque hover:bg-crema'}`}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

/** Leyenda del modo de mapa (se lee sin depender solo del color: lleva números y textos) */
export function MapLegend({ mode, breaks, unit = 'paquetes por casilla' }: { mode: MapMode; breaks: number[]; unit?: string }) {
  if (mode === 'calor')
    return (
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-gris">
        <span>{unit}:</span>
        {HEAT_COLORS.map((c, i) => (
          <span key={c} className="flex items-center gap-1">
            <i className="inline-block h-3 w-3 rotate-45 rounded-[2px] border border-black/10" style={{ background: c }} />
            {i === 0
              ? `<${breaks[0]}`
              : i === HEAT_COLORS.length - 1
                ? `≥${breaks[i - 1]}`
                : breaks[i] - 1 === breaks[i - 1]
                  ? `${breaks[i - 1]}`
                  : `${breaks[i - 1]}–${breaks[i] - 1}`}
          </span>
        ))}
      </div>
    )
  if (mode === 'tablero')
    return (
      <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-gris">
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rotate-45 rounded-[2px] bg-bosque" />Cuadrante negro: lo abastece una Torre</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rotate-45 rounded-[2px] border border-gris/40 bg-white" />Cuadrante blanco: sale directo del HUB</span>
      </div>
    )
  return <div className="text-[11px] font-semibold text-gris">Cada color es un cuadrante (1 ruta de ≤50 paquetes). Dos vecinos nunca comparten color.</div>
}

export function CuadranteLayer({
  cuadrantes,
  cellToCuad,
  selected,
  onCuadranteClick,
  onCellClick,
  fillOpacity = 0.55,
  showOutline = true,
  dimOthers = false,
  mode = 'cuadrantes',
  heat,
  breaks,
}: {
  cuadrantes: Cuadrante[]
  cellToCuad: Record<string, string>
  selected?: string | null
  onCuadranteClick?: (id: string) => void
  onCellClick?: (cell: string) => void
  fillOpacity?: number
  showOutline?: boolean
  dimOthers?: boolean
  mode?: MapMode
  heat?: Record<string, number>
  breaks?: number[]
}) {
  const byId = useMemo(() => new Map(cuadrantes.map((q) => [q.id, q])), [cuadrantes])
  const hb = useMemo(() => breaks ?? heatBreaks(Object.values(heat ?? {})), [breaks, heat])
  // bordes entre cuadrantes distintos (o con el exterior): un solo trazo multi-segmento
  const outlines = useMemo(() => {
    if (!showOutline) return { all: [] as [number, number][][], sel: [] as [number, number][][] }
    const all: [number, number][][] = []
    const sel: [number, number][][] = []
    for (const [cell, id] of Object.entries(cellToCuad)) {
      for (const e of cellEdges(cell)) {
        const other = cellToCuad[e.neighbor]
        if (other === id) continue
        if (other && other < id) continue // cada lado compartido se dibuja una vez
        all.push([e.a, e.b])
        if (selected && (id === selected || other === selected)) sel.push([e.a, e.b])
      }
    }
    return { all, sel }
  }, [cellToCuad, showOutline, selected])

  const fillFor = (cell: string, id: string): string => {
    if (mode === 'calor') return heatColor(heat?.[cell] ?? 0, hb)
    if (mode === 'tablero') {
      const dark = !!byId.get(id)?.torreId
      const odd = cellParity(cell) === 1
      return dark ? (odd ? '#1C4A2F' : '#0B2215') : odd ? '#E7EBCF' : '#FFFFFF'
    }
    const q = byId.get(id)
    return q ? CUAD_PALETTE[q.color % CUAD_PALETTE.length] : '#ccc'
  }
  const baseOpacity = mode === 'calor' ? Math.max(fillOpacity, 0.7) : mode === 'tablero' ? 0.7 : fillOpacity
  const lineColor = mode === 'tablero' ? '#C6D420' : '#12301F'
  return (
    <>
      {Object.entries(cellToCuad).map(([cell, id]) => {
        const sel = selected === id
        const dim = dimOthers && selected && !sel
        return (
          <Polygon
            key={cell + id + mode}
            positions={cellPoly(cell)}
            pathOptions={{
              color: mode === 'tablero' ? 'transparent' : '#ffffff',
              weight: 0.6,
              fillColor: fillFor(cell, id),
              fillOpacity: dim ? 0.12 : sel ? Math.min(0.9, baseOpacity + 0.25) : baseOpacity,
            }}
            eventHandlers={{
              click: () => {
                onCellClick?.(cell)
                onCuadranteClick?.(id)
              },
            }}
          >
            {mode === 'calor' && heat && (
              <Tooltip sticky>
                {Math.round(heat[cell] ?? 0)} paquetes · cuadrante {byId.get(id)?.name}
              </Tooltip>
            )}
          </Polygon>
        )
      })}
      {showOutline && (
        <Polyline positions={outlines.all} interactive={false} pathOptions={{ color: lineColor, weight: mode === 'tablero' ? 2.2 : 1.6, opacity: 0.85 }} />
      )}
      {outlines.sel.length > 0 && <Polyline positions={outlines.sel} interactive={false} pathOptions={{ color: '#F26B21', weight: 4, opacity: 1 }} />}
    </>
  )
}

/** Nombre de cada cuadrante (A3, H12…) en su centro, visible desde cierto zoom */
export function CuadranteNames({ cuadrantes, minZoom = 12, dark }: { cuadrantes: Cuadrante[]; minZoom?: number; dark?: (q: Cuadrante) => boolean }) {
  const map = useMap()
  const [z, setZ] = useState(map.getZoom())
  useMapEvents({ zoomend: () => setZ(map.getZoom()) })
  if (z < minZoom) return null
  return (
    <>
      {cuadrantes.map((q) => (
        <Marker
          key={q.id}
          position={[q.centroid.lat, q.centroid.lng]}
          interactive={false}
          icon={L.divIcon({
            className: 'leaflet-div-icon clean',
            html: `<div class="cuad-label${dark?.(q) ? ' on-dark' : ''}">${q.name}</div>`,
            iconSize: [34, 18],
            iconAnchor: [17, 9],
          })}
        />
      ))}
    </>
  )
}

/** Número de paquetes esperados por casilla (visible al hacer zoom) */
export function CellLabels({ demand, minZoom = 14 }: { demand: Record<string, number>; minZoom?: number }) {
  const map = useMap()
  const [view, setView] = useState({ z: map.getZoom(), b: map.getBounds() })
  useMapEvents({
    zoomend: () => setView({ z: map.getZoom(), b: map.getBounds() }),
    moveend: () => setView({ z: map.getZoom(), b: map.getBounds() }),
  })
  if (view.z < minZoom) return null
  const cells = Object.keys(demand).filter((c) => {
    const p = cellCenter(c)
    return view.b.contains([p.lat, p.lng])
  })
  return (
    <>
      {cells.slice(0, 400).map((c) => {
        const p = cellCenter(c)
        return (
          <Marker
            key={c}
            position={[p.lat, p.lng]}
            interactive={false}
            icon={L.divIcon({ className: 'leaflet-div-icon clean', html: `<div class="cell-label">${Math.round(demand[c])}</div>`, iconSize: [24, 20] })}
          />
        )
      })}
    </>
  )
}

export const hubIcon = L.divIcon({
  className: 'leaflet-div-icon clean',
  html: `<div style="background:#12301F;color:#C6D420;font:700 11px Poppins;padding:4px 8px;border-radius:8px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3)">🏭 HUB XD VES</div>`,
  iconSize: [100, 26],
  iconAnchor: [50, 13],
})

export function HubMarker() {
  return (
    <Marker position={[HUB.lat, HUB.lng]} icon={hubIcon}>
      <Tooltip>HUB XD Villa El Salvador · ubicación aproximada · 700 ped/h</Tooltip>
    </Marker>
  )
}

export function torreIcon(label: string, active = false) {
  return L.divIcon({
    className: 'leaflet-div-icon clean',
    html: `<div style="display:flex;align-items:center;gap:5px;background:${active ? '#F26B21' : '#00808D'};color:#fff;font:700 11px Poppins;padding:3px 9px 3px 6px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3);border:2px solid #fff">${rookSvg('#fff', active ? '#F26B21' : '#00808D', 17)}${label}</div>`,
    iconSize: [120, 26],
    iconAnchor: [60, 13],
  })
}

export function torreLabel(t: Torre): string {
  return t.letter ? `Torre ${t.letter} · ${t.short}` : `Torre ${t.short}`
}

export function TorreMarkers({
  torres,
  cuadrantes,
  showLinks = true,
  activeId,
}: {
  torres: Torre[]
  cuadrantes: Cuadrante[]
  showLinks?: boolean
  activeId?: string | null
}) {
  const byId = new Map(cuadrantes.map((p) => [p.id, p]))
  return (
    <>
      {torres
        .filter((c) => c.cuadIds.length > 0)
        .map((c) => (
          <Fragment key={c.id}>
            {showLinks &&
              c.cuadIds.map((pid) => {
                const p = byId.get(pid)
                if (!p) return null
                return (
                  <Polyline
                    key={pid}
                    positions={[
                      [c.lat, c.lng],
                      [p.centroid.lat, p.centroid.lng],
                    ]}
                    pathOptions={{ color: '#00808D', weight: 1.5, opacity: 0.7, dashArray: '2 4' }}
                    interactive={false}
                  />
                )
              })}
            <Marker position={[c.lat, c.lng]} icon={torreIcon(torreLabel(c), activeId === c.id)} zIndexOffset={500}>
              <Tooltip>
                {torreLabel(c)} · punto medio de {c.cuadIds.length} cuadrantes · ~{Math.round(c.expLoad)} paquetes · {c.trucks} camión(es)
              </Tooltip>
            </Marker>
          </Fragment>
        ))}
    </>
  )
}

export function RouteLine({ route, color = '#12301F', numbered = false, weight = 3 }: { route: Route; color?: string; numbered?: boolean; weight?: number }) {
  const pts: [number, number][] = [[route.depot.lat, route.depot.lng], ...route.stops.map((s) => [s.lat, s.lng] as [number, number])]
  return (
    <>
      <Polyline positions={pts} pathOptions={{ color, weight, opacity: 0.85 }} />
      {numbered &&
        route.stops.map((s) =>
          s.kind === 'reload' ? (
            <Marker
              key={'r' + s.seq}
              position={[s.lat, s.lng]}
              icon={L.divIcon({
                className: 'leaflet-div-icon clean',
                html: `<div style="background:#F26B21;color:#fff;font:700 10px Poppins;padding:2px 6px;border-radius:999px;border:2px solid #fff;white-space:nowrap">↻ Reabastecer</div>`,
                iconSize: [84, 20],
                iconAnchor: [42, 30],
              })}
            />
          ) : (
            <CircleMarker
              key={s.seq}
              center={[s.lat, s.lng]}
              radius={s.orderId === 'F-208341' ? 9 : 5}
              pathOptions={{ color: '#fff', weight: 1.5, fillColor: s.orderId === 'F-208341' ? '#F26B21' : color, fillOpacity: 1 }}
            >
              <Tooltip>
                #{s.seq} · {s.orderId}
              </Tooltip>
            </CircleMarker>
          ),
        )}
    </>
  )
}
