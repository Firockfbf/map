import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('status', 'approved');
  res.json(data);
}
