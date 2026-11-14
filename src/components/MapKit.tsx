import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import L from 'leaflet'
import { CircleMarker, GeoJSON, MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { cellToBoundary, cellsToMultiPolygon } from 'h3-js'
import GoogleMutant from 'leaflet.gridlayer.googlemutant/src/Leaflet.GoogleMutant.mjs'
import { CLEAN_STYLE, GOOGLE_KEY, loadGoogleMaps, useGoogleMaps } from './googleMaps'
import { DISTRICT_GEOJSON, HUB, type LatLng } from '../sim/data'
import type { Colmena, Panal, Route } from '../sim/types'
import { cellCenter } from '../sim/panales'

// Paleta suave para panales (se distinguen y respetan el contraste del texto encima)
export const PANAL_PALETTE = ['#C6D420', '#8FB3E8', '#F4A27A', '#5FB8B2', '#A8D27A', '#E8C35A', '#C59BD8']
export const LIMA_CENTER: [number, number] = [-12.08, -77.02]

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

const boundaryCache = new Map<string, [number, number][]>()
export function cellPoly(cell: string): [number, number][] {
  let b = boundaryCache.get(cell)
  if (!b) {
    b = cellToBoundary(cell) as [number, number][]
    boundaryCache.set(cell, b)
  }
  return b
}

export function PanalLayer({
  panales,
  cellToPanal,
  selected,
  onPanalClick,
  onCellClick,
  fillOpacity = 0.55,
  showOutline = true,
  dimOthers = false,
}: {
  panales: Panal[]
  cellToPanal: Record<string, string>
  selected?: string | null
  onPanalClick?: (id: string) => void
  onCellClick?: (cell: string) => void
  fillOpacity?: number
  showOutline?: boolean
  dimOthers?: boolean
}) {
  const color = useMemo(() => new Map(panales.map((p) => [p.id, PANAL_PALETTE[p.color % PANAL_PALETTE.length]])), [panales])
  const outlines = useMemo(() => {
    if (!showOutline) return []
    const byPanal = new Map<string, string[]>()
    for (const [c, id] of Object.entries(cellToPanal)) {
      const a = byPanal.get(id) ?? []
      a.push(c)
      byPanal.set(id, a)
    }
    return [...byPanal].map(([id, cells]) => ({ id, poly: cellsToMultiPolygon(cells, false) as unknown as [number, number][][][] }))
  }, [cellToPanal, showOutline])
  return (
    <>
      {Object.entries(cellToPanal).map(([cell, id]) => {
        const sel = selected === id
        const dim = dimOthers && selected && !sel
        return (
          <Polygon
            key={cell + id}
            positions={cellPoly(cell)}
            pathOptions={{
              color: '#ffffff',
              weight: 0.6,
              fillColor: color.get(id) ?? '#ccc',
              fillOpacity: dim ? 0.12 : sel ? 0.85 : fillOpacity,
            }}
            eventHandlers={{
              click: () => {
                onCellClick?.(cell)
                onPanalClick?.(id)
              },
            }}
          />
        )
      })}
      {outlines.map((o) => (
        <Polygon
          key={'o' + o.id}
          positions={o.poly}
          interactive={false}
          pathOptions={{ color: selected === o.id ? '#F26B21' : '#12301F', weight: selected === o.id ? 4 : 2, fill: false, opacity: 0.85 }}
        />
      ))}
    </>
  )
}

/** Número de pedidos esperados por celda (visible al hacer zoom) */
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

export function colmenaIcon(label: string, active = false) {
  return L.divIcon({
    className: 'leaflet-div-icon clean',
    html: `<div style="background:${active ? '#F26B21' : '#00808D'};color:#fff;font:700 11px Poppins;padding:3px 7px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3);border:2px solid #fff">🚐 ${label}</div>`,
    iconSize: [110, 24],
    iconAnchor: [55, 12],
  })
}

export function ColmenaMarkers({
  colmenas,
  panales,
  showLinks = true,
  activeId,
}: {
  colmenas: Colmena[]
  panales: Panal[]
  showLinks?: boolean
  activeId?: string | null
}) {
  const byId = new Map(panales.map((p) => [p.id, p]))
  return (
    <>
      {colmenas
        .filter((c) => c.panalIds.length > 0)
        .map((c) => (
          <Fragment key={c.id}>
            {showLinks &&
              c.panalIds.map((pid) => {
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
            <Marker position={[c.lat, c.lng]} icon={colmenaIcon(c.short, activeId === c.id)} zIndexOffset={500}>
              <Tooltip>
                {c.name} · {c.panalIds.length} panales · ~{Math.round(c.expLoad)} pedidos · {c.minivans} minivan(es)
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
                html: `<div style="background:#F26B21;color:#fff;font:700 10px Poppins;padding:2px 6px;border-radius:999px;border:2px solid #fff;white-space:nowrap">↻ Recarga</div>`,
                iconSize: [70, 20],
                iconAnchor: [35, 30],
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
