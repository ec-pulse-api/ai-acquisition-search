import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function getAdminSupabase() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function getUserFromBearer(request: Request) {
  const internalSecret = request.headers.get("x-internal-secret");
  const internalUserId = request.headers.get("x-internal-user-id");

  if (
    internalSecret &&
    internalUserId &&
    process.env.CRON_SECRET &&
    internalSecret === process.env.CRON_SECRET
  ) {
    const admin = getAdminSupabase();
    const { data, error } = await admin.auth.admin.getUserById(internalUserId);
    if (!error && data.user) return data.user;
    return null;
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
