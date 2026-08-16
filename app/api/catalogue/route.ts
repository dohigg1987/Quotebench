import { getChatGPTUser } from "../../chatgpt-auth";
import { listCatalogueWorkspace, upsertCatalogueItem, upsertProposalType, upsertServiceCategory } from "../../../db/catalogue-store";
import type { CatalogueItem, Frequency, PricingBasis } from "../../../packages/pricing-engine/src/index";
import { requireWorkspaceContext } from "../../../db/workspace-store";

export const dynamic = "force-dynamic";

const BASES: PricingBasis[] = ["fixed", "per_unit", "cost_plus"];
const FREQUENCIES: Frequency[] = ["one_off", "weekly", "fortnightly", "monthly", "quarterly", "annually"];

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to access the catalogue." }, { status: 401 });
  try { const context = await requireWorkspaceContext(user, ["owner", "admin", "quoter"]); return Response.json(await listCatalogueWorkspace(context.tenantId)); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "forbidden" }, { status: 403 }); }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to manage the catalogue." }, { status: 401 });
  try {
    const context = await requireWorkspaceContext(user, ["owner", "admin"]);
    const body = (await request.json()) as Partial<CatalogueItem> & { action?:string; parentId?:string|null; sortOrder?:number; active?:boolean };
    if(body.action==="upsert_category"){
      if(!body.name?.trim())return Response.json({error:"Category name is required."},{status:400});
      const category=await upsertServiceCategory(context.tenantId,{id:body.id,name:body.name,parentId:body.parentId??null,sortOrder:body.sortOrder,active:body.active},user.email);
      return Response.json({category},{status:201});
    }
    if(body.action==="upsert_proposal_type"){
      if(!body.name?.trim())return Response.json({error:"Proposal type name is required."},{status:400});
      const proposalType=await upsertProposalType(context.tenantId,{id:body.id,name:body.name,description:body.description,active:body.active},user.email);
      return Response.json({proposalType},{status:201});
    }
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
      ...(body.subcategoryId?.trim()?{subcategoryId:body.subcategoryId.trim().toLowerCase()}:{}),
      description:String(body.description??"").trim().slice(0,2000),
      serviceSchedule:String(body.serviceSchedule??"").trim().slice(0,12000),
      serviceTerms:String(body.serviceTerms??"").trim().slice(0,12000),
      proposalTypeIds:[...new Set((body.proposalTypeIds??[]).map(String).filter(Boolean))].slice(0,50),
      defaultProposalTypeIds:[...new Set((body.defaultProposalTypeIds??[]).map(String).filter(value=>(body.proposalTypeIds??[]).includes(value)))].slice(0,50),
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
