'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui';
import type { IconName } from '@/components/ui';
import type { CatalogView } from './catalogView';

const VIEWS: { value: CatalogView; icon: IconName; label: string }[] = [
  { value: 'grid', icon: 'grid', label: 'viewGrid' },
  { value: 'large', icon: 'tile', label: 'viewLarge' },
];

/**
 * Cuadrícula o vista amplia, solo en el móvil (desde 640 px las dos vistas
 * son iguales). Dos botones de 44 px con aria-pressed.
 */
export function ViewToggle({
  view,
  onChange,
  className,
}: {
  view: CatalogView;
  onChange: (view: CatalogView) => void;
  /** Solo colocación. */
  className?: string;
}) {
  const t = useTranslations('catalog');
  return (
    <div
      role="group"
      aria-label={t('view')}
      className={`flex sm:hidden ${className ?? ''}`}
    >
      {VIEWS.map(({ value, icon, label }, index) => {
        const active = view === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            aria-label={t(label)}
            title={t(label)}
            onClick={() => onChange(value)}
            // Unidos: el segundo monta su borde sobre el del primero.
            className={`ease-luxe inline-flex size-11 items-center justify-center border transition-colors duration-(--duration-fast) ${index > 0 ? '-ml-px' : ''} ${active ? 'border-fg bg-fg text-fg-inverse relative' : 'border-border-strong text-fg hover:bg-surface-raised'}`}
          >
            <Icon name={icon} />
          </button>
        );
      })}
    </div>
  );
}
