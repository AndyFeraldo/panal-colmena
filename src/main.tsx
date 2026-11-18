import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createHashRouter } from 'react-router-dom'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import '@fontsource/poppins/800.css'
import 'leaflet/dist/leaflet.css'
import './index.css'
import Layout from './components/Layout'
import Home from './screens/Home'
import Checkout from './screens/Checkout'
import Planner from './screens/Planner'
import Seasons from './screens/Seasons'
import Hub from './screens/Hub'
import TorreScreen from './screens/TorreScreen'
import Rider from './screens/Rider'
import Delivery from './screens/Delivery'
import Compare from './screens/Compare'
import Integration from './screens/Integration'
import Report from './screens/Report'
import Assumptions from './screens/Assumptions'
import Admin from './screens/Admin'
import Capacity from './screens/Capacity'
import Evaluation from './screens/Evaluation'

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'cliente/checkout', element: <Checkout /> },
      { path: 'cliente/entrega', element: <Delivery /> },
      { path: 'planificador', element: <Planner /> },
      { path: 'planificador/temporadas', element: <Seasons /> },
      { path: 'admin', element: <Admin /> },
      { path: 'hub', element: <Hub /> },
      { path: 'torre', element: <TorreScreen /> },
      { path: 'motorizado', element: <Rider /> },
      { path: 'gerencia', element: <Compare /> },
      { path: 'reporte', element: <Report /> },
      { path: 'capacidad', element: <Capacity /> },
      { path: 'evaluacion', element: <Evaluation /> },
      { path: 'integracion', element: <Integration /> },
      { path: 'supuestos', element: <Assumptions /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
