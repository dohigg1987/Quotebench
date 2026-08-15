import { getChatGPTUser } from "../../chatgpt-auth";
import { listClients, upsertClient } from "../../../db/client-store";
import { requireWorkspaceRole } from "../../../db/member-store";

export const dynamic = "force-dynamic";
const TENANT_ID = "finance-advisory-partners";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to access clients." }, { status: 401 });
  try { await requireWorkspaceRole(TENANT_ID, user, ["owner", "admin", "quoter"]); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "forbidden" }, { status: 403 }); }
  return Response.json({ clients: await listClients(TENANT_ID) });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to manage clients." }, { status: 401 });
  try { await requireWorkspaceRole(TENANT_ID, user, ["owner", "admin", "quoter"]); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "forbidden" }, { status: 403 }); }
  try {
    const body = (await request.json()) as { id?: string; name?: string; contactName?: string; contactEmail?: string; status?: "Active" | "Archived" };
    if (!body.name?.trim() || !body.contactName?.trim() || !body.contactEmail?.trim()) {
      return Response.json({ error: "Client name, contact name and contact email are required." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.contactEmail)) {
      return Response.json({ error: "Enter a valid contact email address." }, { status: 400 });
    }
    const client = await upsertClient(TENANT_ID, {
      id: body.id,
      name: body.name,
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      status: body.status,
    }, user.email);
    return Response.json({ client }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The client could not be saved." }, { status: 409 });
  }
}
