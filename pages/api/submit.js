// pages/api/submit.js

// Désactive le bodyParser de Next.js pour gérer le multipart
export const config = { api: { bodyParser: false } }

import { createClient } from '@supabase/supabase-js'
import { IncomingForm } from 'formidable'
import fs from 'fs'
import os from 'os'
import path from 'path'

// Client “admin” Supabase
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  try {
    // Configure Formidable
    const form = new IncomingForm({
      uploadDir: os.tmpdir(),
      keepExtensions: true,
      maxFileSize: 5 * 1024 * 1024,
    })

    // Parse la requête
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        err ? reject(err) : resolve({ fields, files })
      })
    })

    console.log('FIELDS:', fields)
    console.log('FILES:', files)

    // Récupère les champs et le fichier
    const { pseudo, lat, lng, anon_radius } = fields
    let file = files.avatar
    if (Array.isArray(file)) file = file[0]

    if (!pseudo || !lat || !lng || !anon_radius || !file) {
      return res.status(400).json({ error: 'Champs manquants' })
    }

    // Chemin temporaire
    const tempPath = file.filepath || file.filePath || file.path
    if (!tempPath) throw new Error('Impossible de localiser le fichier uploadé')

    // Lit le buffer et prépare l’upload
    const buffer = fs.readFileSync(tempPath)
    const ext = path.extname(tempPath)
    const fileName = `${Date.now()}${ext}`

    // 1) Upload vers Supabase Storage
    const { error: upErr } = await supabaseAdmin.storage
      .from('avatars')
      .upload(fileName, buffer, { contentType: file.mimetype })
    if (upErr) throw upErr

    console.log('Upload OK:', fileName)

    // 2) Récupère l’URL publique
    const { data: urlData, error: urlErr } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(fileName)
    if (urlErr) throw urlErr

    console.log('Public URL:', urlData.publicUrl)

    // 3) Insère en base avec le rayon
    const { error: dbErr } = await supabaseAdmin
      .from('profiles')
      .insert([{
        pseudo,
        avatar_url: urlData.publicUrl,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        anon_radius: parseInt(anon_radius, 10),
      }])
    if (dbErr) throw dbErr

    console.log('DB insert OK')

    // Supprime le fichier temporaire
    fs.unlinkSync(tempPath)

    return res.status(200).json({ message: 'Profil soumis, pending moderation' })
  } catch (e) {
    console.error('Submit error:', e)
    return res.status(500).json({ error: e.message })
  }
}
