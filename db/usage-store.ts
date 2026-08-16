import { getWorkspaceEntitlement } from "./quote-store";
import { getBillingWorkspace, PLAN_LIMITS } from "./billing-store";

export type UsageMetric = { key: string; label: string; used: number; limit: number; unit: "count" | "bytes" };

async function database() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("Usage storage is unavailable.");
  return env.DB;
}

export async function getWorkspaceUsage(tenantId: string) {
  const db = await database();
  const entitlement = await getWorkspaceEntitlement(tenantId);
  const [clients, seats, pdfs, emails, storage, billing] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS count FROM clients WHERE tenant_id = ? AND status = 'Active'").bind(tenantId).first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM workspace_members WHERE tenant_id = ? AND status != 'Removed'").bind(tenantId).first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM pdf_jobs WHERE tenant_id=? AND created_at>=datetime('now','start of month')").bind(tenantId).first<{count:number}>(),
    db.prepare("SELECT COUNT(*) AS count FROM quote_recipients WHERE tenant_id=? AND last_sent_at>=datetime('now','start of month')").bind(tenantId).first<{count:number}>(),
    db.prepare("SELECT COALESCE(SUM(size_bytes),0) AS bytes FROM stored_files WHERE tenant_id=?").bind(tenantId).first<{bytes:number}>(),
    getBillingWorkspace(tenantId),
  ]);
  const limits = billing.limits ?? PLAN_LIMITS.Professional;
  const metrics: UsageMetric[] = [
    { key: "clients", label: "Active clients", used: clients?.count ?? 0, limit: limits.clients, unit: "count" },
    { key: "seats", label: "Workspace seats", used: seats?.count ?? 0, limit: limits.seats, unit: "count" },
    { key: "quotes", label: "Quotes this month", used: entitlement.quotesUsedThisMonth, limit: entitlement.monthlyQuoteLimit, unit: "count" },
    { key: "pdfs", label: "PDF generations", used: pdfs?.count ?? 0, limit: limits.pdfs, unit: "count" },
    { key: "emails", label: "Emails sent", used: emails?.count ?? 0, limit: limits.emails, unit: "count" },
    { key: "storage", label: "Object storage", used: storage?.bytes ?? 0, limit: limits.storage, unit: "bytes" },
  ];
  return { planName: entitlement.planName, active: entitlement.active, metrics };
}
