type CertificateInput = { reference: string; clientName: string; acceptedAt: string; acceptedBy: string; snapshot: Record<string, unknown>; signers: Array<{ name: string; email: string; role: string; signingOrder: number; signedAt: string | null }> };
function ascii(value: string) { return value.replace(/[\u2013\u2014]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[^\x20-\x7E]/g, "?"); }
function pdfText(value: string) { return ascii(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)"); }
export function renderAcceptanceCertificate(input: CertificateInput) {
  const evidence = (input.snapshot.evidence ?? {}) as Record<string, unknown>;
  const lines = [
    ["QUOTEBENCH ACCEPTANCE CERTIFICATE", 18], ["Independent evidence summary", 10], ["", 10],
    [`Proposal: ${input.reference}`, 12], [`Client: ${input.clientName}`, 12], [`Completed: ${input.acceptedAt}`, 10], [`Accepted by: ${input.acceptedBy}`, 10],
    ["", 10], ["SIGNATURE WORKFLOW", 13], ...input.signers.flatMap((signer) => [[`${signer.signingOrder}. ${signer.name} <${signer.email}>`, 10] as [string, number], [`   ${signer.role} - ${signer.signedAt ?? "not completed"}`, 9] as [string, number]]),
    ["", 10], ["EVIDENCE", 13], [`Certificate ID: ${String(evidence.certificateId ?? "recorded in signer evidence")}`, 9], [`Quote snapshot SHA-256: ${String(evidence.quoteSnapshotHash ?? "")}`, 8], [`Rule-set version: ${String(evidence.ruleSetVersion ?? "")}`, 9], [`Consent: ${String(evidence.consent ?? "Formal offline acceptance")}`, 9],
    ["", 10], ["This certificate summarises the immutable acceptance snapshot retained by QuoteBench.", 9], ["Validate it against the controlled workspace record before relying on a downloaded copy.", 9],
  ] as Array<[string, number]>;
  let y = 790; const commands: string[] = ["0.08 0.31 0.34 rg 0 810 595 32 re f"];
  for (const [text, size] of lines) { if (!text) { y -= 10; continue; } const bold = size >= 12 ? "/F2" : "/F1"; commands.push(`BT ${bold} ${size} Tf 54 ${y} Td (${pdfText(text.slice(0, 110))}) Tj ET`); y -= size + 7; }
  const stream = commands.join("\n"); const objects = ["1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj", "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj", "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >> endobj", `4 0 obj << /Length ${new TextEncoder().encode(stream).length} >> stream\n${stream}\nendstream endobj`, "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj", "6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj"];
  let body = "%PDF-1.4\n"; const offsets = [0]; for (const object of objects) { offsets.push(new TextEncoder().encode(body).length); body += `${object}\n`; } const xref = new TextEncoder().encode(body).length; body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(body);
}
