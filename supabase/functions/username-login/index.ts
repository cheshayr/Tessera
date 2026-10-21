// Lets people sign in with a username. Looks up the email server-side so emails are never exposed.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const reply = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { username, password } = await req.json();
    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: p } = await admin.from('profiles').select('id').eq('username', String(username)).maybeSingle();
    if (!p) return reply({ error: 'Invalid username or password' }, 401);
    const { data: u } = await admin.auth.admin.getUserById(p.id);
    const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data, error } = await anon.auth.signInWithPassword({ email: u.user!.email!, password: String(password) });
    if (error) return reply({ error: /confirm/i.test(error.message) ? 'Please confirm your email first' : 'Invalid username or password' }, 401);
    return reply({ session: data.session });
  } catch { return reply({ error: 'Bad request' }, 400); }
});
