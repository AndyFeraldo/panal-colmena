# Datos del reto y geografía de referencia

> Tipos de dato: **[RETO]** = bases/PPT oficiales · **[ENTREVISTA]** = dicho por el equipo de Falabella · **[SUPUESTO]** = estimación del equipo (editable en la app).

## 1. Reto y metas [RETO]
- Pregunta: ¿Cómo podemos sectorizar los pedidos miniticket de despacho a domicilio para hacer rutas estáticas eficientes en Lima Metropolitana?
- Restricción: poco margen de tiempo en el procesamiento nocturno para sectorizar por ruta dinámica.
- Metas: **OTD 96%** · **SPR 50 paradas por ruta** · **99,9% nivel de servicio de carga**.

## 2. Operación (PPT de Falabella) [RETO]
| Dato | Valor |
|---|---|
| Venta con entrega al día siguiente | 00:00–23:59 (100% si Falabella maneja stock); sellers 00:00–16:59 (50%) |
| CD Villa El Salvador | 48.000 m² · recibo 35.000 ped/día · empaque 80.000 ped/día · despacho 150.000 ped/día |
| HUB cross-docking (XD) | 2.500 m² · **700 pedidos/hora** · ~1,9 km del CD (VES) |
| Oleadas CD → HUB | 14:00 = 15% · 19:00 = 25% · 02:30 = 60% |
| Ruteo estático actual | Primeros 50 pedidos del distrito = 1 ruta |
| Turnos de motorizado | 06:00–11:00 · 12:00–17:00 · 18:00–21:00 |
| Indicadores nacionales | 45% de pedidos en ≤24 h · 80% en ≤48 h |

[ENTREVISTA] La carga/salida real de motos en la mañana se mencionó cerca de las 07:00 (en Cyber 08:00–09:00). Usar 06:00 como inicio de turno oficial y mostrar el 07:00 como referencia.

## 3. Volumen diario [SUPUESTO]
No se conoce el volumen diario de miniticket a domicilio en Lima. Usar **4.000 pedidos/día** por defecto (slider 2.000–8.000). Coherencia: 60% × 4.000 = 2.400 pedidos en la oleada de 02:30 → a 700 ped/h el HUB tarda ≈3,4 h (termina ≈05:56, sin holgura).

## 4. Participación por distrito [RETO aproximado + SUPUESTO]
Leída de un gráfico del PPT (aprox.). Los tres primeros son lectura directa; el resto es una cola sintética razonable. **Normalizar a 100% en el código.**

| Distrito | % | Distrito | % |
|---|---|---|---|
| Santiago de Surco | 15,9 | Lima (Cercado) | 2,4 |
| Miraflores | 10,8 | Barranco | 2,2 |
| San Isidro | 7,5 | San Juan de Miraflores | 1,9 |
| La Molina | 3,9 | La Victoria | 1,9 |
| San Borja | 3,8 | Comas | 1,8 |
| San Juan de Lurigancho | 3,7 | Santa Anita | 1,5 |
| San Miguel | 3,1 | Villa María del Triunfo | 1,4 |
| Surquillo | 3,0 | Villa El Salvador | 1,4 |
| Jesús María | 3,0 | Breña | 1,2 |
| Los Olivos | 3,0 | Rímac | 1,0 |
| Chorrillos | 2,9 | San Luis | 1,0 |
| San Martín de Porres | 2,9 | Puente Piedra | 0,9 |
| Ate | 2,8 | Independencia | 0,7 |
| Lince | 2,6 | Carabayllo | 0,6 |
| Magdalena del Mar | 2,5 | | |
| Pueblo Libre | 2,5 | | |

## 5. Coordenadas aproximadas (fallback si no hay GeoJSON) [SUPUESTO]
Centroides aproximados (lat, lng). Radio sugerido para muestreo entre 0,8 y 3 km según tamaño.

| Distrito | lat | lng | radio km |
|---|---|---|---|
| Santiago de Surco | -12.1450 | -76.9930 | 3.0 |
| Miraflores | -12.1211 | -77.0297 | 1.4 |
| San Isidro | -12.0977 | -77.0365 | 1.3 |
| La Molina | -12.0860 | -76.9350 | 3.0 |
| San Borja | -12.1080 | -76.9990 | 1.5 |
| San Juan de Lurigancho | -11.9800 | -77.0000 | 3.0 |
| San Miguel | -12.0770 | -77.0910 | 1.5 |
| Surquillo | -12.1130 | -77.0120 | 0.9 |
| Jesús María | -12.0780 | -77.0480 | 1.0 |
| Los Olivos | -11.9700 | -77.0700 | 1.8 |
| Chorrillos | -12.1700 | -77.0150 | 2.0 |
| San Martín de Porres | -12.0050 | -77.0900 | 2.5 |
| Ate | -12.0260 | -76.9200 | 3.0 |
| Lince | -12.0840 | -77.0340 | 0.8 |
| Magdalena del Mar | -12.0920 | -77.0700 | 0.9 |
| Pueblo Libre | -12.0750 | -77.0640 | 1.0 |
| Lima (Cercado) | -12.0464 | -77.0428 | 2.0 |
| Barranco | -12.1490 | -77.0210 | 0.8 |
| San Juan de Miraflores | -12.1560 | -76.9700 | 2.0 |
| La Victoria | -12.0730 | -77.0160 | 1.2 |
| Comas | -11.9330 | -77.0500 | 2.5 |
| Santa Anita | -12.0430 | -76.9700 | 1.3 |
| Villa María del Triunfo | -12.1630 | -76.9550 | 2.5 |
| Villa El Salvador | -12.2130 | -76.9370 | 2.5 |
| Breña | -12.0600 | -77.0500 | 0.8 |
| Rímac | -12.0300 | -77.0300 | 1.2 |
| San Luis | -12.0760 | -76.9950 | 0.9 |
| Puente Piedra | -11.8670 | -77.0750 | 3.0 |
| Independencia | -11.9900 | -77.0500 | 1.5 |
| Carabayllo | -11.8500 | -77.0300 | 3.0 |

- **HUB XD (aprox.):** -12.2250, -76.9300 (zona industrial de Villa El Salvador). Mostrar como "ubicación aproximada".
- La costa está al oeste/suroeste: descartar puntos en el mar (usar el GeoJSON o un polígono simple de costa).

## 6. Puntos Torre candidatos [SUPUESTO]
Nombres genéricos (no usar tiendas reales):
| Punto | lat | lng |
|---|---|---|
| Punto Torre Miraflores | -12.1190 | -77.0300 |
| Punto Torre San Isidro | -12.0960 | -77.0350 |
| Punto Torre Surco | -12.1300 | -76.9900 |
| Punto Torre Pueblo Libre | -12.0750 | -77.0550 |
| Punto Torre Los Olivos | -11.9700 | -77.0700 |
| Punto Torre SJL | -11.9900 | -77.0050 |
