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
  {
    id: "20260817_002_us_uk_commercialisation",
    description: "Add tenant market, localisation, tax, durable notification and connector records.",
    backwardCompatible: true,
    statements: [
      `CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        currency TEXT NOT NULL,
        market TEXT NOT NULL DEFAULT 'GB',
        country_code TEXT NOT NULL DEFAULT 'GB',
        locale TEXT NOT NULL DEFAULT 'en-GB',
        timezone TEXT NOT NULL DEFAULT 'Europe/London',
        tax_registration_status TEXT NOT NULL DEFAULT 'registered',
        prices_include_tax INTEGER NOT NULL DEFAULT 0,
        tax_configuration_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'Active',
        tracking_enabled INTEGER NOT NULL DEFAULT 1,
        deleted_at TEXT,
        purge_after TEXT,
        billing_anniversary_day INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS market TEXT NOT NULL DEFAULT 'GB'",
      "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS country_code TEXT NOT NULL DEFAULT 'GB'",
      "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en-GB'",
      "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Europe/London'",
      "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tax_registration_status TEXT NOT NULL DEFAULT 'registered'",
      "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS prices_include_tax INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tax_configuration_json TEXT NOT NULL DEFAULT '{}'",
      `CREATE TABLE IF NOT EXISTS notification_reads (
        tenant_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        event_id TEXT NOT NULL,
        read_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (tenant_id, user_email, event_id)
      )`,
      "CREATE INDEX IF NOT EXISTS notification_reads_tenant_user_idx ON notification_reads (tenant_id, user_email, read_at)",
      `CREATE TABLE IF NOT EXISTS integration_connections (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending_authorisation',
        display_name TEXT NOT NULL,
        external_account_id TEXT,
        encrypted_credentials TEXT,
        configuration_json TEXT NOT NULL DEFAULT '{}',
        connected_by TEXT,
        connected_at TIMESTAMPTZ,
        last_sync_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      "CREATE INDEX IF NOT EXISTS integration_connections_tenant_idx ON integration_connections (tenant_id, category, provider)",
      `CREATE TABLE IF NOT EXISTS integration_sync_runs (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        connection_id TEXT NOT NULL,
        direction TEXT NOT NULL,
        status TEXT NOT NULL,
        records_read INTEGER NOT NULL DEFAULT 0,
        records_written INTEGER NOT NULL DEFAULT 0,
        records_failed INTEGER NOT NULL DEFAULT 0,
        cursor_value TEXT,
        error_code TEXT,
        error_summary TEXT,
        started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMPTZ
      )`,
      "CREATE INDEX IF NOT EXISTS integration_sync_runs_tenant_connection_idx ON integration_sync_runs (tenant_id, connection_id, started_at)",
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
