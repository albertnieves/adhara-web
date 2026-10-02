/** Campo con etiqueta para los formularios del panel. */
export function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-smoke text-[0.6875rem] font-semibold tracking-[0.16em] uppercase">
        {label}
      </span>
      {children}
      {hint && <span className="text-fg-muted text-xs">{hint}</span>}
    </label>
  );
}
