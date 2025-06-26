// components/MapWithForm.js

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Popup,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Chargement dynamique du clustering (SSR désactivé)
const MarkerClusterGroup = dynamic(
  () => import('react-leaflet-markercluster').then(m => m.default),
  { ssr: false }
)

// Icône avatar ronde via DivIcon
const createAvatarIcon = url =>
  L.divIcon({
    html: `
      <div style="
        width: 40px; height: 40px;
        border-radius: 50%; overflow: hidden;
        border: 2px solid white; box-shadow: 0 0 2px rgba(0,0,0,0.5);
      ">
        <img src="${url}" style="width:100%;height:100%;object-fit:cover" />
      </div>
    `,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  })

function getRandomPointInCircle(center, radiusMeters) {
  const rd = radiusMeters / 111320
  const u = Math.random(), v = Math.random()
  const w = rd * Math.sqrt(u), t = 2 * Math.PI * v
  const dy = w * Math.sin(t)
  const dx = (w * Math.cos(t)) / Math.cos(center.lat * Math.PI/180)
  return { lat: center.lat + dy, lng: center.lng + dx }
}

function ClickControl({ onClick }) {
  useMapEvents({ click: onClick })
  return null
}

export default function MapWithForm() {
  const [profiles, setProfiles]               = useState([])
  const [anonRadius, setAnonRadius]           = useState(1000)
  const [clickCircle, setClickCircle]         = useState(null)
  const [profileCircle, setProfileCircle]     = useState(null)
  const [selectedProfile, setSelectedProfile] = useState(null)
  const [selectedPos, setSelectedPos]         = useState(null)

  const [showForm, setShowForm]               = useState(false)
  const [formData, setFormData]               = useState({ pseudo:'', description:'', avatar:null })
  const [showSuccess, setShowSuccess]         = useState(false)
  const [showWelcome, setShowWelcome]         = useState(true)

  useEffect(() => {
    fetch('/api/getProfiles')
      .then(r => r.json())
      .then(setProfiles)
      .catch(console.error)
  }, [])

  const handleMapClick = e => {
    const rand = getRandomPointInCircle(e.latlng, anonRadius)
    setClickCircle({ center: rand, radius: anonRadius })
    setSelectedPos(rand)
    setShowForm(true)
    setProfileCircle(null)
    setSelectedProfile(null)
  }

  const handleProfileClick = p => {
    setProfileCircle({ center:{ lat:p.lat, lng:p.lng }, radius:p.anon_radius })
    setSelectedProfile(p)
    setShowForm(false)
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!selectedPos) return
    const { pseudo, description, avatar } = formData

    setShowSuccess(true)
    setFormData({ pseudo:'', description:'', avatar:null })
    setShowForm(false)

    const fd = new FormData()
    fd.append('pseudo', pseudo)
    fd.append('description', description)
    fd.append('anon_radius', anonRadius)
    fd.append('lat', selectedPos.lat)
    fd.append('lng', selectedPos.lng)
    fd.append('avatar', avatar)

    try {
      const res = await fetch('/api/submit',{ method:'POST', body:fd })
      if (res.ok) fetch('/api/getProfiles').then(r=>r.json()).then(setProfiles)
    } catch(err){ console.error(err) }

    setTimeout(()=>setShowSuccess(false),2000)
  }

  const clusterIconCreate = cluster => {
    const markers = cluster.getAllChildMarkers()
    const count   = markers.length
    const avatars = markers.slice(0,4).map(m => {
      const html = m.options.icon.options.html||''
      const match = html.match(/src="([^"]+)"/)
      return match ? match[1] : ''
    })
    const size = 48
    const html = `
      <div style="position:relative;width:${size}px;height:${size}px">
        ${avatars.map((url,i)=>{ const half=size/2
          return `<img src="${url}" style="
            position:absolute; top:${i<2?0:half}px; left:${(i%2)*half}px;
            width:${half}px; height:${half}px;
            border-radius:50%; border:2px solid white;
          "/>`
        }).join('')}
        ${count>4?`<div style="
          position:absolute; bottom:0; right:0;
          width:${size/2}px; height:${size/2}px;
          background:rgba(0,0,0,0.6); color:white;
          font-size:12px; display:flex;
          align-items:center; justify-content:center;
          border-radius:50%;
        ">+${count-4}</div>`:''}
      </div>
    `
    return L.divIcon({ html, className:'', iconSize:L.point(size,size) })
  }

  return (
    <>
      <style jsx global>{`
        .app-layout {
          display: grid;
          grid-template-areas:
            "header header header"
            "sidebar-left main sidebar-right"
            "footer footer footer";
          grid-template-columns: 200px 1fr 200px;
          grid-template-rows: 60px 1fr 60px;
          height: 100vh;
        }
        .header {
          grid-area: header;
          background: linear-gradient(90deg,#FFC0CB,#FF69B4);
          color:white; display:flex;
          align-items:center; justify-content:center;
          font-size:1.4rem; font-weight:bold;
        }
        .sidebar-left,
        .sidebar-right {
          background:#f8f0f8;
          overflow:hidden;
          display:flex; align-items:center; justify-content:center;
        }
        .sidebar-left { grid-area:sidebar-left; }
        .sidebar-right{ grid-area:sidebar-right; }

        /* PC/TABLETTE : images 80%×90% */
        .sidebar-left img,
        .sidebar-right img {
          width: 80%;
          height: 90%;
          object-fit: cover;
          margin: auto;
          display: block;
        }

        /* MOBILE : one-column layout, hide sidebars */
        @media (max-width: 768px) {
          .app-layout {
            grid-template-areas:
              "header"
              "main"
              "footer";
            grid-template-columns: 1fr;
            grid-template-rows: 60px 1fr 60px;
          }
          .sidebar-left,
          .sidebar-right {
            display: none;
          }
        }

        .main { grid-area: main; position:relative; }
        .footer {
          grid-area: footer;
          background:#333; color:white;
          display:flex; align-items:center;
          justify-content:center; font-size:0.9rem;
        }

        .welcome-overlay {
          position: fixed; top:0; left:0; right:0; bottom:0;
          background: rgba(0,0,0,0.75);
          display:flex; align-items:center; justify-content:center;
          z-index:3000;
        }
        .welcome-box {
          background:white; padding:32px;
          max-width:400px; border-radius:8px;
          text-align:center;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        .welcome-box h2 { margin-bottom:0.5em; }
        .welcome-box p  { margin-bottom:1.5em; }
        .welcome-box button {
          background:#FF69B4; color:white; border:none;
          padding:10px 20px; border-radius:6px;
          cursor:pointer; font-size:1rem;
        }
        @keyframes popIn {
          0%{transform:scale(0);opacity:0}
          80%{transform:scale(1.2);opacity:1}
          100%{transform:scale(1);opacity:1}
        }
        .popup-success {
          position:absolute; top:50%; left:50%;
          width:320px; padding:32px;
          transform:translate(-50%,-50%) scale(0);
          background:white; border-radius:12px;
          box-shadow:0 6px 20px rgba(0,0,0,0.3);
          text-align:center; z-index:2000;
          animation:popIn .25s ease-out forwards;
        }
      `}</style>

      {showWelcome && (
        <div className="welcome-overlay">
          <div className="welcome-box">
            <h2>Welcome on FemboyMap</h2>
            <p>Clique sur la carte pour ajouter ton profil et découvrir les autres !</p>
            <button onClick={()=>setShowWelcome(false)}>Let’s go!</button>
          </div>
        </div>
      )}

      <div className="app-layout">
        <header className="header">
          🌸 Welcome on FemboyMap 🌸
        </header>

        <aside className="sidebar-left">
          <img src="/femboy1.png" alt="Femboy 1" />
        </aside>
        <aside className="sidebar-right">
          <img src="/femboy2.png" alt="Femboy 2" />
        </aside>

        <main className="main">
          <MapContainer
            center={[46.5,2.5]}
            zoom={5}
            style={{ height: '100%', width: '100%', cursor: 'crosshair' }}
            attributionControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MarkerClusterGroup
              showCoverageOnHover={false}
              iconCreateFunction={clusterIconCreate}
            >
              {profiles.map(p => (
                <Marker
                  key={p.id}
                  position={[p.lat, p.lng]}
                  icon={createAvatarIcon(p.avatar_url)}
                  eventHandlers={{ click: () => handleProfileClick(p) }}
                />
              ))}
            </MarkerClusterGroup>

            {clickCircle && (
              <Circle
                center={clickCircle.center}
                radius={clickCircle.radius}
                pathOptions={{ color: 'blue', fillOpacity: 0.1 }}
              />
            )}
            {profileCircle && (
              <Circle
                center={profileCircle.center}
                radius={profileCircle.radius}
                pathOptions={{ color: 'purple', fillOpacity: 0.05 }}
              />
            )}

            <ClickControl onClick={handleMapClick} />

            {selectedProfile && (
              <Popup
                position={[selectedProfile.lat, selectedProfile.lng]}
                onClose={() => setSelectedProfile(null)}
              >
                <div style={{ textAlign: 'center' }}>
                  <img
                    src={selectedProfile.avatar_url}
                    width={60}
                    height={60}
                    style={{ borderRadius: '50%', marginBottom: 8 }}
                  />
                  <strong>{selectedProfile.pseudo}</strong>
                  <p style={{ margin: '4px 0 0' }}>
                    {selectedProfile.description}
                  </p>
                </div>
              </Popup>
            )}
          </MapContainer>

          {showForm && (
            <div style={{
              position: 'absolute',
              top: 20,
              right: 20,
              width: 340,
              background: 'white',
              padding: 20,
              boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
              zIndex: 1000
            }}>
              <button
                onClick={() => setShowForm(false)}
                style={{
                  float: 'right',
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.4rem',
                  cursor: 'pointer'
                }}
              >×</button>
              <h2 style={{
                color: 'var(--pink)',
                margin: '0 0 1rem',
                fontSize: '1.4rem'
              }}>Ajouter ton profil</h2>
              <form onSubmit={handleSubmit}>
                <input
                  required
                  placeholder="Pseudo"
                  value={formData.pseudo}
                  onChange={e => setFormData(f => ({ ...f, pseudo: e.target.value }))}
                  style={{ width: '100%', marginBottom: 12, padding: 8, fontSize: '1rem' }}
                />
                <textarea
                  required
                  maxLength={100}
                  placeholder="Description (100 car.)"
                  value={formData.description}
                  onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                  style={{
                    width:'100%',
                    height:80,
                    marginBottom:12,
                    padding:8,
                    fontSize:'1rem',
                    borderRadius:4,
                    border:'1px solid #ccc'
                  }}
                />
                <input
                  type="file"
                  accept="image/*"
                  required
                  onChange={e => setFormData(f => ({ ...f, avatar: e.target.files[0] }))}
                  style={{ width:'100%', marginBottom:16 }}
                />
                <button
                  type="submit"
                  style={{
                    width:'100%',
                    padding:12,
                    background:'var(--pink)',
                    border:'none',
                    borderRadius:8,
                    cursor:'pointer',
                    fontSize:'1rem'
                  }}
                >Envoyer</button>
              </form>
            </div>
          )}

          {showSuccess && (
            <div className="popup-success">
              <div style={{ fontSize: '2.5rem' }}>🎉</div>
              <h2>Félicitations !</h2>
              <p>Ta demande a été envoyée !</p>
            </div>
          )}
        </main>

        <footer className="footer">
          Contact : Discord <strong> Firock_</strong> | Insta <strong> stupid_femboy_</strong>
        </footer>
      </div>
    </>
  )
}
