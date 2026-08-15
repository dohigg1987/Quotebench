const TENANT_TABLES = [
  "api_access_log", "api_keys", "billing_subscriptions", "brand_profiles", "catalogue_items", "clients", "deal_redemptions",
  "document_templates", "metered_events", "onboarding_state", "pdf_jobs", "personal_templates", "pricing_rule_sets", "quote_events", "quote_recipients", "quotes",
  "security_events", "stored_files", "tracking_events", "webhook_deliveries", "webhook_endpoints",
  "tenant_cohorts", "workspace_entitlements", "workspace_members",
] as const;

export async function runRetentionJobs() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("Retention storage is unavailable.");
  const db = env.DB;
  const existing = await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all<{ name: string }>();
  const tableNames = new Set(existing.results.map((row) => row.name));
  const cleanup = [];
  if (tableNames.has("tracking_events")) cleanup.push(db.prepare("DELETE FROM tracking_events WHERE created_at < datetime('now','-24 months')"));
  if (tableNames.has("webhook_deliveries")) cleanup.push(db.prepare("DELETE FROM webhook_deliveries WHERE created_at < datetime('now','-30 days')"));
  if (tableNames.has("api_access_log")) cleanup.push(db.prepare("DELETE FROM api_access_log WHERE created_at < datetime('now','-90 days')"));
  if (tableNames.has("rate_limits")) cleanup.push(db.prepare("DELETE FROM rate_limits WHERE expires_at < CURRENT_TIMESTAMP"));
  if (cleanup.length) await db.batch(cleanup);

  if (!tableNames.has("tenants")) return { cleaned: cleanup.length, purgedTenants: 0 };
  const due = await db.prepare("SELECT id FROM tenants WHERE status='SoftDeleted' AND purge_after<=CURRENT_TIMESTAMP LIMIT 10").all<{ id: string }>();
  for (const tenant of due.results) {
    if (env.BUCKET) {
      let cursor: string | undefined;
      do {
        const page = await env.BUCKET.list({ prefix: `${tenant.id}/`, cursor, limit: 1000 });
        if (page.objects.length) await env.BUCKET.delete(page.objects.map((object) => object.key));
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
    }
    const statements = TENANT_TABLES.filter((table) => tableNames.has(table)).map((table) => db.prepare(`DELETE FROM ${table} WHERE tenant_id=?`).bind(tenant.id));
    statements.push(db.prepare("DELETE FROM tenants WHERE id=?").bind(tenant.id));
    await db.batch(statements);
  }
  return { cleaned: cleanup.length, purgedTenants: due.results.length };
}
