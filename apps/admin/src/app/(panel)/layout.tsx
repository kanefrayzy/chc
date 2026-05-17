import type { ReactNode } from 'react';
import { headers } from 'next/headers';
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

  // Moderators can only access /tickets and /dashboard
  if (user.role === 'MODERATOR') {
    const headersList = headers();
    const pathname = headersList.get('x-invoke-path') ?? headersList.get('x-pathname') ?? '';
    const allowed = ['/tickets', '/dashboard'];
    const isAllowed = allowed.some((p) => pathname === p || pathname.startsWith(p + '/'));
    if (pathname && !isAllowed) {
      redirect('/tickets');
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-page">
      <Sidebar username={user.username} role={user.role} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar email={user.email} />
        <main className="flex-1 overflow-y-auto px-8 py-7">
          {children}
        </main>
      </div>
    </div>
  );
}
