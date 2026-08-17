import { resolveProposalText, type ProposalMetadata } from "./proposal-metadata.ts";

type ProposalLine = {
  itemName: string;
  quantity: number;
  unitLabel: string;
  finalPriceMinor: number;
  description?: string;
  serviceSchedule?: string;
  serviceTerms?: string;
};

type ProposalBlock = {
  type: string;
  title?: string;
  eyebrow?: string;
  content?: string;
  enabled?: boolean;
  display?: "totals" | "lines" | "full";
  items?: Array<{ title: string; content: string }>;
};

type ProposalPage = {
  title: string;
  format: "standard" | "wide" | "cover" | "letter";
  background: "plain" | "soft" | "brand" | "dark";
  blocks: ProposalBlock[];
};

export type ProposalPdfInput = {
  reference: string;
  clientName: string;
  contactName: string;
  contactEmail?: string;
  validUntil: string;
  currency: string;
  oneOffTotalMinor: number;
  recurringAnnualisedMinor: number;
  title: string;
  introduction: string;
  scopeHeading: string;
  brandName?: string;
  pages?: ProposalPage[];
  lines: ProposalLine[];
  options?: Array<{ label: string }>;
};

type TextLine = {
  text: string;
  size?: number;
  bold?: boolean;
  indent?: number;
  before?: number;
  after?: number;
  colour?: [number, number, number];
};

type PageFormat = { width: number; height: number };

const FORMATS: Record<ProposalPage["format"], PageFormat> = {
  standard: { width: 595, height: 842 },
  letter: { width: 612, height: 792 },
  wide: { width: 842, height: 595 },
  cover: { width: 595, height: 842 },
};

function ascii(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E\n]/g, "?");
}

function escapePdf(value: string): string {
  return ascii(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function money(value: number, currency: string): string {
  return `${currency} ${(value / 100).toLocaleString(currency === "USD" ? "en-US" : "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function wrap(value: string, maxCharacters: number): string[] {
  const paragraphs = ascii(value).split(/\r?\n/);
  const result: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) { result.push(""); continue; }
    let line = "";
    for (const word of words) {
      const chunks = word.length > maxCharacters
        ? word.match(new RegExp(`.{1,${maxCharacters}}`, "g")) ?? [word]
        : [word];
      for (const chunk of chunks) {
        const candidate = line ? `${line} ${chunk}` : chunk;
        if (candidate.length > maxCharacters && line) {
          result.push(line);
          line = chunk;
        } else line = candidate;
      }
    }
    if (line) result.push(line);
  }
  return result;
}

function pageBackground(background: ProposalPage["background"], width: number, height: number): string[] {
  const colour = background === "dark" ? "0.075 0.105 0.125" : background === "brand" ? "0.055 0.31 0.34" : background === "soft" ? "0.94 0.97 0.97" : "1 1 1";
  return [`${colour} rg 0 0 ${width} ${height} re f`];
}

function contentLines(input: ProposalPdfInput, page: ProposalPage): TextLine[] {
  const lines: TextLine[] = [];
  const metadata: ProposalMetadata = {
    clientName: input.clientName,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    quoteReference: input.reference,
    proposalTitle: input.title,
    validUntil: input.validUntil,
    currency: input.currency,
    brandName: input.brandName,
  };
  for (const block of page.blocks.filter((entry) => entry.enabled !== false)) {
    if (block.type === "spacer") { lines.push({ text: "", after: 18 }); continue; }
    if (block.eyebrow) lines.push({ text: (resolveProposalText(block.eyebrow, metadata) ?? block.eyebrow).toUpperCase(), size: 8, bold: true, before: 10, after: 3, colour: [0.12, 0.38, 0.4] });
    if (block.title) lines.push({ text: resolveProposalText(block.title, metadata) ?? block.title, size: 16, bold: true, before: 8, after: 7 });

    if (block.type === "pricing_table") {
      if (block.display !== "totals") {
        for (const service of input.lines) {
          lines.push({ text: `${service.itemName}  |  ${service.quantity} ${service.unitLabel}  |  ${money(service.finalPriceMinor, input.currency)}`, size: 11, bold: true, before: 8, after: 3 });
          if (service.description) lines.push({ text: service.description, indent: 12, after: 3 });
          if (service.serviceSchedule) {
            lines.push({ text: "Service schedule", size: 9, bold: true, indent: 12, before: 4 });
            lines.push({ text: service.serviceSchedule, indent: 12, after: 3 });
          }
          if (service.serviceTerms) {
            lines.push({ text: "Service terms", size: 9, bold: true, indent: 12, before: 4 });
            lines.push({ text: service.serviceTerms, indent: 12, after: 5 });
          }
        }
      }
      if (block.display !== "lines") {
        lines.push({ text: `One-off investment: ${money(input.oneOffTotalMinor, input.currency)}`, size: 12, bold: true, before: 14, after: 4 });
        lines.push({ text: `Annualised recurring: ${money(input.recurringAnnualisedMinor, input.currency)}`, size: 12, bold: true, after: 8 });
      }
      continue;
    }

    if (["feature_grid", "timeline", "team", "faq"].includes(block.type)) {
      for (const item of block.items ?? []) {
        lines.push({ text: resolveProposalText(item.title, metadata) ?? item.title, size: 11, bold: true, before: 6, after: 2 });
        lines.push({ text: resolveProposalText(item.content, metadata) ?? item.content, indent: 10, after: 4 });
      }
      continue;
    }
    if (block.type === "options") {
      for (const option of input.options ?? []) lines.push({ text: `Option: ${option.label}`, size: 11, bold: true, before: 5, after: 3 });
      continue;
    }
    if (block.type === "image") {
      lines.push({ text: "Image available in the secure online proposal.", size: 9, after: 8, colour: [0.35, 0.35, 0.35] });
      continue;
    }
    if (block.type === "video") {
      lines.push({ text: "Video available in the secure online proposal.", size: 9, after: 8, colour: [0.35, 0.35, 0.35] });
      if (block.content) lines.push({ text: resolveProposalText(block.content, metadata) ?? block.content, after: 5 });
      continue;
    }
    if (block.content) lines.push({ text: resolveProposalText(block.content, metadata) ?? block.content, after: 7 });
  }
  return lines;
}

function textCommand(line: string, x: number, y: number, size: number, bold: boolean, colour: [number, number, number]): string {
  return `BT /${bold ? "F2" : "F1"} ${size} Tf ${colour.join(" ")} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapePdf(line)}) Tj ET`;
}

function renderLogicalPage(input: ProposalPdfInput, page: ProposalPage, pageNumberStart: number): Array<{ format: PageFormat; stream: string }> {
  const format = FORMATS[page.format];
  const margin = page.format === "wide" ? 56 : 52;
  const usableWidth = format.width - margin * 2;
  const dark = page.background === "dark" || page.background === "brand";
  const baseColour: [number, number, number] = dark ? [1, 1, 1] : [0.08, 0.1, 0.12];
  const physical: Array<{ format: PageFormat; stream: string }> = [];
  let commands = pageBackground(page.background, format.width, format.height);
  let y = format.height - margin;
  let pageNumber = pageNumberStart;

  const footer = () => {
    commands.push(textCommand(`${input.brandName ?? "QuoteBench"}  |  ${input.reference}  |  Page ${pageNumber}`, margin, 24, 8, false, dark ? [0.85, 0.9, 0.9] : [0.35, 0.4, 0.42]));
  };
  const finish = () => {
    footer();
    physical.push({ format, stream: commands.join("\n") });
    pageNumber += 1;
  };
  const continuation = () => {
    finish();
    commands = pageBackground(page.background, format.width, format.height);
    y = format.height - margin;
    commands.push(textCommand(`${page.title} (continued)`, margin, y, 13, true, baseColour));
    y -= 28;
  };

  commands.push(textCommand(page.title, margin, y, page.format === "cover" ? 25 : 18, true, baseColour));
  y -= page.format === "cover" ? 42 : 32;
  for (const item of contentLines(input, page)) {
    const size = item.size ?? 10;
    const leading = Math.max(13, size * 1.35);
    y -= item.before ?? 0;
    const indent = item.indent ?? 0;
    const maxCharacters = Math.max(18, Math.floor((usableWidth - indent) / (size * 0.52)));
    for (const line of wrap(item.text, maxCharacters)) {
      if (y - leading < 48) continuation();
      if (line) commands.push(textCommand(line, margin + indent, y, size, item.bold ?? false, item.colour ?? baseColour));
      y -= leading;
    }
    y -= item.after ?? 0;
  }
  finish();
  return physical;
}

function coverPage(input: ProposalPdfInput): ProposalPage {
  return {
    title: input.brandName ?? "QuoteBench",
    format: "cover",
    background: "brand",
    blocks: [
      { type: "heading", eyebrow: `PROPOSAL ${input.reference}`, title: input.title, content: `Prepared for ${input.clientName}\n${input.contactName}\nValid until ${input.validUntil}` },
      { type: "callout", title: input.scopeHeading, content: input.introduction },
    ],
  };
}

export function renderProposalPdf(input: ProposalPdfInput): Uint8Array {
  const logicalPages = [coverPage(input), ...(input.pages?.length ? input.pages : [{
    title: "Commercial proposal",
    format: "standard" as const,
    background: "plain" as const,
    blocks: [
      { type: "text", title: input.scopeHeading, content: input.introduction },
      { type: "pricing_table", title: "Scope and investment", display: "full" as const },
      { type: "terms", title: "Terms", content: "This proposal is valid until the stated expiry date. Fees exclude VAT unless specified." },
    ],
  }])];
  const pages: Array<{ format: PageFormat; stream: string }> = [];
  for (const page of logicalPages) pages.push(...renderLogicalPage(input, page, pages.length + 1));

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pageIds: number[] = [];
  pages.forEach((page) => {
    const pageId = objects.length + 1;
    const streamId = pageId + 1;
    pageIds.push(pageId);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.format.width} ${page.format.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`);
    objects.push(`<< /Length ${page.stream.length} >>\nstream\n${page.stream}\nendstream`);
  });
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.7\n%QuoteBench\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

