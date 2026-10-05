'use client';

import { useState } from 'react';
import { DURATION_TOKENS } from '../domain/tokens';
import { buttonClass } from '@/components/ui';

/**
 * Las tres duraciones con la curva de la marca. Con «reducir movimiento» el
 * CSS global las anula y el punto salta sin desplazarse.
 */
export function MotionDemo() {
  const [moved, setMoved] = useState(false);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <button
          type="button"
          className={buttonClass('outline')}
          aria-pressed={moved}
          onClick={() => setMoved((value) => !value)}
        >
          {moved ? 'Volver' : 'Reproducir'}
        </button>
      </div>
      <ul className="flex flex-col gap-4">
        {DURATION_TOKENS.map((token) => (
          <li key={token.variable} className="flex flex-col gap-2">
            <code className="text-xs">{token.variable}</code>
            <div
              aria-hidden="true"
              className="bg-surface-sunken overflow-hidden pr-3"
            >
              <div
                className="h-3 w-full"
                style={{
                  transform: moved ? 'translateX(100%)' : 'none',
                  transition: `transform var(${token.variable}) var(--ease-luxe)`,
                }}
              >
                <span className="bg-accent block size-3" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
