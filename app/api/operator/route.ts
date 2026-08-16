import { getChatGPTUser } from "../../chatgpt-auth";
import { requireOperator } from "../../../db/workspace-store";
import { addOperatorNote, clearEntitlementOverride, createCustomerBillingPortal, exportPlatformCustomer, getPlatformCustomer, getPlatformOverview, invitePlatformMember, setEntitlementOverride, setTenantStatus, updateCustomerProfile, updatePlatformMember } from "../../../db/operator-store";
import { isPlanName } from "../../../db/plans";

export const dynamic = "force-dynamic";

async function operator() {
  const user = await getChatGPTUser();
  if (!user) throw new Error("unauthenticated");
  await requireOperator(user); return user;
}

export async function GET(request: Request) {
  try {
    const user = await operator(); const url = new URL(request.url); const tenantId = url.searchParams.get("tenantId");
    if (url.searchParams.get("export") === "archive" && tenantId) {
      const archive = await exportPlatformCustomer(tenantId, user.email, "Operator requested a complete tenant archive");
      return new Response(JSON.stringify(archive, null, 2), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="quotebench-${tenantId.replace(/[^A-Za-z0-9_-]/g, "-")}-archive.json"` } });
    }
    if (tenantId) return Response.json(await getPlatformCustomer(tenantId));
    return Response.json(await getPlatformOverview({ search: url.searchParams.get("search") ?? undefined, status: url.searchParams.get("status") ?? undefined, plan: url.searchParams.get("plan") ?? undefined }));
  } catch (error) { const message = error instanceof Error ? error.message : "Platform administration is unavailable."; return Response.json({ error: message }, { status: message === "unauthenticated" ? 401 : 403 }); }
}

type OperatorBody = { action?: string; tenantId?: string; reason?: string; status?: "Active" | "Suspended" | "SoftDeleted"; planName?: string; active?: boolean; expiresAt?: string | null; email?: string; memberAction?: "activate" | "remove" | "role"; role?: "owner" | "admin" | "quoter"; note?: string; returnUrl?: string; name?: string; currency?: string; billingAnniversaryDay?: number };

export async function POST(request: Request) {
  try {
    const user = await operator(); const body = await request.json() as OperatorBody;
    if (!body.tenantId || !body.action) return Response.json({ error: "A customer and supported action are required." }, { status: 400 });
    const reason = body.reason?.trim() ?? "";
    if (body.action !== "add_note" && reason.length < 8) return Response.json({ error: "Record a substantive reason of at least eight characters." }, { status: 400 });
    if (body.action === "tenant_status" && body.status && ["Active", "Suspended", "SoftDeleted"].includes(body.status)) await setTenantStatus(body.tenantId, body.status, user.email, reason);
    else if (body.action === "customer_profile" && body.name && body.currency && body.billingAnniversaryDay) await updateCustomerProfile(body.tenantId, { name: body.name, currency: body.currency, billingAnniversaryDay: body.billingAnniversaryDay }, user.email, reason);
    else if (body.action === "set_entitlement" && isPlanName(body.planName)) await setEntitlementOverride(body.tenantId, body.planName, body.active !== false, body.expiresAt ?? null, user.email, reason);
    else if (body.action === "clear_entitlement") await clearEntitlementOverride(body.tenantId, user.email, reason);
    else if (body.action === "member" && body.email && body.memberAction) await updatePlatformMember(body.tenantId, body.email, body.memberAction, body.role, user.email, reason);
    else if (body.action === "member_invite" && body.email && (body.role === "admin" || body.role === "quoter")) await invitePlatformMember(body.tenantId, body.email, body.role, user.email, reason);
    else if (body.action === "add_note" && body.note) await addOperatorNote(body.tenantId, body.note, user.email);
    else if (body.action === "billing_portal") return Response.json({ url: await createCustomerBillingPortal(body.tenantId, user.email, body.returnUrl || new URL(request.url).origin + "/admin", reason) });
    else return Response.json({ error: "The requested operator action is not supported." }, { status: 400 });
    return Response.json(await getPlatformCustomer(body.tenantId));
  } catch (error) { const message = error instanceof Error ? error.message : "The operator action could not be completed."; return Response.json({ error: message }, { status: message === "unauthenticated" ? 401 : message.startsWith("forbidden:") ? 403 : 409 }); }
}
