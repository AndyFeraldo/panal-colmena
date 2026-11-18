import { useState, type ReactNode } from 'react'
import { ChevronDown, FlaskConical, Info, Loader2 } from 'lucide-react'
import { useSim } from '../store/useSim'
import type { SourceKind } from '../sim/params'

export const BASE = import.meta.env.BASE_URL

const TAG_STYLE: Record<SourceKind | 'SIMULADO' | 'NUEVO' | 'EXISTE', string> = {
  RETO: 'bg-bosque text-lima',
  ENTREVISTA: 'bg-naranja-soft text-naranja',
  SUPUESTO: 'bg-turq-soft text-turq',
  DISEÑO: 'bg-lima-soft text-bosque',
  SIMULADO: 'bg-lima-soft text-bosque',
  NUEVO: 'bg-lima text-bosque',
  EXISTE: 'bg-slate-100 text-slate-600',
}
const TAG_TEXT: Record<string, string> = {
  RETO: 'Dato del reto',
  ENTREVISTA: 'Insight entrevista',
  SUPUESTO: 'Supuesto del equipo',
  DISEÑO: 'Diseño',
  SIMULADO: 'Simulado con supuestos',
  NUEVO: 'Nuevo con TORRE f.',
  EXISTE: 'Ya existe',
}

/** Marca TORRE f.: la pieza Torre con la "f." (sin mascota) */
export function TorreLogo({ className = 'h-10', fill = '#C6D420', text = '#12301F', bg }: { className?: string; fill?: string; text?: string; bg?: string }) {
  return (
    <svg viewBox="0 0 40 50" className={className} role="img" aria-label="Torre f.">
      {bg && <rect x="-6" y="-2" width="52" height="54" rx="10" fill={bg} />}
      <path fill={fill} d="M7 3h6v5h4V3h6v5h4V3h6v11l-4 4v16l6 7v5H5v-5l6-7V18l-4-4z" />
      <text x="20" y="35" textAnchor="middle" fontFamily="Poppins" fontWeight={800} fontSize={12} fill={text}>
        f.
      </text>
    </svg>
  )
}

export function Tag({ kind, children }: { kind: keyof typeof TAG_STYLE; children?: ReactNode }) {
  return <span className={`chip ${TAG_STYLE[kind]} whitespace-nowrap`}>{children ?? TAG_TEXT[kind]}</span>
}

export function SimBadge() {
  return (
    <span className="chip bg-lima-soft text-bosque" title="Resultado calculado en tu navegador con datos sintéticos y supuestos editables">
      <FlaskConical size={12} /> Simulado con supuestos
    </span>
  )
}

export function KpiCard({
  label,
  value,
  sub,
  tone = 'light',
  icon,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: 'light' | 'dark' | 'lima' | 'turq'
  icon?: ReactNode
}) {
  const tones = {
    light: 'card',
    dark: 'card-dark',
    lima: 'rounded-2xl bg-lima text-bosque',
    turq: 'rounded-2xl bg-turq text-white',
  }
  return (
    <div className={`${tones[tone]} p-4`}>
      <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide ${tone === 'light' ? 'text-gris' : 'opacity-80'}`}>
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold leading-tight">{value}</div>
      {sub && <div className={`mt-0.5 text-xs ${tone === 'light' ? 'text-gris' : 'opacity-80'}`}>{sub}</div>}
    </div>
  )
}

export function ScreenHeader({
  kicker,
  title,
  hint,
  children,
  right,
}: {
  kicker: string
  title: ReactNode
  /** una sola línea, siempre visible: qué haces en esta pantalla */
  hint?: ReactNode
  /** explicación larga: queda escondida tras "¿Qué veo aquí?" */
  children?: ReactNode
  right?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs font-bold uppercase tracking-wider text-turq">{kicker}</div>
        <h1 className="h-title">{title}</h1>
        {hint && <p className="mt-1 text-sm font-semibold text-bosque/80 md:text-base">{hint}</p>}
        {children && (
          <>
            <button onClick={() => setOpen((o) => !o)} className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-turq-soft px-2.5 py-1 text-xs font-bold text-turq hover:bg-turq hover:text-white">
              <Info size={13} /> {open ? 'Ocultar explicación' : '¿Qué veo aquí?'}
            </button>
            {open && <div className="anim-pop mt-2 max-w-3xl rounded-xl bg-white p-3 text-sm text-gris shadow-sm">{children}</div>}
          </>
        )}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  )
}

/** Detalle opcional: cerrado por defecto para no llenar la pantalla de texto */
export function More({ label = 'Ver detalle', children, className = '' }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <details className={`group rounded-xl bg-white/70 text-sm ${className}`}>
      <summary className="flex cursor-pointer list-none items-center gap-1 px-3 py-2 text-xs font-bold text-turq hover:underline">
        <ChevronDown size={14} className="transition group-open:rotate-180" /> {label}
      </summary>
      <div className="px-3 pb-3 text-gris">{children}</div>
    </details>
  )
}

export function NeedResult({ children }: { children: ReactNode }) {
  const result = useSim((s) => s.result)
  const error = useSim((s) => s.error)
  if (error) return <div className="card p-6 text-red-700">Error en la simulación: {error}</div>
  if (!result)
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-gris">
        <TorreLogo className="anim-float h-20" />
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Loader2 className="animate-spin" size={16} /> Armando el tablero y ubicando las Torres…
        </div>
      </div>
    )
  return <>{children}</>
}

/** Marco de celular para las vistas móviles (en un celular real se muestra a pantalla completa) */
export function PhoneFrame({ children, time = '06:15', title }: { children: ReactNode; time?: string; title?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[380px]">
      <div className="rounded-[2.4rem] bg-bosque p-2.5 shadow-2xl ring-1 ring-black/10">
        <div className="relative overflow-hidden rounded-[1.9rem] bg-white">
          <div className="flex items-center justify-between bg-white px-5 pb-1 pt-2 text-[11px] font-semibold text-tinta">
            <span>{time}</span>
            <span className="h-4 w-20 rounded-full bg-bosque" />
            <span>▮▮▮ 🔋</span>
          </div>
          {title}
          <div className="h-[640px] max-h-[70vh] overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  )
}

export const fmtInt = (n: number) => groupThousands(Math.round(n))
export function groupThousands(n: number) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
export const fmtPct = (x: number, d = 1) => `${(x * 100).toFixed(d).replace('.', ',')}%`
export const fmtNum = (x: number, d = 1) => x.toFixed(d).replace('.', ',')
export const fmtMs = (x: number) => (x < 10 ? x.toFixed(1).replace('.', ',') : Math.round(x).toString())
