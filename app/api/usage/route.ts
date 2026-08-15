import { getChatGPTUser } from "../../chatgpt-auth";
import { requireWorkspaceContext } from "../../../db/workspace-store";
import { getWorkspaceUsage } from "../../../db/usage-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to view workspace usage." }, { status: 401 });
  try {
    const context = await requireWorkspaceContext(user, ["owner", "admin"]);
    return Response.json(await getWorkspaceUsage(context.tenantId));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Workspace usage is unavailable." }, { status: 403 });
  }
}
