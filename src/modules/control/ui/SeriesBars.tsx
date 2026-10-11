export type BarValue = {
  key: string;
  /** Rótulo completo (título y lector de pantalla). */
  label: string;
  /** Rótulo corto bajo la barra; vacío para no rotular. */
  short: string;
  value: number;
  /** Marca la barra (p. ej. un tramo con rotura de stock). */
  flagged?: boolean;
};

/**
 * Barras de una sola serie por tramo (días, semanas o meses), con base en
 * cero; los negativos bajan en peligro. Cada barra lleva su cifra en el
 * título y en la lista accesible.
 */
export function SeriesBars({
  title,
  data,
  format,
  height = 'h-32',
  note,
}: {
  title: string;
  data: readonly BarValue[];
  format: (value: number) => string;
  height?: string;
  note?: string;
}) {
  const positive = Math.max(0, ...data.map((d) => d.value));
  const negative = Math.max(0, ...data.map((d) => -d.value));
  const range = positive + negative;
  const upShare = range === 0 ? 1 : positive / range;
  return (
    <figure className="min-w-0">
      <figcaption className="text-fg-muted text-2xs tracking-caps-sm mb-2 flex justify-between gap-2 font-semibold uppercase">
        <span>{title}</span>
        {note && <span className="normal-case">{note}</span>}
      </figcaption>
      {range === 0 ? (
        <p className="text-fg-muted border-border border-y py-6 text-center text-sm">
          Sin datos en este periodo.
        </p>
      ) : (
        <ol
          className={`grid gap-px ${height}`}
          style={{
            gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
          }}
        >
          {data.map((d) => {
            const up = d.value > 0 ? d.value / positive : 0;
            const down = d.value < 0 ? -d.value / negative : 0;
            const text = `${d.label}: ${format(d.value)}${d.flagged ? ' (sin existencias parte del tramo)' : ''}`;
            return (
              <li
                key={d.key}
                title={text}
                aria-label={text}
                className="group flex min-w-0 flex-col"
              >
                <div className="flex min-h-0 flex-1 flex-col">
                  <div
                    className="border-border-strong flex items-end border-b"
                    style={{ height: `${upShare * 100}%` }}
                  >
                    {up > 0 && (
                      <div
                        className={`mx-auto w-full max-w-6 rounded-t-sm transition-colors ${d.flagged ? 'bg-warning' : 'bg-accent group-hover:bg-accent-fg'}`}
                        style={{ height: `${Math.max(up * 100, 2)}%` }}
                      />
                    )}
                  </div>
                  <div
                    className="flex items-start"
                    style={{ height: `${(1 - upShare) * 100}%` }}
                  >
                    {down > 0 && (
                      <div
                        className="bg-danger mx-auto w-full max-w-6 rounded-b-sm"
                        style={{ height: `${Math.max(down * 100, 2)}%` }}
                      />
                    )}
                  </div>
                </div>
                <span
                  aria-hidden="true"
                  className="text-fg-muted text-2xs mt-1 h-4 truncate text-center"
                >
                  {d.short}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </figure>
  );
}
