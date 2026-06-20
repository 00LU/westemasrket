import Navbar from './Navbar';
import Sidebar from './Sidebar';

export default function RoleLayout({ title, links, children }) {
  return (
    <div className="min-h-screen">
      <Navbar title={title} />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px,1fr]">
        <Sidebar links={links} />
        <div className="space-y-6">{children}</div>
      </main>
    </div>
  );
}
