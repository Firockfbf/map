// pages/api/submit.js

export const config = { api: { bodyParser: false } }

import { createClient } from '@supabase/supabase-js'
import { IncomingForm }  from 'formidable'
import fs                from 'fs'
import os                from 'os'
import path              from 'path'

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

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) =>
        err ? reject(err) : resolve({ fields, files })
      )
    })

    const { pseudo, lat, lng, anon_radius, description } = fields
    let file = files.avatar
    if (Array.isArray(file)) file = file[0]

    // Validation
    if (!pseudo || !lat || !lng || !anon_radius || !description) {
      return res.status(400).json({ error: 'Champs manquants' })
    }
    if (description.length > 100) {
      return res
        .status(400)
        .json({ error: 'La description doit faire au maximum 100 caractères' })
    }

    const tempPath = file.filepath || file.filePath || file.path
    if (!tempPath) throw new Error('Impossible de localiser le fichier uploadé')

    const buffer = fs.readFileSync(tempPath)
    const ext    = path.extname(tempPath)
    const fileName = `${Date.now()}${ext}`

    const { error: upErr } = await supabaseAdmin.storage
      .from('avatars')
      .upload(fileName, buffer, { contentType: file.mimetype })
    if (upErr) throw upErr

    const { data: urlData, error: urlErr } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(fileName)
    if (urlErr) throw urlErr

    const { error: dbErr } = await supabaseAdmin
      .from('profiles')
      .insert([{
        pseudo,
        avatar_url: urlData.publicUrl,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        anon_radius: parseInt(anon_radius, 10),
        description,      // ← ici
      }])
    if (dbErr) throw dbErr

    fs.unlinkSync(tempPath)
    return res.status(200).json({ message: 'Profil soumis, pending moderation' })
  } catch (e) {
    console.error('Submit error:', e)
    return res.status(500).json({ error: e.message })
  }
}
