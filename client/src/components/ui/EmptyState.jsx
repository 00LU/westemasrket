export default function EmptyState({ title, children, action }) {
  return (
    <section className="rounded-xl border border-dashed border-slate-300 p-6 text-center" aria-label={title}>
      <h4 className="font-semibold text-slate-900">{title}</h4>
      {children && <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </section>
  );
}
