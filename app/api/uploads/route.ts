import { getChatGPTUser } from "../../chatgpt-auth";
import { putStoredFile } from "../../../db/document-store";
import { requireWorkspaceRole } from "../../../db/member-store";

export const dynamic = "force-dynamic";
const TENANT_ID = "finance-advisory-partners";

export async function POST(request: Request) { const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Sign in with ChatGPT to upload files." }, { status: 401 }); try { const member = await requireWorkspaceRole(TENANT_ID, user, ["owner", "admin", "quoter"]); const form = await request.formData(); const file = form.get("file"); const kind = String(form.get("kind") ?? "attachment") as "logo" | "image" | "attachment"; const reference = String(form.get("reference") ?? "").trim() || null; if (!(file instanceof File) || !["logo", "image", "attachment"].includes(kind)) return Response.json({ error: "A supported file is required." }, { status: 400 }); if (kind === "logo" && member.role === "quoter") return Response.json({ error: "forbidden: logo upload requires owner or admin role" }, { status: 403 }); return Response.json({ file: await putStoredFile(TENANT_ID, user.email, file, kind, reference) }, { status: 201 }); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "The file could not be uploaded." }, { status: 413 }); } }
