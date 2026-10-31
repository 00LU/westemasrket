import { Recycle } from 'lucide-react';

const ROLES = ['Produttori', 'Trasportatori', 'Destinatari'];

export default function AuthLayout({ children }) {
  return (
    <div className="theme-app min-h-screen bg-shell p-2 sm:p-4 lg:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-1rem)] max-w-[1280px] gap-4 rounded-[1.75rem] bg-canvas p-3 sm:min-h-[calc(100vh-2rem)] sm:p-4 lg:min-h-[calc(100vh-3rem)] lg:grid-cols-[minmax(0,5fr),minmax(0,7fr)] lg:gap-6 lg:rounded-[2.5rem] lg:p-5">
        <aside className="relative hidden flex-col justify-between overflow-hidden rounded-2xl bg-brand-900 p-10 text-white lg:flex">
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-accent-500" aria-hidden="true" />
          <div className="absolute -bottom-10 -right-10 h-44 w-44 rounded-full bg-white/20" aria-hidden="true" />
          <p className="relative flex items-center gap-2 font-display text-2xl font-bold">
            <Recycle size={26} aria-hidden="true" /> WasteMarket
          </p>
          <div className="relative max-w-sm">
            <p className="font-display text-4xl font-bold leading-tight tracking-tight">Ritiri, trasporti e conferimenti in un unico spazio.</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {ROLES.map((role) => (
                <li key={role} className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold">{role}</li>
              ))}
            </ul>
          </div>
          <span aria-hidden="true" />
        </aside>
        <main className="flex flex-col items-center justify-center gap-6 py-6">
          <p className="flex items-center gap-2 font-display text-2xl font-bold text-brand-900 lg:hidden">
            <Recycle size={24} aria-hidden="true" /> WasteMarket
          </p>
          {children}
        </main>
      </div>
    </div>
  );
}
