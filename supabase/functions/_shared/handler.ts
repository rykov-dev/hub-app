import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

/**
 * Wraps an edge function that acts on behalf of the signed-in user.
 * Verifies the bearer token with Supabase Auth (asymmetric signing keys via
 * JWKS, so the gateway's legacy verify_jwt is disabled) and passes a
 * service-role client, the only role allowed to execute the reward functions.
 */
export const userHandler = (
  fn: (ctx: { userId: string; admin: SupabaseClient; req: Request }) => Promise<unknown>,
) =>
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'unauthorized' }, 401);

    const { data, error } = await admin.auth.getClaims(token);
    const claims = data?.claims;
    if (error || !claims?.sub || claims.role !== 'authenticated') {
      return json({ error: 'unauthorized' }, 401);
    }

    try {
      return json(await fn({ userId: claims.sub, admin, req }));
    } catch (e) {
      console.error(e);
      return json({ error: 'internal_error' }, 500);
    }
  });

export const callRpc = async (
  admin: SupabaseClient,
  name: string,
  userId: string,
) => {
  const { data, error } = await admin.rpc(name, { p_user_id: userId });
  if (error) throw error;
  return data;
};
