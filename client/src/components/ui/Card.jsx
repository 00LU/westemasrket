export default function Card({ id, title, children, action, className = '' }) {
  return (
    <section id={id} tabIndex={id ? -1 : undefined} className={`panel ${id ? 'scroll-mt-28 focus:outline-none' : ''} ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold text-slate-900">{title}</h3>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
