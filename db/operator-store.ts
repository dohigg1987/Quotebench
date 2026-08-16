import { exportTenantArchive } from "./backup-store";
import { createStripePortal, ensureBillingSchema, getBillingWorkspace, listBillingHistory } from "./billing-store";
import { getUsageSnapshot } from "./entitlement-store";
import { inviteWorkspaceMember } from "./member-store";
import { isPlanName, PLAN_MONTHLY_PRICE_MINOR, type PlanName } from "./plans";

const ADMIN_EVENT_SCHEMA = `CREATE TABLE IF NOT EXISTS platform_admin_events (id TEXT PRIMARY KEY,tenant_id TEXT,actor_email TEXT NOT NULL,action TEXT NOT NULL,resource_type TEXT NOT NULL,resource_id TEXT,reason TEXT NOT NULL,before_json TEXT NOT NULL DEFAULT '{}',after_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
const NOTE_SCHEMA = `CREATE TABLE IF NOT EXISTS operator_notes (id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,body TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`;

async function ensureOperatorSchema() {
  const db = await ensureBillingSchema();
  await db.batch([
    db.prepare(ADMIN_EVENT_SCHEMA), db.prepare(NOTE_SCHEMA),
    db.prepare("CREATE INDEX IF NOT EXISTS platform_admin_events_tenant_created_idx ON platform_admin_events (tenant_id,created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS operator_notes_tenant_created_idx ON operator_notes (tenant_id,created_at)"),
  ]);
  return db;
}

async function logAdminAction(input: { tenantId?: string | null; actorEmail: string; action: string; resourceType: string; resourceId?: string | null; reason: string; before?: unknown; after?: unknown }) {
  const db = await ensureOperatorSchema();
  await db.prepare("INSERT INTO platform_admin_events (id,tenant_id,actor_email,action,resource_type,resource_id,reason,before_json,after_json) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), input.tenantId ?? null, input.actorEmail.toLowerCase(), input.action, input.resourceType, input.resourceId ?? null, input.reason.trim().slice(0, 500), JSON.stringify(input.before ?? {}), JSON.stringify(input.after ?? {})).run();
}

function computedPlan(row: Record<string, unknown>): PlanName {
  if (isPlanName(row.override_plan)) return row.override_plan;
  if (row.subscription_status === "active" && isPlanName(row.subscription_plan)) return row.subscription_plan;
  const tier = Number(row.lifetime_tier ?? 0); return tier >= 3 ? "Scale" : tier >= 2 ? "Professional" : tier >= 1 ? "Starter" : "Trial";
}

export async function getPlatformOverview(filters: { search?: string; status?: string; plan?: string } = {}) {
  const db = await ensureOperatorSchema();
  const rows = await db.prepare(`SELECT t.id,t.name,t.currency,t.status,t.created_at,t.updated_at,
    (SELECT email FROM workspace_members m WHERE m.tenant_id=t.id AND m.role='owner' AND m.status='Active' ORDER BY m.joined_at LIMIT 1) AS owner_email,
    (SELECT COUNT(*) FROM workspace_members m WHERE m.tenant_id=t.id AND m.status!='Removed') AS member_count,
    (SELECT COUNT(*) FROM clients c WHERE c.tenant_id=t.id AND c.status='Active') AS client_count,
    (SELECT COUNT(*) FROM quotes q WHERE q.tenant_id=t.id AND q.created_at>=datetime('now','start of month')) AS quotes_month,
    (SELECT COALESCE(SUM(q.one_off_total_minor+q.recurring_annualised_minor),0) FROM quotes q WHERE q.tenant_id=t.id AND q.status='Accepted') AS accepted_value_minor,
    (SELECT COUNT(*) FROM pdf_jobs p WHERE p.tenant_id=t.id AND p.created_at>=datetime('now','start of month')) AS pdfs_month,
    (SELECT COUNT(*) FROM quote_recipients r WHERE r.tenant_id=t.id AND r.last_sent_at>=datetime('now','start of month')) AS emails_month,
    (SELECT COALESCE(SUM(size_bytes),0) FROM stored_files f WHERE f.tenant_id=t.id) AS storage_bytes,
    s.plan_name AS subscription_plan,s.status AS subscription_status,s.current_period_end,s.payment_failure_at,
    c.cohort,c.lifetime_tier,o.plan_name AS override_plan,o.active AS override_active,o.expires_at AS override_expires_at
    FROM tenants t LEFT JOIN billing_subscriptions s ON s.tenant_id=t.id LEFT JOIN tenant_cohorts c ON c.tenant_id=t.id
    LEFT JOIN tenant_entitlement_overrides o ON o.tenant_id=t.id AND (o.expires_at IS NULL OR o.expires_at>CURRENT_TIMESTAMP)
    ORDER BY CASE t.status WHEN 'Active' THEN 0 WHEN 'Suspended' THEN 1 ELSE 2 END,t.created_at DESC LIMIT 250`).all<Record<string, unknown>>();
  const search = filters.search?.trim().toLowerCase();
  type PortfolioRow = Record<string, unknown> & { effective_plan: PlanName; monthly_recurring_minor: number };
  const customers = rows.results.map(row => ({ ...row, effective_plan: computedPlan(row), monthly_recurring_minor: row.subscription_status === "active" ? PLAN_MONTHLY_PRICE_MINOR[computedPlan(row)] : 0 }) as PortfolioRow)
    .filter(row => !search || [row.id, row.name, row.owner_email].some(value => String(value ?? "").toLowerCase().includes(search)))
    .filter(row => !filters.status || filters.status === "all" || row.status === filters.status)
    .filter(row => !filters.plan || filters.plan === "all" || row.effective_plan === filters.plan);
  const all = rows.results.map(row => ({ ...row, effective_plan: computedPlan(row), monthly_recurring_minor: row.subscription_status === "active" ? PLAN_MONTHLY_PRICE_MINOR[computedPlan(row)] : 0 }) as PortfolioRow);
  return {
    generatedAt: new Date().toISOString(), customers,
    totals: {
      customers: all.length, active: all.filter(row => row.status === "Active").length, suspended: all.filter(row => row.status === "Suspended").length,
      pastDue: all.filter(row => row.subscription_status === "past_due").length,
      monthlyRecurringMinor: all.filter(row => row.subscription_status === "active").reduce((sum, row) => sum + PLAN_MONTHLY_PRICE_MINOR[row.effective_plan as PlanName], 0),
      storageBytes: all.reduce((sum, row) => sum + Number(row.storage_bytes ?? 0), 0),
    },
  };
}

export async function getPlatformCustomer(tenantId: string) {
  const db = await ensureOperatorSchema();
  const tenant = await db.prepare("SELECT id,name,currency,status,tracking_enabled,deleted_at,purge_after,billing_anniversary_day,created_at,updated_at FROM tenants WHERE id=?").bind(tenantId).first<Record<string, unknown>>();
  if (!tenant) throw new Error("Customer workspace was not found.");
  const [members, usage, billing, history, notes, adminEvents, securityEvents] = await Promise.all([
    db.prepare("SELECT email,display_name,role,status,invited_at,expires_at,joined_at,updated_at FROM workspace_members WHERE tenant_id=? ORDER BY status,role,display_name").bind(tenantId).all<Record<string, unknown>>(),
    getUsageSnapshot(tenantId), getBillingWorkspace(tenantId), listBillingHistory(tenantId),
    db.prepare("SELECT id,body,created_by,created_at FROM operator_notes WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100").bind(tenantId).all<Record<string, unknown>>(),
    db.prepare("SELECT id,actor_email,action,resource_type,resource_id,reason,before_json,after_json,created_at FROM platform_admin_events WHERE tenant_id=? ORDER BY created_at DESC LIMIT 200").bind(tenantId).all<Record<string, unknown>>(),
    db.prepare("SELECT id,actor_email,event_type,resource_type,resource_id,outcome,details_json,request_id,created_at FROM security_events WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100").bind(tenantId).all<Record<string, unknown>>(),
  ]);
  return {
    tenant, members: members.results, usage, billing, invoices: history.invoices, billingEvents: history.events, notes: notes.results,
    adminEvents: adminEvents.results.map(event => ({ ...event, before: JSON.parse(String(event.before_json ?? "{}")), after: JSON.parse(String(event.after_json ?? "{}")) })),
    securityEvents: securityEvents.results.map(event => ({ ...event, details: JSON.parse(String(event.details_json ?? "{}")) })),
  };
}

export async function setTenantStatus(tenantId: string, status: "Active" | "Suspended" | "SoftDeleted", actorEmail: string, reason: string) {
  const db = await ensureOperatorSchema(); const before = await db.prepare("SELECT id,name,status,deleted_at,purge_after FROM tenants WHERE id=?").bind(tenantId).first<Record<string, unknown>>(); if (!before) throw new Error("Customer workspace was not found.");
  if (status === "SoftDeleted") await db.prepare("UPDATE tenants SET status='SoftDeleted',deleted_at=CURRENT_TIMESTAMP,purge_after=datetime('now','+30 days'),updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(tenantId).run();
  else await db.prepare("UPDATE tenants SET status=?,deleted_at=NULL,purge_after=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status, tenantId).run();
  const after = await db.prepare("SELECT id,name,status,deleted_at,purge_after FROM tenants WHERE id=?").bind(tenantId).first<Record<string, unknown>>();
  await logAdminAction({ tenantId, actorEmail, action: `tenant.${status.toLowerCase()}`, resourceType: "tenant", resourceId: tenantId, reason, before, after }); return after;
}

export async function updateCustomerProfile(tenantId: string, input: { name: string; currency: string; billingAnniversaryDay: number }, actorEmail: string, reason: string) {
  const name = input.name.trim(); const currency = input.currency.trim().toUpperCase(); const anniversary = Math.trunc(input.billingAnniversaryDay);
  if (name.length < 2 || name.length > 120) throw new Error("Customer name must contain between 2 and 120 characters.");
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a three-letter ISO code.");
  if (anniversary < 1 || anniversary > 28) throw new Error("Billing anniversary must be between day 1 and day 28.");
  const db = await ensureOperatorSchema();
  const before = await db.prepare("SELECT id,name,currency,billing_anniversary_day FROM tenants WHERE id=?").bind(tenantId).first<Record<string, unknown>>();
  if (!before) throw new Error("Customer workspace was not found.");
  await db.prepare("UPDATE tenants SET name=?,currency=?,billing_anniversary_day=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(name, currency, anniversary, tenantId).run();
  const after = await db.prepare("SELECT id,name,currency,billing_anniversary_day FROM tenants WHERE id=?").bind(tenantId).first<Record<string, unknown>>();
  await logAdminAction({ tenantId, actorEmail, action: "tenant.profile_updated", resourceType: "tenant", resourceId: tenantId, reason, before, after });
  return after;
}

export async function setEntitlementOverride(tenantId: string, planName: PlanName, active: boolean, expiresAt: string | null, actorEmail: string, reason: string) {
  if (!isPlanName(planName)) throw new Error("A supported plan is required."); const db = await ensureOperatorSchema(); const before = await db.prepare("SELECT * FROM tenant_entitlement_overrides WHERE tenant_id=?").bind(tenantId).first<Record<string, unknown>>();
  await db.prepare("INSERT INTO tenant_entitlement_overrides (tenant_id,plan_name,active,reason,expires_at,updated_by) VALUES (?,?,?,?,?,?) ON CONFLICT(tenant_id) DO UPDATE SET plan_name=excluded.plan_name,active=excluded.active,reason=excluded.reason,expires_at=excluded.expires_at,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP").bind(tenantId, planName, active ? 1 : 0, reason.trim(), expiresAt, actorEmail.toLowerCase()).run();
  const after = await db.prepare("SELECT * FROM tenant_entitlement_overrides WHERE tenant_id=?").bind(tenantId).first<Record<string, unknown>>(); await logAdminAction({ tenantId, actorEmail, action: "entitlement.override_set", resourceType: "entitlement", resourceId: tenantId, reason, before, after }); return after;
}

export async function clearEntitlementOverride(tenantId: string, actorEmail: string, reason: string) {
  const db = await ensureOperatorSchema(); const before = await db.prepare("SELECT * FROM tenant_entitlement_overrides WHERE tenant_id=?").bind(tenantId).first<Record<string, unknown>>(); await db.prepare("DELETE FROM tenant_entitlement_overrides WHERE tenant_id=?").bind(tenantId).run(); await logAdminAction({ tenantId, actorEmail, action: "entitlement.override_cleared", resourceType: "entitlement", resourceId: tenantId, reason, before, after: {} });
}

export async function updatePlatformMember(tenantId: string, email: string, action: "activate" | "remove" | "role", role: "owner" | "admin" | "quoter" | undefined, actorEmail: string, reason: string) {
  const db = await ensureOperatorSchema(); const normalised = email.trim().toLowerCase(); const before = await db.prepare("SELECT email,display_name,role,status FROM workspace_members WHERE tenant_id=? AND email=?").bind(tenantId, normalised).first<Record<string, unknown>>(); if (!before) throw new Error("Workspace member was not found.");
  if (before.role === "owner" && action === "remove") { const owners = await db.prepare("SELECT COUNT(*) AS count FROM workspace_members WHERE tenant_id=? AND role='owner' AND status='Active'").bind(tenantId).first<{ count: number }>(); if (Number(owners?.count ?? 0) <= 1) throw new Error("The final active owner cannot be removed."); }
  if (action === "activate") await db.prepare("UPDATE workspace_members SET status='Active',joined_at=COALESCE(joined_at,CURRENT_TIMESTAMP),expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND email=?").bind(tenantId, normalised).run();
  else if (action === "remove") await db.prepare("UPDATE workspace_members SET status='Removed',updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND email=?").bind(tenantId, normalised).run();
  else { if (!role) throw new Error("A supported member role is required."); await db.prepare("UPDATE workspace_members SET role=?,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND email=?").bind(role, tenantId, normalised).run(); }
  const after = await db.prepare("SELECT email,display_name,role,status FROM workspace_members WHERE tenant_id=? AND email=?").bind(tenantId, normalised).first<Record<string, unknown>>(); await logAdminAction({ tenantId, actorEmail, action: `member.${action}`, resourceType: "workspace_member", resourceId: normalised, reason, before, after }); return after;
}

export async function invitePlatformMember(tenantId: string, email: string, role: "admin" | "quoter", actorEmail: string, reason: string) {
  const normalised = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) throw new Error("A valid user email is required.");
  const db = await ensureOperatorSchema();
  const before = await db.prepare("SELECT email,display_name,role,status,invited_at,expires_at FROM workspace_members WHERE tenant_id=? AND email=?").bind(tenantId, normalised).first<Record<string, unknown>>();
  await inviteWorkspaceMember(tenantId, normalised, role, actorEmail);
  const after = await db.prepare("SELECT email,display_name,role,status,invited_at,expires_at FROM workspace_members WHERE tenant_id=? AND email=?").bind(tenantId, normalised).first<Record<string, unknown>>();
  await logAdminAction({ tenantId, actorEmail, action: before ? "member.reinvited" : "member.invited", resourceType: "workspace_member", resourceId: normalised, reason, before, after });
  return after;
}

export async function addOperatorNote(tenantId: string, body: string, actorEmail: string) {
  if (body.trim().length < 3) throw new Error("A substantive support note is required."); const db = await ensureOperatorSchema(); const id = crypto.randomUUID(); await db.prepare("INSERT INTO operator_notes (id,tenant_id,body,created_by) VALUES (?,?,?,?)").bind(id, tenantId, body.trim().slice(0, 4_000), actorEmail.toLowerCase()).run(); await logAdminAction({ tenantId, actorEmail, action: "support.note_added", resourceType: "operator_note", resourceId: id, reason: "Customer support record updated", after: { bodyLength: body.trim().length } }); return id;
}

export async function createCustomerBillingPortal(tenantId: string, actorEmail: string, returnUrl: string, reason: string) { const url = await createStripePortal(tenantId, returnUrl); await logAdminAction({ tenantId, actorEmail, action: "billing.portal_created", resourceType: "billing_customer", resourceId: tenantId, reason }); return url; }
export async function exportPlatformCustomer(tenantId: string, actorEmail: string, reason: string) { const archive = await exportTenantArchive(tenantId); await logAdminAction({ tenantId, actorEmail, action: "tenant.archive_exported", resourceType: "tenant", resourceId: tenantId, reason, after: { integritySha256: archive.integritySha256 } }); return archive; }
