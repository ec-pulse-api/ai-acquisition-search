export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16 text-zinc-100">
      <div className="mb-10">
        <a href="/" className="text-sm text-zinc-400 hover:text-white">AI Acquisition Search</a>
      </div>
      <article className="prose prose-invert max-w-none prose-headings:tracking-tight prose-p:text-zinc-300 prose-li:text-zinc-300">
        {children}
      </article>
    </main>
  );
}
