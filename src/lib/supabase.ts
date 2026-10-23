import { createClient } from "@supabase/supabase-js";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Garantir que mesmo antes da configuração do usuário no .env.local haja uma URL sintaticamente válida
const isValidHttpUrl = (str?: string) => {
  if (!str) return false;
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const supabaseUrl = isValidHttpUrl(rawUrl)
  ? rawUrl!
  : "https://placeholder-project.supabase.co";

export const supabaseAnonKey =
  rawKey && rawKey !== "your-supabase-anon-key-here"
    ? rawKey
    : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

// Client instanciado. As server actions e queries são estritamente tipadas via TypeScript interfaces.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);


