export default function AdminHome(): JSX.Element {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'CHCGREEN';

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold">{siteName} · Admin</h1>
      <p className="mt-4 text-text-secondary">
        Заглушка админ-панели. Следующие итерации — авторизация, дашборд, тикеты, финансы.
      </p>
    </main>
  );
}
