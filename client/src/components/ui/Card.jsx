export default function Card({ title, children, action }) {
  return (
    <section className="panel">
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-slate-900">{title}</h3>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
