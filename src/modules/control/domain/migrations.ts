/**
 * Migraciones del repositorio (supabase/migrations), para comparar con las
 * aplicadas en la base desde la consola (Estado del sistema). Una prueba
 * unitaria exige que esta lista coincida con los archivos: al añadir una
 * migración, se añade aquí.
 */
export const REPO_MIGRATIONS: readonly (readonly [
  version: string,
  name: string,
])[] = [
  ['20260929170331', 'extensions_and_schemas'],
  ['20260929170455', 'staff_and_permissions'],
  ['20260929170513', 'staff_foreign_key_indexes'],
  ['20260929220732', 'catalog'],
  ['20260929220840', 'inventory'],
  ['20260929224423', 'staff_admin'],
  ['20260929230737', 'inventory_levels_cascade'],
  ['20260929232007', 'staff_pending_grants'],
  ['20260930045615', 'variant_costs'],
  ['20260930083657', 'variant_costs_batch'],
  ['20260930220818', 'admin_mfa_guards'],
  ['20260930220820', 'admin_safe_edits'],
  ['20260930220822', 'store_content'],
  ['20260930220824', 'staff_invitations'],
  ['20260930224000', 'purchasing_counter_replenishment'],
  ['20261001090000', 'reports'],
  ['20261002044249', 'assistant_daily_reports'],
  ['20261009150000', 'scent_profiles'],
  ['20261009150100', 'newsletter_subscribers'],
  ['20261010120000', 'business_control'],
  ['20261011090000', 'control_owners'],
  ['20261011090100', 'product_metrics'],
  ['20261011090200', 'product_attention'],
  ['20261011090300', 'backups_system'],
  ['20261011230000', 'web_orders'],
  ['20261012120000', 'web_checkout'],
  ['20261012180000', 'web_payments'],
  ['20261012190000', 'order_emails'],
  ['20261012200000', 'order_refunds'],
];

/** Última migración que espera este código. */
export const LATEST_MIGRATION = REPO_MIGRATIONS.at(-1)?.[0] ?? null;

export type AppliedMigration = { version: string; name: string | null };

export type MigrationDiff = {
  /** En el repositorio y no aplicadas en esta base. */
  pending: { version: string; name: string }[];
  /** Aplicadas en esta base y que no están en el repositorio. */
  unknown: AppliedMigration[];
  applied: number;
};

export function migrationDiff(
  repo: readonly (readonly [string, string])[],
  applied: readonly AppliedMigration[],
): MigrationDiff {
  const appliedVersions = new Set(applied.map((m) => m.version));
  const repoVersions = new Set(repo.map(([version]) => version));
  return {
    pending: repo
      .filter(([version]) => !appliedVersions.has(version))
      .map(([version, name]) => ({ version, name })),
    unknown: applied.filter((m) => !repoVersions.has(m.version)),
    applied: applied.length,
  };
}
