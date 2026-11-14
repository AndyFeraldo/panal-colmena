import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Clock, MapPinOff, ListOrdered, Play, Users, BarChart3 } from 'lucide-react'
import { BASE, Tag, fmtInt, fmtPct } from '../components/ui'
import { useSim } from '../store/useSim'
import { demoSteps } from '../components/demoSteps'

const PIECES = [
  { icon: '📍', name: 'Pin f.', who: 'falabella.com', desc: 'El pedido nace con lat/long', tone: 'bg-white', tag: 'NUEVO' as const },
  { icon: '⬡', name: 'PANAL', who: 'motor + panel web', desc: 'Celda → panal → Colmena al instante', tone: 'bg-bosque text-white', tag: 'NUEVO' as const },
  { icon: '🔗', name: 'SimpliRoute', who: 'lo que ya usan', desc: 'Zonas, visitas y orden de paradas', tone: 'bg-white ring-2 ring-[#5b7fd6]', tag: 'EXISTE' as const },
  { icon: '🚐', name: 'COLMENA', who: 'minivan del proveedor', desc: 'Mini-almacén móvil cerca de los panales', tone: 'bg-turq text-white', tag: 'NUEVO' as const },
  { icon: '🛵', name: 'Motorizado', who: 'app de siempre', desc: 'Empieza y recarga en la Colmena', tone: 'bg-white', tag: 'EXISTE' as const },
  { icon: '💬', name: 'Cliente', who: 'mensajes de siempre', desc: '+ ventana de 2 horas', tone: 'bg-lima text-bosque', tag: 'NUEVO' as const },
]

export default function Home() {
  const navigate = useNavigate()
  const result = useSim((s) => s.result)
  const setDemoStep = useSim((s) => s.setDemoStep)
  const params = useSim((s) => s.params)
  const startDemo = () => {
    setDemoStep(0)
    navigate(demoSteps(result)[0].path)
  }
  const sortEnd = result?.scenarios.A.kpis.sortEnd

  return (
    <div className="space-y-6">
      {/* HERO */}
      <section className="card-dark hexbg relative overflow-hidden p-6 md:p-10">
        <div className="relative z-10 max-w-3xl">
          <span className="chip bg-lima text-bosque">INNOVATHON ULIMA × FALABELLA 2026 · SIMULADOR</span>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            PANAL <span className="text-lima">f.</span> + <span className="text-[#5fd0dc]">COLMENA</span>
          </h1>
          <p className="mt-4 text-lg font-semibold text-white md:text-2xl">
            Se ordena de <span className="text-lima">día</span>, se ejecuta de <span className="text-[#5fd0dc]">noche</span>.
          </p>
          <p className="mt-2 max-w-2xl text-sm text-white/80 md:text-base">
            <b className="text-lima">PANAL</b> decide qué pedidos van juntos desde que se compran; la <b className="text-[#5fd0dc]">COLMENA</b> hace que lleguen a
            tiempo, sin volver a Villa El Salvador. Todo conectado a SimpliRoute, el software que Falabella ya usa.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/gerencia" className="btn-lima !px-5 !py-3 !text-base">
              <BarChart3 size={18} /> Ver la simulación
            </Link>
            <Link to="/cliente/checkout" className="btn !bg-white/10 !px-5 !py-3 !text-base text-white hover:!bg-white/20">
              <Users size={18} /> Recorrer como cada usuario
            </Link>
            <button onClick={startDemo} className="btn-naranja !px-5 !py-3 !text-base">
              <Play size={18} fill="currentColor" /> Modo demo (3 min)
            </button>
          </div>
        </div>
        <img src={`${BASE}brand/abella.svg`} alt="Abella, la abeja repartidora" className="anim-buzz absolute -right-6 bottom-0 hidden w-[340px] opacity-95 md:block" />
      </section>

      {/* PROBLEMA */}
      <section>
        <h2 className="mb-3 text-xl font-extrabold text-bosque">¿Qué problema resolvemos?</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card border-t-4 border-naranja p-5">
            <Clock className="text-naranja" />
            <div className="mt-2 text-4xl font-extrabold text-bosque">3,5 h</div>
            <p className="mt-1 text-sm">
              El <b>60%</b> de los pedidos llega al HUB a las <b>02:30</b> y la primera moto sale a las <b>06:00</b>. A 700 ped/h, con {fmtInt(params.ordersPerDay)} pedidos/día el HUB
              termina de clasificar a las <b>{sortEnd ? fmtClock(sortEnd) : '05:56'}</b>.
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              <Tag kind="RETO" />
              <Tag kind="SUPUESTO">Volumen diario: supuesto</Tag>
            </div>
          </div>
          <div className="card border-t-4 border-naranja p-5">
            <ListOrdered className="text-naranja" />
            <div className="mt-2 text-xl font-extrabold leading-tight text-bosque">"Los primeros 50 pedidos del distrito"</div>
            <p className="mt-1 text-sm">
              Las rutas se arman por <b>orden de llegada</b>, no por cercanía. El sobrante forma rutas chicas: hoy el{' '}
              <b>{result ? fmtPct(result.scenarios.A.kpis.pctRoutesUnder30, 0) : '…'}</b> de las rutas simuladas tiene menos de 30 paradas.
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              <Tag kind="RETO" />
              <Tag kind="ENTREVISTA" />
            </div>
          </div>
          <div className="card border-t-4 border-naranja p-5">
            <MapPinOff className="text-naranja" />
            <div className="mt-2 text-xl font-extrabold leading-tight text-bosque">Direcciones sin coordenadas</div>
            <p className="mt-1 text-sm">
              "La web no obliga a marcar el punto": alguien las busca <b>a mano en Google</b>. Con {fmtPct(1 - params.pctPinToday, 0)} sin pin, son{' '}
              <b>{result ? Math.round(result.scenarios.A.kpis.geocodeMin / 60) : '…'} horas</b> de trabajo manual cada noche.
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              <Tag kind="ENTREVISTA" />
              <Tag kind="SUPUESTO">1,5 min/dirección</Tag>
            </div>
          </div>
        </div>
      </section>

      {/* PIEZAS */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-extrabold text-bosque">Cómo encajan las piezas</h2>
          <span className="text-xs text-gris">Solo 2 piezas nuevas de software (Pin f. y PANAL). Lo demás ya existe y se reutiliza.</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {PIECES.map((p, i) => (
            <div key={p.name} className="relative">
              <div className={`h-full rounded-2xl p-4 shadow-sm ${p.tone}`}>
                <div className="text-2xl">{p.icon}</div>
                <div className="mt-1 font-extrabold">{p.name}</div>
                <div className="text-[11px] font-semibold opacity-70">{p.who}</div>
                <div className="mt-2 text-xs opacity-90">{p.desc}</div>
                <div className="mt-2">
                  <Tag kind={p.tag} />
                </div>
              </div>
              {i < PIECES.length - 1 && (
                <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-crema text-bosque md:block" size={20} />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h3 className="font-extrabold text-bosque">Metas del reto</h3>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              ['96%', 'entregas a tiempo (OTD)'],
              ['50', 'paradas por ruta (SPR)'],
              ['99,9%', 'nivel de servicio de carga'],
            ].map(([v, l]) => (
              <div key={l} className="rounded-xl bg-crema p-3">
                <div className="text-2xl font-extrabold text-bosque">{v}</div>
                <div className="text-[11px] text-gris">{l}</div>
              </div>
            ))}
          </div>
          <div className="mt-2">
            <Tag kind="RETO" />
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-extrabold text-bosque">Cómo leer esta demo</h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li>• Usa el <b>selector de rol</b> arriba para ver la solución como cada usuario.</li>
            <li>• Todos los números salen de una <b>simulación en tu navegador</b> (misma semilla = mismos resultados).</li>
            <li>• Cada dato indica su tipo:</li>
          </ul>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Tag kind="RETO" />
            <Tag kind="ENTREVISTA" />
            <Tag kind="SUPUESTO" />
            <Tag kind="SIMULADO" />
          </div>
        </div>
      </section>
    </div>
  )
}

function fmtClock(min: number) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
