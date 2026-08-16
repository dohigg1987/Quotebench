import { getChatGPTUser } from "../../chatgpt-auth";
import { assertQuoteCapacity, getWorkspaceEntitlement, listQuoteEvents, listQuotes, upsertQuote } from "../../../db/quote-store";
import { money, price } from "../../../packages/pricing-engine/src/index";
import { listCatalogueItems, listCatalogueWorkspace } from "../../../db/catalogue-store";
import { getRuleWorkspace } from "../../../db/pricing-rule-store";
import { listClients, upsertClient } from "../../../db/client-store";
import { requireWorkspaceContext } from "../../../db/workspace-store";
import { normaliseProposalPages, type DocumentPage } from "../../../db/document-store";
import { resolveLegalContent } from "../../../db/engagement-store";

export const dynamic = "force-dynamic";

type SaveQuoteBody = {
  reference?: string;
  clientName?: string;
  contactName?: string;
  contactEmail?: string;
  clientId?: string;
  validUntil?: string;
  status?: "Draft" | "Ready";
  answers?: Record<string, string>;
  quoteDiscount?: number;
  lines?: Array<{ itemId?: string; quantity?: number; discount?: number }>;
  currency?: string;
  regionCode?: string;
  asOfDate?: string;
  document?: { title?: string; introduction?: string; scopeHeading?: string; brandName?: string; brandInitials?: string; proposalTypeId?:string; templateId?:string; depositMinor?:number; options?:Array<{id:string;label:string}>; pages?:DocumentPage[] };
};

function unauthorised() {
  return Response.json({ error: "Sign in with ChatGPT to access saved quotes." }, { status: 401 });
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return unauthorised();
  const member = await requireWorkspaceContext(user, ["owner", "admin", "quoter"]).catch(() => null);
  if (!member) return Response.json({ error: "forbidden: active workspace membership is required" }, { status: 403 });

  try {
    const tenantId = member.tenantId;
    const [quotes, events, entitlement, catalogueWorkspace, rules, clients] = await Promise.all([listQuotes(tenantId), listQuoteEvents(tenantId), getWorkspaceEntitlement(tenantId), listCatalogueWorkspace(tenantId), getRuleWorkspace(tenantId), listClients(tenantId)]);
    return Response.json({ quotes, events, entitlement, catalogue: catalogueWorkspace.catalogue, catalogueCategories:catalogueWorkspace.categories, proposalTypes:catalogueWorkspace.proposalTypes, ruleSet: rules.published, draftRuleSet: rules.draft, clients, workspace: { id: tenantId, name: member.workspaceName, currency: member.currency, role: member.role } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quote storage failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return unauthorised();
  const member = await requireWorkspaceContext(user, ["owner", "admin", "quoter"]).catch(() => null);
  if (!member) return Response.json({ error: "forbidden: active workspace membership is required" }, { status: 403 });

  try {
    const body = (await request.json()) as SaveQuoteBody;
    const clientName = body.clientName?.trim() ?? "";
    const contactName = body.contactName?.trim() ?? "";
    const contactEmail = body.contactEmail?.trim().toLowerCase() ?? "";
    const reference = body.reference?.trim() ?? "QB-1049";
    const validUntil = body.validUntil?.trim() ?? "";
    const status = body.status === "Ready" ? "Ready" : "Draft";
    const quoteDiscount = Number(body.quoteDiscount ?? 0);

    if (!clientName || !contactName || !contactEmail || !validUntil) {
      return Response.json({ error: "Client, contact, contact email and validity date are required." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return Response.json({ error: "Enter a valid client contact email address." }, { status: 400 });
    }
    const tenantId = member.tenantId;
    await assertQuoteCapacity(tenantId, reference);
    const legal = await resolveLegalContent(tenantId, body.document?.proposalTypeId?.trim());
    if (status === "Ready" && legal.missingMandatory.length) {
      return Response.json({ error: "Mandatory legal policies require a published version before this proposal can be marked ready." }, { status: 422 });
    }
    const document = {
      title: body.document?.title?.trim() || "Transformation delivery partnership",
      introduction: body.document?.introduction?.trim() || "This proposal combines focused strategy, delivery capacity and an ongoing advisory relationship.",
      scopeHeading: body.document?.scopeHeading?.trim() || "A practical route to measurable change",
      brandName: body.document?.brandName?.trim() || "Finance Advisory Partners",
      brandInitials: body.document?.brandInitials?.trim().slice(0, 4).toUpperCase() || "FAP",
      proposalTypeId:body.document?.proposalTypeId?.trim().slice(0,80)||undefined,
      templateId:body.document?.templateId?.trim().slice(0,160)||undefined,
      depositMinor: Math.max(0,Math.round(Number(body.document?.depositMinor??0))),
      options:(body.document?.options??[]).slice(0,12).map(option=>({id:String(option.id||crypto.randomUUID()),label:String(option.label??"").trim().slice(0,160)})).filter(option=>option.label),
      pages:normaliseProposalPages(body.document?.pages),
      legalContent: legal.snapshots,
    };

    const [catalogueItems, rules] = await Promise.all([listCatalogueItems(tenantId), getRuleWorkspace(tenantId)]);
    const answers = Object.fromEntries(Object.entries(body.answers ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
    const unanswered = (rules.published.questions ?? []).filter((question) => question.required && !answers[question.id]);
    if (status === "Ready" && unanswered.length) {
      return Response.json({ error: `Answer required pricing questions: ${unanswered.map((question) => question.prompt).join(", ")}.` }, { status: 422 });
    }
    const lines = (body.lines ?? []).flatMap((line) => {
      const item = catalogueItems.find((candidate) => candidate.id === line.itemId);
      if (!item || !Number.isFinite(line.quantity)) return [];
      return [{
        lineId: item.id,
        item,
        quantity: Number(line.quantity),
        discountBp: money.bp(Number(line.discount ?? 0) * 100),
      }];
    });
    const priced = price({
      ruleSet: rules.published,
      currency: /^[A-Z]{3}$/.test(String(body.currency??member.currency).toUpperCase())?String(body.currency??member.currency).toUpperCase():member.currency,
      role: member.role,
      answers,
      lines,
      quoteDiscountBp: money.bp(quoteDiscount * 100),
      trace: true,
      regionCode:String(body.regionCode??"GLOBAL").trim().toUpperCase().slice(0,12),
      asOfDate:/^\d{4}-\d{2}-\d{2}$/.test(String(body.asOfDate))?String(body.asOfDate):new Date().toISOString().slice(0,10),
    });

    if (!priced.ok) {
      return Response.json({ error: "Pricing controls blocked this quote.", details: priced.errors }, { status: 422 });
    }

    const client = await upsertClient(tenantId, { id: body.clientId, name: clientName, contactName, contactEmail }, user.email);
    if (!client) throw new Error("The client record could not be resolved.");
    const stored = await upsertQuote({
      id: crypto.randomUUID(),
      tenantId,
      ownerEmail: user.email,
      clientId: client.id,
      reference,
      clientName,
      contactName,
      contactEmail,
      validUntil,
      status,
      currency: priced.quote.currency,
      oneOffTotalMinor: priced.quote.oneOffSubtotalMinor,
      recurringAnnualisedMinor: priced.quote.recurringAnnualisedMinor,
      marginBp: priced.quote.marginBp,
      lineItemsJson: JSON.stringify(body.lines ?? []),
      answersJson: JSON.stringify({ values: body.answers ?? {}, quoteDiscount, regionCode:String(body.regionCode??"GLOBAL").toUpperCase(), asOfDate:String(body.asOfDate??new Date().toISOString().slice(0,10)) }),
      pricingSnapshotJson: JSON.stringify(priced.quote),
      documentJson: JSON.stringify(document),
      ruleSetId: rules.published.id,
      ruleSetVersion: rules.published.version,
    });

    return Response.json({ quote: stored }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quote storage failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
