import { acceptQuote } from "../../../../../../db/quote-store";
import { enforceTokenRateLimit } from "../../../../../../db/workspace-store";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const body = (await request.json()) as { acceptedBy?: string; consent?: boolean; selectedOptionId?: string };
    const acceptedBy = body.acceptedBy?.trim() ?? "";
    if (!body.consent || acceptedBy.length < 2 || acceptedBy.length > 120) {
      return Response.json(
        { error: "Full name and explicit acceptance confirmation are required." },
        { status: 400 },
      );
    }
    const { token } = await params;
    const rate = await enforceTokenRateLimit(token, "accept", 10);
    if (!rate.allowed) return Response.json({ error: "Too many acceptance attempts." }, { status: 429, headers: { "retry-after": "60" } });
    const quote = await acceptQuote(
      token,
      acceptedBy,
      request.headers.get("user-agent"),
      body.selectedOptionId,
      request.headers.get("cf-connecting-ip"),
    );
    return Response.json({ status: quote.status, acceptedAt: quote.acceptedAt, signingComplete: quote.signingComplete ?? quote.status === "Accepted", pendingSignatures: quote.pendingSignatures ?? 0 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Acceptance could not be recorded." },
      { status: 409 },
    );
  }
}
