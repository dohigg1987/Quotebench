import { getChatGPTUser } from "../../chatgpt-auth";
import { listCatalogueItems } from "../../../db/catalogue-store";
import { listClients } from "../../../db/client-store";
import { getRuleWorkspace } from "../../../db/pricing-rule-store";
import { exportQuoteRecords, getWorkspaceEntitlement, listQuoteEvents, listQuotes } from "../../../db/quote-store";
import { requireWorkspaceRole } from "../../../db/member-store";
import { listWorkspaceMembers } from "../../../db/member-store";

export const dynamic = "force-dynamic";
const TENANT_ID = "finance-advisory-partners";

function csvValue(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [headers.map(csvValue).join(","), ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(","))].join("\n");
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to export workspace data." }, { status: 401 });
  try { await requireWorkspaceRole(TENANT_ID, user, ["owner"]); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "forbidden" }, { status: 403 }); }
  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  const resource = url.searchParams.get("resource");
  const [clients, catalogue, quotes, events, rules, entitlement, completeQuoteRecords, members] = await Promise.all([
    listClients(TENANT_ID), listCatalogueItems(TENANT_ID), listQuotes(TENANT_ID),
    listQuoteEvents(TENANT_ID), getRuleWorkspace(TENANT_ID), getWorkspaceEntitlement(TENANT_ID), exportQuoteRecords(TENANT_ID), listWorkspaceMembers(TENANT_ID),
  ]);

  if (format === "csv") {
    const resources: Record<string, Array<Record<string, unknown>>> = {
      clients: clients as unknown as Array<Record<string, unknown>>,
      catalogue: catalogue as unknown as Array<Record<string, unknown>>,
      quotes: quotes as unknown as Array<Record<string, unknown>>,
    };
    const rows = resources[resource ?? ""];
    if (!rows) return Response.json({ error: "Choose clients, catalogue or quotes for CSV export." }, { status: 400 });
    return new Response(toCsv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="quotebench-${resource}.csv"` } });
  }

  const payload = { exportedAt: new Date().toISOString(), tenantId: TENANT_ID, members, clients, catalogue, quotes: completeQuoteRecords, events, rules, entitlement };
  return new Response(JSON.stringify(payload, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": "attachment; filename=quotebench-workspace-export.json" } });
}
