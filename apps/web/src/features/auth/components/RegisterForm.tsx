'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Alert, Button, Checkbox, FormField, Input } from '@chcgreen/ui';
import { registerSchema, type RegisterDto } from '@chcgreen/shared';
import { authApi } from '@/lib/api/auth';
import { ApiException } from '@/lib/api/client';

export interface RegisterFormProps {
  /** Реферальный код, подставленный из ?ref=... */
  initialReferralCode?: string;
  /** Куда редиректить после успеха */
  onSuccessRedirect?: string;
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

const initialState = {
  email: '',
  phone: '',
  username: '',
  password: '',
  ageConfirmed: false,
  termsAccepted: false,
};

export function RegisterForm({
  initialReferralCode = '',
  onSuccessRedirect = '/',
}: RegisterFormProps): JSX.Element {
  const t = useTranslations('auth');
  const router = useRouter();
  const [values, setValues] = useState(initialState);
  const [referralCode, setReferralCode] = useState(initialReferralCode);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const update = <K extends keyof typeof values>(key: K, value: (typeof values)[K]): void => {
    setValues((s) => ({ ...s, [key]: value }));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setFormError(null);
    setErrors({});

    const dto: RegisterDto = {
      email: values.email.trim(),
      phone: values.phone.trim(),
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
        router.push(onSuccessRedirect);
        router.refresh();
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

      <FormField label={t('fields.phone')} required error={errors.phone} hint="+994...">
        {(id) => (
          <Input
            id={id}
            type="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={(e) => update('phone', e.target.value)}
            invalid={Boolean(errors.phone)}
            disabled={isPending}
          />
        )}
      </FormField>

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
          <p className="text-xs text-danger" role="alert">
            {errors.ageConfirmed}
          </p>
        ) : null}

        <Checkbox
          id="termsAccepted"
          checked={values.termsAccepted}
          onChange={(e) => update('termsAccepted', e.target.checked)}
          label={t('checkboxes.terms')}
          disabled={isPending}
        />
        {errors.termsAccepted ? (
          <p className="text-xs text-danger" role="alert">
            {errors.termsAccepted}
          </p>
        ) : null}
      </div>

      <Button type="submit" loading={isPending} fullWidth size="lg">
        {t('actions.register')}
      </Button>
    </form>
  );
}
