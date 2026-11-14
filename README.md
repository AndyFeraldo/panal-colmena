# 🐝 PANAL f. + COLMENA

**Propuesta de equipo para la Innovathon Ulima × Saga Falabella 2026.**
Simulador web de una solución para **sectorizar los pedidos miniticket de despacho a domicilio en Lima** y lograr rutas estáticas eficientes en el poco tiempo nocturno disponible.

> "Se ordena de día, se ejecuta de noche. PANAL decide qué pedidos van juntos; la COLMENA hace que lleguen a tiempo."

🔗 **Demo en vivo:** https://andyferaldo.github.io/panal-colmena/

## En 1 minuto (guía para el jurado)
1. Abre la demo y presiona **▶ Modo demo**: un recorrido guiado de 9 pasos (~3 min). Flechas ← → del teclado para avanzar.
2. Usa el **selector de rol** (Cliente · Planificador · HUB · Colmena · Motorizado · Gerencia) para ver la pantalla de cada usuario.
3. En **Gerencia → Comparador** mueve los sliders (pedidos/día, Cyber, % con pin, mochila…) y mira cómo cambian los KPIs de **Hoy vs PANAL vs PANAL + Colmena**.

## La solución
| Pieza | Qué hace |
|---|---|
| **Pin f.** | El cliente marca su puerta en el mapa al comprar → cada pedido nace con coordenadas. |
| **PANAL** | Lima en hexágonos H3 (res. 8, ~0,74 km²) agrupados en panales de ~50 pedidos cercanos, que cruzan distritos. El pedido sabe su panal desde que se compra. |
| **SimpliRoute** | PANAL le envía los pedidos ya agrupados (Zonas, Visitas); SimpliRoute ordena las paradas. No se cambia de sistema. |
| **COLMENA** | Una minivan lleva las bolsas cerca de los panales; las motos empiezan y recargan ahí en vez de volver a Villa El Salvador. |
| **Ventana corta** | El cliente sabe que su pedido llega en una ventana de 2 horas, no "de 8 a 8". |
| **Aprendizaje** | Con los tiempos reales por parada, PANAL propone ajustes de panales cada semana (medibles). |

## Qué hay dentro (todo se calcula en el navegador)
- **Datos sintéticos con semilla** (misma semilla = mismos resultados): pedidos por distrito según los pesos del reto, curva de ventas, oleadas 15/25/60%, tallas por volumen.
- **Panales** por crecimiento de regiones sobre celdas H3 con 8 semanas de historial sintético, limitados por paradas, volumen y tiempo del turno.
- **Regla actual (baseline):** por turno y por distrito, los primeros 50 pedidos en orden de llegada forman una ruta; todo sale del HUB VES.
- **Asignación nocturna** celda → panal → Colmena, medida con `performance.now()` (milisegundos).
- **Orden de paradas** (simula la optimización de SimpliRoute): vecino más cercano + 2-opt, con recargas cuando la mochila se llena.
- **KPIs** de los 3 escenarios: SPR, rutas chicas, km vacíos, % pedidos a tiempo (proxy OTD), carga correcta, geocodificación manual, vehículos en el HUB, ventana al cliente.
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
src/sim/          motor: datos, H3, panales, colmenas, baseline, rutas, KPIs, aprendizaje (+ tests)
src/integration/  RoutingProvider, MockSimpliRouteProvider (demo) y esqueleto SimpliRouteApiProvider
src/workers/      la simulación corre en un Web Worker para no congelar la pantalla
src/screens/      P0…P10 (Inicio, Checkout, Planificador, HUB, Colmena, Motorizado, Entrega, Comparador, Integración, Reporte, Supuestos)
src/components/   Layout, mapas, marco de celular, modo demo
docs/             contexto del reto, insights, supuestos, flyers
```

## Aviso
Proyecto académico. **No es material oficial de Falabella.** Datos sintéticos y supuestos documentados en `docs/`. La integración con SimpliRoute está **simulada** (no se hacen llamadas reales). Las vistas del motorizado y de mensajes al cliente son genéricas e ilustrativas.

Mapas © colaboradores de OpenStreetMap · Límites de distritos: INEI vía [juaneladio/peru-geojson](https://github.com/juaneladio/peru-geojson) · Hexágonos: [H3](https://h3geo.org/).
