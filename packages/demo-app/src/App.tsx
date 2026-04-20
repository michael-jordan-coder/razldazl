export const App = () => {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-8">
      <section className="max-w-md w-full bg-white rounded-lg shadow p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Welcome</h1>
        <p className="text-slate-600">
          This is a sample React app. Click any element in the editor preview
          to select it, then describe a change in natural language.
        </p>
        <div className="flex gap-2 pt-2">
          <button className="px-3 py-2 rounded bg-slate-900 text-white text-sm">Primary</button>
          <button className="px-3 py-2 rounded border border-slate-300 text-sm">Secondary</button>
        </div>
      </section>
    </main>
  );
};
