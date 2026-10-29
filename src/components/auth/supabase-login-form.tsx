"use client";

import { useActionState, useEffect, useRef } from "react";
import { addToast } from "@/lib/toast-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginWithSupabase, type LoginState } from "@/app/login/actions";

const initialState: LoginState = { error: null };

export function SupabaseLoginForm({
  nextPath,
  sessionExpired = false,
}: {
  nextPath: string;
  sessionExpired?: boolean;
}) {
  const [state, formAction, pending] = useActionState(loginWithSupabase, initialState);
  const notifiedSessionExpiration = useRef(false);

  useEffect(() => {
    if (!sessionExpired || notifiedSessionExpiration.current) return;
    notifiedSessionExpiration.current = true;
    addToast({ message: "Sua sessão expirou. Entre novamente para continuar." });
  }, [sessionExpired]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />
      <div className="space-y-2">
        <label htmlFor="email" className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className="h-10"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Senha
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-10"
        />
      </div>
      {state.error && (
        <p role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
