import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Loader2, Pause, Play, X } from 'lucide-react'
import { useSim } from '../store/useSim'
import { BASE, TorreLogo } from './ui'
import { demoSteps } from './demoSteps'

const ROLES = [
  { label: 'Inicio', to: '/', match: ['/'] },
  { label: 'Cliente', to: '/cliente/checkout', match: ['/cliente'] },
  { label: 'Planificador', to: '/planificador', match: ['/planificador'] },
  { label: 'Admin', to: '/admin', match: ['/admin'] },
  { label: 'HUB', to: '/hub', match: ['/hub'] },
  { label: 'Torre', to: '/torre', match: ['/torre'] },
  { label: 'Motorizado', to: '/motorizado', match: ['/motorizado'] },
  { label: 'Gerencia', to: '/gerencia', match: ['/gerencia', '/reporte', '/capacidad', '/evaluacion'] },
]

const SUBNAV: Record<string, { label: string; to: string }[]> = {
  Cliente: [
    { label: 'P1 · Checkout con Pin f.', to: '/cliente/checkout' },
    { label: 'P6 · Día de la entrega', to: '/cliente/entrega' },
  ],
  Gerencia: [
    { label: 'P7 · Comparador de escenarios', to: '/gerencia' },
    { label: 'Capacidad: motos y camiones', to: '/capacidad' },
    { label: '✓ Evaluación vs. el reto', to: '/evaluacion' },
    { label: 'P9 · Reporte y aprendizaje', to: '/reporte' },
  ],
}

function activeRole(path: string) {
  if (path === '/') return 'Inicio'
  return ROLES.find((r) => r.match.some((m) => m !== '/' && path.startsWith(m)))?.label ?? ''
}

export default function Layout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const run = useSim((s) => s.run)
  const running = useSim((s) => s.running)
  const result = useSim((s) => s.result)
  const demoStep = useSim((s) => s.demoStep)
  const setDemoStep = useSim((s) => s.setDemoStep)
  const role = activeRole(pathname)
  const sub = SUBNAV[role]

  useEffect(() => {
    run(true)
  }, [run])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const steps = demoSteps(result)
  const startDemo = () => {
    setDemoStep(0)
    navigate(steps[0].path)
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-[1000] border-b-4 border-lima bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-3 py-2 md:px-5">
          <Link to="/" className="flex shrink-0 items-center gap-3" aria-label="Inicio">
            <img src={`${BASE}brand/falabella.png`} alt="falabella." className="h-7 md:h-8" />
            <span className="hidden h-8 w-px bg-linea sm:block" />
            <span className="hidden items-center gap-1.5 text-base font-extrabold leading-tight text-bosque sm:flex">
              <TorreLogo className="h-7" fill="#12301F" text="#C6D420" />
              TORRE <span className="text-verde">f.</span>
            </span>
          </Link>
          <nav className="mx-auto hidden min-w-0 items-center gap-1 overflow-x-auto lg:flex" aria-label="Selector de rol">
            {ROLES.map((r) => (
              <Link
                key={r.label}
                to={r.to}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
                  role === r.label ? 'bg-bosque text-lima' : 'text-bosque hover:bg-crema'
                }`}
              >
                {r.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-3 lg:ml-0">
            {running && <Loader2 size={16} className="animate-spin text-turq" aria-label="Simulando" />}
            <button onClick={startDemo} className="btn-lima !px-3 !py-1.5">
              <Play size={14} fill="currentColor" /> <span className="hidden sm:inline">Modo demo</span>
            </button>
            <img src={`${BASE}brand/innova.png`} alt="Innova Ulima" className="hidden h-7 md:block" />
          </div>
        </div>
        {/* selector de rol en celular / tablet */}
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden" aria-label="Selector de rol">
          {ROLES.map((r) => (
            <Link
              key={r.label}
              to={r.to}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                role === r.label ? 'bg-bosque text-lima' : 'bg-crema text-bosque'
              }`}
            >
              {r.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-linea bg-crema/70">
          <div className="mx-auto flex max-w-[1400px] items-center gap-1 overflow-x-auto px-3 py-1 text-xs md:px-5">
            {sub?.map((s) => (
              <NavLink
                key={s.to}
                to={s.to}
                end
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-md px-2 py-1 font-semibold ${isActive ? 'bg-white text-bosque shadow-sm' : 'text-gris hover:text-bosque'}`
                }
              >
                {s.label}
              </NavLink>
            ))}
            <span className="ml-auto" />
            <NavLink
              to="/integracion"
              className={({ isActive }) => `whitespace-nowrap rounded-md px-2 py-1 font-semibold ${isActive ? 'bg-white text-turq shadow-sm' : 'text-turq hover:underline'}`}
            >
              🔌 Integración SimpliRoute
            </NavLink>
            <NavLink
              to="/supuestos"
              className={({ isActive }) => `whitespace-nowrap rounded-md px-2 py-1 font-semibold ${isActive ? 'bg-white text-bosque shadow-sm' : 'text-gris hover:text-bosque'}`}
            >
              ⚙️ Supuestos y fuentes
            </NavLink>
          </div>
        </div>
      </header>

      <main className={`mx-auto w-full max-w-[1400px] flex-1 px-3 py-5 md:px-5 ${demoStep !== null ? 'pb-48' : 'pb-16'}`}>
        <Outlet />
      </main>

      {demoStep !== null && <DemoBar step={demoStep} />}

      <footer className="fixed inset-x-0 bottom-0 z-[900] bg-bosque px-3 py-1.5 text-center text-[11px] text-white/80">
        Propuesta de equipo · <b className="text-lima">Innovathon Ulima × Falabella 2026</b> · No es material oficial de Falabella · Datos simulados.
      </footer>
    </div>
  )
}

const STEP_SECONDS = 18

function DemoBar({ step }: { step: number }) {
  const navigate = useNavigate()
  const result = useSim((s) => s.result)
  const setDemoStep = useSim((s) => s.setDemoStep)
  const steps = demoSteps(result)
  const [auto, setAuto] = useState(false)
  const [left, setLeft] = useState(STEP_SECONDS)
  const s = steps[step]
  const stepRef = useRef(step)
  stepRef.current = step

  const go = (i: number) => {
    if (i < 0) return
    if (i >= steps.length) {
      setDemoStep(null)
      return
    }
    setDemoStep(i)
    navigate(steps[i].path)
    setLeft(STEP_SECONDS)
  }

  useEffect(() => {
    if (!auto) return
    const t = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          go(stepRef.current + 1)
          return STEP_SECONDS
        }
        return l - 1
      })
    }, 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(stepRef.current + 1)
      if (e.key === 'ArrowLeft') go(stepRef.current - 1)
      if (e.key === 'Escape') setDemoStep(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-x-0 bottom-7 z-[950] px-3">
      <div className="anim-pop mx-auto flex max-w-4xl items-center gap-3 rounded-2xl bg-bosque p-3 text-white shadow-2xl ring-2 ring-lima md:gap-4 md:p-4">
        <TorreLogo className="anim-float hidden h-16 shrink-0 sm:block" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-lima md:text-base">{s.title}</span>
            <span className="text-[11px] text-white/60">
              {step + 1}/{steps.length}
              {auto && ` · ${left}s`}
            </span>
          </div>
          <p className="mt-0.5 text-xs leading-snug text-white/90 md:text-sm">{s.text}</p>
          <div className="mt-2 flex gap-1">
            {steps.map((_, i) => (
              <button
                key={i}
                aria-label={`Paso ${i + 1}`}
                onClick={() => go(i)}
                className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-lima' : 'bg-white/20'}`}
              />
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
          <button onClick={() => go(step - 1)} disabled={step === 0} className="btn !bg-white/10 !p-2 text-white" aria-label="Anterior">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setAuto((a) => !a)} className="btn !bg-white/10 !p-2 text-white" aria-label={auto ? 'Pausar' : 'Reproducir automático'}>
            {auto ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button onClick={() => go(step + 1)} className="btn-lima !p-2" aria-label="Siguiente">
            {step === steps.length - 1 ? 'Fin' : <ChevronRight size={18} />}
          </button>
          <button onClick={() => setDemoStep(null)} className="btn !bg-white/10 !p-2 text-white" aria-label="Salir del modo demo">
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
