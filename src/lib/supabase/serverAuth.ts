import { createClient } from "@supabase/supabase-js";

let cachedAnonClient: ReturnType<typeof createClient> | null = null;

function getAnonClient() {
  if (cachedAnonClient) return cachedAnonClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase anon auth client is not configured.");
  }

  cachedAnonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedAnonClient;
}

export async function getUserFromBearerToken(authHeader: string | null) {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return null;

  const client = getAnonClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
