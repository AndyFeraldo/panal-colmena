import { useEffect, useState, type ReactNode } from 'react'
import { More, NeedResult, PhoneFrame, ScreenHeader, Tag } from '../components/ui'
import { anaContext } from '../components/demoSteps'
import { fmtTime } from '../sim/geo'
import { useSim } from '../store/useSim'

export default function Delivery() {
  return (
    <NeedResult>
      <DeliveryInner />
    </NeedResult>
  )
}

function DeliveryInner() {
  const result = useSim((s) => s.result)!
  const ctx = anaContext(result)!
  const route = ctx.route!
  const idx = route.stops.findIndex((s) => s.orderId === 'F-208341')
  const prev = route.stops.slice(0, idx).reverse().find((s) => s.kind === 'delivery')
  const [resched, setResched] = useState<null | 'hoy' | 'manana'>(null)
  const [asking, setAsking] = useState(false)
  const torreName = ctx.torre ? `la Torre ${ctx.torre.letter ?? ''} · ${ctx.torre.short}` : 'el HUB'
  type Msg = { t: number; kind: 'EXISTE' | 'NUEVO' | 'YO'; text: ReactNode }
  const base: Msg[] = [
    { t: route.startTime, kind: 'EXISTE', text: 'Tu pedido salió a ruta 🛵' },
    {
      t: route.startTime + 1,
      kind: 'NUEVO',
      text: (
        <>
          <b>Nuevo:</b> tu pedido llega <b>hoy entre {fmtTime(ctx.winStart)} y {fmtTime(ctx.winEnd)}</b>. ¿No estarás? Puedes cambiar el horario aquí.
        </>
      ),
    },
  ]
  const normal: Msg[] = [
    { t: prev?.eta ?? ctx.eta - 6, kind: 'EXISTE', text: 'Tu pedido es el siguiente en ser entregado 📍 Sigue a tu motorizado aquí' },
    { t: ctx.eta + 3, kind: 'EXISTE', text: '¡Entregado! ✅' },
  ]
  const later: Msg[] = [
    { t: route.startTime + 4, kind: 'YO', text: resched === 'hoy' ? 'No estaré. Mejor hoy de 18:00 a 20:00' : 'No estaré. Mejor mañana de 9:00 a 11:00' },
    {
      t: route.startTime + 5,
      kind: 'NUEVO',
      text:
        resched === 'hoy' ? (
          <>
            <b>Listo ✅</b> llega <b>hoy entre 18:00 y 20:00</b>. Tu paquete se queda en {torreName}, cerca de tu casa: sale en el turno de la tarde.
          </>
        ) : (
          <>
            <b>Listo ✅</b> llega <b>mañana entre 9:00 y 11:00</b>. Tu paquete se queda en {torreName} y sale primero en la ruta de mañana.
          </>
        ),
    },
    { t: resched === 'hoy' ? 18 * 60 + 41 : 9 * 60 + 37, kind: 'EXISTE', text: '¡Entregado! ✅' },
  ]
  const msgs = resched ? [...base, ...later] : [...base, ...normal]
  const [shown, setShown] = useState(1)
  useEffect(() => {
    const from = resched ? 2 : 1
    setShown(from)
    const ts = [1, 2, 3].map((i) => setTimeout(() => setShown(from + i), i * 1100))
    return () => ts.forEach(clearTimeout)
  }, [route.id, resched])
  const bubble = (m: Msg, i: number) =>
    m.kind === 'YO' ? (
                <div key={i} className="anim-drop ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-bosque p-3 text-sm text-white shadow-sm">
                  {m.text}
                  <div className="mt-1 text-right text-[10px] text-white/70">Ana · {fmtTime(m.t)}</div>
                </div>
              ) : (
                <div key={i} className={`anim-drop max-w-[88%] rounded-2xl rounded-tl-sm p-3 text-sm shadow-sm ${m.kind === 'NUEVO' ? 'bg-lima-soft ring-2 ring-lima' : i === msgs.length - 1 ? 'bg-[#e3f5d0]' : 'bg-white'}`}>
                  <div>{m.text}</div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <Tag kind={m.kind} />
                    <span className="text-[10px] text-gris">{fmtTime(m.t)}</span>
                  </div>
                </div>
              )

  const inWindow = ctx.eta >= ctx.winStart && ctx.eta <= ctx.winEnd

  return (
    <div>
      <ScreenHeader kicker="💬 Cliente · día de la entrega" title="Ana sabe cuándo llega" hint="Antes: “de 8 a 8”. Ahora: una ventana de 2 horas, y si no está, se cambia el mismo día.">
        Mismo canal de mensajes de hoy (vista genérica, no es la interfaz real de ninguna app). Solo se suma un mensaje: la ventana de 2 horas calculada con el ETA de la ruta
        optimizada.
      </ScreenHeader>
      <div className="grid items-start gap-6 lg:grid-cols-[400px_1fr]">
        <PhoneFrame
          time={fmtTime(Math.min(ctx.eta + 3, route.startTime + 5))}
          title={
            <div className="flex items-center gap-2 bg-bosque px-4 py-3 text-white">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-lima text-lg font-extrabold italic text-bosque">f.</span>
              <div>
                <div className="font-bold">falabella.</div>
                <div className="text-[11px] text-white/70">mensajes de entrega (ilustrativo)</div>
              </div>
            </div>
          }
        >
          <div className="min-h-full space-y-3 bg-[#eef1e6] p-4">
            {msgs.slice(0, shown).map((m, i) => i < 2 ? bubble(m, i) : null)}
            {!resched && shown >= 2 && (
              <div className="anim-drop rounded-2xl bg-white p-3 shadow-sm">
                {!asking ? (
                  <button onClick={() => setAsking(true)} className="btn-dark w-full !py-2.5 !text-sm">
                    🙋 No estaré a esa hora
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-bosque">¿Cuándo te queda mejor?</div>
                    <button onClick={() => setResched('hoy')} className="btn-lima w-full !py-2 !text-sm">
                      Hoy, 18:00 – 20:00
                    </button>
                    <button onClick={() => setResched('manana')} className="btn-ghost w-full !py-2 !text-sm">
                      Mañana, 9:00 – 11:00
                    </button>
                  </div>
                )}
              </div>
            )}
            {msgs.slice(0, shown).map((m, i) => (i >= 2 ? bubble(m, i) : null))}
            {resched && shown >= msgs.length && (
              <button
                onClick={() => {
                  setResched(null)
                  setAsking(false)
                }}
                className="mx-auto block text-xs font-semibold text-gris underline"
              >
                Volver a ver sin reprogramar
              </button>
            )}
          </div>
        </PhoneFrame>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="card border-l-4 border-naranja p-5">
              <div className="text-[11px] font-bold uppercase text-naranja">Hoy</div>
              <div className="text-3xl font-extrabold text-bosque">"de 8 a 8"</div>
              <div className="text-sm text-gris">Ventana de 12 horas</div>
              <div className="mt-2">
                <Tag kind="ENTREVISTA" />
              </div>
            </div>
            <div className="card border-l-4 border-verde p-5">
              <div className="text-[11px] font-bold uppercase text-verde">Con TORRE f.</div>
              <div className="text-3xl font-extrabold text-bosque">
                {fmtTime(ctx.winStart)} – {fmtTime(ctx.winEnd)}
              </div>
              <div className="text-sm text-gris">
                Ventana de 2 h. ETA simulado de Ana: <b>{fmtTime(ctx.eta)}</b> {inWindow ? '✓ dentro de la ventana' : '⚠ fuera de la ventana'}
              </div>
              <div className="mt-2">
                <Tag kind="NUEVO" />
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-extrabold text-bosque">¿Ana no está? Se reprograma el mismo día</h3>
              <span className="chip bg-lima text-bosque">lo más pedido en mentoría</span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-naranja-soft p-4">
                <div className="text-[11px] font-bold uppercase text-naranja">Hoy</div>
                <div className="text-2xl font-extrabold text-bosque">1 a 2 días</div>
                <div className="text-xs text-bosque/80">El paquete vuelve al almacén de VES y se vuelve a programar.</div>
              </div>
              <div className="rounded-xl bg-lima-soft p-4">
                <div className="text-[11px] font-bold uppercase text-verde">Con TORRE f.</div>
                <div className="text-2xl font-extrabold text-bosque">El mismo día</div>
                <div className="text-xs text-bosque/80">El paquete se queda en su Torre, a minutos de su casa, y sale en el turno que Ana elige.</div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <Tag kind="SUPUESTO">"1–2 días": dato de mentoría, por validar</Tag>
              <Tag kind="NUEVO" />
            </div>
          </div>
          <More label="¿Por qué importa?"><ul className="space-y-1.5">
              <li>• El cliente está en casa a la hora correcta → menos "cliente no estaba" y menos reintentos.</li>
              <li>• Se envía por el canal que ya existe ("salió a ruta" y "eres el siguiente" ya se usan).</li>
              <li>• La ventana sale del ETA de la ruta optimizada: es un cálculo, no una promesa al aire.</li>
            </ul></More>
        </div>
      </div>
    </div>
  )
}
