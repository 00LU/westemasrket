import { forwardRef } from 'react';

const Button = forwardRef(function Button({ children, className = '', variant = 'primary', ...props }, ref) {
  const styles = {
    primary: 'bg-brand-900 text-white hover:bg-brand-800',
    secondary: 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-50',
    accent: 'bg-accent-500 text-white hover:bg-accent-600',
    light: 'bg-white text-brand-900 hover:bg-white/90',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };

  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-btn px-5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60       ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});

export default Button;
