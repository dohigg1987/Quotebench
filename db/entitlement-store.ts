import { getBillingWorkspace } from "./billing-store";
import { PLAN_LIMITS, type UsageMetricKey } from "./plans";

export type UsageMetric = { key: UsageMetricKey; label: string; used: number; limit: number; unit: "count" | "bytes"; state: "healthy" | "warning" | "blocked" };

async function database() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("Entitlement storage is unavailable.");
  return env.DB;
}

const metricLabels: Record<UsageMetricKey, string> = {
  clients: "Active clients",
  seats: "Workspace seats",
  quotes: "Quotes this month",
  pdfs: "PDF generations",
  emails: "Emails sent",
  storage: "Object storage",
};

export async function getUsageSnapshot(tenantId: string) {
  const db = await database();
  const [tenant, clients, seats, quotes, pdfs, emails, storage, billing] = await Promise.all([
    db.prepare("SELECT status FROM tenants WHERE id=?").bind(tenantId).first<{ status: string }>(),
    db.prepare("SELECT COUNT(*) AS count FROM clients WHERE tenant_id=? AND status='Active'").bind(tenantId).first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM workspace_members WHERE tenant_id=? AND status!='Removed'").bind(tenantId).first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM quotes WHERE tenant_id=? AND created_at>=datetime('now','start of month')").bind(tenantId).first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM pdf_jobs WHERE tenant_id=? AND created_at>=datetime('now','start of month')").bind(tenantId).first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM quote_recipients WHERE tenant_id=? AND last_sent_at>=datetime('now','start of month')").bind(tenantId).first<{ count: number }>(),
    db.prepare("SELECT COALESCE(SUM(size_bytes),0) AS bytes FROM stored_files WHERE tenant_id=?").bind(tenantId).first<{ bytes: number }>(),
    getBillingWorkspace(tenantId),
  ]);
  const limits = billing.limits ?? PLAN_LIMITS.Trial;
  const values: Record<UsageMetricKey, number> = {
    clients: Number(clients?.count ?? 0), seats: Number(seats?.count ?? 0), quotes: Number(quotes?.count ?? 0),
    pdfs: Number(pdfs?.count ?? 0), emails: Number(emails?.count ?? 0), storage: Number(storage?.bytes ?? 0),
  };
  const metrics = (Object.keys(values) as UsageMetricKey[]).map((key): UsageMetric => {
    const used = values[key]; const limit = limits[key]; const ratio = limit ? used / limit : 1;
    return { key, label: metricLabels[key], used, limit, unit: key === "storage" ? "bytes" : "count", state: ratio >= 1.1 ? "blocked" : ratio >= 1 ? "warning" : "healthy" };
  });
  return { planName: billing.effectivePlan, active: tenant?.status === "Active" && billing.accessActive, tenantStatus: tenant?.status ?? "Unknown", metrics };
}

export async function assertCapacity(tenantId: string, metric: UsageMetricKey, increment = 1) {
  const snapshot = await getUsageSnapshot(tenantId);
  if (snapshot.tenantStatus !== "Active") throw new Error("The workspace is not active.");
  if (!snapshot.active) throw new Error("The workspace is in read and export mode. An active entitlement is required to create new records.");
  const target = snapshot.metrics.find((item) => item.key === metric);
  if (!target) throw new Error("The requested entitlement metric is unavailable.");
  const hardLimit = Math.ceil(target.limit * 1.1);
  if (target.used + Math.max(0, increment) > hardLimit) throw new Error(`${target.label} hard limit reached (${hardLimit.toLocaleString("en-GB")}, including the 10% grace band).`);
  return { ...target, hardLimit };
}
