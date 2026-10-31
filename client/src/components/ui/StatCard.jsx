const TONES = {
  light: { box: 'bg-white text-slate-900', label: 'text-slate-500', hint: 'text-slate-500', icon: 'bg-slate-100 text-brand-900' },
  dark: { box: 'bg-brand-900 text-white', label: 'text-white/70', hint: 'text-white/70', icon: 'bg-white/15 text-white' },
  accent: { box: 'bg-accent-500 text-white', label: 'text-white/85', hint: 'text-white/85', icon: 'bg-white/20 text-white' },
};

export default function StatCard({ label, value, hint, icon: Icon, tone = 'light' }) {
  const styles = TONES[tone] || TONES.light;
  return (
    <section className={`rounded-2xl p-6 shadow-soft ${styles.box}`}>
      <div className="flex items-start justify-between gap-3">
        <p className={`font-display text-lg font-medium ${styles.label}`}>{label}</p>
        {Icon && (
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${styles.icon}`}>
            <Icon size={18} aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-4 font-display text-4xl font-bold tracking-tight">{value}</p>
      {hint && <p className={`mt-1 text-sm ${styles.hint}`}>{hint}</p>}
    </section>
  );
}
