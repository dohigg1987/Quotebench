import { RELEASE_SMOKE_TENANT_ID } from "../lib/release-assurance.ts";

export type ReleaseMigration = {
  id: string;
  description: string;
  backwardCompatible: true;
  statements: string[];
};

// Release migrations are expand-only. Destructive cleanup belongs in a later,
// explicitly approved release after the prior Worker version is no longer a
// rollback target.
export const RELEASE_MIGRATIONS: ReleaseMigration[] = [
  {
    id: "20260816_001_release_assurance",
    description: "Create the isolated, non-billable release assurance tenant registry.",
    backwardCompatible: true,
    statements: [
      `CREATE TABLE IF NOT EXISTS _quotebench_release_tenants (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        billing_enabled INTEGER NOT NULL DEFAULT 0 CHECK (billing_enabled = 0),
        purpose TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `INSERT INTO _quotebench_release_tenants (id, display_name, billing_enabled, purpose)
       VALUES ('${RELEASE_SMOKE_TENANT_ID}', 'QuoteBench release assurance', 0, 'deterministic pricing and dependency smoke tests')
       ON CONFLICT (id) DO UPDATE SET display_name = excluded.display_name, billing_enabled = 0, purpose = excluded.purpose`,
    ],
  },
];

export const DESTRUCTIVE_MIGRATION_PATTERNS = [
  /\bDROP\s+(?:TABLE|COLUMN|SCHEMA|INDEX)\b/i,
  /\bTRUNCATE\b/i,
  /\bALTER\s+TABLE\b[\s\S]*\bRENAME\b/i,
  /\bALTER\s+(?:TABLE\b[\s\S]*)?\bTYPE\b/i,
  /\bSET\s+NOT\s+NULL\b/i,
];

export function destructiveStatements(migrations = RELEASE_MIGRATIONS) {
  return migrations.flatMap((migration) => migration.statements
    .filter((statement) => DESTRUCTIVE_MIGRATION_PATTERNS.some((pattern) => pattern.test(statement)))
    .map((statement) => ({ migration: migration.id, statement })));
}
