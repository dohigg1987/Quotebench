import { declineQuote } from "../../../../../../db/quote-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const body = (await request.json()) as { reason?: string };
    await declineQuote(token, body.reason?.trim() || null);
    return Response.json({ declined: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The proposal could not be declined." }, { status: 409 });
  }
}
