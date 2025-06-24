import { supabase } from '../../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_PASS}`)
    return res.status(401).end();

  const { id } = req.body;
  await supabase
    .from('profiles')
    .update({ status: 'approved' })
    .eq('id', id);

  res.status(200).end();
}
