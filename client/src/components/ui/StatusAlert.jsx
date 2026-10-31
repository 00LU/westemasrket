const styles = {
  info: 'border-blue-200 bg-blue-50 text-blue-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-accent-200 bg-accent-50 text-accent-800',
  error: 'border-red-200 bg-red-50 text-red-900',
};

export default function StatusAlert({ variant = 'info', title, children, action, className = '' }) {
  const role = variant === 'error' ? 'alert' : 'status';

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${styles[variant]} ${className}`}
      role={role}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
        </div>
        {action}
      </div>
    </div>
  );
}
