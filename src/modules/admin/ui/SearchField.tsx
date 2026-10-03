'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRef, useTransition } from 'react';
import { SearchField as SearchInput } from '@/components/ui';

/**
 * Búsqueda que filtra mientras se escribe (actualiza la URL sin recargar).
 * Dentro de un `<form method="get">` sigue funcionando con Intro y sin JS.
 * El aspecto es el `SearchField` del sistema (DS-07).
 */
export function SearchField({
  name = 'q',
  defaultValue,
  placeholder,
  label,
  className,
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
    <SearchInput
      name={name}
      defaultValue={defaultValue}
      placeholder={placeholder}
      label={label}
      pending={pending}
      onChange={(event) => update(event.target.value)}
      className={className}
    />
  );
}
