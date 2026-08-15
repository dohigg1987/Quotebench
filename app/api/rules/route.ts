import { getChatGPTUser } from "../../chatgpt-auth";
import { createRuleDraft, getRuleWorkspace, publishRuleDraft, saveRuleDraft } from "../../../db/pricing-rule-store";
import type { RuleSet } from "../../../packages/pricing-engine/src/index";
import { requireWorkspaceRole } from "../../../db/member-store";

export const dynamic = "force-dynamic";
const TENANT_ID = "finance-advisory-partners";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to access pricing rules." }, { status: 401 });
  try { await requireWorkspaceRole(TENANT_ID, user, ["owner", "admin"]); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "forbidden" }, { status: 403 }); }
  return Response.json(await getRuleWorkspace(TENANT_ID));
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to manage pricing rules." }, { status: 401 });
  try { await requireWorkspaceRole(TENANT_ID, user, ["owner", "admin"]); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "forbidden" }, { status: 403 }); }
  try {
    const body = (await request.json()) as { action?: string; ruleSet?: RuleSet };
    if (body.action === "create_draft") {
      return Response.json({ draft: await createRuleDraft(TENANT_ID, user.email) }, { status: 201 });
    }
    if (!body.ruleSet) return Response.json({ error: "A draft rule set is required." }, { status: 400 });
    if (body.ruleSet.roundingIncrementMinor < 1 || body.ruleSet.quoteMinimumMinor < 0) {
      return Response.json({ error: "Rounding and minimum values are invalid." }, { status: 400 });
    }
    const invalidBand = body.ruleSet.quantityBands.find((band) => band.fromQuantity < 1 || (band.toQuantity !== undefined && band.toQuantity < band.fromQuantity) || band.unitPriceMinor < 0);
    if (invalidBand) return Response.json({ error: `Quantity band ${invalidBand.id} has invalid bounds or price.` }, { status: 400 });
    const questions = body.ruleSet.questions ?? [];
    const questionIds = new Set(questions.map((question) => question.id));
    if (questionIds.size !== questions.length || questions.some((question) => !question.id.trim() || !question.prompt.trim() || question.options.length < 1)) {
      return Response.json({ error: "Every pricing question needs a unique ID, a prompt and at least one option." }, { status: 400 });
    }
    const invalidModifier = body.ruleSet.modifiers.find((modifier) => {
      const question = questions.find((entry) => entry.id === modifier.triggerQuestionId);
      return !question || !question.options.some((option) => option.value === modifier.triggerValue);
    });
    if (invalidModifier) return Response.json({ error: `Modifier ${invalidModifier.name} references a missing question option.` }, { status: 400 });
    if (body.action === "save_draft") {
      return Response.json({ draft: await saveRuleDraft(TENANT_ID, body.ruleSet, user.email) });
    }
    if (body.action === "publish") {
      return Response.json({ published: await publishRuleDraft(TENANT_ID, body.ruleSet, user.email), draft: null });
    }
    return Response.json({ error: "Unsupported pricing rule action." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Pricing rules could not be updated." }, { status: 409 });
  }
}
