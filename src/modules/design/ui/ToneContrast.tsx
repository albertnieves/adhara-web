'use client';

import { useCallback, useState } from 'react';
import { contrastRatio, formatRatio, parseColor } from '../domain/contrast';
import type { Rgb } from '../domain/contrast';
import {
  GRAPHIC_COLORS,
  TEXT_COLORS,
  TONES,
  backgroundsFor,
  colorsFor,
  fixedPairs,
  matrixPairs,
} from '../domain/tokens';
import type { ContrastPair, ToneId } from '../domain/tokens';

const COLORS = Object.fromEntries(
  TONES.map((tone) => [tone.id, colorsFor(tone.id)]),
) as Record<ToneId, string[]>;

const ROWS = [...TEXT_COLORS, ...GRAPHIC_COLORS, 'accent'];

type Colors = Record<string, Rgb | null>;

function ratioOf(pair: ContrastPair, colors: Colors | null) {
  const fg = colors?.[pair.fg];
  const bg = colors?.[pair.bg];
  return fg && bg ? contrastRatio(fg, bg) : null;
}

/**
 * Muestra de una combinación: el contraste escrito con el color sobre su
 * fondo (texto) o dentro de un borde de 2 px de ese color (gráfico).
 */
function Chip({ pair, ratio }: { pair: ContrastPair; ratio: number | null }) {
  const fails = ratio !== null && ratio < pair.min;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span
        className="inline-flex min-h-9 min-w-20 items-center justify-center border-2 px-2 text-sm tabular-nums"
        style={{
          background: `var(--color-${pair.bg})`,
          color: `var(--color-${pair.kind === 'text' ? pair.fg : 'fg'})`,
          borderColor:
            pair.kind === 'text'
              ? `var(--color-${pair.bg})`
              : `var(--color-${pair.fg})`,
        }}
      >
        {ratio === null ? '…' : formatRatio(ratio)}
      </span>
      {fails && <span className="text-danger text-xs">No cumple</span>}
    </span>
  );
}

/**
 * Contraste de las combinaciones permitidas en un tono, calculado con los
 * colores que aplica el navegador dentro de ese tono. Es la misma matriz que
 * comprueba tests/unit/design-tokens.test.ts.
 */
export function ToneContrast({ tone }: { tone: ToneId }) {
  const [colors, setColors] = useState<Colors | null>(null);
  const ref = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      const style = getComputedStyle(el);
      setColors(
        Object.fromEntries(
          COLORS[tone].map((name) => [
            name,
            parseColor(style.getPropertyValue(`--color-${name}`)),
          ]),
        ),
      );
    },
    [tone],
  );

  const label = TONES.find((t) => t.id === tone)?.label ?? tone;
  const bgs = backgroundsFor(tone);
  const matrix = matrixPairs(tone);
  const fixed = fixedPairs(tone);
  const all = [...matrix, ...fixed];
  const passing = all.filter((pair) => {
    const ratio = ratioOf(pair, colors);
    return ratio !== null && ratio >= pair.min;
  }).length;

  return (
    <div
      ref={ref}
      aria-busy={colors === null ? true : undefined}
      className="flex flex-col gap-8"
    >
      <p className="text-sm">
        {colors === null
          ? 'Calculando el contraste…'
          : `Cumplen ${passing} de ${all.length} combinaciones.`}
      </p>
      <table className="data-table stack-table">
        <caption className="sr-only">
          Contraste de cada color sobre cada fondo en el tono {label}
        </caption>
        <thead>
          <tr>
            <th scope="col">Color</th>
            {bgs.map((bg) => (
              <th key={bg} scope="col">
                Sobre <code className="normal-case">{bg}</code>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((fg) => {
            const first = matrix.find((p) => p.fg === fg)!;
            return (
              <tr key={fg}>
                <td data-primary>
                  <code className="text-sm">{fg}</code>
                  <span className="text-fg-muted block text-xs">
                    {first.kind === 'text' ? 'Texto' : 'Gráfico'}, mínimo{' '}
                    {first.min.toLocaleString('es-ES')}:1
                  </span>
                </td>
                {bgs.map((bg) => {
                  const pair = matrix.find((p) => p.fg === fg && p.bg === bg);
                  return (
                    <td key={bg} data-label={`Sobre ${bg}`}>
                      {pair ? (
                        <Chip pair={pair} ratio={ratioOf(pair, colors)} />
                      ) : (
                        <span className="text-fg-muted text-xs">
                          Solo adorno
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <table className="data-table stack-table">
        <caption className="text-fg-muted mb-2 text-left text-sm">
          Combinaciones fijas
        </caption>
        <thead>
          <tr>
            <th scope="col">Color</th>
            <th scope="col">Fondo</th>
            <th scope="col">Contraste</th>
          </tr>
        </thead>
        <tbody>
          {fixed.map((pair) => (
            <tr key={`${pair.fg}-${pair.bg}`}>
              <td data-primary>
                <code className="text-sm">{pair.fg}</code>
              </td>
              <td data-label="Fondo">
                <code className="text-sm">{pair.bg}</code>
              </td>
              <td data-label="Contraste">
                <Chip pair={pair} ratio={ratioOf(pair, colors)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
