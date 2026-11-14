# Insights de la entrevista con el equipo de Falabella (taller del 14/11/2026)

> Resumen anonimizado de la transcripción (no se publican nombres ni la grabación). Cada insight indica cómo influyó en la solución.

| # | Lo que dijeron (parafraseado) | Implicancia para PANAL + COLMENA |
|---|---|---|
| 1 | Usan **SimpliRoute** (licencia SaaS) para armar rutas y hacer seguimiento; la app del motorizado es intuitiva y los recurrentes la usan con facilidad. | Integrarse vía API; no crear app nueva para el motorizado. |
| 2 | Muchas direcciones **no tienen coordenadas** porque la web no obliga a marcar el punto; hay que buscarlas en Google. Todos los sistemas de ruteo usan las coordenadas como input. | **Pin f.** en el checkout + geocodificación automática. |
| 3 | Trabajan con **rutas estáticas**: los primeros pedidos que caen van armando rutas; lo que llega después se rutea según la dispersión. El motorizado se entera de su ruta al cargar. | PANAL cambia "orden de llegada" por "cercanía" y precalcula de día. |
| 4 | El sistema trabaja con **tallas por volumen** (XS3, XS2, S…) en dm³ y calcula cuánto entra en la mochila; estándar ~50 pedidos por motorizado. Si no entra, hay que hacer otra vuelta. | Panales dimensionados por volumen y tiempo; recarga en Colmena. |
| 5 | Mencionaron la opción de una **unidad (minivan) llena de pedidos que alimente a la moto** en su zona, y que los motorizados **no tienen que volver obligatoriamente**: pueden recargar en tiendas. | Nace la **COLMENA**. |
| 6 | En **Cyber** las motos han salido a las 8–9 a. m. en vez de las 7 y no terminan de entregar; hubo problemas hace ~1 año en la transferencia al HUB y su procesamiento; este año mejoró con el proveedor. | Mapas Cyber precalculados + 2.ª minivan de relevo. |
| 7 | El 60% de la oleada de 02:30 se explica por la curva de ventas (sube desde las 17:00–18:00 hasta medianoche); la propuesta de valor es la velocidad (24 h). | No se puede adelantar ese volumen → decidir de día, ejecutar de noche. |
| 8 | La visibilidad del cliente **no es buena**: la ventana inicial es muy amplia (≈ "de 8 a 8"); hoy envían mensaje de "salió a ruta" y "tu pedido es el siguiente" con link de seguimiento. | **Ventana de 2 h** a las 07:00 (mensaje nuevo sobre el canal existente). |
| 9 | Se **paga al transporte por paquete entregado**; para Falabella la pérdida directa es baja, la sufren el cliente y el transportista. | El ahorro de rutas/km beneficia al proveedor; para Falabella el valor es OTD, cliente y Cyber. |
| 10 | Marcas falsas de "cliente no estaba" se controlan con la latitud/longitud de la marca. | Fuera de alcance (ya lo controlan). |
| 11 | "En teoría SimpliRoute aprende de los cambios del motorizado… no sé cómo probarlo." | Reporte de aprendizaje **medible** en PANAL. |
| 12 | El producto *same day* ya usa **tiendas como puntos de salida** de última milla. | Respaldo para puntos Colmena / panales híbridos. |
| 13 | Si la dirección es errada, servicio al cliente contacta al cliente, actualiza la dirección y se reintenta (mismo día si está en el cuadrante). | Pin f. reduce reintentos. |
