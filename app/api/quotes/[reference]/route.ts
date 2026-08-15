import { getChatGPTUser } from "../../../chatgpt-auth";
import { createQuoteRevision, duplicateQuote, getInternalQuote, issueQuote, markQuoteAcceptedOffline } from "../../../../db/quote-store";
import { requireWorkspaceRole } from "../../../../db/member-store";

export const dynamic = "force-dynamic";

const TENANT_ID = "finance-advisory-partners";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Sign in with ChatGPT to open saved quotes." }, { status: 401 });
  }
  try { await requireWorkspaceRole(TENANT_ID, user, ["owner", "admin", "quoter"]); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "forbidden" }, { status: 403 }); }
  const { reference } = await params;
  const quote = await getInternalQuote(TENANT_ID, reference);
  return quote
    ? Response.json({ quote })
    : Response.json({ error: "The quote could not be found." }, { status: 404 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Sign in with ChatGPT to issue quotes." }, { status: 401 });
  }
  try { await requireWorkspaceRole(TENANT_ID, user, ["owner", "admin", "quoter"]); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "forbidden" }, { status: 403 }); }

  try {
    const body = (await request.json()) as { action?: string; acceptedBy?: string };
    const { reference } = await params;
    if (body.action === "revise") {
      const quote = await createQuoteRevision(TENANT_ID, reference, user.email);
      return Response.json({ quote }, { status: 201 });
    }
    if (body.action === "duplicate") {
      const quote = await duplicateQuote(TENANT_ID, reference, user.email);
      return Response.json({ quote }, { status: 201 });
    }
    if (body.action === "accept_offline" && body.acceptedBy?.trim()) {
      return Response.json({ quote: await markQuoteAcceptedOffline(TENANT_ID, reference, body.acceptedBy.trim(), user.email) });
    }
    if (body.action !== "issue") {
      return Response.json({ error: "Unsupported quote action." }, { status: 400 });
    }
    const token = await issueQuote(TENANT_ID, reference, user.email);
    return Response.json({ token, path: `/q/${token}` });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "The quote could not be issued." },
      { status: 409 },
    );
  }
}
