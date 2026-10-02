const STYLES: Record<string, { label: string; className: string }> = {
  draft: { label: 'Borrador', className: 'border-mist text-smoke' },
  published: { label: 'Publicado', className: 'border-success text-success' },
  archived: { label: 'Archivado', className: 'border-line text-fg-muted' },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? STYLES.draft!;
  return (
    <span
      className={`text-2xs tracking-caps inline-flex items-center border px-2 py-0.5 font-semibold uppercase ${style.className}`}
    >
      {style.label}
    </span>
  );
}
