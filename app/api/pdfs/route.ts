import { getCurrentUser } from "../../auth";
import { createPdfJob, getPdfJob } from "../../../db/document-store";
import { getInternalQuote } from "../../../db/quote-store";
import { meterEvent, requireWorkspaceContext } from "../../../db/workspace-store";
import { assertCapacity } from "../../../db/entitlement-store";
import type { PdfJobMessage } from "../../../lib/pdf-jobs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in to QuoteBench to generate PDFs." }, { status: 401 });
  try {
    const context = await requireWorkspaceContext(user, ["owner", "admin", "quoter"]);
    const body = (await request.json()) as { reference?: string };
    if (!body.reference) return Response.json({ error: "Quote reference is required." }, { status: 400 });
    const quote = await getInternalQuote(context.tenantId, body.reference);
    if (!quote) return Response.json({ error: "Quote not found." }, { status: 404 });
    await assertCapacity(context.tenantId, "pdfs");
    const job = await createPdfJob(context.tenantId, body.reference, user.email);
    const { env } = await import("cloudflare:workers");
    if (!env.PDF_QUEUE) throw new Error("PDF queue is unavailable.");
    await env.PDF_QUEUE.send({ tenantId: context.tenantId, jobId: String(job.id), reference: body.reference, actorEmail: user.email } satisfies PdfJobMessage);
    await meterEvent(context.tenantId, "pdf.generated", String(job.id));
    return Response.json({ job }, { status: 202 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "PDF generation could not be queued." }, { status: 409 });
  }
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in to QuoteBench to access PDFs." }, { status: 401 });
  try {
    const context = await requireWorkspaceContext(user, ["owner", "admin", "quoter"]);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Job ID is required." }, { status: 400 });
    const job = await getPdfJob(context.tenantId, id);
    if (!job) return Response.json({ error: "PDF job not found." }, { status: 404 });
    return Response.json({ job, downloadPath: job?.file_id ? `/api/files/${job.file_id}` : null });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "PDF status is unavailable." }, { status: 500 });
  }
}
