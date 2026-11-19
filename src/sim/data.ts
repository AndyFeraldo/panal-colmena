// Datos de referencia: docs/datos-del-reto.md
// Pesos por distrito: los 3 primeros son lectura del PPT [RETO aprox.], el resto cola sintética [SUPUESTO].
import geo from '../data/lima-distritos.json'

export interface LatLng {
  lat: number
  lng: number
}

export interface District {
  name: string
  geoName: string // nombre en el GeoJSON (INEI)
  weight: number // normalizado a 1
  center: LatLng
  radiusKm: number
}

const RAW: [string, string, number, number, number, number][] = [
  ['Santiago de Surco', 'SANTIAGO DE SURCO', 15.9, -12.145, -76.993, 3.0],
  ['Miraflores', 'MIRAFLORES', 10.8, -12.1211, -77.0297, 1.4],
  ['San Isidro', 'SAN ISIDRO', 7.5, -12.0977, -77.0365, 1.3],
  ['La Molina', 'LA MOLINA', 3.9, -12.086, -76.935, 3.0],
  ['San Borja', 'SAN BORJA', 3.8, -12.108, -76.999, 1.5],
  ['San Juan de Lurigancho', 'SAN JUAN DE LURIGANCHO', 3.7, -11.98, -77.0, 3.0],
  ['San Miguel', 'SAN MIGUEL', 3.1, -12.077, -77.091, 1.5],
  ['Surquillo', 'SURQUILLO', 3.0, -12.113, -77.012, 0.9],
  ['Jesús María', 'JESUS MARIA', 3.0, -12.078, -77.048, 1.0],
  ['Los Olivos', 'LOS OLIVOS', 3.0, -11.97, -77.07, 1.8],
  ['Chorrillos', 'CHORRILLOS', 2.9, -12.17, -77.015, 2.0],
  ['San Martín de Porres', 'SAN MARTIN DE PORRES', 2.9, -12.005, -77.09, 2.5],
  ['Ate', 'ATE', 2.8, -12.026, -76.92, 3.0],
  ['Lince', 'LINCE', 2.6, -12.084, -77.034, 0.8],
  ['Magdalena del Mar', 'MAGDALENA DEL MAR', 2.5, -12.092, -77.07, 0.9],
  ['Pueblo Libre', 'MAGDALENA VIEJA', 2.5, -12.075, -77.064, 1.0],
  ['Lima (Cercado)', 'LIMA', 2.4, -12.0464, -77.0428, 2.0],
  ['Barranco', 'BARRANCO', 2.2, -12.149, -77.021, 0.8],
  ['San Juan de Miraflores', 'SAN JUAN DE MIRAFLORES', 1.9, -12.156, -76.97, 2.0],
  ['La Victoria', 'LA VICTORIA', 1.9, -12.073, -77.016, 1.2],
  ['Comas', 'COMAS', 1.8, -11.933, -77.05, 2.5],
  ['Santa Anita', 'SANTA ANITA', 1.5, -12.043, -76.97, 1.3],
  ['Villa María del Triunfo', 'VILLA MARIA DEL TRIUNFO', 1.4, -12.163, -76.955, 2.5],
  ['Villa El Salvador', 'VILLA EL SALVADOR', 1.4, -12.213, -76.937, 2.5],
  ['Breña', 'BREÑA', 1.2, -12.06, -77.05, 0.8],
  ['Rímac', 'RIMAC', 1.0, -12.03, -77.03, 1.2],
  ['San Luis', 'SAN LUIS', 1.0, -12.076, -76.995, 0.9],
  ['Puente Piedra', 'PUENTE PIEDRA', 0.9, -11.867, -77.075, 3.0],
  ['Independencia', 'INDEPENDENCIA', 0.7, -11.99, -77.05, 1.5],
  ['Carabayllo', 'CARABAYLLO', 0.6, -11.85, -77.03, 3.0],
]

const total = RAW.reduce((s, r) => s + r[2], 0)

export const DISTRICTS: District[] = RAW.map(([name, geoName, w, lat, lng, r]) => ({
  name,
  geoName,
  weight: w / total,
  center: { lat, lng },
  radiusKm: r,
}))

// GeoJSON de distritos de la provincia de Lima (INEI, vía github.com/juaneladio/peru-geojson)
export type DistrictFeature = {
  type: 'Feature'
  properties: { name: string; ubigeo: string }
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] }
}
export const DISTRICT_GEOJSON = geo as unknown as { type: 'FeatureCollection'; features: DistrictFeature[] }

// HUB XD Villa El Salvador [RETO: ~1,9 km del CD; coordenada aproximada]
export const HUB: LatLng & { name: string } = { name: 'HUB XD Villa El Salvador', lat: -12.225, lng: -76.93 }

export interface TorreZone extends LatLng {
  id: string
  name: string
  short: string
  store: string // tienda Saga de la zona: la Torre pasa por ahí en su ronda (abastece y espera seguro)
}

// Zonas Torre candidatas [SUPUESTO]. Cada coordenada es la "tienda Saga de la zona" (ubicación genérica,
// no una tienda real específica). Solo se usan las 1–2 que más ahorran (maxTorres).
export const TORRE_ZONES: TorreZone[] = [
  { id: 'C-NOR', short: 'Lima Norte', name: 'Torre Lima Norte', store: 'Tienda Saga Lima Norte', lat: -11.993, lng: -77.062 },
  { id: 'C-MIR', short: 'Miraflores', name: 'Torre Miraflores', store: 'Tienda Saga Miraflores', lat: -12.119, lng: -77.03 },
  { id: 'C-SIS', short: 'San Isidro', name: 'Torre San Isidro', store: 'Tienda Saga San Isidro', lat: -12.096, lng: -77.035 },
  { id: 'C-SMI', short: 'San Miguel', name: 'Torre San Miguel', store: 'Tienda Saga San Miguel', lat: -12.077, lng: -77.085 },
  { id: 'C-EST', short: 'Lima Este', name: 'Torre Lima Este', store: 'Tienda Saga Lima Este', lat: -12.005, lng: -76.99 },
]

// Ana: cliente de la historia (Los Olivos, Lima Norte: lejos del HUB; compra audífonos el jueves 21:00)
export const ANA = {
  id: 'F-208341',
  name: 'Ana',
  district: 'Los Olivos',
  lat: -11.9705,
  lng: -77.0715,
  address: 'Calle Los Jazmines 245, Los Olivos',
  reference: 'Casa verde de 2 pisos, frente al parque',
  product: 'Audífonos inalámbricos',
}

// Nombres genéricos de motorizados (sintéticos)
export const RIDER_NAMES = [
  'Carlos', 'Luis', 'Rosa', 'Pedro', 'Miguel', 'Lucía', 'Jorge', 'Diana', 'Raúl', 'Elena', 'Víctor', 'Sofía',
  'Andrés', 'Paola', 'Hugo', 'Marta', 'Iván', 'Gaby', 'Óscar', 'Nadia', 'Felipe', 'Karen', 'Tomás', 'Julia',
]

export const STREETS = [
  'Av. Larco', 'Calle Berlín', 'Av. Benavides', 'Jr. Tacna', 'Av. Arequipa', 'Calle Schell', 'Av. Primavera',
  'Av. Angamos', 'Jr. Huancavelica', 'Av. Brasil', 'Av. La Marina', 'Calle Las Begonias', 'Av. Javier Prado',
  'Av. Universitaria', 'Av. Próceres', 'Calle Los Pinos', 'Jr. Ica', 'Av. Salaverry', 'Av. Caminos del Inca',
  'Calle Monte Rosa', 'Av. Aviación', 'Av. Canadá', 'Av. El Sol', 'Calle Alcanfores',
]
