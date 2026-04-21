export const App = () => {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-8">
      <section className="min-h-screen bg-neutral-100 text-slate-100 flex flex-col items-center justify-center p-8 gap-4 rounded-lg">
        <h1 className="text-3xl font-semibold px-8">Welcome dog</h1>
        <p className="text-rose-500">fuckkkk</p>
        <div className="flex gap-2 pt-2">
          <button className="px-3 py-2 rounded bg-slate-900 text-white text-sm">Primary</button>
          <button className="px-3 py-2 rounded border border-slate-300 text-rose-500 bg-blue-500 text-xl">Secondary</button>
        </div>
      </section>
    </main>
  );
};
