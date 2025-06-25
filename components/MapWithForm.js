// components/MapWithForm.js

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabaseClient'

// Cluster chargé en SSR off
const MarkerClusterGroup = dynamic(
  () => import('react-leaflet-markercluster').then(m => m.default),
  { ssr: false }
)

// Écouteur de clic basique, sans désactivation de la carte
function ClickControl({ onClick }) {
  useMapEvents({
    click(e) {
      onClick(e)
    },
  })
  return null
}

// Tirage aléatoire dans un cercle (en mètres)
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

export default function MapWithForm() {
  const [profiles, setProfiles] = useState([])
  const [anonRadius, setAnonRadius] = useState(1000)
  const [clickCircle, setClickCircle] = useState(null)
  const [profileCircle, setProfileCircle] = useState(null)
  const [selectedPos, setSelectedPos] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    pseudo: '',
    avatar: null,
    description: '',
  })

  // Load approved profiles
  useEffect(() => {
    fetch('/api/getProfiles')
      .then(r => r.json())
      .then(setProfiles)
  }, [])

  // Nouveau cercle + formulaire au clic carte
  const handleMapClick = e => {
    const randomCenter = getRandomPointInCircle(e.latlng, anonRadius)
    setClickCircle({ center: randomCenter, radius: anonRadius })
    setSelectedPos(randomCenter)
    setShowForm(true)
    setProfileCircle(null) // cache le cercle de profil si visible
  }

  // Affiche le cercle d’anonymisation d’un profil au clic
  const handleProfileClick = p => {
    setProfileCircle({
      center: { lat: p.lat, lng: p.lng },
      radius: p.anon_radius,
    })
  }

  const closeForm = () => {
    setShowForm(false)
  }

  // Envoi du formulaire
  const handleSubmit = async e => {
    e.preventDefault()
    if (!selectedPos) return

    const fd = new FormData()
    fd.append('pseudo', formData.pseudo)
    fd.append('lat', selectedPos.lat)
    fd.append('lng', selectedPos.lng)
    fd.append('anon_radius', anonRadius)
    fd.append('description', formData.description)
    fd.append('avatar', formData.avatar)

    const res = await fetch('/api/submit', { method: 'POST', body: fd })
    if (res.ok) {
      alert('Profil soumis, en attente de modération !')
      closeForm()
    } else {
      const err = await res.json()
      alert('Erreur : ' + err.error)
    }
  }

  // Icône avatar
  const createAvatarIcon = url =>
    new L.Icon({
      iconUrl: url,
      iconSize: [40, 40],
      className: 'rounded-marker-icon',
      iconAnchor: [20, 40],
      popupAnchor: [0, -40],
    })

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      {/* Sélecteur de rayon */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 20,
          zIndex: 1000,
          background: 'white',
          padding: '10px 16px',
          borderRadius: 4,
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        }}
      >
        <label style={{ fontSize: '1rem' }}>
          Rayon&nbsp;:
          <select
            value={anonRadius}
            onChange={e => setAnonRadius(Number(e.target.value))}
            style={{
              marginLeft: 12,
              padding: '6px 12px',
              fontSize: '1.1rem',
              minWidth: '120px',
              borderRadius: 4,
              border: '1px solid #ccc',
            }}
          >
            <option value={500}>0.5 km</option>
            <option value={1000}>1 km</option>
            <option value={3000}>3 km</option>
            <option value={5000}>5 km</option>
          </select>
        </label>
      </div>

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
            >
              <Popup>
                <img
                  src={p.avatar_url}
                  width={50}
                  height={50}
                  style={{ borderRadius: '50%' }}
                  alt={p.pseudo}
                />
                <div>{p.pseudo}</div>
                <p style={{ fontSize: '0.9rem', margin: '4px 0 0' }}>
                  {p.description}
                </p>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>

        {/* Cercle de création */}
        {clickCircle && (
          <Circle
            center={clickCircle.center}
            radius={clickCircle.radius}
            pathOptions={{ color: 'blue', fillOpacity: 0.1 }}
          />
        )}

        {/* Cercle de profil */}
        {profileCircle && (
          <Circle
            center={profileCircle.center}
            radius={profileCircle.radius}
            pathOptions={{ color: 'purple', fillOpacity: 0.05 }}
          />
        )}

        <ClickControl onClick={handleMapClick} />
      </MapContainer>

      {/* Formulaire */}
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
            onClick={closeForm}
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
              placeholder="Description (max 100 caractères)"
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
