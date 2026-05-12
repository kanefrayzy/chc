'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Alert, Button, FormField, Input } from '@chcgreen/ui';
import { loginSchema, type LoginDto } from '@chcgreen/shared';
import { authApi } from '@/lib/api/auth';
import { ApiException } from '@/lib/api/client';

export interface LoginFormProps {
  onSuccessRedirect?: string;
}

interface FieldErrors {
  identifier?: string;
  password?: string;
}

export function LoginForm({ onSuccessRedirect = '/' }: LoginFormProps): JSX.Element {
  const t = useTranslations('auth');
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setFormError(null);
    setErrors({});

    const dto: LoginDto = { identifier: identifier.trim(), password };
    const parsed = loginSchema.safeParse(dto);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof FieldErrors | undefined;
        if (k && !fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    startTransition(async () => {
      try {
        await authApi.login(parsed.data);
        router.push(onSuccessRedirect);
        router.refresh();
      } catch (err) {
        if (err instanceof ApiException) {
          setFormError(err.status === 401 ? t('errors.invalidCredentials') : err.message);
        } else {
          setFormError(t('errors.unknown'));
        }
      }
    });
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      {formError ? <Alert variant="danger">{formError}</Alert> : null}

      <FormField label={t('fields.identifier')} required error={errors.identifier}>
        {(id) => (
          <Input
            id={id}
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            invalid={Boolean(errors.identifier)}
            disabled={isPending}
          />
        )}
      </FormField>

      <FormField label={t('fields.password')} required error={errors.password}>
        {(id) => (
          <Input
            id={id}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={Boolean(errors.password)}
            disabled={isPending}
          />
        )}
      </FormField>

      <Button type="submit" loading={isPending} fullWidth size="lg">
        {t('actions.login')}
      </Button>
    </form>
  );
}
