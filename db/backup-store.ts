const ARCHIVE_TABLES = [
  "api_access_log",
  "api_keys",
  "billing_subscriptions",
  "billing_invoices",
  "billing_events",
  "brand_profiles",
  "catalogue_item_proposal_types",
  "catalogue_items",
  "clients",
  "deal_redemptions",
  "document_templates",
  "metered_events",
  "onboarding_state",
  "pdf_jobs",
  "personal_templates",
  "pricing_rule_sets",
  "proposal_types",
  "quote_events",
  "quote_recipients",
  "quotes",
  "security_events",
  "service_categories",
  "stored_files",
  "tenant_cohorts",
  "tenant_entitlement_overrides",
  "tracking_events",
  "webhook_deliveries",
  "webhook_endpoints",
  "workspace_entitlements",
  "workspace_members",
  "operator_notes",
  "platform_admin_events",
] as const;

type TenantArchive = {
  format: "quotebench-tenant-archive";
  schemaVersion: 1;
  exportedAt: string;
  tenantId: string;
  tenant: Record<string, unknown>;
  tables: Record<string, Array<Record<string, unknown>>>;
  integritySha256: string;
};

async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function exportTenantArchive(tenantId: string): Promise<TenantArchive> {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("Backup storage is unavailable.");
  const existing = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table'").all<{ name: string }>();
  const available = new Set(existing.results.map((row) => row.name));
  const tenant = available.has("tenants")
    ? await env.DB.prepare("SELECT * FROM tenants WHERE id=?").bind(tenantId).first<Record<string, unknown>>()
    : null;
  if (!tenant) throw new Error("Tenant could not be archived.");
  const tables: TenantArchive["tables"] = {};
  for (const table of ARCHIVE_TABLES) {
    if (!available.has(table)) continue;
    const rows = await env.DB.prepare(`SELECT * FROM ${table} WHERE tenant_id=?`).bind(tenantId).all<Record<string, unknown>>();
    tables[table] = rows.results;
  }
  const body = {
    format: "quotebench-tenant-archive" as const,
    schemaVersion: 1 as const,
    exportedAt: new Date().toISOString(),
    tenantId,
    tenant,
    tables,
  };
  return { ...body, integritySha256: await digest(JSON.stringify(body)) };
}

export async function validateTenantArchive(value: unknown): Promise<{ valid: boolean; reason?: string }> {
  const archive = value as Partial<TenantArchive>;
  if (archive.format !== "quotebench-tenant-archive" || archive.schemaVersion !== 1) return { valid: false, reason: "unsupported_archive_format" };
  if (!archive.tenantId || !archive.tenant || !archive.tables || !archive.integritySha256) return { valid: false, reason: "incomplete_archive" };
  const body = {
    format: archive.format,
    schemaVersion: archive.schemaVersion,
    exportedAt: archive.exportedAt,
    tenantId: archive.tenantId,
    tenant: archive.tenant,
    tables: archive.tables,
  };
  return await digest(JSON.stringify(body)) === archive.integritySha256
    ? { valid: true }
    : { valid: false, reason: "archive_integrity_mismatch" };
}
