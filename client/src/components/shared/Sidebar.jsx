import { useRef } from 'react';
import { NavLink } from 'react-router-dom';

export default function Sidebar({ links }) {
  const menu = useRef(null);
  const navigation = (
    <nav aria-label="Navigazione del ruolo" className="space-y-1">
      {links.map((link) => (
        <NavLink key={link.to} to={link.to} end onClick={() => { if (menu.current) menu.current.open = false; }}
          className={({ isActive }) => `block rounded-xl px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-brand-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-soft">
      <details ref={menu} className="lg:hidden"><summary className="cursor-pointer text-sm font-semibold text-brand-900">Menu di navigazione</summary><div className="mt-3">{navigation}</div></details>
      <div className="hidden lg:block">{navigation}</div>
    </aside>
  );
}
