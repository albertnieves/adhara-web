/**
 * Minigráfico de una serie (p. ej. unidades por semana): línea fina en el
 * acento con el último punto marcado. Decorativo (aria-hidden): la cifra va
 * en el texto accesible que acompaña.
 */
export function Sparkline({
  values,
  label,
  className = 'h-6 w-24',
}: {
  values: readonly number[];
  /** Resumen para el lector de pantalla, p. ej. «12 semanas: de 0 a 4 uds». */
  label: string;
  className?: string;
}) {
  if (values.length < 2 || values.every((v) => v === 0)) {
    return (
      <span className={`text-fg-muted text-xs ${className}`}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  const max = Math.max(...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100;
    const y = 22 - ((v - min) / span) * 20;
    return [x, y] as const;
  });
  const last = points.at(-1)!;
  return (
    <span className={`inline-block ${className}`}>
      <svg
        viewBox="0 0 100 24"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="block h-full w-full overflow-visible"
      >
        <polyline
          points={points.map(([x, y]) => `${x},${y}`).join(' ')}
          className="stroke-accent fill-none"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={last[0]}
          cy={last[1]}
          r={1.8}
          className="fill-accent-fg"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
