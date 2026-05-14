'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';

interface AvatarUploadProps {
  username: string;
  currentAvatarUrl?: string | null;
  onUploaded?: (url: string) => void;
}

export function AvatarUpload({ username, currentAvatarUrl, onUploaded }: AvatarUploadProps): JSX.Element {
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Разрешены только PNG, JPG, WEBP');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Файл не должен превышать 2 МБ');
      return;
    }
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    const fd = new FormData();
    fd.append('file', file);

    startTransition(async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
        const res = await fetch(`${apiUrl}/auth/avatar`, {
          method: 'POST',
          body: fd,
          credentials: 'include',
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { message?: string };
          setError(body.message ?? 'Ошибка загрузки');
          return;
        }
        const data = await res.json() as { avatarUrl: string };
        setPreview(data.avatarUrl);
        onUploaded?.(data.avatarUrl);
      } catch {
        setError('Ошибка сети');
      }
    });
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative group cursor-pointer"
        disabled={isPending}
        aria-label="Загрузить аватарку"
      >
        <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-brand/40 bg-bg-muted">
          {preview ? (
            <Image
              src={preview}
              alt={username}
              width={96}
              height={96}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-text-secondary">
              {username[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs font-semibold text-white">
            {isPending ? '...' : 'Изменить'}
          </span>
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <p className="text-xs text-text-secondary">PNG, JPG, WEBP · макс. 2 МБ</p>
    </div>
  );
}
