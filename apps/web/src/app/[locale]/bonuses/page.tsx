import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@chcgreen/ui';

export const dynamic = 'force-dynamic';

interface BonusesPageProps {
  params: { locale: string };
}

export async function generateMetadata({ params }: BonusesPageProps): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'bonuses' });
  return { title: t('pageTitle') };
}

interface BonusItem {
  title: string;
  subtitle: string;
  text: string;
  badge: string;
  tone: 'brand' | 'purple' | 'success' | 'info';
}

const RU_ITEMS: BonusItem[] = [
  {
    title: 'Бонус первого пополнения',
    subtitle: '+100% к первому депозиту',
    text: 'При первом пополнении баланса от 20 AZN мы удваиваем сумму. Бонусные средства можно использовать сразу для покупки кодов.',
    badge: '100%',
    tone: 'brand',
  },
  {
    title: 'Кэшбэк выходного дня',
    subtitle: '5% возврат каждое воскресенье',
    text: 'В воскресенье в 23:59 мы возвращаем 5% от ваших расходов за неделю прямо на баланс. Без отыгрыша, без ограничений.',
    badge: '5%',
    tone: 'purple',
  },
  {
    title: 'Реферальная программа',
    subtitle: '10% с пополнений друзей',
    text: 'Делитесь реферальной ссылкой — за каждое пополнение приглашённого друга получаете 10% бонусом. Лимит не ограничен.',
    badge: '10%',
    tone: 'success',
  },
  {
    title: 'Ранги и привилегии',
    subtitle: 'Чем выше ранг — тем больше плюшек',
    text: 'Повышенный кэшбэк, приоритетная поддержка, эксклюзивные коды и индивидуальные бонусы от модераторов на высоких рангах.',
    badge: 'VIP',
    tone: 'info',
  },
];

const AZ_ITEMS: BonusItem[] = [
  {
    title: 'İlk depozit bonusu',
    subtitle: 'İlk depozitə +100%',
    text: '20 AZN-dən başlayan ilk depozitdə məbləği ikiqat artırırıq. Bonus vəsaitləri dərhal kod almaq üçün istifadə oluna bilər.',
    badge: '100%',
    tone: 'brand',
  },
  {
    title: 'Həftəsonu keş-bek',
    subtitle: 'Hər bazar 5% geri qaytarma',
    text: 'Bazar günü 23:59-da həftəlik xərclərinizin 5%-ni birbaşa balansa qaytarırıq. İddiasız, məhdudiyyətsiz.',
    badge: '5%',
    tone: 'purple',
  },
  {
    title: 'Referal proqramı',
    subtitle: 'Dostların depozitindən 10%',
    text: 'Referal linkinizi paylaşın — dəvət etdiyiniz hər dostun depoziti üçün 10% bonus alın. Limit yoxdur.',
    badge: '10%',
    tone: 'success',
  },
  {
    title: 'Ranqlar və imtiyazlar',
    subtitle: 'Ranq nə qədər yüksəkdirsə, bonus o qədər çox',
    text: 'Artırılmış keş-bek, prioritet dəstək, eksklüziv kodlar və yüksək ranqlarda moderatorların fərdi bonusları.',
    badge: 'VIP',
    tone: 'info',
  },
];

const toneBg: Record<BonusItem['tone'], string> = {
  brand: 'bg-brand/15 text-brand border-brand/30',
  purple: 'bg-accent-purple/15 text-accent-purple border-accent-purple/30',
  success: 'bg-success/15 text-success border-success/30',
  info: 'bg-info/15 text-info border-info/30',
};

export default async function BonusesPage({ params }: BonusesPageProps): Promise<JSX.Element> {
  const t = await getTranslations({ locale: params.locale, namespace: 'bonuses' });
  const items = params.locale === 'az' ? AZ_ITEMS : RU_ITEMS;

  return (
    <AppShell locale={params.locale}>
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold text-text-primary">{t('pageTitle')}</h1>
        <p className="mt-2 text-text-secondary">{t('subtitle')}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {items.map((it, idx) => (
            <Card key={idx} variant="elevated" padding="lg">
              <div className="flex items-start gap-4">
                <span
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border text-sm font-bold ${toneBg[it.tone]}`}
                >
                  {it.badge}
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-text-primary">{it.title}</h3>
                  <p className="mt-0.5 text-sm text-text-secondary">{it.subtitle}</p>
                  <p className="mt-3 text-sm leading-relaxed text-text-secondary">{it.text}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
