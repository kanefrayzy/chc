import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getServerUser, isStaff } from '../../lib/api/server';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await getServerUser();
  if (!isStaff(user) || !user) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar username={user.username} role={user.role} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar email={user.email} />
        <main className="flex-1 overflow-y-auto px-8 py-8 bg-page">
          {children}
        </main>
      </div>
    </div>
  );
}
