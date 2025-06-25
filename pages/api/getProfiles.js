// pages/api/getProfiles.js
import { supabase } from '../../lib/supabaseClient'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('id,pseudo,avatar_url,lat,lng,description')
    .eq('status', 'approved')
  if (error) return res.status(500).json({ error: error.message })
  res.status(200).json(data)
}
