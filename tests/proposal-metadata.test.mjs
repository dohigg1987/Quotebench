import test from "node:test";
import assert from "node:assert/strict";
import { proposalMetadataFields, resolveProposalText } from "../lib/proposal-metadata.ts";

test("proposal metadata fields resolve known quote and client values", () => {
  const result = resolveProposalText(
    "{{proposal.title}} for {{client.name}} ({{quote.reference}})",
    { proposalTitle: "Transformation programme", clientName: "Northstar", quoteReference: "QB-1052" },
  );
  assert.equal(result, "Transformation programme for Northstar (QB-1052)");
});

test("unavailable metadata remains visible for safe template authoring", () => {
  assert.equal(resolveProposalText("Prepared for {{client.name}}", {}), "Prepared for {{client.name}}");
  assert.equal(new Set(proposalMetadataFields.map((field) => field.token)).size, proposalMetadataFields.length);
});

test("non-string Puck inline editor values cannot enter metadata replacement", () => {
  assert.equal(resolveProposalText({ type: "InlineTextField" }, { clientName: "Northstar" }), undefined);
});
