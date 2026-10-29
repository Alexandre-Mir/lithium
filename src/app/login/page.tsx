import { connection } from "next/server";
import { redirect } from "next/navigation";
import { SupabaseLoginForm } from "@/components/auth/supabase-login-form";
import { safeReturnPath } from "@/lib/auth-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[]; reason?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  await connection();

  const params = await searchParams;
  const nextPath = safeReturnPath(params.next);
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (user) {
    redirect(nextPath);
  }

  return (
    <div className="flex min-h-full items-start justify-center px-4 py-16 sm:py-24">
      <section className="w-full max-w-sm border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950">
        <p className="text-[10px] font-mono uppercase tracking-wide text-gray-500">Lithium</p>
        <h1 className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Entrar</h1>
        <p className="mt-1 mb-5 text-xs text-gray-600 dark:text-gray-400">
          Use as credenciais da sua conta Supabase.
        </p>
        <SupabaseLoginForm
          nextPath={nextPath}
          sessionExpired={params.reason === "session-expired"}
        />
      </section>
    </div>
  );
}
