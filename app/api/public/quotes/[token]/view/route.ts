import { recordQualifiedView } from "../../../../../../db/quote-store";
import { recordTrackingEvent, resolveRecipientToken } from "../../../../../../db/delivery-store";
import { enforceTokenRateLimit } from "../../../../../../db/workspace-store";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const rate = await enforceTokenRateLimit(token, "view", 60);
  if (!rate.allowed) return Response.json({ error: "Too many requests." }, { status: 429, headers: { "retry-after": "60" } });
  const userAgent = request.headers.get("user-agent") ?? "";
  const scanner = /(?:googleimageproxy|microsoft office|proofpoint|mimecast|barracuda|urlscan|bot|crawler|spider)/i.test(userAgent);
  const body = await request.json().catch(() => ({})) as { eventType?: "open" | "section_heartbeat" | "pdf_download"; section?: string; durationMs?: number; deviceHash?: string };
  if (scanner) { if (await resolveRecipientToken(token)) await recordTrackingEvent(token, "prefetch", null, null, body.deviceHash ?? null, { scanner: true }); return Response.json({ status: "prefetch" }); }
  if (body.eventType === "section_heartbeat") { const recipient = await recordTrackingEvent(token, "section_heartbeat", body.section?.slice(0, 60) ?? "unknown", Math.min(60_000, Math.max(0, Number(body.durationMs ?? 0))), body.deviceHash ?? null, {}); return recipient ? Response.json({ status: "recorded" }) : Response.json({ error: "Quote not found." }, { status: 404 }); }
  const quote = await recordQualifiedView(token);
  if (!quote) return Response.json({ error: "Quote not found." }, { status: 404 });
  return Response.json({ status: quote.status });
}
