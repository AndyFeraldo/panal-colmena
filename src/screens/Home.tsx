import { Link, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ArrowRight, Play } from 'lucide-react'
import { Tag, fmtInt, fmtPct } from '../components/ui'
import { useSim } from '../store/useSim'
import { demoSteps } from '../components/demoSteps'

// Pieza Torre (misma silueta del logo), en coordenadas 40×50
const TOWER = 'M7 3h6v5h4V3h6v5h4V3h6v11l-4 4v16l6 7v5H5v-5l6-7V18l-4-4z'

// Cada usuario: dónde entra y qué hace ahí (una línea)
const USERS = [
  { to: '/cliente/checkout', icon: '🛒', who: 'Cliente', what: 'Marca su puerta al comprar' },
  { to: '/planificador', icon: '🗺️', who: 'Planificador', what: 'Mapa de calor y cuadrantes' },
  { to: '/hub', icon: '🏭', who: 'Jefe de HUB', what: '02:30: todo asignado en ms' },
  { to: '/admin', icon: '⚖️', who: 'Administrador', what: '¿Más de 50? Lo reparte' },
  { to: '/torre', icon: '♜', who: 'Encargado de Torre', what: 'Torre móvil: citas y cajas' },
  { to: '/motorizado', icon: '🛵', who: 'Motorizado', what: 'Sin paquetes → a su Torre' },
  { to: '/gerencia', icon: '📊', who: 'Gerencia', what: 'Resultados: hoy vs TORRE f.' },
]

// Qué herramienta usa cada uno (feedback del mentor: no sumar apps ni pasos innecesarios)
const APPS = [
  { icon: '🛒', who: 'Cliente', uses: 'Web de Falabella + el WhatsApp de siempre', newTool: false },
  { icon: '🛵', who: 'Motorizado', uses: 'La app de SimpliRoute de siempre', newTool: false },
  { icon: '♜', who: 'Torre', uses: 'Celular con escáner del proveedor', newTool: false },
  { icon: '🗺️', who: 'Oficina y HUB', uses: 'Tablero f. (web) → publica en SimpliRoute', newTool: true },
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
  const kmLess = A && C && A.emptyKm > 0 ? 1 - C.emptyKm / A.emptyKm : null

  return (
    <div className="space-y-6">
      {/* HERO: la Torre al frente, con su escena animada */}
      <section className="card-dark boardbg relative overflow-hidden">
        <div className="grid items-center gap-4 p-6 md:p-10 lg:grid-cols-[1.05fr_1fr]">
          <div className="relative z-10">
            <span className="chip bg-lima text-bosque">INNOVATHON ULIMA × FALABELLA 2026</span>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.02] tracking-tight md:text-5xl xl:text-6xl">
              La recarga que va
              <br />
              <span className="text-lima">hacia la moto.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-white/85 md:text-lg">
              <b className="text-white">TORRE f.</b> ordena Lima en cuadrantes de máximo 50 paquetes y lleva una <b className="text-lima">Torre</b> (un camión de Saga) a las zonas lejanas. La moto recarga cerca y no cruza Lima de vuelta al HUB.
            </p>

            {/* 3 cifras que salen de la simulación */}
            <div className="mt-5 grid max-w-xl grid-cols-3 gap-2">
              <HeroStat label="a tiempo" from={A ? fmtPct(A.otd, 0) : '…'} to={C ? fmtPct(C.otd, 0) : '…'} />
              <HeroStat label="ventana al cliente" from={A ? `${A.windowHours} h` : '12 h'} to={C ? `${C.windowHours} h` : '2 h'} />
              <HeroStat label="km sin entregar" to={kmLess !== null ? `−${fmtPct(kmLess, 0)}` : '…'} />
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button onClick={startDemo} className="btn-lima !px-5 !py-3 !text-base">
                <Play size={18} fill="currentColor" /> Ver la demo (3 min)
              </button>
              <Link to="/torre" className="btn !bg-white/10 !px-5 !py-3 !text-base text-white hover:!bg-white/20">
                Ver la Torre en acción <ArrowRight size={18} />
              </Link>
            </div>
            <div className="mt-3 text-[11px] text-white/60">Cifras simuladas con supuestos del equipo · {result ? `${fmtInt(result.orders.length)} pedidos` : 'calculando…'}</div>
          </div>

          <HeroScene />
        </div>
      </section>

      {/* LOS 3 DIFERENCIADORES */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-extrabold text-bosque">Lo que nos hace distintos</h2>
          <span className="text-sm font-semibold text-gris">Tres piezas que trabajan juntas</span>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Differentiator
            n={1}
            dark
            star
            title="La Torre"
            line="Un camión de Saga lleva una caja lista por moto a las zonas lejanas. Su base es la tienda Saga y se cita con las motos a horas fijas."
            punch="La moto recarga a minutos de su zona."
            to="/torre"
            cta="Ver el día de la Torre"
            art={<ArtTorre />}
          />
          <Differentiator
            n={2}
            title="Los cuadrantes"
            line="Lima dividida en casillas en rombo de ~8 cuadras. Las vecinas se juntan en cuadrantes de máximo 50 paquetes: cada cuadrante es una ruta."
            punch="Cruzan distritos, respetan vías rápidas y ríos."
            to="/planificador"
            cta="Ver el mapa de cuadrantes"
            art={<ArtCuadrantes />}
          />
          <Differentiator
            n={3}
            title="Rutas con SimpliRoute"
            line="Publicamos los cuadrantes como zonas y los pedidos como visitas. SimpliRoute, que Falabella ya usa, ordena las paradas."
            punch="Cero apps nuevas: se conecta a lo que ya existe."
            to="/integracion"
            cta="Ver cómo se conecta"
            art={<ArtRutas />}
          />
        </div>
      </section>

      {/* HOY vs CON TORRE f. */}
      <section className="card overflow-hidden">
        <div className="grid md:grid-cols-2">
          <div className="bg-naranja-soft/60 p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-naranja">Hoy</div>
            <ul className="mt-2 space-y-2.5 text-sm text-bosque">
              <Row icon="⏱️" text="3,5 h para ordenar el 60% que llega a las 02:30" />
              <Row icon="🧮" text={`"Los primeros 50 del distrito": ${A ? fmtPct(A.pctRoutesUnder30, 0) : '…'} de rutas con menos de 30 paradas`} />
              <Row icon="🔙" text="Sin paquetes, la moto cruza Lima de vuelta a Villa El Salvador" />
              <Row icon="🕗" text='El cliente espera "de 8 a 8"' />
            </ul>
            <div className="mt-3 flex flex-wrap gap-1">
              <Tag kind="RETO" />
              <Tag kind="ENTREVISTA" />
            </div>
          </div>
          <div className="bg-lima-soft/70 p-5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-bosque">Con TORRE f.</div>
              <Link to="/gerencia" className="text-xs font-bold text-turq hover:underline">
                Ver resultados →
              </Link>
            </div>
            <ul className="mt-2 space-y-2.5 text-sm text-bosque">
              <Row icon="⚡" text={`02:30: cada pedido ya sabe su cuadrante (${C ? `${Math.max(1, Math.round(C.decisionMs))} ms` : 'ms'})`} />
              <Row icon="♟️" text={`Rutas por cercanía, máximo ${C ? C.maxStops : 50} paquetes`} />
              <Row icon="♜" text="Sin paquetes, la moto va a su Torre, cerca" />
              <Row icon="💬" text={`El cliente recibe "llega entre 9:00 y 11:00" · ${C ? fmtPct(C.otd, 0) : '…'} a tiempo`} />
            </ul>
            <div className="mt-3">
              <Tag kind="SIMULADO" />
            </div>
          </div>
        </div>
      </section>

      {/* QUIÉN ERES */}
      <section>
        <h2 className="mb-3 text-xl font-extrabold text-bosque">Recórrelo como cada usuario</h2>
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
          <h2 className="text-xl font-extrabold text-bosque">Cero apps nuevas</h2>
          <span className="text-xs font-semibold text-gris">Lo único nuevo es el Tablero f., y solo en la oficina</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {APPS.map((a) => (
            <div key={a.who} className="rounded-xl bg-crema p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-extrabold text-bosque">
                  <span className="text-lg">{a.icon}</span> {a.who}
                </span>
                <span className={`chip ${a.newTool ? 'bg-lima text-bosque' : 'bg-white text-bosque'}`}>{a.newTool ? 'NUEVO' : 'YA EXISTE'}</span>
              </div>
              <div className="mt-1 text-xs text-bosque/80">{a.uses}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function HeroStat({ label, from, to }: { label: string; from?: string; to: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10">
      <div className="flex items-baseline gap-1.5">
        {from && <span className="text-sm font-semibold text-white/55 line-through decoration-naranja decoration-2">{from}</span>}
        <span className="text-2xl font-extrabold text-lima md:text-3xl">{to}</span>
      </div>
      <div className="text-[11px] leading-tight text-white/75">{label}</div>
    </div>
  )
}

function Row({ icon, text }: { icon: string; text: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className="w-5 shrink-0 text-center">{icon}</span>
      <span>{text}</span>
    </li>
  )
}

function Differentiator({
  n,
  title,
  line,
  punch,
  to,
  cta,
  art,
  dark,
  star,
}: {
  n: number
  title: string
  line: string
  punch: string
  to: string
  cta: string
  art: ReactNode
  dark?: boolean
  star?: boolean
}) {
  return (
    <Link
      to={to}
      className={`group flex flex-col overflow-hidden rounded-2xl shadow-sm ring-1 transition hover:-translate-y-1 hover:shadow-lg ${
        dark ? 'bg-bosque text-white ring-lima/40 hover:ring-lima' : 'bg-white text-bosque ring-transparent hover:ring-lima'
      }`}
    >
      <div className={`relative flex h-40 items-center justify-center ${dark ? 'boardbg bg-bosque-2' : 'bg-crema'}`}>
        {art}
        <span className={`absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full text-sm font-extrabold ${dark ? 'bg-lima text-bosque' : 'bg-bosque text-lima'}`}>{n}</span>
        {star && <span className="chip absolute right-3 top-3 bg-naranja text-white">★ Nuestro diferenciador</span>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className={`text-xl font-extrabold ${dark ? 'text-lima' : 'text-bosque'}`}>{title}</h3>
        <p className={`mt-1.5 text-sm ${dark ? 'text-white/80' : 'text-bosque/75'}`}>{line}</p>
        <p className={`mt-2 text-sm font-bold ${dark ? 'text-white' : 'text-bosque'}`}>{punch}</p>
        <span className={`mt-auto flex items-center gap-1 pt-3 text-sm font-bold ${dark ? 'text-lima' : 'text-turq'} group-hover:underline`}>
          {cta} <ArrowRight size={15} />
        </span>
      </div>
    </Link>
  )
}

/* ---------- Ilustraciones (SVG simples, sin datos) ---------- */

// Rombo centrado en (x, y) con media-diagonal r
const diamond = (x: number, y: number, r: number) => `M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}Z`

const QUAD_COLORS = ['#c6d420', '#7dba29', '#5fd0dc', '#f6b38a', '#e9f2c0', '#9fd6a0']

/** Escena del hero: HUB lejos, Torre cerca de los cuadrantes, motos que recargan en la Torre */
function HeroScene() {
  // casillas en rombo de la zona lejana, agrupadas en 4 cuadrantes
  const cells: { x: number; y: number; q: number }[] = []
  const r = 22
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 7; col++) {
      const x = 70 + col * 2 * r + (row % 2 ? r : 0)
      const y = 40 + row * r
      if (x > 360) continue
      const q = (x < 160 ? 0 : x < 260 ? 1 : 2) + (row >= 3 ? 3 : 0)
      cells.push({ x, y, q: [0, 2, 1, 3, 4, 5][q] })
    }
  const torre = { x: 215, y: 175 }
  const hub = { x: 215, y: 330 }
  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      <svg viewBox="0 0 430 370" className="w-full" role="img" aria-label="La Torre en la zona lejana; el HUB queda lejos">
        {/* cuadrantes */}
        {cells.map((c, i) => (
          <path key={i} d={diamond(c.x, c.y, r - 1.5)} fill={QUAD_COLORS[c.q]} fillOpacity={0.85} stroke="#12301F" strokeOpacity={0.35} />
        ))}
        <text x={30} y={30} fill="#e9f2c0" fontSize={11} fontWeight={700} fontFamily="Poppins">
          ZONA LEJANA · cuadrantes
        </text>

        {/* camino largo de hoy: la moto vuelve a VES */}
        <path d={`M330 120 C 400 220, 320 300, ${hub.x + 25} ${hub.y}`} fill="none" stroke="#F26B21" strokeWidth={2.5} strokeDasharray="6 6" opacity={0.85} />
        <text x={330} y={262} fill="#F6B38A" fontSize={10.5} fontWeight={700} fontFamily="Poppins">
          Hoy: vuelve
        </text>
        <text x={330} y={276} fill="#F6B38A" fontSize={10.5} fontWeight={700} fontFamily="Poppins">
          a recargar
        </text>

        {/* el camión sube del HUB a la tienda Saga */}
        <path id="truckPath" d={`M${hub.x} ${hub.y - 18} L${torre.x} ${torre.y + 32}`} fill="none" stroke="#C6D420" strokeWidth={2} strokeDasharray="3 6" opacity={0.6} />
        <g>
          <rect x={-11} y={-7} width={22} height={14} rx={3} fill="#C6D420" />
          <rect x={-11} y={-7} width={8} height={14} rx={2} fill="#12301F" opacity={0.35} />
          <animateMotion dur="5s" repeatCount="indefinite" rotate="0">
            <mpath href="#truckPath" />
          </animateMotion>
        </g>

        {/* HUB */}
        <rect x={hub.x - 34} y={hub.y - 16} width={68} height={32} rx={8} fill="#fff" />
        <text x={hub.x} y={hub.y + 5} textAnchor="middle" fill="#12301F" fontSize={12} fontWeight={800} fontFamily="Poppins">
          HUB VES
        </text>

        {/* Torre */}
        <circle cx={torre.x} cy={torre.y} r={44} fill="#C6D420" opacity={0.18}>
          <animate attributeName="r" values="34;50;34" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.28;0.06;0.28" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx={torre.x} cy={torre.y} r={30} fill="#12301F" stroke="#C6D420" strokeWidth={3} />
        <path d={TOWER} transform={`translate(${torre.x - 14} ${torre.y - 18}) scale(0.7)`} fill="#C6D420" />
        <rect x={torre.x + 38} y={torre.y - 12} width={112} height={24} rx={12} fill="#C6D420" />
        <text x={torre.x + 94} y={torre.y + 4} textAnchor="middle" fill="#12301F" fontSize={11} fontWeight={800} fontFamily="Poppins">
          Torre · tienda Saga
        </text>

        {/* motos que van y vuelven entre la Torre y su cuadrante */}
        {[
          { to: [110, 70], dur: '3.2s' },
          { to: [180, 95], dur: '2.6s' },
          { to: [120, 135], dur: '3.6s' },
        ].map((m, i) => (
          <g key={i}>
            <line x1={torre.x} y1={torre.y} x2={m.to[0]} y2={m.to[1]} stroke="#fff" strokeWidth={1.5} strokeDasharray="2 4" opacity={0.6} />
            <circle r={7} fill="#fff" stroke="#00808D" strokeWidth={3}>
              <animate attributeName="cx" values={`${m.to[0]};${torre.x};${m.to[0]}`} dur={m.dur} repeatCount="indefinite" />
              <animate attributeName="cy" values={`${m.to[1]};${torre.y};${m.to[1]}`} dur={m.dur} repeatCount="indefinite" />
            </circle>
          </g>
        ))}
        <text x={30} y={215} fill="#fff" fontSize={10.5} fontWeight={700} fontFamily="Poppins">
          Recarga a minutos
        </text>
        <text x={30} y={229} fill="#fff" fontSize={10.5} fontWeight={700} fontFamily="Poppins">
          de su zona
        </text>
      </svg>
    </div>
  )
}

function ArtTorre() {
  return (
    <svg viewBox="0 0 220 120" className="h-full w-full max-w-[260px] p-3" aria-hidden>
      <rect x={20} y={64} width={46} height={28} rx={5} fill="#fff" />
      <text x={43} y={82} textAnchor="middle" fontSize={9} fontWeight={800} fill="#12301F" fontFamily="Poppins">
        HUB
      </text>
      <path d="M70 78 H120" stroke="#C6D420" strokeWidth={2.5} strokeDasharray="4 5" />
      <circle cx={150} cy={74} r={30} fill="#12301F" stroke="#C6D420" strokeWidth={3} />
      <path d={TOWER} transform="translate(136 56) scale(0.7)" fill="#C6D420" />
      {[
        [196, 34],
        [204, 80],
        [178, 112],
      ].map(([x, y], i) => (
        <g key={i}>
          <line x1={150} y1={74} x2={x} y2={y} stroke="#fff" strokeOpacity={0.6} strokeDasharray="2 3" />
          <circle cx={x} cy={y} r={7} fill="#fff" stroke="#00808D" strokeWidth={3} />
        </g>
      ))}
    </svg>
  )
}

function ArtCuadrantes() {
  const r = 16
  const cells: { x: number; y: number; q: number }[] = []
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 6; col++) {
      const x = 22 + col * 2 * r + (row % 2 ? r : 0)
      const y = 14 + row * r * 1.15
      cells.push({ x, y, q: (col < 2 ? 0 : col < 4 ? 1 : 2) + (row > 2 && col < 3 ? 2 : 0) })
    }
  return (
    <svg viewBox="0 0 220 110" className="h-full w-full max-w-[260px] p-3" aria-hidden>
      {cells.map((c, i) => (
        <path key={i} d={diamond(c.x, c.y, r - 1)} fill={['#C6D420', '#7DBA29', '#5FD0DC', '#F6B38A', '#E9F2C0'][c.q % 5]} stroke="#12301F" strokeOpacity={0.3} />
      ))}
      {/* límite de distrito punteado: el cuadrante lo cruza */}
      <path d="M100 0 C 92 40, 118 70, 104 110" fill="none" stroke="#12301F" strokeWidth={1.5} strokeDasharray="4 3" />
      <rect x={150} y={84} width={62} height={20} rx={10} fill="#12301F" />
      <text x={181} y={98} textAnchor="middle" fontSize={10} fontWeight={800} fill="#C6D420" fontFamily="Poppins">
        ≤ 50 c/u
      </text>
    </svg>
  )
}

function ArtRutas() {
  const pts = [
    [30, 86],
    [62, 60],
    [96, 74],
    [120, 40],
    [158, 52],
    [188, 28],
  ]
  return (
    <svg viewBox="0 0 220 110" className="h-full w-full max-w-[260px] p-3" aria-hidden>
      <path d={diamond(110, 56, 52)} fill="#5FD0DC" fillOpacity={0.25} stroke="#00808D" strokeDasharray="4 3" />
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="#00808D" strokeWidth={3} strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={9} fill={i === 0 ? '#12301F' : '#fff'} stroke="#00808D" strokeWidth={2.5} />
          <text x={x} y={y + 3.5} textAnchor="middle" fontSize={9} fontWeight={800} fill={i === 0 ? '#C6D420' : '#12301F'} fontFamily="Poppins">
            {i === 0 ? '♜' : i}
          </text>
        </g>
      ))}
    </svg>
  )
}
