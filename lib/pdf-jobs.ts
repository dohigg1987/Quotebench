import { assertCapacity } from "../db/entitlement-store";
import { completePdfJob, failPdfJob } from "../db/document-store";
import { getInternalQuote } from "../db/quote-store";
import { renderProposalPdf } from "./proposal-pdf";

export type PdfJobMessage = {
  tenantId: string;
  jobId: string;
  reference: string;
  actorEmail: string;
};

export async function processPdfJob(message: PdfJobMessage): Promise<void> {
  try {
    const quote = await getInternalQuote(message.tenantId, message.reference);
    if (!quote) throw new Error("Quote not found.");
    const bytes = renderProposalPdf({
      reference: quote.reference,
      clientName: quote.clientName,
      contactName: quote.contactName,
      contactEmail: quote.contactEmail ?? undefined,
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
    await assertCapacity(message.tenantId, "storage", bytes.byteLength);
    await completePdfJob(message.tenantId, message.jobId, quote.reference, message.actorEmail, bytes);
  } catch (error) {
    await failPdfJob(message.tenantId, message.jobId, error instanceof Error ? error.message : "Generation failed.");
    throw error;
  }
}
