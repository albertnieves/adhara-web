'use client';

import { useId, useState } from 'react';
import type { SearchableVariant } from '../domain/counter';
import { findByCode, searchVariants } from '../domain/counter';
import { CONTROL_CLASSES, Eyebrow } from '@/components/ui';

/**
 * Buscador de formatos para pantallas táctiles. Un lector de códigos USB o
 * Bluetooth teclea el código y Enter: si coincide con un SKU o EAN exacto, se
 * elige sin tocar la pantalla.
 */
export function VariantSearch<T extends SearchableVariant>({
  items,
  onPick,
  label = 'Buscar perfume',
  placeholder = 'Nombre, marca, SKU o código de barras',
  autoFocus = false,
  renderMeta,
  isDisabled,
}: {
  items: readonly T[];
  onPick: (item: T) => void;
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Dato extra a la derecha de cada resultado (disponible, PVP…). */
  renderMeta?: (item: T) => React.ReactNode;
  isDisabled?: (item: T) => boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const results = searchVariants(items, query);

  function pick(item: T) {
    onPick(item);
    setQuery('');
    setNotice(null);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const exact = findByCode(items, query);
    const candidate = exact ?? (results.length === 1 ? results[0]! : null);
    if (candidate && !isDisabled?.(candidate)) pick(candidate);
    else if (query.trim() && results.length === 0) {
      setNotice(`Sin resultados para «${query.trim()}».`);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id}>
        <Eyebrow as="span">{label}</Eyebrow>
      </label>
      <input
        id={id}
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setNotice(null);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="search"
        className={`${CONTROL_CLASSES} min-h-12 text-base`}
      />
      {notice && (
        <p role="status" className="text-danger text-sm">
          {notice}
        </p>
      )}
      {results.length > 0 && (
        <ul className="border-border divide-border bg-surface-raised/70 max-h-80 divide-y overflow-y-auto border">
          {results.map((item) => {
            const disabled = isDisabled?.(item) ?? false;
            return (
              <li key={item.variantId}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(item)}
                  className="hover:bg-surface-raised flex min-h-12 w-full items-center justify-between gap-4 px-4 py-2 text-left text-sm transition-colors disabled:opacity-40"
                >
                  <span>
                    <span className="text-fg-muted">{item.brandName} · </span>
                    {item.productName}
                    <span className="text-fg-muted">
                      {' '}
                      · {item.variantLabel}
                    </span>
                    {item.sku && (
                      <span className="text-fg-muted block text-xs">
                        {item.sku}
                      </span>
                    )}
                  </span>
                  {renderMeta && (
                    <span className="shrink-0 text-xs tabular-nums">
                      {renderMeta(item)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
