import assert from "node:assert/strict";
import test from "node:test";
import { renderProposalPdf } from "../lib/proposal-pdf.ts";

test("proposal PDF preserves authored pages, pricing and long schedules", () => {
  const marker = "UNIQUE_END_MARKER";
  const bytes = renderProposalPdf({
    reference: "QB-9001",
    clientName: "Example Client Limited",
    contactName: "Alex Example",
    validUntil: "2026-12-31",
    currency: "GBP",
    oneOffTotalMinor: 125000,
    recurringAnnualisedMinor: 720000,
    title: "Operational improvement programme",
    introduction: "A proposal that preserves the authored document structure.",
    scopeHeading: "Scope and outcomes",
    brandName: "QuoteBench",
    options: [{ label: "Standard programme" }],
    lines: [{
      itemName: "Managed delivery",
      quantity: 2,
      unitLabel: "month",
      finalPriceMinor: 125000,
      description: "A governed delivery service.",
      serviceSchedule: `${"Weekly planning, delivery and reporting. ".repeat(150)}${marker}`,
      serviceTerms: "Thirty days notice applies.",
    }],
    pages: [
      { title: "Overview", format: "standard", background: "plain", blocks: [{ type: "text", title: "Approach", content: "Detailed narrative content." }] },
      { title: "Investment", format: "wide", background: "soft", blocks: [{ type: "pricing_table", title: "Scope and investment", display: "full" }, { type: "options", title: "Options" }] },
    ],
  });
  const pdf = new TextDecoder().decode(bytes);
  assert.match(pdf, /^%PDF-1\.7/);
  assert.match(pdf, /\/Count [4-9]/);
  assert.match(pdf, /Scope and investment/);
  assert.match(pdf, /Managed delivery/);
  assert.match(pdf, new RegExp(marker));
  assert.match(pdf, /\/MediaBox \[0 0 842 595\]/);
  assert.doesNotMatch(pdf, /slice\(0, 110\)/);
});
