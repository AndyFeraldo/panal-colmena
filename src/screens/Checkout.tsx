import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { Marker, Polygon, useMap } from 'react-leaflet'
import { gridDisk, latLngToCell } from '../sim/grid'
import { Check, Loader2, LocateFixed, Search, ShoppingCart, Timer } from 'lucide-react'
import { GOOGLE_KEY, geocodeAddress } from '../components/googleMaps'
import { BaseMap, CUAD_PALETTE, cellPoly } from '../components/MapKit'
import { NeedResult, PhoneFrame, ScreenHeader, Tag, fmtInt } from '../components/ui'
import { ANA } from '../sim/data'
import { useSim } from '../store/useSim'

const pinIcon = L.divIcon({
  className: 'leaflet-div-icon clean',
  html: `<div style="font-size:38px;line-height:38px;filter:drop-shadow(0 3px 3px rgba(0,0,0,.35))">📍</div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 36],
})

export default function Checkout() {
  return (
    <NeedResult>
      <CheckoutInner />
    </NeedResult>
  )
}

function CheckoutInner() {
  const result = useSim((s) => s.result)!
  const demoStep = useSim((s) => s.demoStep)
  const params = useSim((s) => s.params)
  const [pos, setPos] = useState({ lat: ANA.lat + 0.0012, lng: ANA.lng + 0.0016 })
  const [confirmed, setConfirmed] = useState(false)
  const [stage, setStage] = useState(0)
  const [address, setAddress] = useState(ANA.address)
  const [geo, setGeo] = useState<{ busy: boolean; msg: string | null; ok?: boolean }>({ busy: false, msg: null })
  const [recenter, setRecenter] = useState(0)

  // Pin f. + geocodificación automática (Google Geocoding API): la dirección escrita se convierte en un punto
  const locate = async () => {
    setGeo({ busy: true, msg: null })
    const r = await geocodeAddress(address)
    if ('error' in r) {
      setGeo({ busy: false, msg: r.error, ok: false })
      return
    }
    setPos({ lat: r.lat, lng: r.lng })
    setConfirmed(false)
    setRecenter((n) => n + 1)
    setGeo({ busy: false, msg: `Google ubicó: ${r.formatted}. Ajusta el pin si hace falta.`, ok: true })
  }

  const info = useMemo(() => {
    const cell = latLngToCell(pos.lat, pos.lng)
    let cuadId = result.map.cellToCuad[cell]
    if (!cuadId) for (const n of gridDisk(cell, 2)) if (result.map.cellToCuad[n]) { cuadId = result.map.cellToCuad[n]; break }
    const cuadrante = result.map.cuadrantes.find((p) => p.id === cuadId)
    const torre = result.torres.find((c) => c.id === cuadrante?.torreId)
    return { cell, cuadrante, torre }
  }, [pos, result])

  useEffect(() => {
    if (!confirmed) return
    setStage(0)
    const ts = [1, 2, 3].map((i) => setTimeout(() => setStage(i), i * 650))
    return () => ts.forEach(clearTimeout)
  }, [confirmed])

  // En el modo demo: Ana mueve el pin y confirma sola
  useEffect(() => {
    if (demoStep !== 1) return
    const t1 = setTimeout(() => setPos({ lat: ANA.lat, lng: ANA.lng }), 900)
    const t2 = setTimeout(() => setConfirmed(true), 2200)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [demoStep])

  const color = info.cuadrante ? CUAD_PALETTE[info.cuadrante.color % CUAD_PALETTE.length] : '#C6D420'

  return (
    <div>
      <ScreenHeader kicker="P1 · Cliente · Checkout de falabella.com" title={<>Pin f.: el pedido nace con su punto exacto</>}>
        Ana (Miraflores) compra unos audífonos el jueves a las 21:00. Al pagar arrastra el pin hasta su puerta.
      </ScreenHeader>
      <div className="grid items-start gap-6 lg:grid-cols-[400px_1fr]">
        <PhoneFrame
          time="21:04"
          title={
            <div className="bg-bosque px-4 py-3 text-white">
              <div className="flex items-center gap-2 font-bold">
                <ShoppingCart size={16} className="text-lima" /> Confirma tu entrega
              </div>
              <div className="text-[11px] text-white/70">falabella.com · checkout (ilustrativo)</div>
            </div>
          }
        >
          <div className="relative">
            <BaseMap center={[ANA.lat + 0.0006, ANA.lng + 0.0008]} zoom={16} className="!h-[260px] !rounded-none" scrollWheel={false}>
              {confirmed && <Polygon positions={cellPoly(info.cell)} pathOptions={{ color: '#12301F', weight: 2, fillColor: color, fillOpacity: 0.45 }} />}
              <Recenter pos={pos} trigger={recenter} />
              <Marker
                position={[pos.lat, pos.lng]}
                draggable
                icon={pinIcon}
                eventHandlers={{
                  dragend: (e) => {
                    const ll = (e.target as L.Marker).getLatLng()
                    setPos({ lat: ll.lat, lng: ll.lng })
                    setConfirmed(false)
                  },
                }}
              />
            </BaseMap>
            <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[500] rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold shadow">
              Arrastra el pin hasta tu puerta
            </div>
          </div>
          <div className="space-y-2 p-4">
            <label className="block rounded-xl border border-linea p-2.5">
              <span className="text-[10px] font-bold uppercase text-gris">Dirección</span>
              <input className="w-full text-sm outline-none" value={address} onChange={(e) => setAddress(e.target.value)} />
            </label>
            {GOOGLE_KEY && (
              <button onClick={locate} disabled={geo.busy} className="btn-ghost w-full !py-2 !text-xs">
                {geo.busy ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />} Ubicar mi dirección en el mapa
              </button>
            )}
            {geo.msg && <div className={`rounded-lg p-2 text-[11px] font-semibold ${geo.ok ? 'bg-lima-soft text-bosque' : 'bg-naranja-soft text-naranja'}`}>{geo.msg}</div>}
            <label className="block rounded-xl border border-linea p-2.5">
              <span className="text-[10px] font-bold uppercase text-gris">Referencia</span>
              <input className="w-full text-sm outline-none" defaultValue={ANA.reference} />
            </label>
            <div className="text-[11px] text-gris">
              Pin: {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
            </div>
            <button onClick={() => setConfirmed(true)} className="btn-lima w-full !py-3">
              <Check size={16} /> Sí, aquí es mi puerta
            </button>
            {confirmed && <div className="anim-pop rounded-xl bg-lima-soft p-2 text-center text-xs font-semibold text-bosque">✓ Pedido {ANA.id} confirmado con coordenadas</div>}
          </div>
        </PhoneFrame>

        <div className="space-y-4">
          <div className="card-dark p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lima">Qué pasa por dentro al confirmar</h3>
              <span className="chip bg-white/10 text-white/80">vista demo · el cliente no ve esto</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { k: 'Casilla', v: `◆ ${info.cell.replace(/-/g, '').replace(':', '·')}`, s: '◆ rombo de ~8 cuadras por lado (0,8 km)' },
                { k: 'Cuadrante (1 ruta, ≤50)', v: info.cuadrante?.name ?? '—', s: info.cuadrante ? `${Math.round(info.cuadrante.expStops)} paquetes esperados · ${info.cuadrante.districts.join(' + ')}` : '' },
                {
                  k: 'Torre',
                  v: info.torre ? `♜ ${info.torre.letter} · ${info.torre.short}` : 'Sale del HUB',
                  s: info.torre ? 'Su bolsa viaja en el camión Torre de madrugada' : 'Cuadrante cercano al HUB (H = directo)',
                },
              ].map((x, i) => (
                <div
                  key={x.k}
                  className={`rounded-xl p-3 transition-all duration-500 ${confirmed && stage > i ? 'anim-drop bg-white/10 opacity-100' : 'bg-white/5 opacity-30'}`}
                >
                  <div className="text-[10px] font-bold uppercase text-white/60">{x.k}</div>
                  <div className="text-2xl font-extrabold" style={{ color: i === 1 ? color : i === 2 ? '#5fd0dc' : '#fff' }}>
                    {x.v}
                  </div>
                  <div className="text-[11px] text-white/70">{x.s}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-white/70">
              Asignación instantánea: <b className="text-lima">casilla → cuadrante → Torre</b> es una búsqueda en un diccionario. A las 02:30 no hay nada que decidir.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card border-l-4 border-naranja p-5">
              <div className="flex items-center gap-2 font-extrabold text-naranja">
                <Search size={18} /> Sin pin (hoy)
              </div>
              <p className="mt-2 text-sm">Alguien busca la dirección en Google a mano antes de rutear.</p>
              <div className="mt-2 text-3xl font-extrabold text-bosque">{String(params.geocodeMinPerOrder).replace('.', ',')} min</div>
              <div className="text-xs text-gris">por pedido sin coordenadas · el pedido cae al centro del distrito</div>
              <div className="mt-2 flex gap-1">
                <Tag kind="ENTREVISTA" />
                <Tag kind="SUPUESTO" />
              </div>
            </div>
            <div className="card border-l-4 border-verde p-5">
              <div className="flex items-center gap-2 font-extrabold text-verde">
                <Timer size={18} /> Con Pin f.
              </div>
              <p className="mt-2 text-sm">La coordenada viene del cliente. Direcciones antiguas se geocodifican de día, automáticamente.</p>
              <div className="mt-2 text-3xl font-extrabold text-bosque">0 min</div>
              <div className="text-xs text-gris">
                Esta noche: {result.assignment.withoutCoords} de {fmtInt(result.orders.length)} pedidos aún sin pin (escenario con Pin f.)
              </div>
              <div className="mt-2">
                <Tag kind="NUEVO" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Recenter({ pos, trigger }: { pos: { lat: number; lng: number }; trigger: number }) {
  const map = useMap()
  useEffect(() => {
    if (trigger > 0) map.setView([pos.lat, pos.lng], 17)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])
  return null
}
