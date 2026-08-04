'use client';

import { useRef, useState } from 'react';
import { adminApi, type AdminSettingRow } from '../../../lib/api/admin';
import { ApiException } from '../../../lib/api/client';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { SettingEditModal } from './SettingEditModal';
import { cn } from '../../../lib/cn';

// ─── Группы настроек ──────────────────────────────────────────────────────────

const GROUPS: { id: string; label: string; description: string; keys: string[] }[] = [
  {
    id: 'gameplay',
    label: 'Геймплей',
    description: 'Включение и отключение разделов сайта',
    keys: [
      'gameplay.roulette_enabled',
      'gameplay.referrals_enabled',
      'gameplay.chat_enabled',
      'gameplay.ranks_enabled',
      'gameplay.code_purchase_enabled',
      'gameplay.jackpot_enabled',
      'gameplay.case_opening_enabled',
      'gameplay.external_casino_url',
    ],
  },
  {
    id: 'roulette',
    label: 'Рулетка',
    description: 'Минимальная и максимальная ставки',
    keys: ['roulette.min_bet_minor', 'roulette.max_bet_minor'],
  },
  {
    id: 'deposit',
    label: 'Депозиты',
    description: 'Лимиты пополнения и бонус',
    keys: ['deposit.min_amount_minor', 'deposit.max_amount_minor', 'deposit.bonus_bps'],
  },
  {
    id: 'withdrawal',
    label: 'Выводы',
    description: 'Лимиты на вывод средств',
    keys: ['withdrawal.min_amount_minor', 'withdrawal.manual_threshold_minor'],
  },
  {
    id: 'referral',
    label: 'Рефералы',
    description: 'Комиссии реферальной программы',
    keys: ['referral.from_loss_bps', 'referral.from_deposit_bps', 'referral.from_win_bps'],
  },
  {
    id: 'brand',
    label: 'Бренд',
    description: 'Название сайта, логотип и контакты',
    keys: [
      'brand.site_name',
      'brand.logo_url',
      'brand.support_email',
      'brand.tagline',
      'brand.hero_image_url',
    ],
  },
  {
    id: 'landing',
    label: 'Лендинг',
    description: 'Изображения плиток игр на главной странице',
    keys: [
      'landing.game_image_url.roulette',
      'landing.game_image_url.mines',
      'landing.game_image_url.classic',
      'landing.game_image_url.cases',
    ],
  },
];

// Красивые названия для ключей
const LABELS: Record<string, string> = {
  'gameplay.roulette_enabled': 'Рулетка',
  'gameplay.referrals_enabled': 'Рефералы',
  'gameplay.chat_enabled': 'Чат / тикеты',
  'gameplay.ranks_enabled': 'VIP-ранги',
  'gameplay.code_purchase_enabled': 'Покупка кодов',
  'gameplay.jackpot_enabled': 'Джекпот',
  'gameplay.case_opening_enabled': 'Кейсы',
  'gameplay.external_casino_url': 'URL внешнего казино (iframe)',
  'roulette.min_bet_minor': 'Минимальная ставка',
  'roulette.max_bet_minor': 'Максимальная ставка',
  'deposit.min_amount_minor': 'Минимальный депозит',
  'deposit.max_amount_minor': 'Максимальный депозит',
  'deposit.bonus_bps': 'Бонус при пополнении',
  'withdrawal.min_amount_minor': 'Минимальный вывод',
  'withdrawal.manual_threshold_minor': 'Порог ручного вывода',
  'referral.from_loss_bps': 'Комиссия от проигрыша реферала',
  'referral.from_deposit_bps': 'Бонус с пополнения реферала (500 = 5%)',
  'referral.from_win_bps': 'НЕ ИСПОЛЬЗУЕТСЯ (бонус с выигрыша отключён)',
  'brand.site_name': 'Название сайта',
  'brand.logo_url': 'Логотип',
  'brand.support_email': 'Email поддержки',
  'brand.tagline': 'Слоган / описание',
  'brand.hero_image_url': 'Hero-изображение',
  'landing.game_image_url.roulette': 'Плитка «Рулетка»',
  'landing.game_image_url.mines': 'Плитка «Mines»',
  'landing.game_image_url.classic': 'Плитка «Классика»',
  'landing.game_image_url.cases': 'Плитка «Кейсы»',
};

// Форматирование значения для отображения
function formatValue(s: AdminSettingRow): string {
  if (s.type === 'boolean') return s.value ? 'Включено' : 'Выключено';
  const key = s.key;
  const val = String(s.value ?? '');
  // Суммы в копейках → AZN
  if (
    key.endsWith('_minor') &&
    (key.includes('amount') || key.includes('bet') || key.includes('threshold'))
  ) {
    const num = Number(val);
    if (!isNaN(num)) return `${(num / 100).toFixed(2)} AZN`;
  }
  // Базисные пункты → проценты
  if (key.endsWith('_bps')) {
    const num = Number(val);
    if (!isNaN(num)) return `${(num / 100).toFixed(2)}%`;
  }
  if (!val) return '—';
  if (val.startsWith('http')) return val.length > 50 ? val.slice(0, 50) + '…' : val;
  return val;
}

function isImageKey(key: string): boolean {
  return key === 'brand.hero_image_url' || key.startsWith('landing.game_image_url.');
}

// ─── Компонент ────────────────────────────────────────────────────────────────

export function SettingsTable({ initialItems }: { initialItems: AdminSettingRow[] }) {
  const [items, setItems] = useState(initialItems);
  const [target, setTarget] = useState<AdminSettingRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [imageUploadingKey, setImageUploadingKey] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const byKey = Object.fromEntries(items.map((s) => [s.key, s]));

  async function onSubmit(key: string, value: unknown) {
    setError(null);
    try {
      const updated = await adminApi.settings.set(key, value);
      setItems((prev) => prev.map((s) => (s.key === key ? updated : s)));
      setTarget(null);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Не удалось сохранить');
    }
  }

  async function onLogoUpload(file: File) {
    setError(null);
    setLogoUploading(true);
    try {
      const updated = await adminApi.settings.uploadLogo(file);
      setItems((prev) => prev.map((s) => (s.key === updated.key ? updated : s)));
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Не удалось загрузить логотип');
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  async function onImageUpload(key: string, file: File) {
    setError(null);
    setImageUploadingKey(key);
    try {
      const updated = await adminApi.settings.uploadImage(key, file);
      setItems((prev) => prev.map((s) => (s.key === updated.key ? updated : s)));
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Не удалось загрузить изображение');
    } finally {
      setImageUploadingKey(null);
      const inp = imageInputRefs.current[key];
      if (inp) inp.value = '';
    }
  }

  async function toggleBoolean(s: AdminSettingRow) {
    await onSubmit(s.key, !s.value);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {GROUPS.map((group) => {
        const groupItems = group.keys.map((k) => byKey[k]).filter(Boolean) as AdminSettingRow[];
        if (groupItems.length === 0) return null;

        return (
          <div key={group.id} className="rounded-xl border border-border bg-bg-card">
            {/* Group header */}
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-sm font-semibold text-text-primary">{group.label}</h3>
              <p className="mt-0.5 text-xs text-text-secondary">{group.description}</p>
            </div>

            {/* Settings rows */}
            <div className="divide-y divide-border">
              {groupItems.map((s) => (
                <div
                  key={s.key}
                  className="flex items-center gap-4 px-5 py-3.5"
                >
                  {/* Name + description */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">
                        {LABELS[s.key] ?? s.key}
                      </span>
                      {!s.isDefault && (
                        <Badge tone="accent" className="text-[10px]">изменено</Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-text-secondary">{s.description}</div>
                  </div>

                  {/* Current value */}
                  <div className="shrink-0 min-w-[120px] text-right">
                    {s.type === 'boolean' ? (
                      <Badge tone={s.value ? 'success' : 'neutral'}>
                        {s.value ? 'Включено' : 'Выключено'}
                      </Badge>
                    ) : (
                      <span
                        className={cn(
                          'text-sm font-mono',
                          s.value ? 'text-text-primary' : 'text-text-muted',
                        )}
                      >
                        {formatValue(s)}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-2">
                    {s.key === 'brand.logo_url' && (
                      <>
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void onLogoUpload(f);
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={logoUploading}
                          onClick={() => logoInputRef.current?.click()}
                        >
                          Загрузить
                        </Button>
                      </>
                    )}
                    {isImageKey(s.key) && (
                      <>
                        <input
                          ref={(el) => { imageInputRefs.current[s.key] = el; }}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void onImageUpload(s.key, f);
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={imageUploadingKey === s.key}
                          onClick={() => imageInputRefs.current[s.key]?.click()}
                        >
                          Загрузить
                        </Button>
                      </>
                    )}
                    {s.type === 'boolean' ? (
                      <Button
                        size="sm"
                        variant={s.value ? 'danger' : 'primary'}
                        onClick={() => void toggleBoolean(s)}
                      >
                        {s.value ? 'Выключить' : 'Включить'}
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => setTarget(s)}>
                        Изменить
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <SettingEditModal
        target={target}
        onClose={() => setTarget(null)}
        onSubmit={onSubmit}
      />
    </div>
  );
}
