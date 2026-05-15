'use client';

interface PlayPageProps {
  casinoUrl: string;
}

export function PlayPage({ casinoUrl }: PlayPageProps): JSX.Element {
  const url = casinoUrl || 'https://star7sky.store/';

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col">
      <iframe
        src={url}
        title="Купить код"
        className="h-full w-full flex-1 border-0"
        allow="fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
