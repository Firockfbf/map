// pages/_app.js

import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import '../styles/globals.css'

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}
