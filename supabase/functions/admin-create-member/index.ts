// Deploy as a Supabase Edge Function.
// Required secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return respond({ error: "Missing authorization" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return respond({ error: "Unauthorized" }, 401);

  const adminClient = createClient(url, serviceKey);
  const { data: caller } = await adminClient.from("profiles").select("role").eq("id", user.id).single();
  if (caller?.role !== "admin") return respond({ error: "Only the group admin can create accounts." }, 403);

  const { count } = await adminClient.from("profiles").select("*", { count: "exact", head: true });
  if ((count ?? 0) >= 6) return respond({ error: "The six-member group limit has been reached." }, 409);

  let body: { full_name?: string; email?: string; password?: string };
  try { body = await req.json(); } catch { return respond({ error: "Invalid JSON body." }, 400); }
  const full_name = body.full_name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  if (!full_name || !email || password.length < 8) return respond({ error: "Name, valid email and password of at least 8 characters are required." }, 400);

  const { data, error } = await adminClient.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name, role: "member" }
  });
  if (error) return respond({ error: error.message }, 400);
  return respond({ message: `Account created for ${full_name}.`, user_id: data.user.id });
});
