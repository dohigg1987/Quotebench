import { getChatGPTUser } from "../../chatgpt-auth";
import { requireWorkspaceContext, auditSecurity } from "../../../db/workspace-store";
import { createEngagementVersion, listEngagementContent, publishEngagementContent, saveEngagementDraft, type EngagementContent } from "../../../db/engagement-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to access engagement governance." }, { status: 401 });
  try { const context = await requireWorkspaceContext(user, ["owner", "admin", "quoter"]); return Response.json({ content: await listEngagementContent(context.tenantId) }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Engagement governance is unavailable." }, { status: 403 }); }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to manage engagement governance." }, { status: 401 });
  try {
    const context = await requireWorkspaceContext(user, ["owner", "admin"]);
    const body = await request.json() as Partial<EngagementContent> & { action?: "save" | "publish" | "new_version" };
    const item = body.action === "publish" && body.id ? await publishEngagementContent(context.tenantId, user.email, body.id)
      : body.action === "new_version" && body.id ? await createEngagementVersion(context.tenantId, user.email, body.id)
      : await saveEngagementDraft(context.tenantId, user.email, body);
    await auditSecurity({ tenantId: context.tenantId, actorEmail: user.email, eventType: `engagement.${body.action ?? "save"}`, resourceType: "legal_content", resourceId: item.id, outcome: "success", details: { version: item.version, kind: item.kind } });
    return Response.json({ item }, { status: 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Legal content could not be saved." }, { status: 409 }); }
}
