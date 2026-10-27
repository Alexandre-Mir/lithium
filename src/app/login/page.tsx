import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PasswordLoginForm } from "@/components/auth/password-login-form";
import {
  isPasswordSessionTokenValid,
  PASSWORD_SESSION_COOKIE,
  safeReturnPath,
} from "@/lib/password-auth";

export const instant = false;

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  await connection();

  const params = await searchParams;
  const nextPath = safeReturnPath(params.next);
  const cookieStore = await cookies();
  const token = cookieStore.get(PASSWORD_SESSION_COOKIE)?.value;

  if (isPasswordSessionTokenValid(token, process.env.SENHA)) {
    redirect(nextPath);
  }

  const passwordConfigured = Boolean(process.env.SENHA);

  return (
    <div className="flex min-h-full items-start justify-center px-4 py-16 sm:py-24">
      <section className="w-full max-w-sm border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950">
        <p className="text-[10px] font-mono uppercase tracking-wide text-gray-500">Lithium</p>
        <h1 className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Acesso protegido</h1>
        <p className="mt-1 mb-5 text-xs text-gray-600 dark:text-gray-400">
          Informe a senha para continuar.
        </p>
        {passwordConfigured ? (
          <PasswordLoginForm nextPath={nextPath} />
        ) : (
          <p role="alert" className="border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            O acesso ainda não foi configurado. Defina a variável SENHA no ambiente da aplicação.
          </p>
        )}
      </section>
    </div>
  );
}
