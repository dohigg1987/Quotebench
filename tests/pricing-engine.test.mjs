import assert from "node:assert/strict";
import test from "node:test";
import { money, price } from "../packages/pricing-engine/src/index.ts";

const workshop = {
  id: "design-day",
  categoryId: "agency",
  name: "Design day",
  unitLabel: "day",
  pricingBasis: "per_unit",
  basePriceMinor: money.minor(45_000),
  costMinor: money.minor(20_000),
  recurrence: "one_off",
};

const retainer = {
  id: "social-retainer",
  categoryId: "agency",
  name: "Social retainer",
  unitLabel: "month",
  pricingBasis: "fixed",
  basePriceMinor: money.minor(120_000),
  costMinor: money.minor(60_000),
  recurrence: "monthly",
};

const ruleSet = {
  id: "agency-v1",
  version: 1,
  roundingIncrementMinor: money.minor(500),
  quoteMinimumMinor: money.minor(0),
  marginFloorBp: money.bp(3_500),
  discountCaps: { owner: money.bp(2_000), admin: money.bp(1_500), quoter: money.bp(1_000) },
  quantityBands: [{ id: "day-5-9", itemId: "design-day", fromQuantity: 5, toQuantity: 9, unitPriceMinor: money.minor(40_000), priority: 10 }],
  modifiers: [
    { id: "complex", name: "High complexity", scope: "all", triggerQuestionId: "complexity", triggerValue: "high", adjustmentKind: "percentage", adjustmentValue: 2_000, sequence: 10 },
    { id: "rush", name: "Rush", scope: "all", triggerQuestionId: "turnaround", triggerValue: "rush", adjustmentKind: "percentage", adjustmentValue: 1_500, sequence: 20 },
  ],
  minimumFees: [{ itemId: "design-day", minimumMinor: money.minor(50_000) }],
};

const baseRequest = {
  ruleSet,
  currency: "GBP",
  role: "owner",
  answers: { complexity: "high", turnaround: "rush" },
  lines: [
    { lineId: "l1", item: retainer, quantity: 1 },
    { lineId: "l2", item: workshop, quantity: 6 },
  ],
};

test("E3-R07 E3-R14 E3-R15 E3-R39: hand-calculated agency fixture", () => {
  const result = price(baseRequest);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const workshopLine = result.quote.lines.find((line) => line.lineId === "l2");
  assert.equal(workshopLine?.effectiveUnitPriceMinor, 40_000);
  assert.equal(workshopLine?.finalPriceMinor, 331_500);
  assert.deepEqual(workshopLine?.modifiersApplied.map((modifier) => modifier.name), ["High complexity", "Rush"]);
});

test("E3-R30 E3-R31 E3-R32: separates recurring and one-off values", () => {
  const result = price({ ...baseRequest, answers: {} });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.quote.oneOffSubtotalMinor, 240_000);
  assert.equal(result.quote.recurringByFrequency.monthly, 120_000);
  assert.equal(result.quote.recurringAnnualisedMinor, 1_440_000);
});

test("E3-R04 E3-R41: cost-plus rounds up to protect margin", () => {
  const item = { id: "licence", categoryId: "software", name: "Licence", unitLabel: "user", pricingBasis: "cost_plus", costMinor: money.minor(4_801), targetMarginBp: money.bp(4_000), recurrence: "monthly" };
  const result = price({ ...baseRequest, answers: {}, lines: [{ lineId: "licence", item, quantity: 1 }], ruleSet: { ...ruleSet, quantityBands: [], modifiers: [], minimumFees: [], roundingIncrementMinor: money.minor(0) } });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.quote.lines[0]?.baseUnitPriceMinor, 8_002);
});

test("E3-R22 E3-R24: combined discount cap blocks pricing", () => {
  const result = price({ ...baseRequest, role: "quoter", quoteDiscountBp: money.bp(600), lines: [{ lineId: "l2", item: workshop, quantity: 6, discountBp: money.bp(600) }] });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errors[0]?.code, "pricing.discount_cap_exceeded");
});

test("E3-N02: identical input produces byte-identical output", () => {
  assert.equal(JSON.stringify(price(baseRequest)), JSON.stringify(price(baseRequest)));
});

test("E3-R45: an empty basket is valid and explicit", () => {
  const result = price({ ...baseRequest, lines: [] });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.quote.oneOffSubtotalMinor, 0);
  assert.equal(result.quote.warnings[0]?.code, "pricing.empty_basket");
});
