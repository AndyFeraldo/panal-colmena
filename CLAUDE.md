# TORRE f. — Simulador web para la Innovathon Ulima × Saga Falabella 2026

> Este archivo es el brief maestro. Léelo completo antes de escribir código.
> Idioma de la interfaz: **español (Perú)**. Idioma del código: inglés para nombres de variables/funciones, comentarios en español cuando ayuden.
> El dueño del repositorio **no sabe programar**: explícale en lenguaje simple lo que haces en cada fase, y deja todo listo para que funcione con un solo comando y se publique en GitHub Pages.

---

## 0. Qué hay que construir (en una frase)

Una **web app de simulación, interactiva y publicada en GitHub Pages**, que demuestre ante el jurado que la solución **TORRE f.** funciona: cómo se sectorizan los pedidos de despacho a domicilio (miniticket) en Lima, cómo se conecta con SimpliRoute (el software que Falabella ya usa) y cómo mejora los indicadores del reto frente a la regla actual, mostrando las pantallas de **todos los usuarios**.

No es el producto real: es un **prototipo funcional con datos sintéticos** y una **integración simulada** con SimpliRoute. Pero la lógica (casillas, cuadrantes, asignación, torres, rutas, KPIs) debe ser **real y calculada en el navegador**, no números fijos.

---

## 1. Contexto del concurso

- **Evento:** Innovathon Ulima × Saga Falabella 2026 (Universidad de Lima, Innova Ulima).
- **Demo Day:** viernes 20 de noviembre de 2026. Pitch de **3 minutos** + preguntas del jurado.
- **Rúbrica (lo que optimiza este prototipo):**

| Criterio | Peso | Qué debe lograr el prototipo |
|---|---|---|
| Comprensión del reto y del público | 25% | Mostrar el problema real con datos del reto y de la entrevista; pantallas para cada usuario real. |
| Creatividad e innovación | 20% | Que se vea claro lo distinto: cuadrantes que cruzan distritos, decisión de día, Torre móvil, Pin f. |
| Viabilidad y potencial | 20% | Que se vea que **se integra con SimpliRoute** y no reemplaza nada; supuestos transparentes. |
| **Prototipo** | **25%** | **"¿Qué tan fácil y atractivo es interactuar con la solución?"** → debe ser clicable, fluido, bonito, sin fricción. |
| Presentación y storytelling | 10% | Un **modo demo guiado** de ~3 minutos que acompañe el pitch. |

---

## 2. El reto (texto oficial de las bases)

> **¿Cómo podemos sectorizar los pedidos miniticket de despacho a domicilio para hacer rutas estáticas eficientes en Lima Metropolitana?** Actualmente existe poco margen de tiempo durante el procesamiento nocturno para sectorizar los pedidos por ruta dinámica.
>
> La solución debe enfocarse en cómo se organizan y distribuyen los pedidos de despacho a domicilio en el poco tiempo que hay entre el cierre de pedidos y la salida de las unidades, con el fin de alcanzar un **96% de entregas a tiempo (OTD)**, **50 paradas por ruta (SPR)** y un **99.9% de nivel de servicio de carga**.

### 2.1 Datos que dio Falabella (PPT del reto)
- **Venta:** 00:00–23:59 → entrega al día siguiente (100% si Falabella maneja el stock). Sellers: 00:00–16:59 (50% si el seller maneja el stock).
- **CD Villa El Salvador (VES):** 48.000 m² · recibo 35.000 ped/día · empaque 80.000 ped/día · despacho 150.000 ped/día.
- **HUB de cross-docking (XD):** 2.500 m² · **procesa 700 pedidos/hora** · a ~1,9 km del CD, en VES.
- **Salidas del CD al HUB (oleadas):** 14:00 → **15%** · 19:00 → **25%** · 02:30 → **60%**.
- **Ruteo estático actual:** "los **primeros 50 pedidos del distrito** se asignan a una ruta".
- **Motorizados:** 3 rutas por día: **06:00–11:00**, **12:00–17:00**, **18:00–21:00**.
- **Metas:** OTD 96% · SPR 50 · carga 99,9%.
- Participación por distrito (lectura aproximada de un gráfico; usar como pesos sintéticos): Santiago de Surco ≈16%, Miraflores ≈11%, San Isidro ≈7,5%, y luego una cola larga de distritos entre ≈4% y <1% (ver `docs/datos-del-reto.md`).

### 2.2 Lo que aprendimos entrevistando al equipo de Falabella (insights clave)
Ver detalle en `docs/insights-entrevista.md`. Resumen:
1. **Usan SimpliRoute** (licencia SaaS) para armar rutas y hacer seguimiento; la app del motorizado les parece intuitiva. → **No crear una app nueva; integrarse.**
2. **Muchas direcciones no tienen coordenadas** (la web no obliga a marcar el punto). Alguien las **busca a mano en Google**. Todo sistema de ruteo necesita lat/long. → **Pin f.**
3. **Rutas estáticas por orden de llegada:** "los primeros pedidos que caen van armando rutas"; lo que entra después se rutea según dispersión. El motorizado conoce su ruta recién al cargar.
4. **Mochila por volumen:** tallas XS3, XS2, S, M… en dm³; el sistema calcula cuánto entra; estándar ~50 pedidos. Si no entra, **el motorizado tiene que volver** a recargar.
5. **Idea de la propia entrevistada:** una **camión "nodriza"** que alimente a las motos en su zona para que no vuelvan; y "no tienen que volver obligatoriamente, pueden recargar en tiendas". → **Torre.**
6. **Cyber:** las motos salen a las 8 o 9 en vez de a las 7 y no terminan de entregar. Los lunes hay picos.
7. **El 60% de las 02:30** viene de la curva de ventas (17:00–24:00) y la promesa es entrega en 24 h → no se puede adelantar.
8. **Visibilidad del cliente mala:** ventana prometida "de 8 a 8"; hoy envían WhatsApp "salió a ruta" y "eres el siguiente" + link de seguimiento.
9. **Pagan al transporte por paquete entregado:** el ahorro de rutas beneficia sobre todo al **proveedor de transporte**; a Falabella le importa OTD, experiencia del cliente y aguantar Cyber.
10. Marcas falsas de "cliente no estaba" se controlan con la ubicación GPS de la marca (fuera de alcance).
11. "SimpliRoute aprende de los cambios del motorizado… en teoría, no sé cómo probarlo." → Nuestro reporte de aprendizaje debe ser **medible y visible**.

---

## 3. La solución: TORRE f.

**Frase central:** *"Cada pedido tiene su casilla. Cada moto tiene su Torre." · Se ordena de día, se ejecuta de noche.*

### 3.1 Las piezas
| Pieza | Qué es | Nuevo o existente |
|---|---|---|
| **Pin f.** | En el checkout de falabella.com el cliente arrastra un pin hasta su puerta → el pedido nace con lat/long. Direcciones antiguas se geocodifican automáticamente de día. | **Nuevo** (cambio en el checkout) |
| **Tablero f.** (motor + panel web) | Lima dividida en **casillas en rombo de ~8 cuadras (0,8 km de lado)**. Con el historial, casillas vecinas se agrupan en **cuadrantes de máximo 50 paquetes** (= una ruta), dimensionados por paquetes, volumen y tiempo del turno. Nombres: letra de su Torre + número (A1, A2…) o H1, H2… si salen directo del HUB. Los cuadrantes **cruzan límites de distrito**. Mapas por nivel de demanda: **Bajo / Normal / Alto / Cyber**. Vistas: **calor**, **cuadrantes**, **tablero** (negro = Torre, blanco = HUB). | **Nuevo** |
| **Asignación instantánea** | Como el pedido tiene lat/long desde que se compra, se le asigna **casilla → cuadrante → torre al instante**. A las 02:30 no se decide nada: solo se clasifica físicamente. | **Nuevo** |
| **Integración SimpliRoute** | El Tablero f. publica los cuadrantes como **Zonas**, envía los pedidos como **Visitas** (con lat/long y etiqueta de cuadrante), deja que **la Optimización de SimpliRoute ordene las paradas** dentro de cada cuadrante y recibe **Webhooks** de entregas para aprender. | **Existente** (se reutiliza) |
| **Torre (A, B, C…)** | Camión del proveedor de transporte que sale del HUB (~05:30) con las bolsas de sus cuadrantes y se estaciona en el **punto medio** de ellos (p. ej. estacionamiento de una tienda). Las motos **recogen y se reabastecen ahí** ("me quedé sin paquetes" → voy a mi Torre; no volvemos al almacén). Se usa donde hay muchos cuadrantes lejos del HUB y en Cyber. En SimpliRoute = **un vehículo + un punto de inicio (depot)**; la recarga = una 2.ª ruta del día desde la Torre. | **Nuevo** (operativo) |
| **Ventana corta** | A las 07:00, con el ETA de la ruta optimizada, el cliente recibe **"tu pedido llega entre 9:00 y 11:00"** en vez de "de 8 a 8", por el WhatsApp que ya existe. | **Nuevo** (mensaje extra) |
| **Aprendizaje medible** | Con los webhooks (tiempos reales por parada), el Tablero f. ajusta los cuadrantes cada semana y muestra **qué cambió y por qué**. | **Nuevo** |

### 3.2 Cómo responde a las metas
| Meta / problema | Pieza | Mecanismo |
|---|---|---|
| Sectorizar en poco tiempo nocturno | Pin f. + Tablero f. | Asignación al comprar; de noche solo lookup (milisegundos). |
| SPR 50 | TORRE f. | Rutas por cercanía y balanceadas; la Torre permite completar 50 aunque la mochila no alcance. |
| OTD 96% | Torre + ventana | Menos km vacíos a VES; cliente esperando en la ventana correcta; segunda camión en Cyber. |
| Carga 99,9% | Torre | Doble control: el HUB carga pocas camiones; el encargado de la Torre escanea cada bolsa entregada a cada moto. |
| Direcciones sin coordenadas | Pin f. | Elimina búsqueda manual en Google. |
| Lo que **NO** resuelve (mostrarlo con honestidad) | — | La capacidad física del HUB (700 ped/h) no aumenta; solo se desacopla con la Torre. |

### 3.3 Usuarios (roles)
1. **Cliente** (checkout con Pin f. y WhatsApp el día de la entrega).
2. **Planificador logístico** (oficina, de día): revisa/ajusta cuadrantes y torres, publica en SimpliRoute.
3. **Jefe de HUB / proveedor de transporte** (noche, 02:30): ve asignación, clasificación por cuadrante, carga de camiones, alertas de desborde.
4. **Encargado de la Torre** (05:30–21:00, en el celular): bolsas por cuadrante, escaneo de entrega a cada moto, recargas.
5. **Motorizado** (app de siempre de SimpliRoute; nosotros mostramos una **vista genérica ilustrativa** de lo que cambia: inicio en la Torre + parada de recarga). **No imitar la interfaz ni el logo de SimpliRoute.**
6. **Gerencia / jurado**: comparador de escenarios y reporte de cierre.

---

## 4. Stack técnico (decisión tomada)

- **Vite + React + TypeScript**, 100% **estático** (sin backend) para publicarlo en **GitHub Pages**.
- **Mapas:** `leaflet` + `react-leaflet` con teselas de OpenStreetMap (atribución visible obligatoria). Alternativa válida: MapLibre GL con un estilo libre. Debe verse como un "Google Maps" limpio.
- **Casillas:** cuadrícula propia en rombo (`src/sim/grid.ts`, 0,8 km de lado; 4 vecinos por arista).
- **Geometría:** `@turf/turf` (puntos en polígonos, distancias, centroides).
- **Estado:** `zustand`. **Gráficos:** `recharts`. **Estilos:** Tailwind CSS. **Íconos:** `lucide-react`.
- **Simulación pesada** en un **Web Worker** para no congelar la UI.
- **Aleatoriedad con semilla** (`seedrandom`) → resultados reproducibles (misma semilla = mismos números en la demo).
- **Tests:** `vitest` para los algoritmos (asignación, cuadrantes, baseline, KPIs).
- **Deploy:** GitHub Actions → GitHub Pages (configurar `base` de Vite con el nombre del repo).
- **Router:** hash router (`createHashRouter`) para que funcione en GitHub Pages sin configuración extra.
- Debe funcionar en **laptop (proyector 1280×720 y 1920×1080)** y verse bien en celular.

---

## 5. Datos sintéticos (todo generado en el navegador, con semilla)

### 5.1 Geografía de Lima
- Intentar usar un **GeoJSON público de distritos de Lima Metropolitana** con licencia abierta (buscar uno confiable; citar la fuente en `docs/fuentes.md`). Guardarlo en `public/data/`.
- **Fallback** si no se consigue: usar los centroides aproximados de `docs/datos-del-reto.md` y muestrear puntos con una distribución normal alrededor del centroide (sigma según tamaño del distrito), descartando puntos en el mar (al oeste de la costa).
- **HUB XD VES:** coordenada aproximada en `docs/datos-del-reto.md` (marcar en UI como "ubicación aproximada").
- **Puntos Torre candidatos:** 3–6 puntos (estacionamientos genéricos "Punto Torre Miraflores", "…San Isidro", "…Surco", "…Los Olivos", "…SJL"). No usar nombres de tiendas reales específicas.

### 5.2 Pedidos
- `pedidosPorDia` configurable (slider **2.000 – 8.000**, default **4.000**). Escenarios: Bajo ×0,7, Normal ×1, Alto ×1,4, **Cyber ×2**.
- Distribución por distrito según los pesos de `docs/datos-del-reto.md`; dentro del distrito, puntos aleatorios (más densos cerca de avenidas/centro si es fácil; si no, uniforme dentro del polígono).
- Cada pedido: `id` (ej. `F-208341`), `createdAt` (curva de ventas: baja en almuerzo, sube fuerte 17:00–24:00), `oleada` (14:00 / 19:00 / 02:30 según hora de compra → 15% / 25% / 60%), `lat/lng` reales, `tieneCoordenadas` (según slider **% de pedidos con pin**: default hoy 60%, con Pin f. 95%), `direccionTexto`, `distrito`, `tallaVolumen` (XS3, XS2, XS, S, M con dm³ de `docs/supuestos.md`), `turno` (06–11 / 12–17 / 18–21).
- **Historial:** generar 8 semanas sintéticas para calcular la **demanda esperada por casilla y día de la semana** (lunes con pico +20%).

### 5.3 Supuestos (todos editables en la pantalla "Supuestos")
Ver `docs/supuestos.md`. Valores por defecto: velocidad moto 18 km/h en ciudad, factor de rodeo 1,3 sobre distancia en línea recta, tiempo por parada 3,5 min, mochila 120 dm³, capacidad camión 400 pedidos, error de carga manual 0,5% por bolsa vs 0,05% con escaneo doble, tiempo de geocodificación manual 1,5 min por dirección sin coordenadas. **Mostrar siempre** en la UI que son supuestos y que se validan con Falabella.

---

## 6. Algoritmos (implementar en `src/sim/` con tests)

### 6.1 Regla actual (baseline) — `baselineDistrictFifo`
- Por cada turno: ordenar pedidos por hora de llegada; por cada distrito, tomar los **primeros 50** → una ruta; el sobrante forma otra ruta (aunque sea de 7 pedidos).
- Pedidos sin coordenadas: se cuentan como **geocodificación manual** (minutos de trabajo) antes de rutear.
- Todas las rutas **salen del HUB VES**; si la mochila se llena (volumen), la moto **vuelve al HUB** a recargar (km vacíos ida y vuelta).

### 6.2 Construcción de cuadrantes — `buildCuadrantes(history, template, params)`
- Casillas en rombo con demanda esperada > 0.
- **Crecimiento de regiones** contiguas: desde una semilla (casilla no asignada más al sur-oeste), agregar el vecino (`gridDisk`/`gridRingUnsafe`) más cercano al centroide del grupo hasta alcanzar **~45 paquetes esperados (tope duro 50)** sin superar los límites de **volumen** ni de **tiempo estimado del turno** (paradas × tiempo por parada + recorrido estimado ≤ duración del turno).
- Fusionar cuadrantes pequeños (<30) con el vecino más chico si no supera 50.
- Asignar **colores** sin que dos cuadrantes vecinos compartan color (coloreo greedy).
- Generar los 4 mapas (Bajo/Normal/Alto/Cyber) escalando la demanda.
- Nombrar cuadrantes por su Torre: `A1`, `A2`… (o `H1`, `H2`… si salen directo del HUB). La Torre se ubica en el punto medio (ponderado por demanda) de sus cuadrantes.

### 6.3 Torres — `assignTorres(cuadrantes, puntos, params)`
- Cuadrantes cuyo centroide está a **> 10 km del HUB** (parámetro) se asignan al punto Torre más cercano, hasta la capacidad de el camión. Los demás salen directo del HUB.
- Si una Torre supera su capacidad en un escenario → **alerta "enviar 2.º camión"**.

### 6.4 Asignación nocturna — `assignOrders(orders, cuadranteMap)`
- `latLngToCell(lat, lng, 8)` → cuadrante → torre. **Medir el tiempo real** con `performance.now()` y mostrarlo ("2.412 pedidos asignados en 4 ms").
- **Desborde:** si un cuadrante supera su capacidad (paradas o volumen), mover las casillas del borde al cuadrante vecino con espacio (registrar cada movimiento como alerta aprobable en la pantalla del HUB).
- Pedidos sin coordenadas (escenario sin Pin f.): caen al centroide de su distrito (asignación peor) y suman minutos de geocodificación manual.

### 6.5 Orden de paradas (simula la Optimización de SimpliRoute) — `sequenceRoute`
- Vecino más cercano + **2-opt**. Inicio en el HUB o en la Torre según corresponda. Calcular ETA por parada con los supuestos.
- **Recarga:** cuando el volumen acumulado supera la mochila, insertar parada de recarga en la Torre (o volver al HUB en el baseline).

### 6.6 KPIs — `computeKpis(result)` (comparar 3 escenarios)
Escenarios: **A) Hoy (distrito + FIFO)** · **B) Tablero f. (sin Torre)** · **C) TORRE f.**.

| KPI | Cálculo |
|---|---|
| SPR promedio | pedidos / rutas |
| N.º de rutas y % de rutas con < 30 paradas | conteo |
| Km vacíos (sin entregar) | HUB/Torre ↔ primera/última parada + viajes de recarga |
| % rutas que terminan dentro del turno (**proxy de OTD**) | ETA última parada ≤ fin del turno |
| Riesgo de error de carga (**proxy de nivel de carga**) | 1 − Π(1 − p_error) por bolsa según manual vs escaneo doble → mostrar como % de carga correcta |
| Tiempo de decisión nocturna | ms medidos (Tablero f.) vs "ruteo dinámico / regla manual" del baseline |
| Minutos de geocodificación manual | pedidos sin coordenadas × 1,5 min |
| Vehículos a cargar en el HUB | motos (baseline) vs camiones + motos que salen del HUB |
| Ventana prometida al cliente | 12 h vs 2 h |

**Importante:** los KPIs deben **salir de la simulación**, cambiar con los sliders y mostrar una etiqueta "simulado con supuestos". No inventar números fijos. Si un resultado sale peor de lo esperado, mostrarlo igual (honestidad > marketing) y ajustar solo los supuestos documentados.

---

## 7. Pantallas (todas obligatorias)

Barra superior fija: logo Falabella (izq.) · "TORRE f." · **selector de rol** (Cliente · Planificador · Admin · HUB · Torre · Motorizado · Gerencia) · botón **"▶ Modo demo"** · logo Innova Ulima (der.). Pie fijo: *"Propuesta de equipo · Innovathon Ulima × Falabella 2026 · No es material oficial de Falabella · Datos simulados."*

### P0. Inicio — "¿Qué problema resolvemos?"
- Hero con la Torre f. y la frase central.
- 3 tarjetas del problema con datos reales: **3,5 h** (60% llega 02:30, 1.ª moto 06:00); **regla "primeros 50 del distrito"**; **direcciones sin coordenadas**.
- Diagrama de las piezas (Pin f. → Tablero f. → SimpliRoute → Torre → motorizado → cliente).
- Botones grandes: "Ver la simulación" · "Recorrer como cada usuario" · "Modo demo (3 min)".

### P1. Cliente — Checkout con Pin f. (vista celular)
- Mapa con pin arrastrable sobre una dirección de ejemplo (Miraflores). Campo de dirección y referencia. Botón "✓ Sí, aquí es mi puerta".
- Al confirmar: animación que muestra **"Casilla → Cuadrante P-09 → Torre Miraflores"** (badge "vista demo, el cliente no ve esto").
- Comparación lado a lado: "Sin pin: alguien busca tu dirección en Google (1,5 min)" vs "Con pin: 0 min".

### P2. Planificador — Mapa de cuadrantes (de día)
- Mapa Leaflet (Google Maps u OSM) de Lima con casillas en rombo: modos calor / cuadrantes / tablero, borde grueso entre cuadrantes, número de pedidos esperados por casilla (visible al hacer zoom), límites de distrito punteados (para ver que se cruzan).
- Selector **Bajo / Normal / Alto / Cyber** y selector de día de la semana.
- Marcadores 🚐 de puntos Torre con círculo de los cuadrantes que atienden; marcador del HUB VES.
- Panel derecho con KPIs del mapa: n.º de cuadrantes, paradas promedio esperadas, % cuadrantes que cruzan distritos, n.º de torres, % pedidos con pin.
- Interacción: clic en un cuadrante → detalle (casillas, distritos que cruza, paradas/volumen/tiempo estimado, torre). **Clic en una casilla de borde → moverla al cuadrante vecino** (recalcula KPIs).
- Botón **"Publicar en SimpliRoute"** → abre la **consola de integración** (P8) mostrando las llamadas simuladas `POST /v1/zones` con el JSON.

### P3. Jefe de HUB / proveedor — La noche (02:30)
- Línea de tiempo animable 14:00 → 19:00 → 02:30 → 05:30 → 06:00 con las oleadas (15/25/60%).
- Al "llegar" la oleada de 02:30: contador **"N pedidos asignados en X ms"**, puntos cayendo en sus casillas en el mapa.
- Barras de llenado por **cuadrante** y por **Torre**; orden de clasificación sugerido ("primero bolsas del turno 1").
- **Alertas aprobables:** "P-13 tiene +6 → ¿pasar a P-09 (vecino)? [Aprobar]" y "Torre Surco al 100% → ¿enviar 2.º camión? [Sí]". Al aprobar, se recalcula.
- Checklist de carga por camión (bolsas por cuadrante) y lista de motos que salen directo del HUB.
- Botón "Enviar visitas a SimpliRoute" → consola (P8) con `POST /v1/routes/visits/` simulado.

### P4. Encargado de la Torre (vista celular)
- "Torre Miraflores · Estacionado 05:58 · 6 cuadrantes".
- Lista de bolsas por cuadrante y motorizado con estado (entregada / en camino / recarga 2.ª bolsa ~10:00).
- Botón **"📷 Escanear bolsa"** que simula un escaneo: si es la bolsa correcta → ✓; si se simula una bolsa equivocada → alerta roja "Esta bolsa es de P-08, no de P-09".
- Contador de carga correcta de la Torre.

### P5. Motorizado (vista celular genérica, ilustrativa)
- Encabezado: "Tu ruta de hoy · Zona P-09 · Inicio: Torre Miraflores (5 min de tu cuadrante)".
- Mapa de la ruta ordenada (línea con paradas numeradas) y lista de paradas con ETA; **parada de recarga en la Torre** resaltada.
- Comparación chica: "Antes: inicio en HUB VES (~20 km)".
- Nota visible: *"Vista ilustrativa: el motorizado usa la app de SimpliRoute de siempre; aquí solo mostramos qué cambia."*

### P6. Cliente — Día de la entrega (vista celular tipo chat genérico, no copiar WhatsApp exacto)
- Mensajes: "Tu pedido salió a ruta" (existente) → **"Nuevo: llega hoy entre 9:00 y 11:00"** (calculado con el ETA real de la simulación) → "Eres el siguiente" (existente) → "¡Entregado!".
- Etiquetas "ya existe" vs "nuevo con TORRE f.".

### P7. Gerencia / Jurado — **Comparador de escenarios** (pantalla estrella)
- Tres columnas o pestañas: **Hoy** · **Tablero f.** · **TORRE f.**, cada una con mini-mapa de rutas.
- Sliders: pedidos/día, escenario (Normal/Cyber), % con pin, distancia mínima para Torre, tamaño de mochila.
- Tabla de KPIs (sección 6.6) con flecha de mejora y color vs meta (verde si cumple 50 / 96% / 99,9%).
- Gráficos: distribución de paradas por ruta (histograma), km vacíos, % rutas a tiempo.
- **Animación opcional** de motos recorriendo rutas (acelerada) para el pitch.
- Caja "Lo que NO resuelve": capacidad física del HUB (700 ped/h) → mostrar hora estimada de fin de clasificación según volumen.

### P8. Integración — "¿Cómo se conecta con SimpliRoute?"
- Diagrama de arquitectura: falabella.com (Pin f.) → **Tablero f.** ⇄ **SimpliRoute API** → app del motorizado / mensajes al cliente; Torre como vehículo + depot.
- **Consola de API simulada** con el log de llamadas generadas por las otras pantallas (método, endpoint, JSON de ejemplo, respuesta simulada). Mapeo:
  - Cuadrantes → `Zones` · Pedidos → `Visits` (con `latitude`, `longitude`, `reference`, tags de cuadrante) · Orden → `Optimization`/`Plans` · Torre → `Vehicles` + punto de inicio de ruta · Entregas → `Webhooks` → PANAL.
- Arquitectura de código: interfaz `RoutingProvider` con `MockSimpliRouteProvider` (por defecto) y un esqueleto `SimpliRouteApiProvider` documentado (token por variable de entorno, **nunca** en el repo; base `https://api.simpliroute.com/v1/`; docs públicas: https://documentation.simpliroute.com/es/). **No hacer llamadas reales.**
- Texto: "Falta confirmar con Falabella si su licencia incluye acceso a la API."

### P9. Reporte de cierre y aprendizaje
- KPIs del día simulado vs metas.
- "El cuadrante aprende": lista de ajustes propuestos para la próxima semana generados a partir de la simulación (p. ej. "P-21 promedió 4,6 min/parada (lento) → ceder 1 casilla a P-23"). Mostrar mapa antes/después.

### P10. Supuestos y fuentes
- Tabla editable de supuestos (sección 5.3) con botón "restaurar valores".
- Separar claramente: **Dato del reto (PPT/bases)** · **Insight de la entrevista** · **Supuesto del equipo**.

### Modo demo guiado (~3 min, para el pitch)
Secuencia automática con botón "siguiente" y narración en pantalla (texto corto):
1. Problema (P0) → 2. Ana compra con Pin f. (P1) → 3. El planificador publica cuadrantes (P2) → 4. 02:30: asignación en milisegundos (P3) → 5. La Torre sale y escanea (P4) → 6. Carlos recarga cerca (P5) → 7. Ana recibe su ventana de 2 h (P6) → 8. Resultados Hoy vs PANAL vs PANAL+Torre (P7) → 9. Se integra con SimpliRoute (P8).
Historia: **Ana** (cliente en Miraflores, compra audífonos el jueves 21:00) y **Carlos** (motorizado del cuadrante P-09).

---

## 8. Identidad visual

- **Colores:** lima Falabella `#C6D420`, verde oscuro `#12301F` / `#1C4A2F`, verde `#7DBA29`, turquesa Innova Ulima `#00808D`, naranja Innova Ulima `#F26B21`, fondo crema `#F6F8EC`, texto `#1E2A22`. Cuadrantes: paleta de 6–7 colores suaves distinguibles.
- **Tipografía:** Poppins (paquete `@fontsource/poppins`, pesos 400/600/700/800).
- **Recursos en `public/brand/`:** `falabella.png` (logotipo), `f.svg` ("f." blanca), `innova.png` (Innova Ulima), `torre.svg` (pieza Torre, favicon).
- Estética: tarjetas redondeadas, casillas en rombo y la pieza Torre como motivo gráfico (ajedrez), mucho aire, legible en proyector. **Nada de abejas, panales ni hexágonos.**
- Accesibilidad: contraste AA, no depender solo del color (usar números/etiquetas).

---

## 9. Estructura sugerida del repositorio

```
cuadrante-torre/
├─ CLAUDE.md                 ← este archivo
├─ README.md                 ← para el jurado (qué es, link a la demo, cómo usar)
├─ docs/                     ← contexto, datos, supuestos, insights, fuentes
├─ public/brand/, public/data/
├─ src/
│  ├─ sim/                   ← generadores, grid (rombos), cuadrantes, torres, baseline, rutas, KPIs (+ tests)
│  ├─ integration/           ← RoutingProvider, MockSimpliRouteProvider, SimpliRouteApiProvider (esqueleto)
│  ├─ store/                 ← zustand
│  ├─ screens/               ← P0…P10
│  ├─ components/            ← PhoneFrame, LaptopFrame, KpiCard, MapKit, ApiConsole, DemoTour…
│  └─ workers/               ← simulación en Web Worker
└─ .github/workflows/deploy.yml
```

---

## 10. Plan de trabajo (fases con entregable visible)

1. **Base:** Vite + React + TS + Tailwind + router + layout + selector de rol + colores/fuentes + P0. Deploy a GitHub Pages funcionando desde el día 1.
2. **Datos y mapa:** geografía de Lima, generador de pedidos con semilla, mapa con casillas en rombo.
3. **Motor:** baseline, cuadrantes, torres, asignación, secuenciación, KPIs + **tests**.
4. **Pantallas de oficina:** P2, P3, P7, P9, P10.
5. **Pantallas celular:** P1, P4, P5, P6 (componente `PhoneFrame`).
6. **Integración:** P8 + consola de API alimentada por las acciones de las otras pantallas.
7. **Modo demo + pulido:** tour de 3 min, animaciones, rendimiento, README con capturas.

Al final de cada fase: `npm run build` sin errores, tests en verde, commit con mensaje claro y explicación simple al usuario de qué puede ver y dónde.

## 11. Criterios de aceptación

- [ ] Se abre desde un link de GitHub Pages sin instalar nada.
- [ ] Las 11 pantallas + modo demo funcionan y se navegan con el selector de rol.
- [ ] Los KPIs cambian al mover los sliders y salen de la simulación (no hardcodeados).
- [ ] Misma semilla → mismos resultados (demo reproducible).
- [ ] Asignación nocturna de 4.000 pedidos en < 50 ms en una laptop normal (y se muestra el tiempo medido).
- [ ] Se ven cuadrantes que cruzan distritos y las torres en el mapa.
- [ ] La consola de integración muestra las llamadas simuladas a SimpliRoute con el mapeo correcto.
- [ ] Todo dato muestra su tipo: dato del reto / insight / supuesto.
- [ ] Pie con "No es material oficial de Falabella · Datos simulados".
- [ ] Se ve bien en 1280×720 (proyector) y en celular.
- [ ] Tests de `src/sim/` en verde; `README.md` con capturas, link y guía de 1 minuto para el jurado.

## 12. Reglas

- No hacer llamadas reales a SimpliRoute ni a ninguna API con credenciales. Ningún secreto en el repo.
- No imitar la interfaz ni el logo de SimpliRoute ni de WhatsApp; usar vistas genéricas y decir "ilustrativa".
- No usar nombres reales de personas de Falabella ni datos reales de clientes.
- No presentar supuestos como datos reales.
- Mantener el foco: **demostrar que la solución funciona y que se entiende en 3 minutos.**
