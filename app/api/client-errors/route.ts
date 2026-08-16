import { getCurrentUser } from "../../auth";
import { requireWorkspaceContext } from "../../../db/workspace-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  try {
    const context = await requireWorkspaceContext(user, ["owner", "admin", "quoter"]);
    const body = await request.json() as { surface?: unknown; name?: unknown; message?: unknown; componentStack?: unknown };
    const event = {
      tenantId: context.tenantId,
      surface: String(body.surface ?? "unknown").slice(0, 80),
      name: String(body.name ?? "Error").slice(0, 120),
      message: String(body.message ?? "Client editor failure").slice(0, 1000),
      componentStack: String(body.componentStack ?? "").slice(0, 3000),
    };
    console.error("quotebench_client_error", event);
    return Response.json({ recorded: true }, { status: 202, headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "Client error could not be recorded." }, { status: 403 });
  }
}
