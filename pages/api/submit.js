import { supabase } from '../../lib/supabaseClient';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const data = await new Promise((resolve, reject) => {
    const Busboy = require('busboy');
    const busboy = new Busboy({ headers: req.headers });
    const fields = {};
    busboy.on('field', (name, val) => fields[name] = val);
    busboy.on('file', (name, file) => {
      const chunks = [];
      file.on('data', c => chunks.push(c));
      file.on('end', () => fields.avatar = Buffer.concat(chunks));
    });
    busboy.on('finish', () => resolve(fields));
    req.pipe(busboy);
  });

  const { data: upload } = await supabase.storage
    .from('avatars')
    .upload(`avatars/${Date.now()}.png`, data.avatar, { contentType: 'image/png' });

  const publicUrl = supabase.storage
    .from('avatars')
    .getPublicUrl(upload.path)
    .publicURL;

  await supabase.from('profiles').insert([{
    pseudo: data.pseudo,
    lat: parseFloat(data.lat),
    lng: parseFloat(data.lng),
    avatar_url: publicUrl
  }]);

  res.status(200).end();
}
