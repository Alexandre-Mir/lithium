export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="container mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-8"
    >
      <span className="sr-only">Carregando conteúdo…</span>
      <div className="h-36 animate-pulse border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-900" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="h-24 animate-pulse border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-900" />
        <div className="h-24 animate-pulse border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-900" />
      </div>
      <div className="h-48 animate-pulse border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-900" />
    </div>
  );
}
