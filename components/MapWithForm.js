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

// Chargement dynamique de MarkerClusterGroup (SSR désactivé)
const MarkerClusterGroup = dynamic(
  () => import('react-leaflet-markercluster').then(m => m.default),
  { ssr: false }
)

// Icône avatar ronde via DivIcon
const createAvatarIcon = url =>
  L.divIcon({
    html: `
      <div style="
        width: 40px;
        height: 40px;
        border-radius: 50%;
        overflow: hidden;
        border: 2px solid white;
        box-shadow: 0 0 2px rgba(0,0,0,0.5);
      ">
        <img
          src="${url}"
          style="width: 100%; height: 100%; object-fit: cover;"
          alt="avatar"
        />
      </div>
    `,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  })

// Génère un point aléatoire dans un cercle (mètres)
function getRandomPointInCircle(center, radiusMeters) {
  const rd = radiusMeters / 111320
  const u = Math.random(), v = Math.random()
  const w = rd * Math.sqrt(u), t = 2 * Math.PI * v
  const dy = w * Math.sin(t)
  const dx = (w * Math.cos(t)) / Math.cos(center.lat * Math.PI / 180)
  return { lat: center.lat + dy, lng: center.lng + dx }
}

// Écoute clics sur la carte
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
  const [formData, setFormData]               = useState({
    pseudo: '',
    description: '',
    avatar: null,
  })
  const [showContact, setShowContact]         = useState(false)

  // 1) Récupère les profils approuvés
  useEffect(() => {
    fetch('/api/getProfiles')
      .then(r => r.json())
      .then(setProfiles)
      .catch(console.error)
  }, [])

  // 2) Clic carte : cercle bleu + formulaire
  const handleMapClick = e => {
    const rand = getRandomPointInCircle(e.latlng, anonRadius)
    setClickCircle({ center: rand, radius: anonRadius })
    setSelectedPos(rand)
    setShowForm(true)
    setProfileCircle(null)
    setSelectedProfile(null)
  }

  // 3) Clic marker : cercle violet + popup
  const handleProfileClick = p => {
    setProfileCircle({ center: { lat: p.lat, lng: p.lng }, radius: p.anon_radius })
    setSelectedProfile(p)
    setShowForm(false)
    setClickCircle(null)
  }

  // 4) Envoi formulaire
  const handleSubmit = async e => {
    e.preventDefault()
    if (!selectedPos) return
    const fd = new FormData()
    fd.append('pseudo', formData.pseudo)
    fd.append('description', formData.description)
    fd.append('anon_radius', anonRadius)
    fd.append('lat', selectedPos.lat)
    fd.append('lng', selectedPos.lng)
    fd.append('avatar', formData.avatar)
    const res = await fetch('/api/submit', { method: 'POST', body: fd })
    if (res.ok) {
      alert('Profil soumis !')
      setShowForm(false)
      fetch('/api/getProfiles').then(r => r.json()).then(setProfiles)
    } else {
      const err = await res.json()
      alert('Erreur : ' + err.error)
    }
  }

  // Fonction de création d’icône de cluster avec mini-mosaïque d’avatars
  const clusterIconCreate = cluster => {
    const markers = cluster.getAllChildMarkers()
    const count   = markers.length
    const avatars = markers.slice(0, 4).map(m => m.options.icon.options.html.match(/src="([^"]+)"/)[1])
    const size    = 48

    const html = `
      <div style="position: relative; width: ${size}px; height: ${size}px;">
        ${avatars.map((url, i) => {
          const half = size / 2
          const top  = i < 2 ? 0 : half
          const left = (i % 2) * half
          return `
            <img src="${url}" style="
              position: absolute;
              top: ${top}px;
              left: ${left}px;
              width: ${half}px;
              height: ${half}px;
              border-radius: 50%;
              border: 2px solid white;
            "/>
          `
        }).join('')}
        ${count > 4
          ? `<div style="
              position: absolute;
              bottom: 0;
              right: 0;
              width: ${size/2}px;
              height: ${size/2}px;
              background: rgba(0,0,0,0.6);
              color: white;
              font-size: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 50%;
            ">+${count - 4}</div>`
          : ''
        }
      </div>
    `
    return L.divIcon({
      html,
      className: 'custom-cluster-icon',
      iconSize: L.point(size, size),
    })
  }

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      {/* Rayon */}
      <div style={{
        position: 'absolute', top: 10, left: 40, zIndex: 1000,
        background: 'white', padding: '10px 16px',
        borderRadius: 4, boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
      }}>
        <label style={{ fontSize: '1rem' }}>
          Rayon :
          <select
            value={anonRadius}
            onChange={e => setAnonRadius(Number(e.target.value))}
            style={{
              marginLeft: 12, padding: '6px 12px',
              fontSize: '1.1rem', minWidth: 120,
              borderRadius: 4, border: '1px solid #ccc'
            }}
          >
            <option value={500}>0.5 km</option>
            <option value={1000}>1 km</option>
            <option value={3000}>3 km</option>
            <option value={5000}>5 km</option>
            <option value={10000}>10 km</option>
            <option value={15000}>15 km</option>
            <option value={20000}>20 km</option>
            <option value={25000}>25 km</option>
            <option value={30000}>30 km</option>
          </select>
        </label>
      </div>

      {/* Contact */}
      <button
        onClick={() => setShowContact(true)}
        style={{
          position: 'absolute', bottom: 20, left: 20, zIndex: 1000,
          background: 'var(--pink)', color: 'white',
          border: 'none', padding: '8px 12px',
          borderRadius: 4, cursor: 'pointer'
        }}
      >Contact</button>
      {showContact && (
        <div style={{
          position: 'absolute', bottom: 60, left: 20, width: 200,
          background: 'white', padding: 16,
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)', borderRadius: 4,
          zIndex: 1000
        }}>
          <button
            onClick={() => setShowContact(false)}
            style={{
              position: 'absolute', top: 8, right: 8,
              background: 'transparent', border: 'none',
              fontSize: '1.2rem', cursor: 'pointer'
            }}>×</button>
          <h3>Contactez-moi</h3>
          <p>Discord: <a href="https://discord.com/users/Firock_" target="_blank" rel="noopener">Firock_</a></p>
          <p>Insta: <a href="https://instagram.com/stupid_femboy_" target="_blank" rel="noopener">@stupid_femboy_</a></p>
        </div>
      )}

      <MapContainer
        center={[46.5, 2.5]} zoom={5}
        style={{ height: '100%', width: '100%', cursor: 'crosshair' }}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* Cluster avec mosaïque d’avatars */}
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

        {/* Popup */}
        {selectedProfile && (
          <Popup
            position={[selectedProfile.lat, selectedProfile.lng]}
            onClose={() => setSelectedProfile(null)}
          >
            <div style={{ textAlign: 'center' }}>
              <img
                src={selectedProfile.avatar_url}
                width={60} height={60}
                style={{ borderRadius: '50%', marginBottom: 8 }}
                alt={selectedProfile.pseudo}
              />
              <div style={{ fontWeight: 'bold' }}>{selectedProfile.pseudo}</div>
              <div style={{ fontSize: '0.9rem', marginTop: 4 }}>
                {selectedProfile.description}
              </div>
            </div>
          </Popup>
        )}
      </MapContainer>

      {/* Formulaire */}
      {showForm && (
        <div style={{
          position: 'absolute', top: 20, right: 20, width: 320,
          background: 'white', padding: 16,
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)', zIndex: 1000
        }}>
          <button
            onClick={() => setShowForm(false)}
            style={{
              float: 'right', background: 'transparent', border: 'none',
              fontSize: '1.2rem', cursor: 'pointer'
            }}>×</button>
          <h2 style={{ color: 'var(--pink)', margin: '0 0 1rem' }}>
            Ajouter ton profil
          </h2>
          <form onSubmit={handleSubmit}>
            <input
              required placeholder="Pseudo"
              value={formData.pseudo}
              onChange={e => setFormData(f => ({ ...f, pseudo: e.target.value }))}
              style={{ width: '100%', marginBottom: 8 }}
            />
            <textarea
              required maxLength={100} placeholder="Description (100 car.)"
              value={formData.description}
              onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
              style={{
                width: '100%', height: 60, marginBottom: 8, padding: 6,
                fontSize: '0.9rem', borderRadius: 4, border: '1px solid #ccc'
              }}
            />
            <input
              type="file" accept="image/*" required
              onChange={e => setFormData(f => ({ ...f, avatar: e.target.files[0] }))}
              style={{ width: '100%', marginBottom: 12 }}
            />
            <button
              type="submit"
              style={{
                width: '100%', padding: '8px',
                background: 'var(--pink)', border: 'none',
                borderRadius: 8, cursor: 'pointer'
              }}
            >Envoyer</button>
          </form>
        </div>
      )}
    </div>
  )
}
