import assert from "node:assert/strict";
import test from "node:test";
import { proposalPageToPuckData, puckDataToProposalBlocks } from "../lib/proposal-puck-data.ts";

test("Puck data round-trips the existing proposal page schema", () => {
  const page = {
    id: "page-1",
    title: "Overview",
    format: "wide",
    background: "soft",
    blocks: [
      { id: "text-1", type: "text", eyebrow: "Context", title: "Our proposal", content: "Client-specific narrative", enabled: true, layout: "full", alignment: "left" },
      { id: "grid-1", type: "feature_grid", title: "Outcomes", columns: 3, enabled: true, items: [{ id: "item-1", title: "Control", content: "Clear governance" }] },
    ],
  };
  const data = proposalPageToPuckData(page);
  assert.deepEqual(data.root.props, { format: "wide", background: "soft" });
  assert.deepEqual(puckDataToProposalBlocks(data), page.blocks.map((block) => ({ ...block, locked: false })));
});

test("Puck cannot persist calculated prices or remove governed status", () => {
  const [pricing, terms, signature] = puckDataToProposalBlocks({
    root: { props: {} },
    content: [
      { type: "pricing_table", props: { id: "pricing", title: "Investment", display: "full", locked: false, amountMinor: 1, totalMinor: 1 } },
      { type: "terms", props: { id: "terms", title: "Terms", content: "Valid for 30 days", locked: false } },
      { type: "signature", props: { id: "signature", title: "Acceptance", locked: false } },
    ],
  });
  assert.equal(pricing.locked, true);
  assert.equal(terms.locked, true);
  assert.equal(signature.locked, true);
  assert.equal("amountMinor" in pricing, false);
  assert.equal("totalMinor" in pricing, false);
});

test("Puck adapter rejects unknown components and enforces page limits", () => {
  const content = [{ type: "unsupported", props: { id: "bad" } }, ...Array.from({ length: 65 }, (_, index) => ({ type: "text", props: { id: `text-${index}`, title: `Block ${index}` } }))];
  const blocks = puckDataToProposalBlocks({ root: { props: {} }, content });
  assert.equal(blocks.length, 59);
  assert.ok(blocks.every((block) => block.type === "text"));
});
