# Fuentes
- Bases oficiales: "Bases Innovathon con Saga Falabella" (Universidad de Lima / Innova Ulima, 2026).
- PPT "Innovathon ULIMA x Falabella" (contexto logístico, capacidades, flujo HD Lima).
- PPT "Taller de Ideación Innovathon Falabella" (Innova Ulima).
- Entrevista grupal con el equipo de Falabella, 14/11/2026 (ver insights-entrevista.md, anonimizado).
- API pública de SimpliRoute: https://documentation.simpliroute.com/es/ (Visitas, Planes, Rutas, Vehículos, Zonas, Webhooks, Optimización).
- Teselas de mapa: © colaboradores de OpenStreetMap (tile.openstreetmap.org, uso ligero para demo). Opcional: Google Maps (Maps JavaScript API + Geocoding API) con clave restringida, mostrado vía leaflet.gridlayer.googlemutant (usa la API oficial).
- GeoJSON de distritos de Lima: límites del INEI publicados en https://github.com/juaneladio/peru-geojson (`peru_distrital_simple.geojson`), filtrado a la provincia de Lima y simplificado en `src/data/lima-distritos.json` y `public/data/lima-distritos.geojson`. Nota: Pueblo Libre aparece como "MAGDALENA VIEJA" (nombre oficial).
