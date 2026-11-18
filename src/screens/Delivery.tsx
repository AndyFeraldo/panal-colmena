import { useEffect, useState } from 'react'
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
  const msgs = [
    { t: route.startTime, kind: 'EXISTE' as const, text: 'Tu pedido salió a ruta 🛵' },
    {
      t: route.startTime + 1,
      kind: 'NUEVO' as const,
      text: (
        <>
          <b>Nuevo:</b> tu pedido llega <b>hoy entre {fmtTime(ctx.winStart)} y {fmtTime(ctx.winEnd)}</b>. ¿No estarás? Responde 1 para reprogramar.
        </>
      ),
    },
    { t: prev?.eta ?? ctx.eta - 6, kind: 'EXISTE' as const, text: 'Tu pedido es el siguiente en ser entregado 📍 Sigue a tu motorizado aquí' },
    { t: ctx.eta + 3, kind: 'EXISTE' as const, text: '¡Entregado! ✅' },
  ]
  const [shown, setShown] = useState(1)
  useEffect(() => {
    setShown(1)
    const ts = [1, 2, 3].map((i) => setTimeout(() => setShown(i + 1), i * 1100))
    return () => ts.forEach(clearTimeout)
  }, [route.id])
  const inWindow = ctx.eta >= ctx.winStart && ctx.eta <= ctx.winEnd

  return (
    <div>
      <ScreenHeader kicker="💬 Cliente · día de la entrega" title="Ana sabe cuándo llega" hint="Antes: “de 8 a 8”. Ahora: una ventana de 2 horas.">
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
            {msgs.slice(0, shown).map((m, i) => (
              <div key={i} className={`anim-drop max-w-[88%] rounded-2xl rounded-tl-sm p-3 text-sm shadow-sm ${m.kind === 'NUEVO' ? 'bg-lima-soft ring-2 ring-lima' : i === 3 ? 'bg-[#e3f5d0]' : 'bg-white'}`}>
                <div>{m.text}</div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <Tag kind={m.kind} />
                  <span className="text-[10px] text-gris">{fmtTime(m.t)}</span>
                </div>
              </div>
            ))}
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
