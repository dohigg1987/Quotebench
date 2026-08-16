import { getChatGPTUser } from "../../chatgpt-auth";
import { completePdfJob, createPdfJob, failPdfJob, getPdfJob } from "../../../db/document-store";
import { getInternalQuote } from "../../../db/quote-store";
import { meterEvent, requireWorkspaceContext } from "../../../db/workspace-store";

export const dynamic = "force-dynamic";

function simplePdf(lines: string[]) {
  const escape = (value: string) => value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
  const text = lines.map((line, index) => `${index ? "0 -22 Td " : ""}(${escape(line.slice(0, 110))}) Tj`).join("\n");
  const stream = `BT /F1 12 Tf 48 790 Td ${text} ET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>", `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets[index + 1] = pdf.length; pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

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
        const serviceLines=quote.pricingSnapshot.lines.flatMap(line=>["",`${line.itemName}: ${line.quantity} ${line.unitLabel} - ${quote.currency} ${(line.finalPriceMinor/100).toFixed(2)}`,...(line.description?[line.description]:[]),...(line.serviceSchedule?[`Service schedule: ${line.serviceSchedule}`]:[]),...(line.serviceTerms?[`Service terms: ${line.serviceTerms}`]:[])]);
        const bytes = simplePdf([`QuoteBench proposal ${quote.reference}`, `Prepared for ${quote.clientName}`, `Contact: ${quote.contactName}`, `Valid until ${quote.validUntil}`, `One-off total: ${quote.currency} ${(quote.oneOffTotalMinor / 100).toFixed(2)}`, `Annualised recurring: ${quote.currency} ${(quote.recurringAnnualisedMinor / 100).toFixed(2)}`, "", quote.document.title, quote.document.introduction, quote.document.scopeHeading,...serviceLines]);
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
