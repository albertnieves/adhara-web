'use client';

export function PrintButton({
  children = 'Imprimir',
  disabled = false,
}: {
  children?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => window.print()}
      className="bg-ink text-ivory hover:bg-ink-soft tracking-caps inline-flex min-h-11 items-center px-5 text-xs font-semibold uppercase transition-colors disabled:opacity-40"
    >
      {children}
    </button>
  );
}
