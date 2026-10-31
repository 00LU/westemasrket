import PageHeader from './PageHeader';
import Sidebar from './Sidebar';

export default function RoleLayout({ title, links, children }) {
  return (
    <div className="theme-app min-h-screen bg-shell p-2 sm:p-4 lg:p-6">
      <div className="mx-auto grid max-w-[1600px] gap-4 rounded-[1.75rem] bg-canvas p-3 sm:p-4 lg:grid-cols-[272px,minmax(0,1fr)] lg:gap-6 lg:rounded-[2.5rem] lg:p-5">
        <Sidebar links={links} />
        <div className="min-w-0 space-y-5">
          <PageHeader title={title} />
          <main className="space-y-5">{children}</main>
        </div>
      </div>
    </div>
  );
}
