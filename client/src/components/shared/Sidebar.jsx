import { NavLink } from 'react-router-dom';

export default function Sidebar({ links }) {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-soft">
      <nav className="space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `block rounded-xl px-3 py-2 text-sm font-semibold transition ${
                isActive ? 'bg-brand-900 text-white' : 'text-slate-700 hover:bg-slate-100'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
