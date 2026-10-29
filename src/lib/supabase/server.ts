import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeReturnPathFromReferer } from "@/lib/auth-redirect";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies; the Proxy refreshes sessions.
        }
      },
    },
  });
}

export async function requireSupabaseUser() {
  const client = await createSupabaseServerClient();
  const { data: { user }, error } = await client.auth.getUser();

  if (error || !user) {
    const requestHeaders = await headers();
    const next = safeReturnPathFromReferer(requestHeaders.get("referer"));
    const query = new URLSearchParams({ reason: "session-expired", next });
    redirect(`/login?${query.toString()}`);
  }

  return { client, user };
}
