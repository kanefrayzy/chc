import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@chcgreen/ui';

export const dynamic = 'force-dynamic';

interface FaqPageProps {
  params: { locale: string };
}

export async function generateMetadata({ params }: FaqPageProps): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'faq' });
  return { title: t('pageTitle') };
}

interface QA {
  q: string;
  a: string;
}

const RU_ITEMS: QA[] = [
  {
    q: 'Как пополнить баланс?',
    a: 'Откройте модалку «Пополнить» в шапке, выберите платёжный метод и введите сумму. Зачисление мгновенное после подтверждения провайдера.',
  },
  {
    q: 'Какие платёжные методы доступны?',
    a: 'Картой AZN и криптой USDT (TRC20). Список методов администратор может расширять — иконки и валюты видны прямо на карточках.',
  },
  {
    q: 'Сколько идёт вывод средств?',
    a: 'Автоматические выводы по карте и крипте — до 15 минут. Ручной вывод через модератора — в течение суток.',
  },
  {
    q: 'Что такое «купить код»?',
    a: 'Это запрос на код игры через модератора. Нажмите «Купить код», откроется тикет в чате — модератор согласует сумму и пришлёт 14-значный код.',
  },
  {
    q: 'Как ввести код?',
    a: 'Перейдите в раздел «Играть», вставьте 14-значный код и нажмите «Играть». Откроется игровая сессия в новой вкладке.',
  },
  {
    q: 'Что показывает «История операций»?',
    a: 'Все пополнения, выводы и покупки кодов в одной таблице — на странице профиля во вкладке «История».',
  },
  {
    q: 'Безопасно ли хранить деньги на балансе?',
    a: 'Баланс хранится в qəpik (минорных единицах AZN), все операции идемпотентны и проходят через журналируемые транзакции.',
  },
];

const AZ_ITEMS: QA[] = [
  {
    q: 'Balansı necə artırmaq olar?',
    a: 'Yuxarıda «Artırmaq» düyməsini açın, ödəniş üsulunu seçin və məbləği daxil edin. Provayder təsdiqindən sonra dərhal hesaba düşür.',
  },
  {
    q: 'Hansı ödəniş üsulları mövcuddur?',
    a: 'AZN kart və USDT TRC20 ilə. Admin yeni üsullar əlavə edə bilər — ikon və valyuta kartda görünür.',
  },
  {
    q: 'Çıxarış nə qədər çəkir?',
    a: 'Avtomatik (kart, kripto) — 15 dəqiqəyə qədər. Manual moderator vasitəsilə — 24 saat ərzində.',
  },
  {
    q: '«Kod almaq» nədir?',
    a: 'Moderator vasitəsilə oyun kodu istəyidir. «Kod al» düyməsi tiket açır — moderator məbləği razılaşdırıb 14 rəqəmli kod göndərir.',
  },
  {
    q: 'Kodu necə daxil etmək olar?',
    a: '«Oyna» bölməsinə keçin, 14 rəqəmli kodu yapışdırın və «Oyna» düyməsini basın.',
  },
  {
    q: '«Əməliyyat tarixçəsi» nəyi göstərir?',
    a: 'Bütün artırma, çıxarış və kod alışları profil səhifəsindəki «Tarixçə» tabında bir cədvəldə.',
  },
  {
    q: 'Balansda pul saxlamaq təhlükəsizdirmi?',
    a: 'Balans qəpiklərdə saxlanılır, bütün əməliyyatlar idempotentdir və jurnallanmış tranzaksiyalardan keçir.',
  },
];

export default async function FaqPage({ params }: FaqPageProps): Promise<JSX.Element> {
  const t = await getTranslations({ locale: params.locale, namespace: 'faq' });
  const items = params.locale === 'az' ? AZ_ITEMS : RU_ITEMS;

  return (
    <AppShell locale={params.locale}>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-text-primary">{t('pageTitle')}</h1>
        <p className="mt-2 text-text-secondary">{t('subtitle')}</p>
        <div className="mt-8 space-y-3">
          {items.map((it, idx) => (
            <Card key={idx} variant="elevated" padding="md">
              <details className="group">
                <summary className="cursor-pointer list-none flex items-start justify-between gap-3">
                  <span className="text-base font-semibold text-text-primary">{it.q}</span>
                  <span
                    aria-hidden
                    className="mt-1 text-text-secondary transition-transform group-open:rotate-180"
                  >
                    ▾
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">{it.a}</p>
              </details>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
