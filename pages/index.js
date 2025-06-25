import dynamic from 'next/dynamic'

// On importe le composant client-only
const MapWithForm = dynamic(
  () => import('../components/MapWithForm'),
  { ssr: false }
)

export default function HomePage() {
  return <MapWithForm />
}
