declare module 'leaflet.gridlayer.googlemutant/src/Leaflet.GoogleMutant.mjs' {
  import { GridLayer, type GridLayerOptions } from 'leaflet'
  export interface GoogleMutantOptions extends GridLayerOptions {
    type?: 'roadmap' | 'satellite' | 'terrain' | 'hybrid'
    styles?: google.maps.MapTypeStyle[]
  }
  export default class GoogleMutant extends GridLayer {
    constructor(options?: GoogleMutantOptions)
  }
}
