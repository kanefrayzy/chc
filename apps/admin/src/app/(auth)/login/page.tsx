import { redirect } from 'next/navigation';
import { getServerUser, isStaff } from '../../../lib/api/server';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await getServerUser();
  if (isStaff(user)) {
    redirect('/dashboard');
  }
  return (
    <main className="min-h-screen bg-page flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="admin-brand-stripe h-1 w-full rounded-t-md" />
        <div className="bg-surface border border-border border-t-0 rounded-b-lg shadow-card px-8 py-8">
          <div className="text-xs uppercase tracking-widest text-ink-500">
            CHCGreen · Admin
          </div>
          <h1 className="mt-2 text-xl font-semibold text-ink-900">Вход в панель</h1>
          <p className="mt-1 text-sm text-ink-500">
            Только для модераторов и администраторов.
          </p>
          <div className="mt-6">
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
  );
}
