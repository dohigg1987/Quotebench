import { declineQuote } from "../../../../../../db/quote-store";
import { enforceTokenRateLimit } from "../../../../../../db/workspace-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const rate = await enforceTokenRateLimit(token, "decline", 10);
    if (!rate.allowed) return Response.json({ error: "Too many decline attempts." }, { status: 429, headers: { "retry-after": "60" } });
    const body = (await request.json()) as { reason?: string };
    await declineQuote(token, body.reason?.trim() || null);
    return Response.json({ declined: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The proposal could not be declined." }, { status: 409 });
  }
}
