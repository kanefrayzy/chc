'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { adminAuthApi } from '../../../lib/api/auth';
import { ApiException } from '../../../lib/api/client';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Alert } from '../../../components/ui/Alert';

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await adminAuthApi.login({ identifier, password });
      if (res.user.role !== 'MODERATOR' && res.user.role !== 'SUPER_ADMIN') {
        // не админ — сразу logout
        await adminAuthApi.logout().catch(() => undefined);
        setError('Недостаточно прав. Этот раздел только для модераторов.');
        return;
      }
      const next = search.get('next') || '/dashboard';
      router.replace(next);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiException && e.status === 401) {
        setError('Неверный логин или пароль.');
      } else {
        setError('Не удалось войти. Попробуйте позже.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="identifier" className="block text-xs font-medium text-ink-500 mb-1.5">
          Email или username
        </label>
        <Input
          id="identifier"
          name="identifier"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-xs font-medium text-ink-500 mb-1.5">
          Пароль
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" loading={loading} className="w-full">
        Войти
      </Button>
    </form>
  );
}
