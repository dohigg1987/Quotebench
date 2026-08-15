import { getChatGPTUser } from "../../../chatgpt-auth";
import { getStoredFile } from "../../../../db/document-store";
import { requireWorkspaceContext } from "../../../../db/workspace-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const publicRequest = new URL(request.url).searchParams.get("public") === "1"; let tenantId: string | undefined; if (!publicRequest) { const user = await getChatGPTUser(); if (!user) return new Response("Not found", { status: 404 }); try { tenantId = (await requireWorkspaceContext(user, ["owner", "admin", "quoter"])).tenantId; } catch { return new Response("Not found", { status: 404 }); } } const file = await getStoredFile(id, tenantId); if (!file) return new Response("Not found", { status: 404 }); return new Response(file.object.body, { headers: { "content-type": file.contentType, "content-disposition": `inline; filename="${file.filename.replaceAll('"', "")}"`, "cache-control": publicRequest ? "public, max-age=3600" : "private, no-store", "x-content-type-options": "nosniff" } }); }
