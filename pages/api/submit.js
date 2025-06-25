// pages/api/submit.js
export const config = { api: { bodyParser: false } }

import { createClient } from '@supabase/supabase-js'
import { IncomingForm }  from 'formidable'
import fs                from 'fs'
import os                from 'os'
import path              from 'path'

// Client “admin”
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  try {
    const form = new IncomingForm({
      uploadDir: os.tmpdir(),
      keepExtensions: true,
      maxFileSize: 5 * 1024 * 1024,
    })

    // Parse fields + fichiers
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        err ? reject(err) : resolve({ fields, files })
      })
    })

    // Récupération + validation
    const { pseudo, lat, lng, description } = fields
    if (!pseudo || !lat || !lng) {
      return res.status(400).json({ error: 'Champs manquants' })
    }
    if (description && description.length > 100) {
      return res
        .status(400)
        .json({ error: 'Description trop longue (max 100 caractères)' })
    }

    let file = files.avatar
    if (Array.isArray(file)) file = file[0]
    if (!file) {
      return res.status(400).json({ error: 'Avatar manquant' })
    }

    // Chemin tmp
    const tmp = file.filepath || file.filePath || file.path
    if (!tmp) throw new Error('Fichier uploadé introuvable')

    // Lecture + upload
    const buffer = fs.readFileSync(tmp)
    const ext    = path.extname(tmp)
    const name   = `${Date.now()}${ext}`

    const { error: upErr } = await supabaseAdmin.storage
      .from('avatars')
      .upload(name, buffer, { contentType: file.mimetype })
    if (upErr) throw upErr

    const { data: urlData, error: urlErr } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(name)
    if (urlErr) throw urlErr

    // Insert en DB
    const { error: dbErr } = await supabaseAdmin
      .from('profiles')
      .insert([
        {
          pseudo,
          avatar_url: urlData.publicUrl,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          description: description || '',
          status: 'pending',
        },
      ])
    if (dbErr) throw dbErr

    // Nettoyage
    fs.unlinkSync(tmp)
    res.status(200).json({ message: 'Profil soumis, pending moderation' })
  } catch (e) {
    console.error('Submit error:', e)
    res.status(500).json({ error: e.message })
  }
}
