import { getChatGPTUser } from "../../chatgpt-auth";
import { listCatalogueItems } from "../../../db/catalogue-store";
import { getRuleWorkspace } from "../../../db/pricing-rule-store";
import { money, price, type RuleSet } from "../../../packages/pricing-engine/src/index";
import { requireWorkspaceContext } from "../../../db/workspace-store";

export const dynamic = "force-dynamic";

type PreviewBody = {
  answers?: Record<string, string>;
  ruleSet?: RuleSet;
  quoteDiscount?: number;
  lines?: Array<{ itemId?: string; quantity?: number; discount?: number }>;
};

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to price quotes." }, { status: 401 });
  try {
    const context = await requireWorkspaceContext(user, ["owner", "admin", "quoter"]);
    const body = (await request.json()) as PreviewBody;
    const [catalogueItems, rules] = await Promise.all([listCatalogueItems(context.tenantId), getRuleWorkspace(context.tenantId)]);
    const lines = (body.lines ?? []).flatMap((line) => {
      const item = catalogueItems.find((candidate) => candidate.id === line.itemId);
      if (!item || !Number.isFinite(line.quantity)) return [];
      return [{ lineId: item.id, item, quantity: Number(line.quantity), discountBp: money.bp(Number(line.discount ?? 0) * 100) }];
    });
    const selectedRuleSet = body.ruleSet ?? rules.published;
    const result = price({
      ruleSet: selectedRuleSet,
      currency: context.currency,
      role: context.role,
      answers: Object.fromEntries(Object.entries(body.answers ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
      lines,
      quoteDiscountBp: money.bp(Number(body.quoteDiscount ?? 0) * 100),
      trace: true,
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The quote could not be priced." }, { status: 400 });
  }
}
