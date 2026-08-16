export type ProposalMetadata = {
  clientName?: string;
  contactName?: string;
  contactEmail?: string;
  quoteReference?: string;
  proposalTitle?: string;
  validUntil?: string;
  currency?: string;
  brandName?: string;
  workspaceName?: string;
};

export const proposalMetadataFields = [
  { token: "{{client.name}}", label: "Client name", key: "clientName" },
  { token: "{{client.contact_name}}", label: "Contact name", key: "contactName" },
  { token: "{{client.contact_email}}", label: "Contact email", key: "contactEmail" },
  { token: "{{quote.reference}}", label: "Quote reference", key: "quoteReference" },
  { token: "{{proposal.title}}", label: "Proposal title", key: "proposalTitle" },
  { token: "{{quote.valid_until}}", label: "Valid until", key: "validUntil" },
  { token: "{{quote.currency}}", label: "Currency", key: "currency" },
  { token: "{{brand.name}}", label: "Brand name", key: "brandName" },
  { token: "{{workspace.name}}", label: "Workspace name", key: "workspaceName" },
] as const;

export const sampleProposalMetadata: ProposalMetadata = {
  clientName: "Northstar Manufacturing",
  contactName: "Amelia Carter",
  contactEmail: "amelia.carter@northstar.example",
  quoteReference: "QB-1052",
  proposalTitle: "Operational transformation programme",
  validUntil: "30 September 2026",
  currency: "GBP",
  brandName: "Your company",
  workspaceName: "Your workspace",
};

export function resolveProposalText(value: unknown, metadata?: ProposalMetadata) {
  if (typeof value !== "string") return undefined;
  if (!value || !metadata) return value;
  const values: Partial<Record<(typeof proposalMetadataFields)[number]["key"], string | undefined>> = metadata;
  return proposalMetadataFields.reduce(
    (resolved, field) => resolved.replaceAll(field.token, values[field.key] || field.token),
    value,
  );
}
