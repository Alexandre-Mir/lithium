import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
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
    throw new Error("É necessário entrar com uma conta Supabase para continuar.");
  }

  return { client, user };
}
