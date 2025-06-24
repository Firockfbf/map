import { supabase } from '../../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_PASS}`)
    return res.status(401).end();

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('status', 'pending');

  res.json(data);
}
