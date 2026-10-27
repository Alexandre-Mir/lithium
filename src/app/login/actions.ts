"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/auth-redirect";

export type LoginState = {
  error: string | null;
};

export async function loginWithSupabase(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: "Informe o email e a senha da sua conta Supabase." };
  }

  const client = await createSupabaseServerClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { error: "Email ou senha inválidos. Confira suas credenciais do Supabase." };

  redirect(safeReturnPath(formData.get("next")));
}

export async function signOut() {
  const client = await createSupabaseServerClient();
  await client.auth.signOut();
  redirect("/login");
}
