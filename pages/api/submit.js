// pages/api/submit.js
export const config = {
  api: { bodyParser: false }
}

import { createClient } from '@supabase/supabase-js'
import { IncomingForm }  from 'formidable'
import fs                from 'fs'
import os                from 'os'
import path              from 'path'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const RATE_LIMIT_MS = 60_000

export default async function handler(req, res) {
  console.log('--- Nouvelle requête submit ---')
  if (req.method !== 'POST') {
    console.log('Mauvaise méthode :', req.method)
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  console.log('IP détectée :', ip)

  try {
    // Rate-limit
    const { data: last, error: errRate } = await supabaseAdmin
      .from('profiles')
      .select('created_at')
      .eq('ip', ip)
      .order('created_at', { ascending: false })
      .limit(1)

    if (errRate) console.error('Rate-limit query error:', errRate)
    else if (Array.isArray(last) && last.length) {
      const lastTime = new Date(last[0].created_at).getTime()
      if (Date.now() - lastTime < RATE_LIMIT_MS) {
        console.log('Bloqué par rate-limit (< 1 min)')
        return res.status(200).json({ message: 'Ok' })
      }
    }

    // Parse multipart
    console.log('Parsing Formidable…')
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
    console.log('Fields:', fields)
    console.log('Files :', files)

    // ————— Extraction des valeurs simples —————
    let { pseudo, description = '', lat, lng } = fields
    if (Array.isArray(pseudo))      pseudo      = pseudo[0]
    if (Array.isArray(description)) description = description[0]
    if (Array.isArray(lat))         lat         = lat[0]
    if (Array.isArray(lng))         lng         = lng[0]

    let file = files.avatar
    if (Array.isArray(file)) file = file[0]

    if (!pseudo || !lat || !lng || !file) {
      console.log('Champs manquants', { pseudo, lat, lng, file })
      return res.status(400).json({ error: 'Champs manquants' })
    }

    // Upload fichier
    const tmpPath = file.filepath || file.path
    const buffer  = fs.readFileSync(tmpPath)
    const ext     = path.extname(tmpPath)
    const key     = `avatars/${Date.now()}${ext}`

    console.log('Upload vers storage:', key)
    const { error: upErr } = await supabaseAdmin
      .storage.from('avatars').upload(key, buffer, { contentType: file.mimetype })
    if (upErr) throw upErr

    console.log('Récupération URL publique…')
    const { data: urlData, error: urlErr } = await supabaseAdmin
      .storage.from('avatars').getPublicUrl(key)
    if (urlErr) throw urlErr

    const publicUrl = urlData.publicUrl
    if (!publicUrl) throw new Error('Public URL introuvable')

    // Insert dans profiles
    console.log('Insertion en base profiles…')
    const { error: dbErr } = await supabaseAdmin
      .from('profiles').insert([{
        pseudo,
        description,
        avatar_url: publicUrl,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        ip,
      }])
    if (dbErr) throw dbErr

    console.log('✔ Profil inséré')
    fs.unlinkSync(tmpPath)
    return res.status(200).json({ message: 'Profil soumis' })

  } catch (e) {
    console.error('Erreur submit.js:', e)
    return res.status(200).json({ message: 'Ok' })
  }
}
