import { getCurrentUser } from "../../auth";
import { listWorkspaceActivity } from "../../../db/delivery-store";
import { requireWorkspaceContext } from "../../../db/workspace-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in to QuoteBench to view workspace activity." }, { status: 401 });
  try {
    const context = await requireWorkspaceContext(user, ["owner", "admin", "quoter"]);
    return Response.json(await listWorkspaceActivity(context.tenantId));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Workspace activity is unavailable." }, { status: 403 });
  }
}

