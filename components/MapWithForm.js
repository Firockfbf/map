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

// Cluster (SSR désactivé)
const MarkerClusterGroup = dynamic(
  () => import('react-leaflet-markercluster').then(m => m.default),
  { ssr: false }
)

// Icône avatar
const createAvatarIcon = url =>
  new L.Icon({
    iconUrl: url,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
    className: 'rounded-marker-icon',
  })

// Point aléatoire dans un cercle (mètres)
function getRandomPointInCircle(center, radiusMeters) {
  const rd = radiusMeters / 111320
  const u = Math.random()
  const v = Math.random()
  const w = rd * Math.sqrt(u)
  const t = 2 * Math.PI * v
  const dy = w * Math.sin(t)
  const dx = (w * Math.cos(t)) / Math.cos(center.lat * Math.PI / 180)
  return { lat: center.lat + dy, lng: center.lng + dx }
}

// Écouteur de clic carte
function ClickControl({ onClick }) {
  useMapEvents({ click: onClick })
  return null
}

export default function MapWithForm() {
  const [profiles, setProfiles]             = useState([])
  const [anonRadius, setAnonRadius]         = useState(1000)
  const [clickCircle, setClickCircle]       = useState(null)
  const [profileCircle, setProfileCircle]   = useState(null)
  const [selectedProfile, setSelectedProfile] = useState(null)
  const [selectedPos, setSelectedPos]       = useState(null)
  const [showForm, setShowForm]             = useState(false)
  const [formData, setFormData]             = useState({
    pseudo: '',
    description: '',
    avatar: null,
  })
  const [showContact, setShowContact]       = useState(false)

  // Charge les profils approuvés
  useEffect(() => {
    fetch('/api/getProfiles')
      .then(r => r.json())
      .then(setProfiles)
      .catch(console.error)
  }, [])

  // Clic carte = nouveau cercle & ouverture formulaire
  const handleMapClick = e => {
    const rand = getRandomPointInCircle(e.latlng, anonRadius)
    setClickCircle({ center: rand, radius: anonRadius })
    setSelectedPos(rand)
    setShowForm(true)
    setProfileCircle(null)
    setSelectedProfile(null)
  }

  // Clic marker = cercle profil + affichage popup
  const handleProfileClick = p => {
    setProfileCircle({ center: { lat: p.lat, lng: p.lng }, radius: p.anon_radius })
    setSelectedProfile(p)
    setShowForm(false)
    setClickCircle(null)
  }

  // Soumet le formulaire
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

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      {/* 1) Sélecteur de rayon en haut à gauche, légèrement décalé */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 40,       // <-- ici décalage
          zIndex: 1000,
          background: 'white',
          padding: '10px 16px',
          borderRadius: 4,
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        }}
      >
        <label style={{ fontSize: '1rem' }}>
          Rayon :
          <select
            value={anonRadius}
            onChange={e => setAnonRadius(Number(e.target.value))}
            style={{
              marginLeft: 12,
              padding: '6px 12px',
              fontSize: '1.1rem',
              minWidth: 120,
              borderRadius: 4,
              border: '1px solid #ccc',
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

      {/* 2) Bouton Contact */}
      <button
        onClick={() => setShowContact(true)}
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          zIndex: 1000,
          background: 'var(--pink)',
          color: 'white',
          border: 'none',
          padding: '8px 12px',
          borderRadius: 4,
          cursor: 'pointer',
        }}
      >
        Contact
      </button>

      {/* 3) Panneau Contact */}
      {showContact && (
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            left: 20,
            width: 200,
            background: 'white',
            padding: 16,
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
            borderRadius: 4,
            zIndex: 1000,
          }}
        >
          <button
            onClick={() => setShowContact(false)}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: 'transparent',
              border: 'none',
              fontSize: '1.2rem',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
          <h3 style={{ margin: '0 0 8px' }}>Contactez-moi</h3>
          <p style={{ margin: '4px 0' }}>
            Discord : <a href="https://discord.com/users/Firock_" target="_blank" rel="noopener">Firock_</a>
          </p>
          <p style={{ margin: '4px 0' }}>
            Instagram : <a href="https://instagram.com/stupid_femboy_" target="_blank" rel="noopener">@stupid_femboy_</a>
          </p>
        </div>
      )}

      {/* 4) La carte */}
      <MapContainer
        center={[46.5, 2.5]}
        zoom={5}
        style={{ height: '100%', width: '100%', cursor: 'crosshair' }}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <MarkerClusterGroup>
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

        {/* Popup contrôlé */}
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

      {/* 5) Formulaire modal */}
      {showForm && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            width: 320,
            background: 'white',
            padding: 16,
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
            zIndex: 1000,
          }}
        >
          <button
            onClick={() => setShowForm(false)}
            style={{
              float: 'right',
              background: 'transparent',
              border: 'none',
              fontSize: '1.2rem',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
          <h2 style={{ color: 'var(--pink)', margin: '0 0 1rem' }}>
            Ajouter ton profil
          </h2>
          <form onSubmit={handleSubmit}>
            <input
              required
              placeholder="Pseudo"
              value={formData.pseudo}
              onChange={e =>
                setFormData(f => ({ ...f, pseudo: e.target.value }))
              }
              style={{ width: '100%', marginBottom: 8 }}
            />
            <textarea
              required
              maxLength={100}
              placeholder="Description (100 car.)"
              value={formData.description}
              onChange={e =>
                setFormData(f => ({ ...f, description: e.target.value }))
              }
              style={{
                width: '100%',
                height: 60,
                marginBottom: 8,
                padding: 6,
                fontSize: '0.9rem',
                borderRadius: 4,
                border: '1px solid #ccc',
              }}
            />
            <input
              type="file"
              accept="image/*"
              required
              onChange={e =>
                setFormData(f => ({ ...f, avatar: e.target.files[0] }))
              }
              style={{ width: '100%', marginBottom: 12 }}
            />
            <button
              type="submit"
              style={{
                background: 'var(--pink)',
                border: 'none',
                padding: '8px',
                borderRadius: 8,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Envoyer
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
