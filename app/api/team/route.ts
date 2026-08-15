import { getChatGPTUser } from "../../chatgpt-auth";
import { inviteWorkspaceMember, listWorkspaceMembers, requireWorkspaceRole, updateWorkspaceMember, type WorkspaceRole } from "../../../db/member-store";

export const dynamic = "force-dynamic";
const TENANT_ID = "finance-advisory-partners";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to access workspace members." }, { status: 401 });
  try {
    const currentMember = await requireWorkspaceRole(TENANT_ID, user, ["owner", "admin", "quoter"]);
    return Response.json({ members: await listWorkspaceMembers(TENANT_ID), currentRole: currentMember.role, seatLimit: 5 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Workspace membership is unavailable." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to invite workspace members." }, { status: 401 });
  try {
    await requireWorkspaceRole(TENANT_ID, user, ["owner", "admin"]);
    const body = (await request.json()) as { email?: string; role?: "admin" | "quoter" };
    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || !body.role) return Response.json({ error: "A valid email and role are required." }, { status: 400 });
    await inviteWorkspaceMember(TENANT_ID, body.email, body.role, user.email);
    return Response.json({ members: await listWorkspaceMembers(TENANT_ID) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The invitation could not be created." }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to manage workspace members." }, { status: 401 });
  try {
    await requireWorkspaceRole(TENANT_ID, user, ["owner"]);
    const body = (await request.json()) as { email?: string; action?: "role" | "remove"; role?: WorkspaceRole };
    if (!body.email || !body.action) return Response.json({ error: "Member email and action are required." }, { status: 400 });
    await updateWorkspaceMember(TENANT_ID, body.email, body.action, body.role, user.email);
    return Response.json({ members: await listWorkspaceMembers(TENANT_ID) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The member could not be updated." }, { status: 409 });
  }
}
