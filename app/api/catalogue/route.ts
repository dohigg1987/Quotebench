import { getChatGPTUser } from "../../chatgpt-auth";
import { listCatalogueWorkspace, upsertCatalogueItem, upsertProposalType, upsertServiceCategory } from "../../../db/catalogue-store";
import type { CatalogueItem, Frequency, PricingBasis } from "../../../packages/pricing-engine/src/index";
import { requireWorkspaceContext } from "../../../db/workspace-store";

export const dynamic = "force-dynamic";

const BASES: PricingBasis[] = ["fixed", "per_unit", "cost_plus", "retainer", "usage"];
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
    if (body.pricingBasis === "usage" && body.overagePriceMinor === undefined) {
      return Response.json({ error: "Usage items require an overage unit price." }, { status: 400 });
    }
    const validIds=(value:unknown)=>Array.isArray(value)?[...new Set(value.map(String).map(entry=>entry.trim()).filter(Boolean))].slice(0,100):[];
    const volumeTiers=Array.isArray(body.volumeTiers)?body.volumeTiers.slice(0,50).map(tier=>({fromQuantity:Math.max(1,Math.round(Number(tier.fromQuantity))),...(tier.toQuantity?{toQuantity:Math.round(Number(tier.toQuantity))}:{}),unitPriceMinor:Math.max(0,Math.round(Number(tier.unitPriceMinor))) as CatalogueItem["basePriceMinor"]})).filter(tier=>Number.isFinite(tier.fromQuantity)&&Number.isFinite(tier.unitPriceMinor)):[];
    const regionalPrices=Array.isArray(body.regionalPrices)?body.regionalPrices.slice(0,100).map(entry=>({regionCode:String(entry.regionCode??"GLOBAL").trim().toUpperCase().slice(0,12),currency:String(entry.currency??"GBP").trim().toUpperCase().slice(0,3),unitPriceMinor:Math.max(0,Math.round(Number(entry.unitPriceMinor))) as CatalogueItem["basePriceMinor"]})).filter(entry=>/^[A-Z]{3}$/.test(entry.currency)):[];
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
      baseCurrency:/^[A-Z]{3}$/.test(String(body.baseCurrency??"GBP").toUpperCase())?String(body.baseCurrency??"GBP").toUpperCase():"GBP",
      bundleItemIds:validIds(body.bundleItemIds),optionalUpgradeItemIds:validIds(body.optionalUpgradeItemIds),requiredItemIds:validIds(body.requiredItemIds),incompatibleItemIds:validIds(body.incompatibleItemIds),
      volumeTiers,regionalPrices,
      taxCode:String(body.taxCode??"STANDARD").trim().toUpperCase().slice(0,40),taxRateBp:Math.max(0,Math.min(10000,Math.round(Number(body.taxRateBp??0)))) as CatalogueItem["taxRateBp"],pricesIncludeTax:body.pricesIncludeTax===true,
      ...(body.includedUnits!==undefined?{includedUnits:Math.max(0,Math.round(Number(body.includedUnits)))}:{}),...(body.overagePriceMinor!==undefined?{overagePriceMinor:Math.max(0,Math.round(Number(body.overagePriceMinor))) as CatalogueItem["overagePriceMinor"]}:{}),...(body.minimumCommitmentMinor!==undefined?{minimumCommitmentMinor:Math.max(0,Math.round(Number(body.minimumCommitmentMinor))) as CatalogueItem["minimumCommitmentMinor"]}:{}),
      ...(body.indexation&&typeof body.indexation==="object"?{indexation:{method:["fixed","cpi","rpi","custom"].includes(body.indexation.method)?body.indexation.method:"fixed",annualRateBp:Math.max(0,Math.min(5000,Math.round(Number(body.indexation.annualRateBp??0)))) as NonNullable<CatalogueItem["indexation"]>["annualRateBp"],baseDate:/^\d{4}-\d{2}-\d{2}$/.test(String(body.indexation.baseDate))?String(body.indexation.baseDate):new Date().toISOString().slice(0,10),intervalMonths:[1,3,6,12,24].includes(Number(body.indexation.intervalMonths))?Number(body.indexation.intervalMonths):12}}:{}),
    } as CatalogueItem, user.email);
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The catalogue item could not be saved." }, { status: 500 });
  }
}
