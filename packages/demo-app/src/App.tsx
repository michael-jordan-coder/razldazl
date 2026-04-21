export const App = () => {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-8 px-1 gap-0">
      <section className="max-w-md w-full bg-white shadow p-6 space-y-4 bg-slate-950 text-yellow-500 px-5 rounded-lg">
        <h1 className="font-semibold text-gray-900 text-xl">Welcome home
</h1>
        <p className="text-slate-950 font-medium">
          This is a sample React app. Click any element in the editor preview
          to select it, then describe a change in natural language.
        </p>
        <div className="flex gap-2 pt-2">
          <button className="px-3 py-2 rounded bg-slate-900 text-white text-sm">Primary</button>
          <button className="px-3 py-2 rounded border border-slate-300 text-sm text-gray-100 bg-red-700">Secondary</button>
        </div>
      </section>
    </main>
  );
};
