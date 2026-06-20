export default function Input({ label, className = '', ...props }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
      {label}
      <input
        className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-700 focus:ring-2 focus:ring-brand-100 ${className}`}
        {...props}
      />
    </label>
  );
}
