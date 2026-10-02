'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRef, useTransition } from 'react';

/**
 * Búsqueda que filtra mientras se escribe (actualiza la URL sin recargar).
 * Dentro de un `<form method="get">` sigue funcionando con Intro y sin JS.
 */
export function SearchField({
  name = 'q',
  defaultValue,
  placeholder,
  label,
  className = '',
}: {
  name?: string;
  defaultValue?: string;
  placeholder: string;
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const timer = useRef<number | undefined>(undefined);

  function update(value: string) {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const next = new URLSearchParams(params);
      if (value.trim()) next.set(name, value.trim());
      else next.delete(name);
      startTransition(() => {
        router.replace(`${pathname}${next.size ? `?${next}` : ''}`, {
          scroll: false,
        });
      });
    }, 250);
  }

  return (
    <div className={`relative ${className}`}>
      <input
        type="search"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={label}
        onChange={(event) => update(event.target.value)}
        className="input pr-10"
      />
      <span
        aria-hidden="true"
        className={`border-ink/40 absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin rounded-full border border-t-transparent transition-opacity ${pending ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
