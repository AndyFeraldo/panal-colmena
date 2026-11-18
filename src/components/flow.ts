// Recorrido sugerido: el orden en que se cuenta la historia (de día → de noche → resultados)
export interface FlowStep {
  path: string
  label: string
  icon: string
}

export const FLOW: FlowStep[] = [
  { path: '/', label: 'Inicio', icon: '♜' },
  { path: '/cliente/checkout', label: 'El cliente compra con Pin f.', icon: '🛒' },
  { path: '/planificador', label: 'El planificador arma el tablero', icon: '🗺️' },
  { path: '/hub', label: '02:30 en el HUB', icon: '🏭' },
  { path: '/admin', label: 'Admin: ¿más de 50?', icon: '⚖️' },
  { path: '/torre', label: 'La Torre entrega bolsas', icon: '♜' },
  { path: '/motorizado', label: 'El motorizado en ruta', icon: '🛵' },
  { path: '/cliente/entrega', label: 'El cliente sabe cuándo llega', icon: '💬' },
  { path: '/gerencia', label: 'Resultados: hoy vs TORRE f.', icon: '📊' },
  { path: '/capacidad', label: 'Motos y camiones', icon: '🚚' },
  { path: '/evaluacion', label: '¿Responde al reto?', icon: '✅' },
  { path: '/reporte', label: 'Aprendizaje semanal', icon: '🧠' },
  { path: '/integracion', label: 'Conexión con SimpliRoute', icon: '🔌' },
  { path: '/supuestos', label: 'Supuestos y fuentes', icon: '⚙️' },
]
