import { getChatGPTUser } from "../../chatgpt-auth";
import { completePdfJob, createPdfJob, failPdfJob, getPdfJob } from "../../../db/document-store";
import { getInternalQuote } from "../../../db/quote-store";
import { meterEvent, requireWorkspaceContext } from "../../../db/workspace-store";
import { renderProposalPdf } from "../../../lib/proposal-pdf";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to generate PDFs." }, { status: 401 });
  try {
    const context = await requireWorkspaceContext(user, ["owner", "admin", "quoter"]);
    const body = (await request.json()) as { reference?: string };
    if (!body.reference) return Response.json({ error: "Quote reference is required." }, { status: 400 });
    const quote = await getInternalQuote(context.tenantId, body.reference);
    if (!quote) return Response.json({ error: "Quote not found." }, { status: 404 });
    const job = await createPdfJob(context.tenantId, body.reference, user.email);
    await meterEvent(context.tenantId, "pdf.generated", String(job.id));
    return Response.json({ job }, { status: 202 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "PDF generation could not be queued." }, { status: 409 });
  }
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to access PDFs." }, { status: 401 });
  try {
    const context = await requireWorkspaceContext(user, ["owner", "admin", "quoter"]);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Job ID is required." }, { status: 400 });
    let job = await getPdfJob(context.tenantId, id);
    if (!job) return Response.json({ error: "PDF job not found." }, { status: 404 });
    if (job.status === "Queued") {
      try {
        const quote = await getInternalQuote(context.tenantId, String(job.quote_reference));
        if (!quote) throw new Error("Quote not found.");
        const bytes = renderProposalPdf({
          reference: quote.reference,
          clientName: quote.clientName,
          contactName: quote.contactName,
          validUntil: quote.validUntil,
          currency: quote.currency,
          oneOffTotalMinor: quote.oneOffTotalMinor,
          recurringAnnualisedMinor: quote.recurringAnnualisedMinor,
          title: quote.document.title,
          introduction: quote.document.introduction,
          scopeHeading: quote.document.scopeHeading,
          brandName: quote.document.brandName,
          pages: quote.document.pages,
          lines: quote.pricingSnapshot.lines,
          options: quote.document.options,
        });
        await completePdfJob(context.tenantId, id, quote.reference, user.email, bytes);
      } catch (error) {
        await failPdfJob(context.tenantId, id, error instanceof Error ? error.message : "Generation failed.");
      }
      job = await getPdfJob(context.tenantId, id);
    }
    return Response.json({ job, downloadPath: job?.file_id ? `/api/files/${job.file_id}` : null });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "PDF status is unavailable." }, { status: 500 });
  }
}
