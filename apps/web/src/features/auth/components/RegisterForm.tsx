'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { IMaskInput } from 'react-imask';
import { Alert, Button, Checkbox, FormField, Input, cn } from '@chcgreen/ui';
import { registerSchema, type RegisterDto } from '@chcgreen/shared';
import { authApi } from '@/lib/api/auth';
import { ApiException } from '@/lib/api/client';

export interface RegisterFormProps {
  initialReferralCode?: string;
  onSuccessRedirect?: string;
  onSuccess?: () => void;
}

interface FieldErrors {
  email?: string;
  phone?: string;
  username?: string;
  password?: string;
  referralCode?: string;
  ageConfirmed?: string;
  termsAccepted?: string;
}

const emptyValues = {
  email: '',
  phone: '',
  username: '',
  password: '',
  ageConfirmed: false,
  termsAccepted: false,
};

export function RegisterForm({
  initialReferralCode = '',
  onSuccessRedirect,
  onSuccess,
}: RegisterFormProps): JSX.Element {
  const t = useTranslations('auth');
  const router = useRouter();
  const [values, setValues] = useState(emptyValues);
  const [referralCode, setReferralCode] = useState(initialReferralCode);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [regMethod, setRegMethod] = useState<'email' | 'phone'>('email');

  const update = <K extends keyof typeof emptyValues>(key: K, value: (typeof emptyValues)[K]): void => {
    setValues((s) => ({ ...s, [key]: value }));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setFormError(null);
    setErrors({});

    const dto: RegisterDto = {
      email: regMethod === 'email' ? values.email.trim() : '',
      phone: regMethod === 'phone' ? values.phone.replace(/[^+0-9]/g, '').trim() : '',
      username: values.username.trim(),
      password: values.password,
      ageConfirmed: values.ageConfirmed as true,
      termsAccepted: values.termsAccepted as true,
      ...(referralCode.trim() ? { referralCode: referralCode.trim() } : {}),
    };
    const parsed = registerSchema.safeParse(dto);
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
        await authApi.register(parsed.data);
        if (onSuccess) {
          onSuccess();
        } else {
          router.push(onSuccessRedirect ?? '/');
          router.refresh();
        }
      } catch (err) {
        if (err instanceof ApiException) {
          setFormError(err.message);
        } else {
          setFormError(t('errors.unknown'));
        }
      }
    });
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      {formError ? <Alert variant="danger">{formError}</Alert> : null}

      {/* Переключатель Email / Телефон */}
      <div className="flex rounded-lg border border-border bg-bg-elevated p-1 gap-1">
        <button
          type="button"
          onClick={() => setRegMethod('email')}
          className={cn(
            'flex-1 rounded-md py-1.5 text-sm font-medium transition',
            regMethod === 'email'
              ? 'bg-bg-card text-text-primary shadow-sm'
              : 'text-text-muted hover:text-text-secondary',
          )}
        >
          {t('fields.email')}
        </button>
        <button
          type="button"
          onClick={() => setRegMethod('phone')}
          className={cn(
            'flex-1 rounded-md py-1.5 text-sm font-medium transition',
            regMethod === 'phone'
              ? 'bg-bg-card text-text-primary shadow-sm'
              : 'text-text-muted hover:text-text-secondary',
          )}
        >
          {t('fields.phone')}
        </button>
      </div>

      {regMethod === 'email' ? (
        <FormField label={t('fields.email')} required error={errors.email}>
          {(id) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(e) => update('email', e.target.value)}
              invalid={Boolean(errors.email)}
              disabled={isPending}
            />
          )}
        </FormField>
      ) : (
        <FormField label={t('fields.phone')} required error={errors.phone} hint="+994 (XX) XXX-XX-XX">
          {(id) => (
            <IMaskInput
              id={id}
              mask="+994 (00) 000-00-00"
              value={values.phone}
              onAccept={(val: string) => update('phone', val)}
              autoComplete="tel"
              inputMode="tel"
              disabled={isPending}
              className={cn(
                'w-full rounded-lg border bg-bg-elevated px-4 py-2.5 text-sm font-mono text-text-primary placeholder:text-text-muted transition',
                'focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand',
                errors.phone ? 'border-danger' : 'border-border',
                isPending && 'opacity-50',
              )}
              placeholder="+994 (XX) XXX-XX-XX"
            />
          )}
        </FormField>
      )}

      <FormField label={t('fields.username')} required error={errors.username}>
        {(id) => (
          <Input
            id={id}
            autoComplete="username"
            value={values.username}
            onChange={(e) => update('username', e.target.value)}
            invalid={Boolean(errors.username)}
            disabled={isPending}
          />
        )}
      </FormField>

      <FormField
        label={t('fields.password')}
        required
        error={errors.password}
        hint={t('hints.password')}
      >
        {(id) => (
          <Input
            id={id}
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(e) => update('password', e.target.value)}
            invalid={Boolean(errors.password)}
            disabled={isPending}
          />
        )}
      </FormField>

      <FormField label={t('fields.referralCode')} error={errors.referralCode}>
        {(id) => (
          <Input
            id={id}
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
            placeholder="ABCD1234"
            invalid={Boolean(errors.referralCode)}
            disabled={isPending}
          />
        )}
      </FormField>

      <div className="flex flex-col gap-2">
        <Checkbox
          id="ageConfirmed"
          checked={values.ageConfirmed}
          onChange={(e) => update('ageConfirmed', e.target.checked)}
          label={t('checkboxes.age')}
          disabled={isPending}
        />
        {errors.ageConfirmed ? (
          <p className="text-xs text-danger" role="alert">{errors.ageConfirmed}</p>
        ) : null}

        <Checkbox
          id="termsAccepted"
          checked={values.termsAccepted}
          onChange={(e) => update('termsAccepted', e.target.checked)}
          label={t('checkboxes.terms')}
          disabled={isPending}
        />
        {errors.termsAccepted ? (
          <p className="text-xs text-danger" role="alert">{errors.termsAccepted}</p>
        ) : null}
      </div>

      <Button type="submit" loading={isPending} fullWidth size="lg">
        {t('actions.register')}
      </Button>
    </form>
  );
}
