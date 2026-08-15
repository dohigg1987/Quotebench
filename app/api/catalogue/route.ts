import { getChatGPTUser } from "../../chatgpt-auth";
import { listCatalogueItems, upsertCatalogueItem } from "../../../db/catalogue-store";
import type { CatalogueItem, Frequency, PricingBasis } from "../../../packages/pricing-engine/src/index";
import { requireWorkspaceContext } from "../../../db/workspace-store";

export const dynamic = "force-dynamic";

const BASES: PricingBasis[] = ["fixed", "per_unit", "cost_plus"];
const FREQUENCIES: Frequency[] = ["one_off", "weekly", "fortnightly", "monthly", "quarterly", "annually"];

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to access the catalogue." }, { status: 401 });
  try { const context = await requireWorkspaceContext(user, ["owner", "admin", "quoter"]); return Response.json({ catalogue: await listCatalogueItems(context.tenantId) }); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "forbidden" }, { status: 403 }); }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to manage the catalogue." }, { status: 401 });
  try {
    const context = await requireWorkspaceContext(user, ["owner", "admin"]);
    const body = (await request.json()) as Partial<CatalogueItem>;
    const id = body.id?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ?? "";
    if (!id || !body.name?.trim() || !body.categoryId?.trim() || !body.unitLabel?.trim()) {
      return Response.json({ error: "Name, category and unit are required." }, { status: 400 });
    }
    if (!BASES.includes(body.pricingBasis as PricingBasis) || !FREQUENCIES.includes(body.recurrence as Frequency)) {
      return Response.json({ error: "Pricing basis or recurrence is invalid." }, { status: 400 });
    }
    if (body.pricingBasis === "cost_plus" && (!body.costMinor || !body.targetMarginBp)) {
      return Response.json({ error: "Cost-plus items require a cost and target margin." }, { status: 400 });
    }
    if (body.pricingBasis !== "cost_plus" && !body.basePriceMinor) {
      return Response.json({ error: "Fixed and per-unit items require a base price." }, { status: 400 });
    }
    const item = await upsertCatalogueItem(context.tenantId, {
      id,
      name: body.name.trim(),
      categoryId: body.categoryId.trim().toLowerCase(),
      unitLabel: body.unitLabel.trim().toLowerCase(),
      pricingBasis: body.pricingBasis as PricingBasis,
      recurrence: body.recurrence as Frequency,
      ...(body.basePriceMinor ? { basePriceMinor: Math.round(Number(body.basePriceMinor)) } : {}),
      ...(body.costMinor ? { costMinor: Math.round(Number(body.costMinor)) } : {}),
      ...(body.targetMarginBp ? { targetMarginBp: Math.round(Number(body.targetMarginBp)) } : {}),
      minQuantity: Math.max(1, Math.round(Number(body.minQuantity ?? 1))),
      ...(body.maxQuantity ? { maxQuantity: Math.round(Number(body.maxQuantity)) } : {}),
    } as CatalogueItem, user.email);
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The catalogue item could not be saved." }, { status: 500 });
  }
}
