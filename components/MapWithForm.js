import { useState, useEffect } from 'react'
import dynamic               from 'next/dynamic'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMapEvents,
} from 'react-leaflet'
import L                     from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase }          from '../lib/supabaseClient'

// Cluster dynamique
const MarkerClusterGroup = dynamic(
  () => import('react-leaflet-markercluster').then(mod => mod.default),
  { ssr: false }
)

function ClickControl({ onClick, disabled }) {
  const map = useMapEvents({ click(e) { if (!disabled) onClick(e) } })
  useEffect(() => {
    if (!map) return
    if (disabled) {
      map.dragging.disable()
      map.scrollWheelZoom.disable()
    } else {
      map.dragging.enable()
      map.scrollWheelZoom.enable()
    }
  }, [map, disabled])
  return null
}

function getRandomPointInCircle(center, r) {
  const rd = r/111320, u = Math.random(), v = Math.random()
  const w = rd * Math.sqrt(u), t = 2*Math.PI*v
  const dy = w*Math.sin(t)
  const dx = w*Math.cos(t)/Math.cos(center.lat*Math.PI/180)
  return { lat: center.lat+dy, lng: center.lng+dx }
}

export default function MapWithForm() {
  const [showStart, setShowStart]       = useState(true)
  const [profiles, setProfiles]         = useState([])
  const [anonRadius, setAnonRadius]     = useState(1000)
  const [clickCircle, setClickCircle]   = useState(null)
  const [selectedPos, setSelectedPos]   = useState(null)
  const [showForm, setShowForm]         = useState(false)
  const [formData, setFormData]         = useState({ pseudo: '', avatar: null, description: '' })

  useEffect(() => {
    fetch('/api/getProfiles')
      .then(r => r.json())
      .then(data => setProfiles(Array.isArray(data)?data:[]))
  }, [])

  const handleMapClick = e => {
    const rand = getRandomPointInCircle(e.latlng, anonRadius)
    setClickCircle({ center: rand, radius: anonRadius })
    setSelectedPos(rand)
    setShowForm(true)
  }
  const closeForm = () => {
    setShowForm(false)
    setClickCircle(null)
    setSelectedPos(null)
    setFormData({ pseudo:'', avatar:null, description:'' })
  }
  const handleSubmit = async e => {
    e.preventDefault()
    if (!selectedPos) return
    const fd = new FormData()
    fd.append('pseudo', formData.pseudo)
    fd.append('lat', selectedPos.lat)
    fd.append('lng', selectedPos.lng)
    fd.append('description', formData.description)
    fd.append('avatar', formData.avatar)
    const res = await fetch('/api/submit', { method:'POST', body:fd })
    if (res.ok) { alert('En attente de modération !'); closeForm(); }
    else { const err = await res.json(); alert('Erreur : '+err.error) }
  }

  const createAvatarIcon = url => new L.Icon({
    iconUrl: url,
    iconSize: [40,40],
    iconAnchor: [20,40],
    popupAnchor: [0,-40],
  })

  return (
    <div style={{ position:'relative', height:'100vh', width:'100%' }}>
      {/* — ÉCRAN D’ACCUEIL — */}
      {showStart && (
        <div style={{
          position:'absolute', top:0, left:0,
          width:'100vw', height:'100vh',
          background:'rgba(0,0,0,0.5)', display:'flex',
          alignItems:'center', justifyContent:'center',
          zIndex:2000
        }}>
          <div style={{
            width:300, height:300,
            background:'white', borderRadius:8,
            boxShadow:'0 4px 12px rgba(0,0,0,0.3)',
            display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center',
            padding:16, textAlign:'center'
          }}>
            {/* Tu pourras remplacer ce texte par une image */}
            <div style={{ marginBottom:24 }}>Bienvenue !</div>
            <button
              onClick={()=>setShowStart(false)}
              style={{
                padding:'8px 16px',
                border:'none',
                borderRadius:4,
                background:'var(--pink)',
                color:'white',
                cursor:'pointer',
                fontSize:'1rem'
              }}
            >
              Start
            </button>
          </div>
        </div>
      )}

      {/* — SÉLECTEUR DE RAYON — */}
      <div style={{
        position:'absolute', top:10, left:10, zIndex:1000,
        background:'white', padding:'8px 12px',
        borderRadius:4, boxShadow:'0 2px 6px rgba(0,0,0,0.2)'
      }}>
        <label>
          Rayon :
          <select
            value={anonRadius}
            onChange={e=>setAnonRadius(Number(e.target.value))}
            style={{ marginLeft:8 }}
          >
            <option value={500}>0.5 km</option>
            <option value={1000}>1 km</option>
            <option value={3000}>3 km</option>
            <option value={5000}>5 km</option>
          </select>
        </label>
      </div>

      {/* — LA CARTE — */}
      <MapContainer
        center={[46.5,2.5]}
        zoom={5}
        style={{ height:'100%', width:'100%', cursor:'crosshair' }}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <MarkerClusterGroup>
          {profiles.map(p=>(
            <Marker
              key={p.id}
              position={[p.lat,p.lng]}
              icon={createAvatarIcon(p.avatar_url)}
            >
              <Popup>
                <strong>{p.pseudo}</strong>
                {p.description && (
                  <p style={{ marginTop:8, fontStyle:'italic' }}>
                    {p.description}
                  </p>
                )}
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>

        {clickCircle && (
          <Circle
            center={clickCircle.center}
            radius={clickCircle.radius}
            pathOptions={{ color:'blue', fillOpacity:0.1 }}
          />
        )}

        <ClickControl onClick={handleMapClick} disabled={showForm||showStart} />
      </MapContainer>

      {/* — FORMULAIRE — */}
      {showForm && (
        <div style={{
          position:'absolute', top:20, right:20,
          width:320, background:'white', padding:16,
          boxShadow:'0 2px 10px rgba(0,0,0,0.3)',
          zIndex:1000
        }}>
          <button onClick={closeForm}
            style={{
              float:'right', background:'transparent',
              border:'none', fontSize:'1.2rem',
              cursor:'pointer'
            }}>×</button>
          <h2 style={{ color:'var(--pink)', margin:'0 0 1rem' }}>
            Ajouter ton profil
          </h2>
          <form onSubmit={handleSubmit}>
            <input
              required placeholder="Pseudo"
              value={formData.pseudo}
              onChange={e=>setFormData(f=>({ ...f, pseudo:e.target.value }))}
              style={{ width:'100%', marginBottom:8 }}
            />
            <textarea
              placeholder="Description (max 100 chars)"
              maxLength={100}
              value={formData.description}
              onChange={e=>setFormData(f=>({ ...f, description:e.target.value }))}
              style={{
                width:'100%', height:60, marginBottom:8,
                resize:'none', fontSize:'0.9rem'
              }}
            />
            <input
              type="file" accept="image/*" required
              onChange={e=>setFormData(f=>({ ...f, avatar:e.target.files[0] }))}
              style={{ width:'100%', marginBottom:12 }}
            />
            <button type="submit"
              style={{
                background:'var(--pink)',
                border:'none', padding:'8px',
                borderRadius:8, cursor:'pointer',
                width:'100%'
              }}
            >Envoyer</button>
          </form>
        </div>
      )}
    </div>
  )
}
