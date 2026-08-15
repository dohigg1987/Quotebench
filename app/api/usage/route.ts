import { getChatGPTUser } from "../../chatgpt-auth";
import { requireWorkspaceRole } from "../../../db/member-store";
import { getWorkspaceUsage } from "../../../db/usage-store";

export const dynamic = "force-dynamic";
const TENANT_ID = "finance-advisory-partners";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to view workspace usage." }, { status: 401 });
  try {
    await requireWorkspaceRole(TENANT_ID, user, ["owner", "admin"]);
    return Response.json(await getWorkspaceUsage(TENANT_ID));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Workspace usage is unavailable." }, { status: 403 });
  }
}
