export const App = () => {
  return (
    <main className="min-h-screen flex p-8 bg-zinc-200 items-center justify-center">
      <section className="max-w-md w-full bg-white shadow p-6 gap-4 rounded-2xl bg-slate-300 border-zinc-500 flex flex-col items-start">
        <h1 className="font-semibold text-slate-900 tracking-tight text-2xl text-left">Welcome home
</h1>
        <p className="text-sm text-slate-600 text-left">
          This is a sample React app. Click any element in the editor preview
          to select it, then describe a change in natural language.
        </p>
        <div className="flex gap-2 pt-2 ">
          <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Primary</button>
          <button className="px-4 py-2 border border-slate-300 bg-transparent text-slate-900 text-sm font-medium rounded-md hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Secondary</button>
        </div>
      </section>
    </main>
  );
};
