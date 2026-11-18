# ♜ TORRE f.

**Propuesta de equipo para la Innovathon Ulima × Saga Falabella 2026.**
Simulador web de una solución para **sectorizar los pedidos miniticket de despacho a domicilio en Lima** y lograr rutas estáticas eficientes en el poco tiempo nocturno disponible.

> "Cada pedido tiene su casilla. Cada moto tiene su Torre." — Se ordena de día, se ejecuta de noche.

🔗 **Demo en vivo:** https://andyferaldo.github.io/panal-colmena/

## En 1 minuto (guía para el jurado)
1. Abre la demo y presiona **▶ Modo demo**: un recorrido guiado de 10 pasos (~3 min). Flechas ← → del teclado para avanzar.
2. Usa el **selector de rol** (Cliente · Planificador · Admin · HUB · Torre · Motorizado · Gerencia) para ver la pantalla de cada usuario.
3. En **Gerencia** mira el **Comparador** (Hoy vs Tablero f. vs TORRE f.), la **Capacidad** (motos y camiones en un día Normal y en Cyber) y la **Evaluación** honesta frente al reto.

## La solución
| Pieza | Qué hace |
|---|---|
| **Pin f.** | El cliente marca su puerta en el mapa al comprar → cada pedido nace con coordenadas. |
| **Tablero f.** | Lima como un tablero: **casillas en rombo de ~8 cuadras** que se juntan en **cuadrantes de máximo 50 paquetes** (1 ruta), cruzando distritos. El pedido sabe su cuadrante desde que se compra. |
| **Torre (A, B, C…)** | Un camión del proveedor se estaciona en el **punto medio** de sus cuadrantes (A1, A2…). "Me quedé sin paquetes" → la moto se reabastece en su Torre, **no vuelve al almacén** de Villa El Salvador. |
| **Admin** | Si un cuadrante pasa de 50 esta noche: pasa los sobrantes a un vecino con espacio o asigna otro motorizado y lo parte por zona. |
| **SimpliRoute** | Recibe los cuadrantes como Zonas y los pedidos como Visitas; ordena las paradas. No se cambia de sistema. |
| **Ventana corta** | El cliente sabe que su pedido llega en una ventana de 2 horas, no "de 8 a 8". |
| **Aprendizaje** | Con los tiempos reales por parada, el Tablero f. propone ajustes de cuadrantes cada semana (medibles). |

## Qué hay dentro (todo se calcula en el navegador)
- **Datos sintéticos con semilla** (misma semilla = mismos resultados): pedidos por distrito según los pesos del reto, curva de ventas, oleadas 15/25/60%, tallas por volumen.
- **Cuadrantes** por crecimiento de regiones sobre casillas en rombo con 8 semanas de historial sintético; tope duro de 50 paquetes, volumen y tiempo del turno.
- **Mapa de calor** de paquetes por casilla, vista por cuadrantes y vista **tablero** (negro = Torre, blanco = directo del HUB) sobre Google Maps u OpenStreetMap.
- **Regla actual (baseline):** por turno y por distrito, los primeros 50 pedidos en orden de llegada forman una ruta; todo sale del HUB VES.
- **Asignación nocturna** casilla → cuadrante → Torre, medida con `performance.now()` (milisegundos).
- **Más de 50 en una noche:** traspaso al cuadrante vecino con espacio y, si no hay, reparto por zona entre 2+ motorizados.
- **Orden de paradas** (simula la optimización de SimpliRoute): vecino más cercano + 2-opt, con reabastecimiento cuando la mochila se llena.
- **KPIs** de los 3 escenarios y **capacidad** (motos, camiones, Torres) para Bajo / Normal / Alto / Cyber.
- **Integración simulada** con SimpliRoute (consola de API): no se hacen llamadas reales.

Todos los supuestos son editables en la pantalla **Supuestos y fuentes** y cada dato indica si es *dato del reto*, *insight de la entrevista* o *supuesto del equipo*.

## Cómo correrlo en tu computadora
Necesitas [Node.js 22](https://nodejs.org/).
```bash
npm install
npm run dev      # abre http://localhost:5173
npm test         # pruebas de los algoritmos (src/sim)
npm run build    # versión para publicar (carpeta dist/)
```
### Google Maps (opcional)
Sin configurar nada, los mapas usan **OpenStreetMap**. Para usar **Google Maps** como mapa base (y ubicar direcciones escritas en el checkout Pin f.):
1. En [Google Cloud Console](https://console.cloud.google.com/) crea un proyecto, vincula facturación y pon un presupuesto con alerta.
2. Habilita **Maps JavaScript API** y **Geocoding API**; crea una **clave de API**.
3. Restringe la clave por **sitio web**: `http://localhost:5173/*` y `https://TU_USUARIO.github.io/*`, y solo a esas 2 APIs.
4. En tu PC: copia `.env.example` como `.env.local` y pega la clave. En GitHub: crea el secreto `VITE_GOOGLE_MAPS_KEY` (Settings → Secrets and variables → Actions).

Si la clave falla o Google no responde, la app vuelve sola a OpenStreetMap; en cada mapa hay un selector **Google / OSM**.

Cada `push` a la rama `main` publica automáticamente en GitHub Pages (`.github/workflows/deploy.yml`).

## Estructura
```
src/sim/          motor: datos, casillas en rombo, cuadrantes, torres, baseline, rutas, KPIs, capacidad, aprendizaje (+ tests)
src/integration/  RoutingProvider, MockSimpliRouteProvider (demo) y esqueleto SimpliRouteApiProvider
src/workers/      la simulación corre en un Web Worker para no congelar la pantalla
src/screens/      Inicio, Checkout, Planificador, Admin, HUB, Torre, Motorizado, Entrega, Comparador, Capacidad, Evaluación, Reporte, Integración, Supuestos
src/components/   Layout, mapas, marco de celular, modo demo
docs/             contexto del reto, insights, supuestos, fuentes
```

## Aviso
Proyecto académico. **No es material oficial de Falabella.** Datos sintéticos y supuestos documentados en `docs/`. La integración con SimpliRoute está **simulada** (no se hacen llamadas reales). Las vistas del motorizado y de mensajes al cliente son genéricas e ilustrativas.

Mapas: Google Maps (opcional) / © colaboradores de OpenStreetMap · Límites de distritos: INEI vía [juaneladio/peru-geojson](https://github.com/juaneladio/peru-geojson).
