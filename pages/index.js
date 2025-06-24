import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '../lib/supabaseClient';
import 'leaflet/dist/leaflet.css';

const MapContainer = dynamic(
  () => import('react-leaflet').then(mod => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then(mod => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then(mod => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then(mod => mod.Popup),
  { ssr: false }
);
const MarkerClusterGroup = dynamic(
  () => import('react-leaflet-markercluster'),
  { ssr: false }
);

export default function Home() {
  const [profiles, setProfiles] = useState([]);
  const [form, setForm] = useState({ pseudo: '', avatar: null, lat: null, lng: null });

  useEffect(() => {
    fetch('/api/getProfiles')
      .then(res => res.json())
      .then(data => setProfiles(data));
  }, []);

  function addNoise(coord) {
    const r = (Math.random() - 0.5) * 0.1; // ~5–8 km noise
    return coord + r;
  }

  function handleMapClick(e) {
    const { lat, lng } = e.latlng;
    setForm(f => ({ ...f, lat: addNoise(lat), lng: addNoise(lng) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.append('pseudo', form.pseudo);
    fd.append('lat', form.lat);
    fd.append('lng', form.lng);
    fd.append('avatar', form.avatar);
    await fetch('/api/submit', { method: 'POST', body: fd });
    alert("Demande envoyée, en attente de modération !");
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <MapContainer center={[46.5, 2.5]} zoom={5} style={{ flex: 1 }} whenCreated={map => {
        map.on('click', handleMapClick);
      }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MarkerClusterGroup>
          {profiles.map(p => (
            <Marker key={p.id} position={[p.lat, p.lng]}>
              <Popup>
                <img
                  src={p.avatar_url}
                  alt="avatar"
                  width={50}
                  height={50}
                  style={{ borderRadius: '50%' }}
                />
                <p>{p.pseudo}</p>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
      <form
        onSubmit={handleSubmit}
        style={{
          width: '300px',
          padding: '1rem',
          background: 'white',
          overflowY: 'auto'
        }}
      >
        <h2 style={{ color: 'var(--pink)' }}>Ajouter ton profil</h2>
        <input
          required
          placeholder="Pseudo"
          onChange={e => setForm(f => ({ ...f, pseudo: e.target.value }))}
        />
        <input
          type="file"
          accept="image/*"
          required
          onChange={e => setForm(f => ({ ...f, avatar: e.target.files[0] }))}
        />
        <button type="submit">Envoyer</button>
        <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
          Clique sur la carte pour choisir ta position (floutée).
        </p>
      </form>
    </div>
  );
}
