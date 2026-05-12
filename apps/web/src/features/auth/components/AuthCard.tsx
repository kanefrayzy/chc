import type { ReactNode } from 'react';
import { Card } from '@chcgreen/ui';

export interface AuthCardProps {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export function AuthCard({ title, subtitle, footer, children }: AuthCardProps): JSX.Element {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <Card variant="elevated" padding="lg" className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-text-secondary">{subtitle}</p> : null}
        </div>
        {children}
        {footer ? (
          <div className="mt-6 border-t border-border pt-4 text-center text-sm text-text-secondary">
            {footer}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
