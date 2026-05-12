'use client';

import { useUi } from './ui-context';

export function RedeemCodeButton(): JSX.Element {
  const { openRedeemCode } = useUi();
  return (
    <button
      type="button"
      onClick={openRedeemCode}
      className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/20"
      title="Активировать код"
    >
      <span aria-hidden>🎫</span>
      <span>Ввести код</span>
    </button>
  );
}
