"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createPasswordSessionToken,
  passwordMatches,
  PASSWORD_SESSION_COOKIE,
  PASSWORD_SESSION_TTL_SECONDS,
  safeReturnPath,
} from "@/lib/password-auth";

export type LoginState = {
  error: string | null;
};

export async function loginWithPassword(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const configuredPassword = process.env.SENHA;
  if (!configuredPassword) {
    return { error: "O acesso ainda não foi configurado. Defina SENHA nas variáveis de ambiente." };
  }

  const submitted = formData.get("password");
  if (!passwordMatches(typeof submitted === "string" ? submitted : "", configuredPassword)) {
    return { error: "Senha incorreta." };
  }

  const cookieStore = await cookies();
  cookieStore.set(PASSWORD_SESSION_COOKIE, createPasswordSessionToken(configuredPassword), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PASSWORD_SESSION_TTL_SECONDS,
  });

  redirect(safeReturnPath(formData.get("next")));
}
