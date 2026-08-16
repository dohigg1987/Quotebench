import { ensureBillingSchema } from "../../../../db/billing-store";
import { isPlanName } from "../../../../db/plans";

function hex(bytes: ArrayBuffer) { return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join(""); }
async function validSignature(payload: string, header: string | null, secret: string) {
  if (!header) return false; const parts = header.split(",").map(part => part.split("=", 2)); const timestamp = parts.find(([key]) => key === "t")?.[1]; const candidates = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || !candidates.length || Math.abs(Date.now() / 1000 - Number(timestamp)) >= 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); const signature = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  return candidates.some(candidate => { if (candidate.length !== signature.length) return false; let mismatch = 0; for (let i = 0; i < signature.length; i++) mismatch |= signature.charCodeAt(i) ^ candidate.charCodeAt(i); return mismatch === 0; });
}
const dateTime = (value: unknown) => Number(value) > 0 ? new Date(Number(value) * 1_000).toISOString() : null;

export async function POST(request: Request) {
  const { env } = await import("cloudflare:workers"); if (!env.STRIPE_WEBHOOK_SECRET) return Response.json({ error: "stripe_webhook_not_configured" }, { status: 503 });
  const raw = await request.text(); if (!await validSignature(raw, request.headers.get("stripe-signature"), String(env.STRIPE_WEBHOOK_SECRET))) return Response.json({ error: "invalid_signature" }, { status: 401 });
  const event = JSON.parse(raw) as { id: string; type: string; data: { object: Record<string, unknown> } }; const object = event.data.object; const db = await ensureBillingSchema(); const metadata = object.metadata as Record<string, unknown> | undefined; const customerId = String(object.customer ?? ""); const subscriptionId = String(object.subscription ?? (event.type.startsWith("customer.subscription") ? object.id : "") ?? "");
  let tenantId = String(metadata?.tenant_id ?? "");
  if (!tenantId && (customerId || subscriptionId)) tenantId = String((await db.prepare("SELECT tenant_id FROM billing_subscriptions WHERE stripe_customer_id=? OR stripe_subscription_id=?").bind(customerId, subscriptionId).first<{ tenant_id: string }>())?.tenant_id ?? "");
  if (!tenantId) return Response.json({ received: true, ignored: "tenant_resolution_failed" });
  const already = await db.prepare("SELECT id FROM billing_events WHERE provider_event_id=?").bind(event.id).first(); if (already) return Response.json({ received: true, duplicate: true });
  const planName = isPlanName(metadata?.plan_name) ? metadata.plan_name : "Professional";
  if (event.type === "checkout.session.completed") {
    await db.prepare("INSERT INTO billing_subscriptions (tenant_id,stripe_customer_id,stripe_subscription_id,plan_name,status) VALUES (?,?,?,?, 'active') ON CONFLICT(tenant_id) DO UPDATE SET stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,plan_name=excluded.plan_name,status='active',payment_failure_at=NULL,updated_at=CURRENT_TIMESTAMP").bind(tenantId, customerId, subscriptionId, planName).run();
  } else if (["customer.subscription.created", "customer.subscription.updated"].includes(event.type)) {
    const status = String(object.status ?? "active");
    await db.prepare("INSERT INTO billing_subscriptions (tenant_id,stripe_customer_id,stripe_subscription_id,plan_name,status,current_period_end,payment_failure_at) VALUES (?,?,?,?,?,?,NULL) ON CONFLICT(tenant_id) DO UPDATE SET stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,plan_name=excluded.plan_name,status=excluded.status,current_period_end=excluded.current_period_end,payment_failure_at=CASE WHEN excluded.status='active' THEN NULL ELSE billing_subscriptions.payment_failure_at END,updated_at=CURRENT_TIMESTAMP").bind(tenantId, customerId, subscriptionId, planName, status, dateTime(object.current_period_end)).run();
  } else if (event.type === "customer.subscription.deleted") {
    await db.prepare("UPDATE billing_subscriptions SET status='lapsed',current_period_end=?,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=?").bind(dateTime(object.current_period_end), tenantId).run();
  } else if (event.type === "invoice.payment_failed") {
    await db.prepare("UPDATE billing_subscriptions SET status='past_due',payment_failure_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=?").bind(tenantId).run();
  } else if (event.type === "invoice.paid") {
    await db.prepare("UPDATE billing_subscriptions SET status='active',payment_failure_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=?").bind(tenantId).run();
  }
  if (event.type.startsWith("invoice.")) {
    const invoiceId = String(object.id ?? event.id); const period = (object.period_end ? object : (object.lines as { data?: Array<Record<string, unknown>> } | undefined)?.data?.[0] ?? object) as Record<string, unknown>;
    await db.prepare(`INSERT INTO billing_invoices (id,tenant_id,stripe_customer_id,stripe_invoice_id,number,status,currency,subtotal_minor,tax_minor,total_minor,amount_paid_minor,amount_due_minor,hosted_invoice_url,invoice_pdf_url,period_start,period_end,due_at,paid_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(stripe_invoice_id) DO UPDATE SET number=excluded.number,status=excluded.status,currency=excluded.currency,subtotal_minor=excluded.subtotal_minor,tax_minor=excluded.tax_minor,total_minor=excluded.total_minor,amount_paid_minor=excluded.amount_paid_minor,amount_due_minor=excluded.amount_due_minor,hosted_invoice_url=excluded.hosted_invoice_url,invoice_pdf_url=excluded.invoice_pdf_url,period_start=excluded.period_start,period_end=excluded.period_end,due_at=excluded.due_at,paid_at=excluded.paid_at,updated_at=CURRENT_TIMESTAMP`).bind(crypto.randomUUID(), tenantId, customerId, invoiceId, object.number ?? null, String(object.status ?? event.type.replace("invoice.", "")), String(object.currency ?? "gbp"), Number(object.subtotal ?? 0), Number((object.total_tax_amounts as Array<{ amount?: number }> | undefined)?.reduce((sum, item) => sum + Number(item.amount ?? 0), 0) ?? 0), Number(object.total ?? 0), Number(object.amount_paid ?? 0), Number(object.amount_due ?? 0), object.hosted_invoice_url ?? null, object.invoice_pdf ?? null, dateTime(period.period_start), dateTime(period.period_end), dateTime(object.due_date), dateTime(object.status_transitions && (object.status_transitions as Record<string, unknown>).paid_at)).run();
  }
  await db.prepare("INSERT INTO billing_events (id,tenant_id,provider_event_id,event_type,outcome,payload_json) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), tenantId, event.id, event.type, "processed", JSON.stringify({ customerId, subscriptionId, objectId: object.id ?? null })).run();
  return Response.json({ received: true });
}
