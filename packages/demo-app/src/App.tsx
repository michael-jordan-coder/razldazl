export const App = () => {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-8">
      <section className="max-w-md w-full bg-white shadow p-6 space-y-4 bg-zinc-900 rounded-3xl">
        <h1 className="font-semibold text-xs text-slate-50">Welcome</h1>
        <p className="text-slate-100">
          This is a sample React app. Click any element in the editor preview
          to select it, then describe a change in natural language.
        </p>
        <div className="flex gap-2 pt-2">
          <button className="px-3 py-2 rounded bg-slate-900 text-white text-sm">Primary</button>
          <button className="px-3 py-2 rounded border border-slate-300 text-sm text-gray-100 bg-indigo-600">Secondary</button>
        </div>
      </section>
    </main>
  );
};
