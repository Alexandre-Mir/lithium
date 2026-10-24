import Link from "next/link";

export default function NotFound() {
  return <div className="container mx-auto max-w-7xl px-4 py-16 sm:px-8"><div className="rounded-md border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900"><h1 className="text-lg font-bold">Leitura não encontrada</h1><p className="mt-2 text-xs text-gray-500">A leitura solicitada não existe ou foi removida.</p><Link href="/library" className="mt-5 inline-block text-xs font-semibold text-indigo-600">← Voltar para a Biblioteca</Link></div></div>;
}
