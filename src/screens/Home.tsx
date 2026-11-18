import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Play } from 'lucide-react'
import { Tag, TorreLogo, fmtInt, fmtPct } from '../components/ui'
import { useSim } from '../store/useSim'
import { demoSteps } from '../components/demoSteps'

// Cada usuario: dónde entra y qué hace ahí (una línea)
const USERS = [
  { to: '/cliente/checkout', icon: '🛒', who: 'Cliente', what: 'Marca su puerta al comprar' },
  { to: '/planificador', icon: '🗺️', who: 'Planificador', what: 'Mapa de calor y cuadrantes' },
  { to: '/hub', icon: '🏭', who: 'Jefe de HUB', what: '02:30: todo asignado en ms' },
  { to: '/admin', icon: '⚖️', who: 'Administrador', what: '¿Más de 50? Lo reparte' },
  { to: '/torre', icon: '♜', who: 'Encargado de Torre', what: 'Entrega y escanea bolsas' },
  { to: '/motorizado', icon: '🛵', who: 'Motorizado', what: 'Sin paquetes → a su Torre' },
  { to: '/gerencia', icon: '📊', who: 'Gerencia', what: 'Resultados: hoy vs TORRE f.' },
]

// Qué herramienta usa cada uno (feedback del mentor: no sumar apps ni pasos innecesarios)
const APPS = [
  { icon: '🛒', who: 'Cliente', uses: 'Web y app de Falabella + el WhatsApp de siempre', change: 'el pin solo si su dirección no tiene ubicación; recibe "llega entre 9 y 11"', newTool: false },
  { icon: '🛵', who: 'Motorizado', uses: 'La app de SimpliRoute de siempre', change: 'su ruta empieza en la Torre y recarga ahí, no en VES', newTool: false },
  { icon: '♜', who: 'Encargado de Torre', uses: 'Celular con escáner del proveedor', change: 'escanea cada bolsa al dársela a la moto (el único paso nuevo en la calle)', newTool: false },
  { icon: '🗺️', who: 'Oficina y HUB', uses: 'Tablero f. (web) → publica en SimpliRoute', change: 'arma los cuadrantes de día; a las 02:30 solo se clasifica', newTool: true },
]

const PIECES = [
  { icon: '📍', name: 'Pin f.' },
  { icon: '♟️', name: 'Tablero f.' },
  { icon: '🔗', name: 'SimpliRoute' },
  { icon: '♜', name: 'Torre' },
  { icon: '🛵', name: 'Motorizado' },
  { icon: '💬', name: 'Cliente' },
]

export default function Home() {
  const navigate = useNavigate()
  const result = useSim((s) => s.result)
  const setDemoStep = useSim((s) => s.setDemoStep)
  const startDemo = () => {
    setDemoStep(0)
    navigate(demoSteps(result)[0].path)
  }
  const A = result?.scenarios.A.kpis
  const C = result?.scenarios.C.kpis

  return (
    <div className="space-y-6">
      {/* HERO: una frase y dos botones */}
      <section className="card-dark boardbg relative overflow-hidden p-6 md:p-10">
        <div className="relative z-10 max-w-2xl">
          <span className="chip bg-lima text-bosque">INNOVATHON ULIMA × FALABELLA 2026</span>
          <h1 className="mt-4 text-5xl font-extrabold leading-none tracking-tight md:text-7xl">
            TORRE <span className="text-lima">f.</span>
          </h1>
          <p className="mt-4 text-xl font-semibold leading-snug md:text-3xl">
            Cada pedido tiene su <span className="text-lima">casilla</span>.<br />
            Cada moto tiene su <span className="text-[#5fd0dc]">Torre</span>.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button onClick={startDemo} className="btn-lima !px-5 !py-3 !text-base">
              <Play size={18} fill="currentColor" /> Ver la demo (3 min)
            </button>
            <Link to="/cliente/checkout" className="btn !bg-white/10 !px-5 !py-3 !text-base text-white hover:!bg-white/20">
              Recorrer paso a paso <ArrowRight size={18} />
            </Link>
          </div>
        </div>
        <TorreLogo className="anim-float absolute right-10 top-1/2 hidden h-[230px] -translate-y-1/2 drop-shadow-2xl lg:block" />
      </section>

      {/* QUIÉN ERES */}
      <section>
        <h2 className="mb-3 text-xl font-extrabold text-bosque">¿Quién eres? Entra a tu pantalla</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {USERS.map((u) => (
            <Link
              key={u.to}
              to={u.to}
              className="group flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-transparent transition hover:-translate-y-0.5 hover:shadow-md hover:ring-lima"
            >
              <span className="text-3xl">{u.icon}</span>
              <span className="mt-2 font-extrabold leading-tight text-bosque">{u.who}</span>
              <span className="mt-0.5 text-xs text-gris">{u.what}</span>
              <span className="mt-auto pt-2 text-xs font-bold text-turq group-hover:underline">Entrar →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* CERO APPS NUEVAS */}
      <section className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-extrabold text-bosque">Cero apps nuevas: cada uno sigue en lo suyo</h2>
          <span className="text-xs font-semibold text-gris">Lo único nuevo es el Tablero f., y solo en la oficina</span>
        </div>
        <div className="mt-3 divide-y divide-linea">
          {APPS.map((a) => (
            <div key={a.who} className="grid items-center gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[170px_1fr_1.2fr]">
              <div className="flex items-center gap-2 font-extrabold text-bosque">
                <span className="text-xl">{a.icon}</span> {a.who}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className={`chip ${a.newTool ? 'bg-lima text-bosque' : 'bg-crema text-bosque'}`}>{a.newTool ? 'NUEVO' : 'YA EXISTE'}</span>
                {a.uses}
              </div>
              <div className="text-sm text-bosque/80">
                <b className="text-bosque">Cambia:</b> {a.change}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* EL PROBLEMA Y EL RESULTADO EN CIFRAS */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-extrabold text-bosque">El problema hoy</h2>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat value="3,5 h" label="para ordenar el 60% que llega a las 02:30" />
            <Stat value={A ? fmtPct(A.pctRoutesUnder30, 0) : '…'} label="de rutas con menos de 30 paradas" />
            <Stat value={A ? `${Math.round(A.geocodeMin / 60)} h` : '…'} label="buscando direcciones en Google" />
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            <Tag kind="RETO" />
            <Tag kind="ENTREVISTA" />
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-bosque">Con TORRE f.</h2>
            <Link to="/gerencia" className="text-xs font-bold text-turq hover:underline">
              Ver resultados →
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat good value={C ? fmtPct(C.otd, 0) : '…'} label={A ? `a tiempo (hoy ${fmtPct(A.otd, 0)})` : 'a tiempo'} />
            <Stat good value={A && C ? `−${fmtPct(1 - C.emptyKm / A.emptyKm, 0)}` : '…'} label="km sin entregar" />
            <Stat good value={C ? String(C.maxStops) : '…'} label="máximo de paquetes por ruta" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1">
            <Tag kind="SIMULADO" />
            {result && <span className="text-[11px] text-gris">{fmtInt(result.orders.length)} pedidos simulados</span>}
          </div>
        </div>
      </section>

      {/* LAS PIEZAS EN UNA LÍNEA */}
      <section className="card flex flex-wrap items-center justify-center gap-2 p-4">
        {PIECES.map((p, i) => (
          <span key={p.name} className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-crema px-3 py-1.5 text-sm font-bold text-bosque">
              {p.icon} {p.name}
            </span>
            {i < PIECES.length - 1 && <ArrowRight size={16} className="text-gris" />}
          </span>
        ))}
      </section>
    </div>
  )
}

function Stat({ value, label, good }: { value: string; label: string; good?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${good ? 'bg-lima-soft' : 'bg-naranja-soft'}`}>
      <div className={`text-2xl font-extrabold md:text-3xl ${good ? 'text-bosque' : 'text-naranja'}`}>{value}</div>
      <div className="mt-0.5 text-[11px] leading-tight text-bosque/80">{label}</div>
    </div>
  )
}
