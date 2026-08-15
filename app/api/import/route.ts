import { getChatGPTUser } from "../../chatgpt-auth";
import { upsertCatalogueItem } from "../../../db/catalogue-store";
import { upsertClient } from "../../../db/client-store";
import type { CatalogueItem, Frequency, PricingBasis } from "../../../packages/pricing-engine/src/index";
import { requireWorkspaceRole } from "../../../db/member-store";

export const dynamic = "force-dynamic";
const TENANT_ID = "finance-advisory-partners";
const BASES: PricingBasis[] = ["fixed", "per_unit", "cost_plus"];
const FREQUENCIES: Frequency[] = ["one_off", "weekly", "fortnightly", "monthly", "quarterly", "annually"];

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (character === "\n") {
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else if (character !== "\r") {
      cell += character;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function rowValue(headers: string[], row: string[], mapping: Record<string, string>, field: string) {
  const column = mapping[field];
  const index = headers.indexOf(column);
  return index < 0 ? "" : (row[index] ?? "").trim();
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to import workspace data." }, { status: 401 });
  try { await requireWorkspaceRole(TENANT_ID, user, ["owner", "admin"]); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "forbidden" }, { status: 403 }); }
  try {
    const body = (await request.json()) as { resource?: "clients" | "catalogue"; csv?: string; mapping?: Record<string, string> };
    if (!body.resource || !body.csv || !body.mapping) {
      return Response.json({ error: "Resource, CSV content and column mapping are required." }, { status: 400 });
    }
    if (new TextEncoder().encode(body.csv).length > 2_000_000) {
      return Response.json({ error: "CSV files must be no larger than 2 MB." }, { status: 413 });
    }
    const [headers, ...rows] = parseCsv(body.csv);
    if (!headers?.length || !rows.length) return Response.json({ error: "The CSV must contain a header and at least one data row." }, { status: 400 });
    const failures: Array<{ row: number; error: string }> = [];
    let imported = 0;
    for (const [index, row] of rows.entries()) {
      try {
        if (body.resource === "clients") {
          const name = rowValue(headers, row, body.mapping, "name");
          const contactName = rowValue(headers, row, body.mapping, "contactName");
          const contactEmail = rowValue(headers, row, body.mapping, "contactEmail").toLowerCase();
          const statusValue = rowValue(headers, row, body.mapping, "status");
          if (!name || !contactName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) throw new Error("Name, contact name and a valid email are required.");
          const status = statusValue === "Archived" ? "Archived" : "Active";
          await upsertClient(TENANT_ID, { name, contactName, contactEmail, status }, user.email);
        } else {
          const name = rowValue(headers, row, body.mapping, "name");
          const idValue = rowValue(headers, row, body.mapping, "id") || name;
          const id = idValue.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          const categoryId = rowValue(headers, row, body.mapping, "categoryId").toLowerCase();
          const unitLabel = rowValue(headers, row, body.mapping, "unitLabel").toLowerCase();
          const pricingBasis = rowValue(headers, row, body.mapping, "pricingBasis") as PricingBasis;
          const recurrence = rowValue(headers, row, body.mapping, "recurrence") as Frequency;
          if (!id || !name || !categoryId || !unitLabel || !BASES.includes(pricingBasis) || !FREQUENCIES.includes(recurrence)) {
            throw new Error("Name, category, unit, pricing basis and recurrence are required and must be valid.");
          }
          const numberValue = (field: string) => {
            const value = rowValue(headers, row, body.mapping!, field);
            return value === "" ? undefined : Math.round(Number(value));
          };
          const basePriceMinor = numberValue("basePriceMinor");
          const costMinor = numberValue("costMinor");
          const targetMarginBp = numberValue("targetMarginBp");
          if (pricingBasis === "cost_plus" && (!costMinor || !targetMarginBp)) throw new Error("Cost-plus rows require cost and target margin in minor units and basis points.");
          if (pricingBasis !== "cost_plus" && !basePriceMinor) throw new Error("Fixed and per-unit rows require a base price in minor units.");
          await upsertCatalogueItem(TENANT_ID, {
            id, name, categoryId, unitLabel, pricingBasis, recurrence,
            ...(basePriceMinor === undefined ? {} : { basePriceMinor }),
            ...(costMinor === undefined ? {} : { costMinor }),
            ...(targetMarginBp === undefined ? {} : { targetMarginBp }),
            minQuantity: Math.max(1, numberValue("minQuantity") ?? 1),
            ...(numberValue("maxQuantity") === undefined ? {} : { maxQuantity: numberValue("maxQuantity") }),
          } as CatalogueItem, user.email);
        }
        imported += 1;
      } catch (error) {
        failures.push({ row: index + 2, error: error instanceof Error ? error.message : "The row is invalid." });
      }
    }
    return Response.json({ imported, failed: failures.length, failures });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The CSV could not be imported." }, { status: 400 });
  }
}
