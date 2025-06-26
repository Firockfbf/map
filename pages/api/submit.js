// pages/api/submit.js

// Désactive le bodyParser de Next.js pour gérer le multipart
export const config = { api: { bodyParser: false } }

import { createClient } from '@supabase/supabase-js'
import { IncomingForm } from 'formidable'
import fs from 'fs'
import os from 'os'
import path from 'path'

// Initialise le client “admin” Supabase
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
      maxFileSize: 5 * 1024 * 1024, // 5 Mo max
    })

    // Parse la requête
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        err ? reject(err) : resolve({ fields, files })
      })
    })

    // Désenchevêtre les tableaux éventuels renvoyés par Formidable
    let { pseudo, lat, lng, anon_radius, description } = fields
    if (Array.isArray(pseudo))       pseudo      = pseudo[0]
    if (Array.isArray(lat))          lat         = lat[0]
    if (Array.isArray(lng))          lng         = lng[0]
    if (Array.isArray(anon_radius))  anon_radius = anon_radius[0]
    if (Array.isArray(description))  description = description[0]

    // Récupère le fichier avatar
    let file = files.avatar
    if (Array.isArray(file)) file = file[0]

    // Valide la présence de tous les champs
    if (!pseudo || !lat || !lng || !anon_radius || !description || !file) {
      return res.status(400).json({ error: 'Champs manquants' })
    }
    if (description.length > 100) {
      return res
        .status(400)
        .json({ error: 'La description doit faire au maximum 100 caractères' })
    }

    // Chemin temporaire du fichier
    const tempPath = file.filepath || file.filePath || file.path
    if (!tempPath) {
      throw new Error('Impossible de localiser le fichier uploadé')
    }

    // Lit le buffer et prépare l’upload
    const buffer = fs.readFileSync(tempPath)
    const ext    = path.extname(tempPath)
    const fileName = `${Date.now()}${ext}`

    // 1) Upload vers Supabase Storage
    const { error: upErr } = await supabaseAdmin.storage
      .from('avatars')
      .upload(fileName, buffer, { contentType: file.mimetype })
    if (upErr) throw upErr

    // 2) Récupère l’URL publique
    const { data: urlData, error: urlErr } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(fileName)
    if (urlErr) throw urlErr

    // 3) Insère en base avec tous les champs
    const { error: dbErr } = await supabaseAdmin
      .from('profiles')
      .insert([{
        pseudo,
        avatar_url: urlData.publicUrl,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        anon_radius: parseInt(anon_radius, 10),
        description,
      }])
    if (dbErr) throw dbErr

    // Supprime le fichier temporaire
    fs.unlinkSync(tempPath)

    return res.status(200).json({ message: 'Profil soumis, pending moderation' })
  } catch (e) {
    console.error('Submit error:', e)
    return res.status(500).json({ error: e.message })
  }
}
