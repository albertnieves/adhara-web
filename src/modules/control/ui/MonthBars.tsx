import type { MonthKey } from '../domain/months';
import { monthLabel, monthShortLabel } from '../domain/months';

export type MonthValue = { month: MonthKey; value: number };

/**
 * Barras de una sola serie por mes, con base en cero: hacia arriba los
 * valores positivos (acento) y hacia abajo los negativos (peligro). Cada barra
 * lleva su valor en el título (al pasar el ratón) y en la lista accesible; la
 * tabla de la página tiene las cifras exactas.
 */
export function MonthBars({
  title,
  data,
  format,
  highlight,
}: {
  title: string;
  data: readonly MonthValue[];
  format: (value: number) => string;
  /** Mes que se rotula con su valor (normalmente el actual). */
  highlight?: MonthKey;
}) {
  const positive = Math.max(0, ...data.map((d) => d.value));
  const negative = Math.max(0, ...data.map((d) => -d.value));
  const range = positive + negative;
  // Reparto de la altura entre la parte positiva y la negativa.
  const upShare = range === 0 ? 1 : positive / range;

  return (
    <figure className="min-w-0">
      <figcaption className="text-fg-muted text-2xs tracking-caps mb-3 font-semibold uppercase">
        {title}
      </figcaption>
      {range === 0 ? (
        <p className="text-fg-muted border-border border-y py-10 text-center text-sm">
          Sin datos en estos meses.
        </p>
      ) : (
        <ol
          className="grid h-44 gap-0.5"
          style={{
            gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
          }}
        >
          {data.map((d) => {
            const up = d.value > 0 ? d.value / positive : 0;
            const down = d.value < 0 ? -d.value / negative : 0;
            const label = `${monthLabel(d.month)}: ${format(d.value)}`;
            return (
              <li
                key={d.month}
                title={label}
                aria-label={label}
                className="group flex min-w-0 flex-col"
              >
                <div className="flex min-h-0 flex-1 flex-col">
                  <div
                    className="border-border-strong flex items-end border-b"
                    style={{ height: `${upShare * 100}%` }}
                  >
                    {up > 0 && (
                      <div
                        className="bg-accent group-hover:bg-accent-fg mx-auto w-full max-w-8 rounded-t-sm transition-colors"
                        style={{ height: `${Math.max(up * 100, 1.5)}%` }}
                      />
                    )}
                  </div>
                  <div
                    className="flex items-start"
                    style={{ height: `${(1 - upShare) * 100}%` }}
                  >
                    {down > 0 && (
                      <div
                        className="bg-danger mx-auto w-full max-w-8 rounded-b-sm opacity-80 transition-opacity group-hover:opacity-100"
                        style={{ height: `${Math.max(down * 100, 1.5)}%` }}
                      />
                    )}
                  </div>
                </div>
                <span
                  aria-hidden="true"
                  className={`text-2xs mt-1.5 truncate text-center ${d.month === highlight ? 'text-fg font-semibold' : 'text-fg-muted'}`}
                >
                  {monthShortLabel(d.month)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {highlight && range > 0 && (
        <p className="text-fg-muted mt-3 text-xs">
          {monthLabel(highlight)}:{' '}
          <span className="text-fg font-semibold tabular-nums">
            {format(data.find((d) => d.month === highlight)?.value ?? 0)}
          </span>
        </p>
      )}
    </figure>
  );
}
