// pages/api/getProfiles.js

import { supabase } from '../../lib/supabaseClient'

export default async function handler(req, res) {
  // On sélectionne bien la description
  const { data, error } = await supabase
    .from('profiles')
    .select('id, pseudo, avatar_url, lat, lng, anon_radius, description')
    .eq('status', 'approved')

  if (error) {
    console.error('GetProfiles error:', error)
    return res.status(500).json({ error: error.message })
  }

  // Pour debug, tu peux décommenter :
  // console.log('Profiles fetched:', data)

  res.status(200).json(data)
}
