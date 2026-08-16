import { getDatabase } from "./database.ts";
import { PLAN_LIMITS, isPlanName, mostGenerousPlan, type PlanName } from "./plans";

const CODE_SCHEMA = `CREATE TABLE IF NOT EXISTS deal_codes (code_hash TEXT PRIMARY KEY,tier INTEGER NOT NULL,campaign TEXT NOT NULL,redeemed_tenant_id TEXT,redeemed_at TEXT)`;
const REDEMPTION_SCHEMA = `CREATE TABLE IF NOT EXISTS deal_redemptions (id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,code_hash TEXT NOT NULL,tier_contribution INTEGER NOT NULL,redeemed_by TEXT NOT NULL,redeemed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
const SUBSCRIPTION_SCHEMA = `CREATE TABLE IF NOT EXISTS billing_subscriptions (tenant_id TEXT PRIMARY KEY,stripe_customer_id TEXT,stripe_subscription_id TEXT,plan_name TEXT,status TEXT,current_period_end TEXT,payment_failure_at TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
const COHORT_SCHEMA = `CREATE TABLE IF NOT EXISTS tenant_cohorts (tenant_id TEXT PRIMARY KEY,cohort TEXT NOT NULL,lifetime_tier INTEGER NOT NULL DEFAULT 0,joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
const OVERRIDE_SCHEMA = `CREATE TABLE IF NOT EXISTS tenant_entitlement_overrides (tenant_id TEXT PRIMARY KEY,plan_name TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,reason TEXT NOT NULL,expires_at TEXT,updated_by TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
const INVOICE_SCHEMA = `CREATE TABLE IF NOT EXISTS billing_invoices (id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,stripe_customer_id TEXT,stripe_invoice_id TEXT NOT NULL,number TEXT,status TEXT NOT NULL,currency TEXT NOT NULL DEFAULT 'gbp',subtotal_minor INTEGER NOT NULL DEFAULT 0,tax_minor INTEGER NOT NULL DEFAULT 0,total_minor INTEGER NOT NULL DEFAULT 0,amount_paid_minor INTEGER NOT NULL DEFAULT 0,amount_due_minor INTEGER NOT NULL DEFAULT 0,hosted_invoice_url TEXT,invoice_pdf_url TEXT,period_start TEXT,period_end TEXT,due_at TEXT,paid_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
const BILLING_EVENT_SCHEMA = `CREATE TABLE IF NOT EXISTS billing_events (id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,provider_event_id TEXT NOT NULL,event_type TEXT NOT NULL,outcome TEXT NOT NULL,payload_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`;

async function database() { return getDatabase("Billing storage is unavailable."); }
async function hash(value: string) { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.trim().toUpperCase())); return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join(""); }

export async function ensureBillingSchema() {
  const db = await database();
  await db.batch([
    db.prepare(CODE_SCHEMA), db.prepare(REDEMPTION_SCHEMA), db.prepare(SUBSCRIPTION_SCHEMA), db.prepare(COHORT_SCHEMA), db.prepare(OVERRIDE_SCHEMA), db.prepare(INVOICE_SCHEMA), db.prepare(BILLING_EVENT_SCHEMA),
    db.prepare("CREATE INDEX IF NOT EXISTS deal_redemptions_tenant_idx ON deal_redemptions (tenant_id)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS billing_invoices_provider_unique ON billing_invoices (stripe_invoice_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS billing_invoices_tenant_created_idx ON billing_invoices (tenant_id,created_at)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS billing_events_provider_unique ON billing_events (provider_event_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS billing_events_tenant_created_idx ON billing_events (tenant_id,created_at)"),
  ]);
  for (const [code, tier] of [["LAUNCH-ONE-2026", 1], ["LAUNCH-TWO-2026", 1], ["LAUNCH-THREE-2026", 1]] as const) await db.prepare("INSERT OR IGNORE INTO deal_codes (code_hash,tier,campaign) VALUES (?,?,'2026 launch illustration')").bind(await hash(code), tier).run();
  return db;
}

function tierPlan(tier: number): PlanName | null { return tier >= 3 ? "Scale" : tier >= 2 ? "Professional" : tier >= 1 ? "Starter" : null; }

export async function getBillingWorkspace(tenantId: string) {
  const db = await ensureBillingSchema();
  const [redeemed, subscription, cohort, override] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS count,COALESCE(SUM(tier_contribution),0) AS tier FROM deal_redemptions WHERE tenant_id=?").bind(tenantId).first<{ count: number; tier: number }>(),
    db.prepare("SELECT stripe_customer_id,stripe_subscription_id,plan_name,status,current_period_end,payment_failure_at,updated_at FROM billing_subscriptions WHERE tenant_id=?").bind(tenantId).first<Record<string, unknown>>(),
    db.prepare("SELECT cohort,lifetime_tier,joined_at FROM tenant_cohorts WHERE tenant_id=?").bind(tenantId).first<Record<string, unknown>>(),
    db.prepare("SELECT plan_name,active,reason,expires_at,updated_by,updated_at FROM tenant_entitlement_overrides WHERE tenant_id=? AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP)").bind(tenantId).first<Record<string, unknown>>(),
  ]);
  const lifetimePlan = tierPlan(Number(redeemed?.tier ?? 0));
  const subscriptionPlan = subscription?.status === "active" && isPlanName(subscription.plan_name) ? subscription.plan_name : null;
  const overridePlan = override && isPlanName(override.plan_name) ? override.plan_name : null;
  const effectivePlan = overridePlan ?? mostGenerousPlan(lifetimePlan, subscriptionPlan);
  const accessActive = override ? Number(override.active) === 1 : true;
  return {
    redeemedCodes: Number(redeemed?.count ?? 0), lifetimeTier: Number(redeemed?.tier ?? 0), lifetimePlan,
    subscription: subscription ?? null, effectivePlan, limits: PLAN_LIMITS[effectivePlan], cohort: cohort ?? null,
    override: override ?? null, accessActive, checkoutConfigured: await stripeConfigured(), portalConfigured: await stripeConfigured(),
  };
}

export async function redeemCode(tenantId: string, email: string, code: string) {
  const db = await ensureBillingSchema(); const codeHash = await hash(code);
  const claimed = await db.prepare("UPDATE deal_codes SET redeemed_tenant_id=?,redeemed_at=CURRENT_TIMESTAMP WHERE code_hash=? AND redeemed_tenant_id IS NULL RETURNING tier").bind(tenantId, codeHash).first<{ tier: number }>();
  if (!claimed) { const exists = await db.prepare("SELECT 1 AS found FROM deal_codes WHERE code_hash=?").bind(codeHash).first(); throw new Error(exists ? "code_already_used" : "invalid_code"); }
  await db.batch([
    db.prepare("INSERT INTO deal_redemptions (id,tenant_id,code_hash,tier_contribution,redeemed_by) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), tenantId, codeHash, claimed.tier, email),
    db.prepare("INSERT INTO tenant_cohorts (tenant_id,cohort,lifetime_tier) VALUES (?,'lifetime-2026',?) ON CONFLICT(tenant_id) DO UPDATE SET cohort='lifetime-2026',lifetime_tier=lifetime_tier+excluded.lifetime_tier").bind(tenantId, claimed.tier),
  ]);
  return getBillingWorkspace(tenantId);
}

async function stripeConfigured() { const { env } = await import("cloudflare:workers"); return Boolean(env.STRIPE_SECRET_KEY && (env.STRIPE_PRICE_ID || env.STRIPE_PRICE_STARTER || env.STRIPE_PRICE_PROFESSIONAL || env.STRIPE_PRICE_SCALE)); }
async function stripePost(path: string, body: URLSearchParams) { const { env } = await import("cloudflare:workers"); if (!env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured for this deployment."); const response = await fetch(`https://api.stripe.com/v1/${path}`, { method: "POST", headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" }, body }); const payload = await response.json() as Record<string, unknown> & { error?: { message?: string } }; if (!response.ok) throw new Error(payload.error?.message ?? "Stripe could not complete the request."); return payload; }

export async function createStripeCheckout(tenantId: string, email: string, returnUrl: string, requestedPlan: PlanName = "Professional") {
  const { env } = await import("cloudflare:workers");
  const price = requestedPlan === "Starter" ? env.STRIPE_PRICE_STARTER : requestedPlan === "Scale" ? env.STRIPE_PRICE_SCALE : env.STRIPE_PRICE_PROFESSIONAL ?? env.STRIPE_PRICE_ID;
  if (!env.STRIPE_SECRET_KEY || !price || requestedPlan === "Trial") throw new Error(`${requestedPlan} checkout is not configured for this deployment.`);
  const body = new URLSearchParams({ mode: "subscription", "line_items[0][price]": String(price), "line_items[0][quantity]": "1", customer_email: email, success_url: `${returnUrl}?checkout=success`, cancel_url: `${returnUrl}?checkout=cancelled`, "metadata[tenant_id]": tenantId, "metadata[plan_name]": requestedPlan, "subscription_data[metadata][tenant_id]": tenantId, "subscription_data[metadata][plan_name]": requestedPlan, allow_promotion_codes: "true", "automatic_tax[enabled]": "true" });
  const payload = await stripePost("checkout/sessions", body); if (!payload.url) throw new Error("Stripe Checkout did not return a secure redirect."); return String(payload.url);
}

export async function createStripePortal(tenantId: string, returnUrl: string) {
  const db = await ensureBillingSchema(); const subscription = await db.prepare("SELECT stripe_customer_id FROM billing_subscriptions WHERE tenant_id=?").bind(tenantId).first<{ stripe_customer_id: string | null }>();
  if (!subscription?.stripe_customer_id) throw new Error("This workspace does not have a Stripe customer record.");
  const payload = await stripePost("billing_portal/sessions", new URLSearchParams({ customer: subscription.stripe_customer_id, return_url: returnUrl }));
  if (!payload.url) throw new Error("Stripe Billing Portal did not return a secure redirect."); return String(payload.url);
}

export async function listBillingHistory(tenantId: string) {
  const db = await ensureBillingSchema();
  const [invoices, events] = await Promise.all([
    db.prepare("SELECT id,stripe_invoice_id,number,status,currency,subtotal_minor,tax_minor,total_minor,amount_paid_minor,amount_due_minor,hosted_invoice_url,invoice_pdf_url,period_start,period_end,due_at,paid_at,created_at FROM billing_invoices WHERE tenant_id=? ORDER BY created_at DESC LIMIT 50").bind(tenantId).all<Record<string, unknown>>(),
    db.prepare("SELECT id,provider_event_id,event_type,outcome,payload_json,created_at FROM billing_events WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100").bind(tenantId).all<Record<string, unknown>>(),
  ]);
  return { invoices: invoices.results, events: events.results.map(event => ({ ...event, payload: JSON.parse(String(event.payload_json ?? "{}")) })) };
}

export { PLAN_LIMITS } from "./plans";
